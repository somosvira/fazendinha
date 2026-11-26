import { describe, expect, it, vi } from "vitest";
vi.mock("../sanidade/exames.js", () => ({ registrarExameTx: vi.fn(), registrarEscoreValorPartoTx: vi.fn() }));
import { validarEscalaEscore } from "./escore-parto.js";
import { partoAmpliadoSchema } from "./partos.schemas.js";
describe("escore corporal com escala declarada", () => {
  it("admite limites explícitos sem escolher escala clínica", () => {
    expect(() => validarEscalaEscore(3.5, 1, 5)).not.toThrow();
    expect(() => validarEscalaEscore(7, 1, 9)).not.toThrow();
    expect(() => validarEscalaEscore(0, 0, 100)).not.toThrow();
  });
  it("recusa escala ausente, invertida, degenerada e valor fora dela", () => {
    for (const [valor, minimo, maximo] of [[6, 1, 5], [3, 5, 1], [1, 1, 1], [NaN, 1, 5], [3, 1, Infinity]]) expect(() => validarEscalaEscore(valor, minimo, maximo)).toThrow(/escala/);
  });
  it("criação exige REGISTRAR e nunca aceita substituição sem parto existente", () => {
    const id = "7e59821f-4c09-4e95-8d4e-699f32738c2b";
    const base = { chave: id, animalId: id, propriedadeId: 1, data: "2026-01-01", tipo: "ABORTO",observacao:"Aborto observado na fixture; causa desconhecida" };
    expect(partoAmpliadoSchema.safeParse({ ...base, escoreMatriz: { acao: "REGISTRAR", data: "2026-01-02", valor: 3, escalaMin: 1, escalaMax: 5 } }).success).toBe(true);
    expect(partoAmpliadoSchema.safeParse({ ...base, escoreMatriz: { acao: "REGISTRAR", valor: 0 } }).success).toBe(true);
    expect(partoAmpliadoSchema.safeParse({ ...base, escoreMatriz: { acao: "REGISTRAR", valor: 3, escalaMin: 1 } }).success).toBe(false);
    expect(partoAmpliadoSchema.safeParse({ ...base, escoreMatriz: { acao: "ANULAR", exameId: id, motivo: "Corrigir exame" } }).success).toBe(false);
  });
});

it("valor isolado usa a data persistida e não altera o catálogo genérico", async () => {
  const { aplicarEscorePartoTx } = await import("./escore-parto.js");
  const { registrarEscoreValorPartoTx } = await import("../sanidade/exames.js");
  const registrar = vi.mocked(registrarEscoreValorPartoTx);
  registrar.mockResolvedValue({ id: "exame", formatoSnapshot: {} } as never);
  const tx = { exameAnimal: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue({ id: "exame" }) }, auditoriaPecuaria: { create: vi.fn() } };
  const parto = { id: "parto", animalId: "matriz", propriedadeId: 1, data: new Date("2026-01-01T00:00:00Z") };
  await aplicarEscorePartoTx(tx as never, parto as never, { acao: "REGISTRAR", valor: 0 }, null);
  expect(registrar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ data: "2026-01-01", resultados: [{ campo: "ESCORE", valor: 0 }] }), null);
  expect(tx.exameAnimal.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ partoPosPartoId: "parto", finalidadePrincipal: "ESCORE_CORPORAL" }) }));
  expect(tx.auditoriaPecuaria.create).toHaveBeenCalledOnce();
});
