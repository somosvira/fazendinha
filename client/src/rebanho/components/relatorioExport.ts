import type { ResultadoRelatorioRebanhoDTO } from "../api";
import { resolverColunas } from "./relatorioColunas";

const celula = (valor: string | number | null | undefined) => {
  if (valor == null) return "";
  return `"${String(valor).replaceAll('"', '""')}"`;
};

export function relatorioParaCsv(data: ResultadoRelatorioRebanhoDTO, ordem?: readonly string[]): string {
  const colunas = resolverColunas(data, ordem);
  const cabecalho = colunas.map((c) => c.rotulo);
  const linhas = data.linhas.map((linha) => colunas.map((c) => c.valor(linha)));
  return "﻿" + [cabecalho, ...linhas].map((linha) => linha.map(celula).join(";")).join("\r\n");
}

function nomeArquivo(data: ResultadoRelatorioRebanhoDTO, extensao: string) {
  const periodo = [data.meta.periodo.inicio, data.meta.periodo.fim].filter(Boolean).join("-a-") || new Date().toISOString().slice(0, 10);
  return `rebanho-${data.templateId}-${periodo}.${extensao}`;
}

export function baixarRelatorioCsv(data: ResultadoRelatorioRebanhoDTO, ordem?: readonly string[]) {
  const blob = new Blob([relatorioParaCsv(data, ordem)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo(data, "csv");
  a.click();
  URL.revokeObjectURL(url);
}

function criarElemento<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  texto?: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const elemento = document.createElement(tag);
  if (texto != null) elemento.textContent = texto;
  if (className) elemento.className = className;
  return elemento;
}

function textoCelula(valor: string | number | null | undefined): string {
  return valor == null || valor === "" ? "—" : String(valor);
}

function resumoRelatorio(data: ResultadoRelatorioRebanhoDTO): string {
  const partes = [data.descricao, `${data.total} ${data.total === 1 ? "linha" : "linhas"}`];
  const { inicio, fim } = data.meta.periodo;
  if (inicio || fim) partes.push(inicio && fim ? `${inicio} a ${fim}` : inicio ?? fim ?? "");
  return partes.join(" · ");
}

export function montarRelatorioParaPdf(data: ResultadoRelatorioRebanhoDTO, ordem?: readonly string[]): HTMLElement {
  const colunasVisiveis = resolverColunas(data, ordem);
  const documento = criarElemento("div", undefined, "relatorio-export-pdf");
  const cabecalho = criarElemento("header", undefined, "relatorio-pdf-cabecalho");
  cabecalho.append(
    criarElemento("p", "Rebanho · Relatório", "relatorio-pdf-eyebrow"),
    criarElemento("h1", data.titulo),
    criarElemento("p", resumoRelatorio(data), "relatorio-pdf-resumo"),
  );
  documento.append(cabecalho);

  const tabela = criarElemento("table", undefined, "relatorio-export-table");
  const colgroup = document.createElement("colgroup");
  const classesColunas = colunasVisiveis.map((c) => `relatorio-pdf-col-${c.chave.replace(/[^a-z0-9]/gi, "-")}`);
  const largura = Math.floor(100 / Math.max(1, colunasVisiveis.length));
  colunasVisiveis.forEach((_, i) => {
    const coluna = document.createElement("col");
    coluna.className = classesColunas[i] ?? "relatorio-pdf-col-dinamica";
    coluna.style.width = `${largura + (i < 100 - largura * colunasVisiveis.length ? 1 : 0)}%`;
    colgroup.append(coluna);
  });
  tabela.append(colgroup);

  const thead = document.createElement("thead");
  const linhaCabecalho = document.createElement("tr");
  colunasVisiveis.map((coluna) => coluna.rotulo)
    .forEach((rotulo) => linhaCabecalho.append(criarElemento("th", rotulo)));
  thead.append(linhaCabecalho);
  tabela.append(thead);

  const tbody = document.createElement("tbody");
  data.linhas.forEach((linha) => {
    const tr = document.createElement("tr");
    colunasVisiveis.forEach((coluna) => tr.append(criarElemento("td", textoCelula(coluna.valor(linha)), coluna.chave === "animal" ? "relatorio-pdf-animal" : coluna.chave === "data" ? "relatorio-pdf-data" : "relatorio-pdf-dinamica")));
    tbody.append(tr);
  });
  tabela.append(tbody);
  documento.append(tabela);
  return documento;
}

export async function exportarRelatorioPdf(data: ResultadoRelatorioRebanhoDTO, ordem?: readonly string[]) {
  const mod = await import("html2pdf.js");
  const documento = montarRelatorioParaPdf(data, ordem);
  // A biblioteca não publica tipagem completa do builder encadeado.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html2pdf = (mod as any).default ?? (mod as any);
  await html2pdf().set({
    margin: [9, 8, 9, 8],
    filename: nomeArquivo(data, "pdf"),
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: "#FFFFFF" },
    jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
    pagebreak: { mode: ["css", "legacy"], avoid: ["tr"] },
  }).from(documento).save();
}
