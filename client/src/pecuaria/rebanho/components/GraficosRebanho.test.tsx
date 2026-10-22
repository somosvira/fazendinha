import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GraficoCategorias, GraficoBaixas, percentualRebanho } from "./GraficosRebanho";

describe("gráficos do rebanho", () => {
  it("formata participação sobre o total e protege total zero", () => {
    expect(percentualRebanho(5, 16)).toBe("31,3%");
    expect(percentualRebanho(0, 0)).toBe("0%");
  });
  it("reutiliza o contêiner responsivo e fornece descrições para os dois gráficos", () => {
    const dados = [{ nome: "Vaca", qtd: 5, cor: "#24493b" }];
    expect(renderToStaticMarkup(<GraficoCategorias dados={dados} total={5} />)).toContain("Composição por categoria de 5 animais ativos");
    expect(renderToStaticMarkup(<GraficoBaixas dados={dados} />)).toContain("recharts-responsive-container");
  });
});
