import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
const publicar = vi.hoisted(() => vi.fn());
vi.mock("../../../alertas/publicacao.js", () => ({ publicarAlertaTx: publicar, hashConteudo: vi.fn() }));
vi.mock("../../../../db.js", () => ({ prisma: {} }));
import { avaliarProgramacaoTx } from "./produtor.js";
const p = { id: "p", propriedadeId: 1, nome: "Fictícia", tipo: "VACINACAO", meses: [1,2], ano: null, vigenciaInicio: new Date("2030-01-01Z"), vigenciaFim: null, precisao: "MES", dia: null, recorrencia: "JANELA_ELEGIBILIDADE", produtoId: "produto", procedimento: null, publico: {}, publicoConferido: true, fonte: null, executor: "APLICACAO", tipoExameId: null, sujeitoTipo: "ANIMAL", antecedenciaDias: 0, ativo: true, revisao: 2, ativadoEm: new Date("2030-01-01Z"), regraEquivalenteId: null };
function fixture(programa: Omit<typeof p, "regraEquivalenteId"> & { regraEquivalenteId: string | null } = p) {
  const criadas = new Map<string, unknown>();
  const fake = { $executeRaw: vi.fn(), programacaoSanitaria: { findUnique: vi.fn().mockResolvedValue(programa) }, regraAlertaSanitario: { findUnique: vi.fn().mockResolvedValue({ ativo: true, propriedadeIds: [1], produtoId: "produto" }) },
    animal: { findMany: vi.fn().mockResolvedValue([{ id: "a", sexo: "F", dataNascimento: new Date("2029-01-01Z"), nascimentoEstimado: false, brinco: "FICTICIO", nome: null, localizacoes: [] }]) }, produto: { findUnique: vi.fn().mockResolvedValue({ ativo: true, usoSanitario: true, nome: "Produto fictício" }) },
    necessidadeSanitaria: { findUnique: vi.fn().mockResolvedValue({ id: "necessidade-regra", alertaId: "alerta-regra", propriedadeId: 1, situacao: "REALIZADO" }) },
    necessidadeProgramacaoSanitaria: { findUnique: vi.fn().mockImplementation(({ where }) => criadas.get(JSON.stringify(where.programacaoId_periodo_sujeitoTipo_sujeitoId)) ?? null),
      create: vi.fn().mockImplementation(({ data }) => { const n = { id: "n", ...data }; const { programacaoId, periodo, sujeitoTipo, sujeitoId } = data; criadas.set(JSON.stringify({ programacaoId, periodo, sujeitoTipo, sujeitoId }), n); return n; }), update: vi.fn() } };
  return { fake, tx: fake as unknown as Prisma.TransactionClient };
}
beforeEach(() => { publicar.mockReset(); publicar.mockResolvedValue({ alertaId: "alerta" }); });
describe("produtor temporal programado", () => {
  it("replay e troca de mês não publicam dose nova em janela de elegibilidade", async () => {
    const { tx, fake } = fixture();
    await avaliarProgramacaoTx(tx, "p", new Date("2030-01-10Z"), { tecnico: "teste" });
    await avaliarProgramacaoTx(tx, "p", new Date("2030-02-10Z"), { tecnico: "teste" });
    expect(publicar).toHaveBeenCalledTimes(1); expect(fake.necessidadeProgramacaoSanitaria.create).toHaveBeenCalledTimes(1);
    expect(publicar.mock.calls[0][1]).toMatchObject({ dataReferencia: null, prazo: null, resumo: { precisao: "MES", inicioJanela: "2030-01-01" } });
  });
  it("campanhas explícitas geram edição própria sem resolver a anterior", async () => {
    const { tx, fake } = fixture({ ...p, recorrencia: "CAMPANHA_ANUAL" });
    await avaliarProgramacaoTx(tx, "p", new Date("2030-01-10Z"), { tecnico: "teste" });
    await avaliarProgramacaoTx(tx, "p", new Date("2031-01-10Z"), { tecnico: "teste" });
    expect(fake.necessidadeProgramacaoSanitaria.create).toHaveBeenCalledTimes(2); expect(publicar).toHaveBeenCalledTimes(2);
  });
  it("equivalência explícita reutiliza alerta factual sem publicar concorrente", async () => {
    const { tx, fake } = fixture({ ...p, regraEquivalenteId: "regra" });
    await avaliarProgramacaoTx(tx, "p", new Date("2030-01-10Z"), { tecnico: "teste" });
    expect(publicar).not.toHaveBeenCalled(); expect(fake.necessidadeProgramacaoSanitaria.create).toHaveBeenCalledWith({ data: expect.objectContaining({ alertaId: "alerta-regra", regraNecessidadeId: "necessidade-regra", situacao: "REALIZADO" }) });
  });
  it("programação desativada não avalia nem publica", async () => {
    const { tx, fake } = fixture({ ...p, ativo: false });
    await avaliarProgramacaoTx(tx, "p", new Date("2030-01-10Z"), { tecnico: "teste" });
    expect(fake.animal.findMany).not.toHaveBeenCalled(); expect(publicar).not.toHaveBeenCalled();
  });
});
