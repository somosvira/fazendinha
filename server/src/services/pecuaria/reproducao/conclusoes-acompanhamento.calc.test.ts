import { describe, expect, it } from "vitest";
import { referenciaConclusaoReprodutiva, resultadoConclusivoPorFinalidade } from "./conclusoes-acompanhamento.calc.js";

describe("conclusões de acompanhamento", () => {
  it("distingue os resultados gestacional e fetal da mesma realização", () => {
    const dg = { id: "dg", campo: "CONCLUSAO_GESTACIONAL", valor: "POSITIVO" };
    const sexo = { id: "sexo", campo: "SEXO_FETAL", valor: "F" };
    expect(resultadoConclusivoPorFinalidade("RECONFIRMACAO", [dg, sexo])).toBe(dg);
    expect(resultadoConclusivoPorFinalidade("SEXAGEM", [dg, sexo])).toBe(sexo);
  });
  it("não transforma dados ausentes ou inconclusivos em conclusão", () => {
    const resultados = [{ campo: "CONCLUSAO_GESTACIONAL", valor: "INCONCLUSIVO" }, { campo: "SEXO_FETAL", valor: null }];
    expect(resultadoConclusivoPorFinalidade("DIAGNOSTICO", resultados)).toBeUndefined();
    expect(resultadoConclusivoPorFinalidade("SEXAGEM", resultados)).toBeUndefined();
    expect(resultadoConclusivoPorFinalidade("APTIDAO_REPRODUTIVA", [{ campo: "CONCLUSAO_GESTACIONAL", valor: "NEGATIVO" }])).toBeUndefined();
  });
  it("aponta aptidão conclusiva à interpretação, independentemente do DG", () => {
    const exame = { status: "VALIDO", realizacao: "REALIZADO", resultados: [{ id: "dg", campo: "CONCLUSAO_GESTACIONAL", valor: "NEGATIVO", vigente: true }], interpretacao: { id: "interpretacao", resultadoAptidao: "APTO" } };
    expect(referenciaConclusaoReprodutiva("APTIDAO_REPRODUTIVA", exame)).toEqual({ fonte: "INTERPRETACAO", id: "interpretacao", tipo: "APTIDAO_REPRODUTIVA" });
    expect(referenciaConclusaoReprodutiva("CONCLUSAO_GESTACIONAL", exame)).toEqual({ fonte: "RESULTADO", id: "dg", tipo: "CONCLUSAO_GESTACIONAL" });
    expect(referenciaConclusaoReprodutiva("APTIDAO_REPRODUTIVA", { ...exame, status: "ANULADO" })).toBeNull();
    expect(referenciaConclusaoReprodutiva("APTIDAO_REPRODUTIVA", { ...exame, interpretacao: { id: "interpretacao", resultadoAptidao: "INCONCLUSIVO" } })).toBeNull();
  });
});
