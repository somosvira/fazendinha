import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EntradaSaidaChart, pontosEntradaSaida, serieEhMensal, serieEntradaSaida } from "./charts";

describe("EntradaSaidaChart", () => {
  it("mantém os valores exatos na alternativa acessível do gráfico", () => {
    const html = renderToStaticMarkup(<EntradaSaidaChart data={[{ data: "2026-09-01", entradas: 1_000_000, saidas: 0 }]} />);
    expect(html).toContain("Receitas: R$ 1.000.000,00");
    expect(html).toContain("Despesas: R$ 0,00");
    expect(html).toContain("recharts-responsive-container");
    expect(html).toContain('data-slot="chart"');
    expect(html).toContain("--color-receitas: var(--pos)");
    expect(html).toContain("--color-despesas: var(--fin-saida, var(--cafe-2))");
  });

  it("usa totais acumulados nas linhas e valores diários nas barras", () => {
    const data = [
      { data: "2026-09-01", entradas: 100, saidas: 20 },
      { data: "2026-09-02", entradas: 0, saidas: 0 },
      { data: "2026-09-03", entradas: 50, saidas: 30 },
    ];

    expect(serieEntradaSaida(data, "line")).toEqual([
      { data: "2026-09-01", entradas: 100, saidas: 20 },
      { data: "2026-09-02", entradas: 100, saidas: 20 },
      { data: "2026-09-03", entradas: 150, saidas: 50 },
    ]);
    expect(serieEntradaSaida(data, "bar")).toBe(data);
  });

  it("expõe os totais acumulados na alternativa acessível do gráfico de linhas", () => {
    const html = renderToStaticMarkup(<EntradaSaidaChart data={[
      { data: "2026-09-01", entradas: 100, saidas: 20 },
      { data: "2026-09-02", entradas: 0, saidas: 30 },
    ]} />);

    expect(html).toContain("Totais acumulados de receitas e despesas");
    expect(html).toContain("2026-09-02 — Receitas: R$ 100,00; Despesas: R$ 50,00");
  });
});

describe("rótulos de Receitas e despesas", () => {
  const mensal = (meses: number) => Array.from({ length: meses }, (_, i) => ({ data: `2026-${String(i + 1).padStart(2, "0")}-01`, entradas: 10, saidas: 5 }));
  it.each([3, 12])("usa um rótulo de mês único por ponto em uma série mensal de %i pontos", (meses) => {
    const pontos = pontosEntradaSaida(mensal(meses), "line");
    expect(serieEhMensal(mensal(meses))).toBe(true);
    expect(new Set(pontos.map((p) => p.rotuloEixo)).size).toBe(meses);
    expect(pontos[0].rotuloEixo).toMatch(/^jan\.?\/26$/);
    expect(pontos[0].rotuloTooltip).toMatch(/^jan\.?\/26$/);
  });
  it("mantém o dia do mês no eixo e a data completa no tooltip em séries diárias", () => {
    const diaria = [1, 2, 3].map((d) => ({ data: `2026-09-0${d}`, entradas: 0, saidas: 0 }));
    const pontos = pontosEntradaSaida(diaria, "bar");
    expect(serieEhMensal(diaria)).toBe(false);
    expect(pontos.map((p) => p.rotuloEixo)).toEqual(["1", "2", "3"]);
    expect(pontos[1].rotuloTooltip).toBe("02/09/2026");
  });
  it("não confunde um único dia 1 com série mensal", () => {
    expect(serieEhMensal([{ data: "2026-09-01", entradas: 0, saidas: 0 }])).toBe(false);
  });
  it("não deixa a área do gráfico rolar, para o tooltip não gerar barra de rolagem ao passar o mouse", () => {
    const html = renderToStaticMarkup(<EntradaSaidaChart data={mensal(3)} />);
    expect(html).toContain("overflow-hidden");
    expect(html).not.toContain("overflow-x-auto");
  });
});
