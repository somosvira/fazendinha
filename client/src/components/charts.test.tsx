import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EntradaSaidaChart, serieEntradaSaida } from "./charts";

describe("EntradaSaidaChart", () => {
  it("mantém os valores exatos na alternativa acessível do gráfico", () => {
    const html = renderToStaticMarkup(<EntradaSaidaChart data={[{ data: "2026-09-01", entradas: 1_000_000, saidas: 0 }]} />);
    expect(html).toContain("Receitas: R$ 1.000.000,00");
    expect(html).toContain("Despesas: R$ 0,00");
    expect(html).toContain("recharts-responsive-container");
    expect(html).toContain('data-slot="chart"');
    expect(html).toContain("--color-receitas: var(--pos)");
    expect(html).toContain("--color-despesas: var(--neg)");
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
