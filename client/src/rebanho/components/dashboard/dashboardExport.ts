import type { DashboardData } from "../../api";

const cel = (v: string | number | null | undefined) => {
  if (v == null) return "";
  const s = String(v).replaceAll('"', '""');
  return `"${s}"`;
};

export function dashboardParaCsv(data: DashboardData): string {
  const linhas: (string | number | null | undefined)[][] = [
    ["Painel do rebanho"],
    ["Período", data.periodo.inicio, data.periodo.fim],
    ["Gerado em", data.atualizacao.geradoEm],
    ["Dias com produção", data.atualizacao.diasComProducao, data.atualizacao.diasEsperados],
    [],
    ["Indicadores principais", "Valor", "Unidade", "Anterior", "Variação %"],
  ];
  const herois = [
    ["Vacas em lactação", data.herois.vacasEmLactacao],
    ["Produção média por vaca", data.herois.producaoMediaVaca],
    ["Produção total por dia", data.herois.producaoTotalDia],
    ["Vacas em lactação (%)", data.herois.percentualVacasLactacao],
  ] as const;
  herois.forEach(([nome, h]) => linhas.push([nome, h.valor, h.unidade, h.anterior, h.variacaoPercentual]));
  linhas.push([], ["Estado reprodutivo", "Quantidade", "%"]);
  data.estadosReprodutivos.segmentos.forEach((s) => linhas.push([s.label, s.quantidade, s.percentual]));
  for (const [grupo, itens] of Object.entries(data.indicadores)) {
    linhas.push([], [`Indicadores — ${grupo}`, "Valor", "Unidade", "Qualidade"]);
    itens.forEach((i) => linhas.push([i.label, i.valor, i.unidade, i.qualidade]));
  }
  linhas.push([], ["Alertas", "Quantidade", "Severidade", "Detalhe"]);
  data.alertas.forEach((a) => linhas.push([a.label, a.quantidade, a.severidade, a.detalhe]));
  linhas.push([], ["Grupos", "Animais", "Vacas", "Em lactação"]);
  data.grupos.forEach((g) => linhas.push([g.nome, g.animaisAtivos, g.vacas, g.emLactacao]));
  return "﻿" + linhas.map((l) => l.map(cel).join(";")).join("\r\n");
}

export function baixarDashboardCsv(data: DashboardData) {
  const blob = new Blob([dashboardParaCsv(data)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `painel-rebanho-${data.periodo.chave}-${data.periodo.fim}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
