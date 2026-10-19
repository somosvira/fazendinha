import { describe, expect, it, vi } from "vitest";
vi.mock("../sanidade/exames.js", () => ({ registrarExameTx: vi.fn() }));
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
    expect(partoAmpliadoSchema.safeParse({ ...base, escoreMatriz: { acao: "ANULAR", exameId: id, motivo: "Corrigir exame" } }).success).toBe(false);
  });
});
