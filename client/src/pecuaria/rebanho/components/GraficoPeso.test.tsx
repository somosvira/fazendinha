import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GraficoPeso } from "./GraficoPeso";
import type { HistoricoPesagem } from "../types";

const pesagem = (id: string, data: string, pesoKg: number, tipo: HistoricoPesagem["tipo"] = "ROTINA"): HistoricoPesagem => ({
  id, data, pesoKg, tipo, origem: "MANUAL", observacao: null,
});

describe("GraficoPeso", () => {
  it("com pelo menos duas pesagens, renderiza o gráfico (smoke)", () => {
    // a ficha traz as pesagens mais recentes primeiro — o componente reordena para o gráfico
    const html = renderToStaticMarkup(<GraficoPeso historicoPesagens={[
      pesagem("p2", "2026-06-01", 320, "ROTINA"),
      pesagem("p1", "2026-01-01", 260, "ENTRADA"),
    ]} />);
    expect(html).toContain("recharts-responsive-container");
    expect(html).toContain('data-slot="chart"');
    expect(html).toContain("--color-peso: var(--cafe)");
    expect(html).toContain("Evolução do peso do animal ao longo do tempo");
  });

  it("com menos de duas pesagens, mostra o aviso em vez do gráfico", () => {
    const html = renderToStaticMarkup(<GraficoPeso historicoPesagens={[pesagem("p1", "2026-01-01", 260)]} />);
    expect(html).toContain("pelo menos duas pesagens");
    expect(html).not.toContain("recharts-responsive-container");
  });

  it("sem nenhuma pesagem, mostra o aviso", () => {
    const html = renderToStaticMarkup(<GraficoPeso historicoPesagens={[]} />);
    expect(html).toContain("pelo menos duas pesagens");
  });
});
