import type { ResultadoRelatorioRebanhoDTO } from "../api";

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

export function prepararRelatorioParaPdf(elemento: HTMLElement): HTMLElement {
  const copia = elemento.cloneNode(true) as HTMLElement;
  copia.classList.add("relatorio-export-pdf");
  copia.querySelectorAll("[data-export-ignore]").forEach((node) => node.remove());
  copia.querySelectorAll<HTMLElement>(".truncate").forEach((node) => {
    node.style.whiteSpace = "normal";
    node.style.overflow = "visible";
    node.style.textOverflow = "clip";
  });
  return copia;
}

export async function exportarRelatorioPdf(elemento: HTMLElement, data: ResultadoRelatorioRebanhoDTO) {
  const mod = await import("html2pdf.js");
  const copia = prepararRelatorioParaPdf(elemento);
  // A biblioteca não publica tipagem completa do builder encadeado.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html2pdf = (mod as any).default ?? (mod as any);
  await html2pdf().set({
    margin: [9, 8, 9, 8],
    filename: nomeArquivo(data, "pdf"),
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: "#FFFFFF",
      onclone: (documento: Document) => documento.documentElement.classList.add("exportando-relatorio-pdf"),
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
    pagebreak: { mode: ["css", "legacy"], avoid: ["tr"] },
  }).from(copia).save();
}
