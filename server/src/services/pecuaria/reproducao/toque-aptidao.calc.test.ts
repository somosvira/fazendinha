import { describe, expect, it } from "vitest";
import { concluirAptidaoClinica, evidenciaDecisaoAptidaoVigente } from "./toque-aptidao.calc.js";
const data = new Date("2026-10-25");
const exame = { id: "e", animalId: "a", propriedadeId: 1, data, atualizadoEm: data, status: "VALIDO", finalidadePrincipal: "APTIDAO_REPRODUTIVA", resultadoOpcao: "APTO", retornoEm: null };
describe("aptidão clínica exige evidência própria", () => {
  it("DG negativo não comprova aptidão", () => expect(concluirAptidaoClinica([{ ...exame, finalidadePrincipal: "DIAGNOSTICO", resultadoOpcao: "NEGATIVO" }], data).estado).toBe("NAO_DETERMINADA"));
  it("inconclusivo permanece não determinado e conserva retorno", () => expect(concluirAptidaoClinica([{ ...exame, resultadoOpcao: "INCONCLUSIVO", retornoEm: new Date("2026-11-01") }], data)).toMatchObject({ estado: "NAO_DETERMINADA", retornoEm: "2026-11-01", exameId: "e" }));
  it("resultado apto não é decisão nem comprova disponibilidade operacional", () => expect(concluirAptidaoClinica([exame], data)).toMatchObject({ estado: "APTA", exameId: "e" }));
  it("correção ou anulação invalida efeito do snapshot da decisão", () => {
    const snapshot = { id: exame.id, resultado: "APTO", atualizadoEm: data.toISOString(), data: data.toISOString().slice(0,10) };
    expect(evidenciaDecisaoAptidaoVigente(exame, snapshot)).toBe(true);
    expect(evidenciaDecisaoAptidaoVigente({ ...exame, status: "ANULADO" }, snapshot)).toBe(false);
    expect(evidenciaDecisaoAptidaoVigente({ ...exame, atualizadoEm: new Date("2026-10-26") }, snapshot)).toBe(false);
  });
});
