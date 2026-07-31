import type { ResultadoRelatorioRebanhoDTO } from "../api";
import { rotuloAnimal } from "./AnimalIdentity";

const celula = (valor: string | number | null | undefined) => {
  if (valor == null) return "";
  return `"${String(valor).replaceAll('"', '""')}"`;
};

export function relatorioParaCsv(data: ResultadoRelatorioRebanhoDTO): string {
  const cabecalho = ["Animal", "Nome", "Categoria", "Grupo", "Setor", "Data", ...data.colunas.map((c) => c.rotulo)];
  const linhas = data.linhas.map((linha) => [linha.numero, linha.nome, linha.categoria, linha.grupo, linha.setor, linha.data, ...linha.celulas]);
  return "﻿" + [cabecalho, ...linhas].map((linha) => linha.map(celula).join(";")).join("\r\n");
}

function nomeArquivo(data: ResultadoRelatorioRebanhoDTO, extensao: string) {
  const periodo = [data.meta.periodo.inicio, data.meta.periodo.fim].filter(Boolean).join("-a-") || new Date().toISOString().slice(0, 10);
  return `rebanho-${data.templateId}-${periodo}.${extensao}`;
}

export function baixarRelatorioCsv(data: ResultadoRelatorioRebanhoDTO) {
  const blob = new Blob([relatorioParaCsv(data)], { type: "text/csv;charset=utf-8" });
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

function largurasColunas(totalDinamicas: number): number[] {
  if (totalDinamicas === 0) return [40, 35, 25];
  const fixas = totalDinamicas <= 2 ? [24, 18, 12] : totalDinamicas <= 3 ? [22, 16, 11] : [18, 14, 10];
  const restante = 100 - fixas.reduce((soma, largura) => soma + largura, 0);
  const base = Math.floor(restante / totalDinamicas);
  const sobra = restante - base * totalDinamicas;
  return [...fixas, ...Array.from({ length: totalDinamicas }, (_, i) => base + (i < sobra ? 1 : 0))];
}

function resumoRelatorio(data: ResultadoRelatorioRebanhoDTO): string {
  const partes = [data.descricao, `${data.total} ${data.total === 1 ? "linha" : "linhas"}`];
  const { inicio, fim } = data.meta.periodo;
  if (inicio || fim) partes.push(inicio && fim ? `${inicio} a ${fim}` : inicio ?? fim ?? "");
  return partes.join(" · ");
}

export function montarRelatorioParaPdf(data: ResultadoRelatorioRebanhoDTO): HTMLElement {
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
  const classesColunas = ["relatorio-pdf-col-animal", "relatorio-pdf-col-grupo", "relatorio-pdf-col-data"];
  largurasColunas(data.colunas.length).forEach((largura, i) => {
    const coluna = document.createElement("col");
    coluna.className = classesColunas[i] ?? "relatorio-pdf-col-dinamica";
    coluna.style.width = `${largura}%`;
    colgroup.append(coluna);
  });
  tabela.append(colgroup);

  const thead = document.createElement("thead");
  const linhaCabecalho = document.createElement("tr");
  ["Animal", "Grupo / setor", "Data", ...data.colunas.map((coluna) => coluna.rotulo)]
    .forEach((rotulo) => linhaCabecalho.append(criarElemento("th", rotulo)));
  thead.append(linhaCabecalho);
  tabela.append(thead);

  const tbody = document.createElement("tbody");
  data.linhas.forEach((linha) => {
    const tr = document.createElement("tr");
    tr.append(
      criarElemento("td", rotuloAnimal(linha.numero, linha.nome), "relatorio-pdf-animal"),
      criarElemento("td", [linha.grupo, linha.setor].filter(Boolean).join(" · ") || "—", "relatorio-pdf-grupo"),
      criarElemento("td", textoCelula(linha.data), "relatorio-pdf-data"),
    );
    linha.celulas.forEach((valor) => tr.append(criarElemento("td", textoCelula(valor), "relatorio-pdf-dinamica")));
    tbody.append(tr);
  });
  tabela.append(tbody);
  documento.append(tabela);
  return documento;
}

export async function exportarRelatorioPdf(data: ResultadoRelatorioRebanhoDTO) {
  const mod = await import("html2pdf.js");
  const documento = montarRelatorioParaPdf(data);
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
