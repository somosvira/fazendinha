import { describe, expect, it } from "vitest";
import { previaDesconto } from "./composicaoCompra";
describe("prévia comercial em centavos", () => {
  it("conserva desconto e distingue logística não elegível", () => {
    expect(previaDesconto([100,200,30],[true,true,false],30)).toEqual({ valido:true, descontos:[10,20,0], liquidos:[90,180,30] });
  });
  it("distribui centavos deterministicamente e recusa total acima da base", () => {
    expect(previaDesconto([1,1,1],[true,true,true],0.05).descontos).toEqual([0.02,0.02,0.01]);
    expect(previaDesconto([0],[true],1).valido).toBe(false);
  });
});
