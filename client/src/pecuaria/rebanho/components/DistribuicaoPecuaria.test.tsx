import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ComparacaoPecuaria, DistribuicaoPecuaria } from "./DistribuicaoPecuaria";

describe("distribuições operacionais", () => {
  it("mantém quantidades e percentuais fora do gráfico para leitura sem cores", () => {
    const html = renderToStaticMarkup(<DistribuicaoPecuaria titulo="Categoria" descricao="Efetivo" total={16} rotuloCentro="animais" itens={[{ id: "v", nome: "Vaca", qtd: 5 }]} />);
    expect(html).toContain("31,3%");
    expect(html).toContain("5 animais");
    expect(html).toContain("Quantidades e percentuais na lista");
  });
  it("não cria gráfico quando não há composição", () => {
    const html = renderToStaticMarkup(<DistribuicaoPecuaria titulo="Categoria" descricao="Efetivo" total={0} rotuloCentro="animais" itens={[]} />);
    expect(html).toContain("Sem dados para esta composição.");
    expect(html).not.toContain("recharts-responsive-container");
  });
  it("conserva seis casas para ingredientes pequenos na lista textual", () => {
    const html = renderToStaticMarkup(<ComparacaoPecuaria titulo="Ingrediente" descricao="Quantidade diária" unidade="KG" inteiro={false} itens={[{ id: "mineral", nome: "Mineral", qtd: 0.000001 }]} />);
    expect(html).toContain("0,000001 KG");
  });
  it("permite juntar gráficos numa superfície sem criar outro card", () => {
    const html = renderToStaticMarkup(<DistribuicaoPecuaria embutido titulo="Cobertura" descricao="Lotes" total={1} rotuloCentro="lotes" unidade="lotes" itens={[{ id: "com", nome: "Com dieta", qtd: 1 }]} />);
    expect(html).toContain('class="pec-distribuicao-embutida"');
    expect(html).toContain("<h3");
    expect(html).not.toContain('data-slot="financeiro-panel"');
    expect(html).toContain("1 lote");
  });
});
