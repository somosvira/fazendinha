import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import {
  Section,
  SectionHead,
  KpiRow,
  KpiTile,
  ChartLegend,
  LegendItem,
  SplitBar,
  UnitCard,
  ActivityCard,
  AlertCard,
} from "./primitives";

describe("primitivas do relatório", () => {
  it("Section aplica regra inferior e aceita override de padding", () => {
    const html = renderToString(h(Section, { className: "pt-6", children: "x" }));
    expect(html).toContain("<section");
    expect(html).toContain("border-b");
    // twMerge: pt-6 do override vence o pt-9 base
    expect(html).toContain("pt-6");
    expect(html).not.toContain("pt-9");
  });

  it("SectionHead mostra numeral, título e lede", () => {
    const html = renderToString(
      h(SectionHead, { num: "I", title: "O leite paga o leite?", lede: "pergunta ancora" }),
    );
    // "§ {num}" → nós de texto adjacentes; o SSR insere um marcador entre eles
    expect(html).toContain("§ ");
    expect(html).toContain(">I<");
    expect(html).toContain("O leite paga o leite?");
    expect(html).toContain("pergunta ancora");
    expect(html).toContain("<h2");
  });

  it("KpiTile pinta valor negativo e seta conforme delta", () => {
    const html = renderToString(
      h(KpiTile, {
        label: "Fluxo",
        value: "-R$ 1,2 mi",
        negative: true,
        delta: { up: false, good: false, text: "queda", title: "t" },
        note: "nota",
      }),
    );
    expect(html).toContain("text-prejuizo");
    expect(html).toContain("▼");
    expect(html).toContain("nota");
  });

  it("KpiRow envolve as células com regras", () => {
    const html = renderToString(h(KpiRow, null, h("div", null, "cel")));
    expect(html).toContain("grid-cols-4");
    expect(html).toContain("border-y");
  });

  it("LegendItem escolhe a classe conforme o mark", () => {
    expect(renderToString(h(LegendItem, { mark: "dot", children: "Receita" }))).toContain(
      "legend-dot",
    );
    expect(renderToString(h(LegendItem, { mark: "line", children: "Fluxo" }))).toContain(
      "legend-line",
    );
    expect(renderToString(h(LegendItem, { mark: "dash", children: "Custeio" }))).toContain(
      "legend-dash",
    );
  });

  it("ChartLegend reaproveita a classe compartilhada .legend", () => {
    const html = renderToString(h(ChartLegend, null, h(LegendItem, null, "x")));
    expect(html).toContain('class="legend"');
  });

  it("SplitBar renderiza um segmento por entrada com largura da faixa", () => {
    const html = renderToString(
      h(SplitBar, {
        width: 80,
        segments: [
          { pct: 50, color: "var(--leite)" },
          { pct: 50, color: "var(--cafe)" },
        ],
      }),
    );
    expect(html).toContain("width:80%");
    expect(html).toContain("var(--leite)");
    expect(html).toContain("var(--cafe)");
  });

  it("UnitCard lista as cells e marca a positiva", () => {
    const html = renderToString(
      h(UnitCard, {
        accent: "var(--leite)",
        eyebrow: "Leite",
        headline: "sobra por litro",
        cells: [
          { label: "Custo / L", value: "R$ 3,10" },
          { label: "Margem / L", value: "+R$ 0,41", pos: true },
        ],
        caption: "base 250k L",
      }),
    );
    expect(html).toContain("Custo / L");
    expect(html).toContain("+R$ 0,41");
    expect(html).toContain("text-lucro");
    expect(html).toContain("base 250k L");
  });

  it("ActivityCard mostra receita/custeio/investimento e margem", () => {
    const html = renderToString(
      h(ActivityCard, {
        color: "var(--leite)",
        nome: "Leite",
        pctReceita: 62,
        receita: "R$ 800 mil",
        custeio: "-R$ 600 mil",
        investimento: "-R$ 100 mil",
        margemOp: -50000,
        volume: { label: "Litros", value: "250k L", subtitle: "Embaré" },
        fmt: (n: number) => `R$ ${n}`,
      }),
    );
    expect(html).toContain("Leite");
    expect(html).toContain("% da receita");
    expect(html).toContain("Margem op.");
    expect(html).toContain("250k L");
    // margem negativa → cor prejuízo
    expect(html).toContain("var(--prejuizo)");
  });

  it("AlertCard define a cor da stripe pelo tone", () => {
    const neg = renderToString(
      h(AlertCard, { tone: "neg", eyebrow: "Alerta", title: "subiu 40%", ctaText: "Ver" }),
    );
    expect(neg).toContain("var(--prejuizo)");
    expect(neg).toContain("subiu 40%");
    expect(neg).toContain("Ver");
    expect(neg).toContain("→");
    const warn = renderToString(
      h(AlertCard, { eyebrow: "Ruptura", title: "estoque baixo", ctaText: "Ver" }),
    );
    expect(warn).toContain("var(--atencao)");
  });
});
