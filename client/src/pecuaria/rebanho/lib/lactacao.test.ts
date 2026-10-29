import { expect, it } from "vitest";
import { rotuloLactacao } from "./lactacao";

it.each([["LACTANTE", "Lactante"], ["SECA", "Seca"], ["SEM_LACTACAO", "Não informada"], ["NAO_INFORMADA", "Não informada"], [undefined, "Não informada"]])("situação %s apresenta %s sem afirmar secagem", (situacao, esperado) => {
  expect(rotuloLactacao(situacao)).toBe(esperado);
});
