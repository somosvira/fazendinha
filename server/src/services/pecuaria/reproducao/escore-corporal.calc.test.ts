import { expect, it } from "vitest";
import { lerEscoreCorporal, validarResultadosEscore } from "./escore-corporal.calc.js";
it("lê números estruturados preservados como texto sem presumir escala ausente", () => {
 const exame = { id: "e", data: new Date("2026-10-01"), anotacaoOriginal: null, resultados: [{ campo: "ESCORE", valor: "3.25" }, { campo: "ESCALA_MIN", valor: "1" }, { campo: "ESCALA_MAX", valor: "5" }] };
 expect(lerEscoreCorporal(exame)).toMatchObject({ valor: 3.25, escalaMin: 1, escalaMax: 5 });
 expect(() => validarResultadosEscore(exame.resultados)).not.toThrow();
 expect(lerEscoreCorporal({ ...exame, resultados: [{ campo: "ESCORE", valor: "3" }] })).toMatchObject({ valor: 3, escalaMin: null, escalaMax: null });
 expect(lerEscoreCorporal({ ...exame, resultados: [{ campo: "ESCORE", valor: true }] }).valor).toBeNull();
});
