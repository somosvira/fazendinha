import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GraficosIngredientes } from "./GraficosIngredientes";
import { quantidadeNutricional } from "./quantidades";

describe("composição nutricional", () => {
  it("separa unidades e não interpreta quantidade ausente como medida real", () => {
    const html = renderToStaticMarkup(<GraficosIngredientes titulo="Composição" itens={[
      { id: "r", nome: "Ração", quantidade: "3.500", unidade: "KG" },
      { id: "a", nome: "Água", quantidade: "2", unidade: "L" },
    ]} />);
    expect(html).toContain("Composição · KG");
    expect(html).toContain("Composição · L");
    expect(html).toContain("3,5 KG");
    expect(html).not.toContain("R$");
  });
  it("formata quantidades e taxas sem perder a distinção entre zero e texto inválido", () => {
    expect(quantidadeNutricional("0.450")).toBe("0,45");
    expect(quantidadeNutricional("1.000000")).toBe("1");
    expect(quantidadeNutricional("0")).toBe("0");
    expect(quantidadeNutricional("desconhecido")).toBe("desconhecido");
  });
});
