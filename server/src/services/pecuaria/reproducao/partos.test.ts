import { describe, it, expect, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { partoAmpliadoSchema, correcaoPartoAmpliadaSchema } from "./partos.schemas.js";
vi.mock("../rebanho/animais.js", () => ({ registrarPesagemTx: vi.fn() }));
vi.mock("../sanidade/ocorrencias.js", () => ({ criarOcorrenciaTx: vi.fn() }));
import { normalizarDetalhesParto, aplicarRetencaoPartoTx, aplicarPesoPartoTx, corrigirPesosCriasTx } from "./partos.js";
const id = "7e59821f-4c09-4e95-8d4e-699f32738c2b";
const base = { chave: id, animalId: id, propriedadeId: 1, data: "2026-01-01", tipo: "ABORTO" };
const parto = (extra = {}) => ({ id, animalId: id, propriedadeId: 1, data: new Date("2026-01-01"), tipo: "NORMAL", desfecho: "NASCIMENTO", dificuldade: false, retencaoPlacenta: null, ocorridoEm: null, horarioEstimado: false, ...extra } as Prisma.PartoAnimalGetPayload<Record<string, never>>);
const tx = (extra = {}) => ({ ocorrenciaSanitaria: { count: vi.fn().mockResolvedValue(0) }, ...extra } as unknown as Prisma.TransactionClient);
describe("contrato e precisão do parto", () => {
  it("aceita entrada antiga e mantém desconhecidos sem inventar indução ou horário", () => {
    const input = partoAmpliadoSchema.parse(base);
    expect(normalizarDetalhesParto(input, input.data)).toMatchObject({ tipo: "ABORTO", desfecho: "ABORTO", induzido: null, dificuldade: null, ocorridoEm: null, retencaoPlacenta: null });
  });
  it("não transforma nascimento sem dificuldade informada em normal", () => {
    const input = partoAmpliadoSchema.parse({ ...base, tipo: undefined, desfecho: "NASCIMENTO" });
    expect(normalizarDetalhesParto(input, input.data)).toMatchObject({ tipo: "NASCIMENTO", dificuldade: null });
  });
  it("recusa campos desconhecidos e estimado sem horário na criação", () => {
    expect(partoAmpliadoSchema.safeParse({ ...base, colostro: true }).success).toBe(false);
    expect(partoAmpliadoSchema.safeParse({ ...base, horarioEstimado: true }).success).toBe(false);
  });
  it("confere dia de São Paulo e o instante futuro", () => {
    expect(() => normalizarDetalhesParto({ tipo: "NORMAL", ocorridoEm: "2026-01-02T01:30:00Z" }, "2026-01-01")).not.toThrow();
    expect(() => normalizarDetalhesParto({ tipo: "NORMAL", ocorridoEm: "2026-01-02T03:30:00Z" }, "2026-01-01")).toThrow(/São Paulo/);
    expect(() => normalizarDetalhesParto({ tipo: "NORMAL", ocorridoEm: "2099-01-01T12:00:00-03:00" }, "2099-01-01")).toThrow(/futuro/);
  });
  it("preserva horário estimado existente na correção parcial e exige removê-lo ao apagar horário", () => {
    const anterior = parto({ ocorridoEm: new Date("2026-01-01T12:00:00Z"), horarioEstimado: true });
    expect(normalizarDetalhesParto({}, "2026-01-01", anterior)).toMatchObject({ horarioEstimado: true, ocorridoEm: anterior.ocorridoEm });
    expect(() => normalizarDetalhesParto({ ocorridoEm: null }, "2026-01-01", anterior)).toThrow(/estimado/);
  });
  it("corrige natimorto para aborto atualizando ambos códigos e não altera natimorto por anotação", () => {
    expect(normalizarDetalhesParto({ desfecho: "ABORTO" }, "2026-01-01", parto({ tipo: "NATIMORTO" }))).toMatchObject({ tipo: "ABORTO", desfecho: "ABORTO" });
    expect(normalizarDetalhesParto({}, "2026-01-01", parto({ tipo: "NATIMORTO" }))).toMatchObject({ tipo: "NATIMORTO" });
  });
  it("recusa declarações contraditórias e aceita chave/versão na correção", () => {
    expect(() => normalizarDetalhesParto({ tipo: "ABORTO", desfecho: "NASCIMENTO" }, "2026-01-01")).toThrow(/incompatíveis/);
    expect(() => normalizarDetalhesParto({ tipo: "NORMAL", dificuldade: true }, "2026-01-01")).toThrow(/incompatíveis/);
    expect(correcaoPartoAmpliadaSchema.parse({ propriedadeId: 1, motivo: "Conferência", chave: id, versaoEsperada: 2 }).versaoEsperada).toBe(2);
  });
});
describe("vínculos atômicos do parto", () => {
  it("exige revisão explícita se RP false/null contradiz ocorrência válida", async () => {
    const db = tx({ ocorrenciaSanitaria: { count: vi.fn().mockResolvedValue(1) } });
    await expect(aplicarRetencaoPartoTx(db, parto(), {}, null)).rejects.toThrow(/Desvincule explicitamente/);
    await expect(aplicarRetencaoPartoTx(db, parto({ retencaoPlacenta: false }), { ocorrenciaRetencao: { acao: "VINCULAR", ocorrenciaId: id } }, null)).rejects.toThrow(/Sim/);
  });
  it("RP histórica true pode permanecer sem ocorrência, inclusive após tratamento encerrado", async () => {
    await expect(aplicarRetencaoPartoTx(tx(), parto({ retencaoPlacenta: true }), {}, null)).resolves.toBeUndefined();
  });
  it("recusa vincular ocorrência de outro animal sem sobrescrever o fato", async () => {
    const update = vi.fn();
    const db = tx({ ocorrenciaSanitaria: { findUnique: vi.fn().mockResolvedValue({ id, animalId: "outro", propriedadeId: 1, status: "VALIDO", inicio: new Date("2026-01-02") }), update } });
    await expect(aplicarRetencaoPartoTx(db, parto({ retencaoPlacenta: true }), { ocorrenciaRetencao: { acao: "VINCULAR", ocorrenciaId: id } }, null)).rejects.toThrow(/incompatível/);
    expect(update).not.toHaveBeenCalled();
  });
  it("peso da cria natimorta não cria animal ou pesagem", async () => {
    await expect(aplicarPesoPartoTx(tx(), parto(), { acao: "VINCULAR", pesagemId: id }, null, { id, animalId: null })).rejects.toThrow(/sem animal/);
  });
  it("recusa usar snapshot para corrigir peso de cria viva", async () => {
    const db = tx({ criaParto: { findFirst: vi.fn().mockResolvedValue({ id, animalId: id }) } });
    await expect(corrigirPesosCriasTx(db, parto(), { propriedadeId: 1, motivo: "Conferência", pesosCrias: [{ criaId: id, pesoKg: 32 }] }, null)).rejects.toThrow(/pesagem vinculada/);
  });
});
