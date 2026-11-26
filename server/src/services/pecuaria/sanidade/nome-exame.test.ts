import { describe, expect, it } from "vitest";
import { buscaNomeExameOficial, nomeExameApresentacao } from "./nome-exame.js";
describe("apresentação do exame oficial", () => {
  it.each(["ECC", "Escore corporal", "Escore de condição corporal", "condição corporal"])("encontra o oficial por %s", termo => expect(buscaNomeExameOficial(termo)).toBe(true));
  it("preserva exame personalizado", () => { expect(buscaNomeExameOficial("outro")).toBe(false); expect(nomeExameApresentacao("outro", "Escore corporal")).toBe("Escore corporal"); });
});
