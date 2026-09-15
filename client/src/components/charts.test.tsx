import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EntradaSaidaChart } from "./charts";

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
});
