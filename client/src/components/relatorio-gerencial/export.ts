/* Exportação do relatório gerencial: CSV (tabelas visíveis) e PDF (mesmo nó
 * da pré-visualização, via html2pdf — identidade Terrano vem do CSS `.rg-doc`). */
import { rotuloSecao, secoesVisiveis } from "./template";
import type { BlocoCompromisso, RelatorioGerencialDTO, SecaoId, TemplateRelatorio, TipoOperacao } from "./types";

export const ROTULO_REGIME: Record<RelatorioGerencialDTO["meta"]["regime"], string> = {
  realizado: "realizado",
  previsto: "previsto",
  ambos: "realizado e previsto",
};

export const ROTULO_ATIVIDADE: Record<string, string> = { leite: "Leite", cafe: "Café", outros: "Outros" };

export const ROTULO_TIPO: Record<TipoOperacao, string> = {
  receita: "Receitas",
  custeio: "Despesas de custeio",
  investimento: "Investimentos",
  transferencia: "Transferências entre contas",
  compromisso: "Compromissos em aberto",
  parcial: "Liquidações parciais",
  estorno: "Estornos",
};

export const ROTULO_MES = (mes: string) => {
  const [ano, m] = mes.split("-");
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${nomes[Number(m) - 1] ?? m}/${ano}`;
};

type Celula = string | number | null | undefined;
const numero = (n: number) => n.toFixed(2).replace(".", ",");
const celula = (v: Celula) => (v == null ? '""' : `"${(typeof v === "number" ? numero(v) : String(v)).replaceAll('"', '""')}"`);
const linha = (...cs: Celula[]) => cs.map(celula).join(";");

function tabelasDaSecao(id: SecaoId, dto: RelatorioGerencialDTO): string[][] | null {
  switch (id) {
    case "resumo": {
      const r = dto.resumo;
      const rows: string[] = [linha("Indicador", "Valor")];
      if (r.entradas != null) rows.push(linha("Entradas realizadas", r.entradas), linha("Saídas realizadas", r.saidas), linha("Resultado do período", r.resultado), linha("Saldo das contas no fim do período", r.saldoContasFinal), linha("Lançamentos realizados", String(r.nLancamentos ?? 0)));
      if (r.aPagar != null) rows.push(linha("Previsto — a pagar", r.aPagar), linha("Previsto — a receber", r.aReceber));
      return [rows];
    }
    case "saldoContas":
      return dto.saldoContas ? [[
        linha("Conta", "Banco", "Saldo inicial", "Entradas", "Saídas", "Saldo final"),
        ...dto.saldoContas.contas.map((c) => linha(c.nome, c.banco, c.saldoInicial, c.entradas, c.saidas, c.saldoFinal)),
        linha("Total", "", dto.saldoContas.total.saldoInicial, dto.saldoContas.total.entradas, dto.saldoContas.total.saidas, dto.saldoContas.total.saldoFinal),
      ]] : null;
    case "entradasSaidas":
      return dto.entradasSaidas ? [[
        linha("Mês", "Entradas", "Saídas", "Resultado"),
        ...dto.entradasSaidas.meses.map((m) => linha(ROTULO_MES(m.mes), m.entradas, m.saidas, m.resultado)),
        linha("Total", dto.entradasSaidas.total.entradas, dto.entradasSaidas.total.saidas, dto.entradasSaidas.total.resultado),
      ]] : null;
    case "resultado":
      return dto.resultado ? [[
        linha("Atividade", "Receita", "Custeio", "Investimento", "Resultado"),
        ...dto.resultado.porAtividade.map((a) => linha(ROTULO_ATIVIDADE[a.atividade] ?? a.atividade, a.receita, a.custeio, a.investimento, a.resultado)),
        linha("Total", dto.resultado.receita, dto.resultado.custeio, dto.resultado.investimento, dto.resultado.resultado),
      ]] : null;
    case "compromissos": {
      if (!dto.compromissos) return null;
      const bloco = (titulo: string, b: BlocoCompromisso) => [
        linha(titulo, "Fornecedor/cliente", "Categoria", "Vencimento", "Valor", "Situação"),
        ...b.itens.map((i) => linha(i.descricao ?? "", i.fornecedor, i.categoria, i.dataVencimento, i.valor, i.vencido ? "Vencido" : "A vencer")),
        linha("Total", "", "", "", b.total, `Vencido ${numero(b.vencido)} · A vencer ${numero(b.aVencer)}`),
      ];
      return [bloco("A pagar", dto.compromissos.aPagar), bloco("A receber", dto.compromissos.aReceber)];
    }
    case "categorias":
      return dto.categorias ? [
        [linha("Categoria", "Total", "% das saídas"), ...dto.categorias.itens.map((c) => linha(c.categoria, c.total, c.pct))],
        [linha("Centro de custo", "Total", "% das saídas"), ...dto.categorias.centros.map((c) => linha(c.centro, c.total, c.pct))],
      ] : null;
    case "operacoes":
      return [[linha("Tipo", "Quantidade", "Valor", "Entra nos totais"), ...dto.operacoes.map((o) => linha(ROTULO_TIPO[o.tipo], String(o.quantidade), o.valor, o.entraNoTotal ? "Sim" : "Não"))]];
    case "rastreabilidade": {
      const r = dto.rastreabilidade;
      return [[
        linha("Indicador", "Quantidade"),
        linha("Lançamentos no recorte", String(r.totalLancamentos)),
        linha("Estornados (fora dos totais)", String(r.estornados)),
        linha("Com número de documento", String(r.comDocumento)),
        linha("Sem número de documento", String(r.semDocumento)),
        linha("Com nota fiscal anexada", String(r.comNotaFiscal)),
        linha("Sem nota fiscal anexada", String(r.semNotaFiscal)),
        linha("Sem centro de custo (transferências)", String(r.semCentroCusto)),
        linha("Meses fechados", r.mesesFechados.join(", ") || "nenhum"),
        linha("Meses abertos", r.mesesAbertos.join(", ") || "nenhum"),
      ]];
    }
  }
}

export function relatorioGerencialParaCsv(dto: RelatorioGerencialDTO, template: TemplateRelatorio): string {
  const blocos: string[] = [linha(template.titulo, dto.meta.propriedade?.nome ?? "Consolidado", `${dto.meta.periodo.inicio} a ${dto.meta.periodo.fim}`, `Regime: ${ROTULO_REGIME[dto.meta.regime]}`)];
  if (template.subtitulo) blocos.push(linha(template.subtitulo));
  blocos.push(linha(`Gerado em ${dto.meta.geradoEm}`));
  for (const id of secoesVisiveis(template, dto.meta.regime)) {
    const tabelas = tabelasDaSecao(id, dto);
    if (!tabelas) continue;
    blocos.push("", linha(`## ${rotuloSecao(id)}`));
    tabelas.forEach((t, i) => { if (i > 0) blocos.push(""); blocos.push(...t); });
  }
  if (template.observacoes) blocos.push("", linha("Observações"), linha(template.observacoes));
  return "﻿" + blocos.join("\r\n");
}

export function nomeArquivoRelatorio(dto: RelatorioGerencialDTO, extensao: "csv" | "pdf") {
  return `relatorio-gerencial-${dto.meta.periodo.inicio}-a-${dto.meta.periodo.fim}.${extensao}`;
}

export function baixarRelatorioGerencialCsv(dto: RelatorioGerencialDTO, template: TemplateRelatorio) {
  const blob = new Blob([relatorioGerencialParaCsv(dto, template)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivoRelatorio(dto, "csv");
  a.click();
  URL.revokeObjectURL(url);
}

/** PDF a partir do MESMO nó da pré-visualização — garante que o arquivo é o que se viu. */
export async function exportarRelatorioGerencialPdf(elemento: HTMLElement, dto: RelatorioGerencialDTO) {
  const mod = await import("html2pdf.js");
  // A biblioteca não publica tipagem completa do builder encadeado.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html2pdf = (mod as any).default ?? (mod as any);
  await html2pdf().set({
    margin: [10, 10, 12, 10],
    filename: nomeArquivoRelatorio(dto, "pdf"),
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: "#F2EDE2" },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["css", "legacy"], avoid: [".rg-bloco", "tr"] },
  }).from(elemento).save();
}
