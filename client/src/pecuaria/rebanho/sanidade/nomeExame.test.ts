import { describe, expect, it } from "vitest";
import { camposExameParaExibicao, nomeExame } from "./nomeExame";

describe("nome de apresentação do exame", () => {
  it("identifica o ECC pelo tipo de sistema sem alterar nomes próprios", () => {
    expect(nomeExame("b0841f3c-3f88-4c2d-9d0d-3ef33d49b841", "Escore corporal")).toBe("Escore de condição corporal (ECC)");
    expect(nomeExame("personalizado", "Escore corporal")).toBe("Escore corporal");
    const campos = [{ codigo: "ESCORE", rotulo: "Escore original" }];
    expect(camposExameParaExibicao("b0841f3c-3f88-4c2d-9d0d-3ef33d49b841", campos)[0].rotulo).toBe("Escore de condição corporal (ECC)");
    expect(campos[0].rotulo).toBe("Escore original");
    expect(camposExameParaExibicao("personalizado", campos)).toEqual(campos);
  });
});
