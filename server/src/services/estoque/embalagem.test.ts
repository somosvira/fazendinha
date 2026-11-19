import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { interpretarEmbalagem, quantidadeDaEmbalagem } from "./embalagem.js";

describe("conteúdo das embalagens", () => {
  it("converte apresentação completa para unidade de consumo", () => {
    expect(interpretarEmbalagem("Frasco 100 ml")).toMatchObject({ unidade: "ML", conteudo: new Prisma.Decimal(100) });
    expect(interpretarEmbalagem("Balde 1,5 kg")?.conteudo.toString()).toBe("1500");
    expect(interpretarEmbalagem("Frasco 5 doses")?.unidade).toBe("DOSE");
  });
  it("deixa concentrações, kits e apresentações incompletas para conferência", () => {
    for (const texto of [null, "100 mg/ml", "Frasco 100 ml + diluente 10 ml", "Caixa 10 frascos", "Frasco 0 ml"])
      expect(interpretarEmbalagem(texto)).toBeNull();
  });
  it("converte quantidade de compra e protege precisão", () => {
    expect(quantidadeDaEmbalagem(new Prisma.Decimal(2), 100).toString()).toBe("200");
    expect(() => quantidadeDaEmbalagem(new Prisma.Decimal("0.5"), 100)).toThrow("inteira");
    expect(() => quantidadeDaEmbalagem(new Prisma.Decimal(999999999), 100)).toThrow("precisão");
  });
});
