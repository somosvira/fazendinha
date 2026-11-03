import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GraficoPeso, prepararPontosPeso } from "./GraficoPeso";
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
    expect(html).toContain("Ainda não há pesagens deste animal");
    expect(html).toContain('role="status"');
    expect(html).toContain("pelo menos duas pesagens");
  });

  it("recorta a curva na janela do período e avisa quando sobram menos de duas pesagens", () => {
    const historico = [
      pesagem("p3", "2026-09-10", 262),
      pesagem("p2", "2026-05-10", 210),
      pesagem("p1", "2025-05-01", 34, "ENTRADA"),
    ];
    const noPeriodo = renderToStaticMarkup(<GraficoPeso historicoPesagens={historico} desde="2026-03-30" ate="2026-09-26" />);
    expect(noPeriodo).toContain("recharts-responsive-container");
    const curto = renderToStaticMarkup(<GraficoPeso historicoPesagens={historico} desde="2026-08-27" ate="2026-09-26" />);
    expect(curto).toContain("Menos de duas pesagens neste período");
    expect(curto).not.toContain("recharts-responsive-container");
  });
});

it("separa séries e interrompe a curva medida nos pesos de precisão/contexto diferentes", () => {
  const dados = prepararPontosPeso([
    { ...pesagem("p4", "2026-04-01", 330), precisao: "MEDIDO", contextoHistorico: "INTERNO" },
    { ...pesagem("p3", "2026-03-01", 320), precisao: "MEDIDO", contextoHistorico: "EXTERNO" },
    { ...pesagem("p2", "2026-02-01", 310), precisao: "ESTIMADO", contextoHistorico: "INTERNO" },
    { ...pesagem("p1", "2026-01-01", 300), precisao: "MEDIDO", contextoHistorico: "INTERNO" },
    pesagem("p0", "2025-12-01", 290),
  ]);
  expect(dados.map(p => [p.pesoMedido, p.pesoSemPrecisao, p.pesoHistorico])).toEqual([
    [null, 290, null], [300, null, null], [null, null, 310], [null, null, 320], [330, null, null],
  ]);
  expect(dados[2]).toMatchObject({ precisao: "ESTIMADO", contextoHistorico: "INTERNO", origem: "MANUAL" });
  expect(dados[3]).toMatchObject({ precisao: "MEDIDO", contextoHistorico: "EXTERNO" });
});
it("apresenta legenda que distingue medida, precisão desconhecida e pontos históricos", () => {
  const html = renderToStaticMarkup(<GraficoPeso historicoPesagens={[
    { ...pesagem("p3", "2026-03-01", 320), precisao: "MEDIDO", contextoHistorico: "INTERNO" },
    { ...pesagem("p2", "2026-02-01", 310), precisao: "INFORMADO", contextoHistorico: "INTERNO" },
    pesagem("p1", "2026-01-01", 300),
  ]} />);
  expect(html).toContain("Medido");
  expect(html).toContain("Precisão não informada");
  expect(html).toContain("Estimado, informado ou externo");
});
