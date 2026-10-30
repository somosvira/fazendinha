import { describe, expect, it } from "vitest";
import { resolverClasseReprodutiva } from "./classe-reprodutiva.calc.js";
const dia = (s: string) => new Date(s);
const base = { referencia: dia("2026-10-29"), dataEntrada: dia("2025-01-01"), partosAntesDaEntrada: 0, partos: [], iniciais: [] };
const declaracao = (classeReprodutiva: string, data = "2026-01-01") => ({ id: classeReprodutiva, data: dia(data), criadoEm: dia(data), status: "VALIDO", classeReprodutiva });
const parto = { id: "p", data: dia("2026-09-01"), status: "VALIDO" };
describe("evidência explícita de classe reprodutiva", () => {
  it("zero padrão permanece desconhecido; declaração rastreável comprova novilha", () => {
    expect(resolverClasseReprodutiva(base).classe).toBe("NAO_DETERMINADA");
    expect(resolverClasseReprodutiva({ ...base, iniciais: [declaracao("NOVILHA")] }))
      .toEqual({ classe: "NOVILHA", conflito: false, evidenciaIds: ["NOVILHA"] });
  });
  it("não antecipa declaração futura nem mantém declaração anulada", () => {
    for (const inicial of [declaracao("NOVILHA", "2026-10-30"), { ...declaracao("NOVILHA"), status: "ANULADO" }])
      expect(resolverClasseReprodutiva({ ...base, iniciais: [inicial] }).classe).toBe("NAO_DETERMINADA");
  });
  it("saldo positivo e declaração de vaca comprovam classe sem inventar parto", () => {
    expect(resolverClasseReprodutiva({ ...base, partosAntesDaEntrada: 2 }).classe).toBe("VACA");
    expect(resolverClasseReprodutiva({ ...base, iniciais: [declaracao("VACA")] })).toMatchObject({ classe: "VACA", evidenciaIds: ["VACA"] });
  });
  it("parto posterior à declaração de novilha inicia sua classe de vaca na data factual", () => {
    const input = { ...base, iniciais: [declaracao("NOVILHA")], partos: [parto] };
    expect(resolverClasseReprodutiva({ ...input, referencia: dia("2026-08-31") }).classe).toBe("NOVILHA");
    expect(resolverClasseReprodutiva(input)).toEqual({ classe: "VACA", conflito: false, evidenciaIds: ["p"] });
  });
  it("nuliparidade declarada depois de parto, saldo positivo ou declaração de vaca gera conflito", () => {
    const iniciais = [declaracao("NOVILHA", "2026-10-01")];
    for (const patch of [{ partos: [parto] }, { partosAntesDaEntrada: 1 }, { iniciais: [...iniciais, declaracao("VACA")] }])
      expect(resolverClasseReprodutiva({ ...base, iniciais, ...patch })).toMatchObject({ classe: "NAO_DETERMINADA", conflito: true });
  });
  it("saldo só classifica a partir da entrada; parto futuro/anulado não é evidência", () => {
    expect(resolverClasseReprodutiva({ ...base, referencia: dia("2024-12-31"), partosAntesDaEntrada: 2 }).classe).toBe("NAO_DETERMINADA");
    expect(resolverClasseReprodutiva({ ...base, partos: [{ ...parto, status: "ANULADO" }, { ...parto, data: dia("2026-10-30") }] }).classe).toBe("NAO_DETERMINADA");
  });
});
