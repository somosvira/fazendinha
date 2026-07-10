// @vitest-environment jsdom
/* Smoke da migração Tailwind do painel executivo do animal (InsightsPanel) +
 * Timeline. O DB de dev está vazio (0 animais), então não dá pra abrir o cockpit
 * no browser — este teste renderiza os componentes com dados sintéticos e confere
 * que o markup migrado sai íntegro (rótulos, valores, cores por tom). */
import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import {
  ScoreBadge, RentabilidadeKpi, Tendencias, Insights, Percentis,
  ProducaoFinanceira, EficienciaGauge, Projecoes, Genealogia,
} from "./InsightsPanel";
import { Timeline } from "../Timeline";

const FINANCEIRO = {
  precoLeite: 2.5, fontePreco: "config" as const,
  receitaLactacao: 12000, custoVacaDia: 10, custoVacaDiaTotalLactacao: 3000,
  custoSanidadeAnimal: 200, custosTotal: 8000, lucro: 4000, margem: 0.33,
  tom: "pos" as const,
};

describe("InsightsPanel — migração Tailwind", () => {
  it("ScoreBadge mostra estrelas cheias/vazias e o rótulo da classificação", () => {
    const html = renderToString(h(ScoreBadge, { score: { valor: 88, classificacao: "MUITO_BOA", estrelas: 4, fatores: [] } }));
    expect(html).toContain("Muito boa");
    // 4 estrelas cheias (text-leite) + 1 vazia (var(--rule))
    expect(html).toContain("text-leite");
    expect(html).toContain("var(--rule)");
    expect(html).toContain("★");
  });

  it("RentabilidadeKpi mostra lucro, receita, custos e margem", () => {
    const html = renderToString(h(RentabilidadeKpi, { f: FINANCEIRO }));
    expect(html).toContain("Rentabilidade");
    expect(html).toContain("Esta vaca paga seus custos.");
    expect(html).toContain("Receita");
    expect(html).toContain("Margem");
    // célula .rb-k migrada: border-l + first:border-l-0
    expect(html).toContain("first:border-l-0");
  });

  it("Tendencias renderiza setas coloridas por sentido", () => {
    const html = renderToString(h(Tendencias, { tendencias: [
      { chave: "prod", label: "Produção", direcao: "up", delta: "+2L", sentido: "pos" },
      { chave: "ccs", label: "CCS", direcao: "up", delta: "+50", sentido: "neg" },
    ] }));
    expect(html).toContain("Tendências");
    expect(html).toContain("Produção");
    expect(html).toContain("text-lucro"); // sentido pos
    expect(html).toContain("text-prejuizo"); // sentido neg
  });

  it("Insights mostra warn e ok com bordas coloridas", () => {
    const html = renderToString(h(Insights, { insights: [
      { tipo: "warn", titulo: "CCS alto", detalhe: "risco de mastite" },
      { tipo: "ok", titulo: "Produção estável" },
    ] }));
    expect(html).toContain("CCS alto");
    expect(html).toContain("risco de mastite");
    expect(html).toContain("Produção estável");
  });

  it("Percentis desenha as barras e o ranking", () => {
    const html = renderToString(h(Percentis, { p: {
      producao: 80, rentabilidade: 60, fertilidade: 40, ccs: 90,
      ranking: { posicao: 12, total: 100 },
    } }));
    expect(html).toContain("Comparação com o lote");
    expect(html).toContain("80º percentil");
    // SSR insere marcadores <!-- --> entre expressões JSX; conferimos os pedaços
    expect(html).toContain("em produção");
    expect(html).toContain(">12<");
    // barra de progresso
    expect(html).toContain("width:80%");
  });

  it("ProducaoFinanceira lista os KVs", () => {
    const html = renderToString(h(ProducaoFinanceira, { pf: {
      acumuladoLitros: 3000, valorRecebido: 7500, precoMedio: 2.5,
      lucroPorLitro: 0.8, receitaDiaria: 62.5, receitaMensal: 1875,
    } }));
    expect(html).toContain("Produção financeira");
    expect(html).toContain("Acumulado");
    expect(html).toContain("Lucro por litro");
  });

  it("EficienciaGauge desenha o arco e o percentual", () => {
    const html = renderToString(h(EficienciaGauge, { e: { meta: 30, atual: 27, percentual: 90 } }));
    expect(html).toContain("Eficiência");
    expect(html).toContain(">90<"); // "90%" com marcador SSR entre {e.percentual} e "%"
    expect(html).toContain("<svg");
  });

  it("Projecoes mostra datas e valores estimados", () => {
    const html = renderToString(h(Projecoes, {
      p: { producaoLactacao: 9000, receitaLactacao: 22500, lucroLactacao: 6000, dataSecagem: "2026-10-01", dataParto: "2026-12-01" },
      fontePreco: "config",
    }));
    expect(html).toContain("Projeções");
    expect(html).toContain("Data prevista de secagem");
  });

  it("Genealogia mostra mãe clicável e campos sem registro", () => {
    const html = renderToString(h(Genealogia, {
      g: { mae: { id: "m1", nome: "CATARINA", numero: "1002", producaoMediaDia: 28 }, pai: "BRUISER", avoMaterna: null, avoMaterno: null },
      onAbrirAnimal: () => {},
    }));
    expect(html).toContain("Genealogia");
    expect(html).toContain("CATARINA");
    expect(html).toContain("BRUISER");
    expect(html).toContain("sem registro");
  });
});

describe("Timeline — migração Tailwind", () => {
  it("renderiza eventos com tag por domínio, data e interpretação", () => {
    const html = renderToString(h(Timeline, {
      eventos: [
        { id: "e1", animalId: "a1", data: "2026-05-10", dominio: "reproducao", titulo: "IA com BRUISER", responsavel: "João", impacto: "R$ 0", proximoPasso: "DG em 30 dias" },
        { id: "e2", animalId: "a1", data: "2026-04-01", dominio: "sanidade", titulo: "Aplicação Mastjet", alerta: true },
      ],
      interpretacao: { "reproducao:e1": "boa janela reprodutiva" },
    }));
    expect(html).toContain("Reprodução");
    expect(html).toContain("Sanidade");
    expect(html).toContain("IA com BRUISER");
    expect(html).toContain("↑ alerta");
    expect(html).toContain("Interpretação");
    expect(html).toContain("Impacto");
    expect(html).toContain("Próximo passo");
    // tag de reprodução usa a cor café
    expect(html).toContain("text-cafe");
  });
});
