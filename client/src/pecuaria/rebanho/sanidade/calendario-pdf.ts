import type { ConsultaProgramacoes } from "./programacoes-api";
import { MESES_SANITARIOS, publicoProgramacao } from "./programacoes-api";

/** Superfície pública do jsPDF já fornecido por html2pdf.js. */
interface PdfCalendario {
  setFont(nome: string, estilo: string): unknown;
  setFontSize(tamanho: number): unknown;
  setFillColor(r: number, g: number, b: number): unknown;
  setTextColor(r: number, g: number, b: number): unknown;
  setDrawColor(r: number, g: number, b: number): unknown;
  text(texto: string | string[], x: number, y: number, opcoes?: { align?: "center" | "right" }): unknown;
  rect(x: number, y: number, largura: number, altura: number, estilo?: string): unknown;
  splitTextToSize(texto: string, largura: number): string[];
  addPage(): unknown;
  setPage(pagina: number): unknown;
  getNumberOfPages(): number;
  save(nome: string): unknown;
}

const MARGEM = 10;
const LARGURA = 277;
const COLUNA_ATIVIDADE = 97;
const COLUNA_MES = (LARGURA - COLUNA_ATIVIDADE) / 12;
const LIMITE_CONTEUDO = 192;
const ALTURA_LINHA = 3.8;

/** Geração vetorial: não clona o DOM da aplicação nem rasteriza uma tabela de altura ilimitada. */
export async function exportarCalendarioSanitario(dados: ConsultaProgramacoes): Promise<void> {
  if (dados.mes != null || !dados.meta?.completo || dados.meta.filtros !== null) {
    throw new Error("O PDF exige a consulta anual completa do escopo autorizado");
  }
  const { default: html2pdf } = await import("html2pdf.js");
  // A API pública do worker fornece o jsPDF existente. A largura positiva mantém
  // floor(width * pageRatio) >= 1 no divisor de páginas interno da biblioteca.
  const inicial = document.createElement("canvas");
  inicial.width = 100;
  inicial.height = 1;
  const pdf: PdfCalendario = await html2pdf().set({ margin: 0, jsPDF: { unit: "mm", format: "a4", orientation: "landscape" } }).from(inicial).toPdf().get("pdf");
  // Cobre a imagem inicial; todo o conteúdo abaixo permanece texto/vetor.
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, 297, 210, "F");
  let y = MARGEM;
  function titulo() {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.setTextColor(32, 60, 57);
    pdf.text(`Agenda de Sanidade · ${dados.ano}`, MARGEM, 16);
    y = 24;
  }
  function novaPagina() { pdf.addPage(); titulo(); }
  function paragrafo(texto: string) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    const linhas = pdf.splitTextToSize(texto, LARGURA);
    for (const linha of linhas) {
      if (y + ALTURA_LINHA > LIMITE_CONTEUDO) novaPagina();
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(linha, MARGEM, y);
      y += ALTURA_LINHA;
    }
    y += 3;
  }
  function cabecalhoTabela() {
    if (y + 8 > LIMITE_CONTEUDO) novaPagina();
    pdf.setFillColor(237, 245, 243);
    pdf.setDrawColor(190, 207, 201);
    pdf.rect(MARGEM, y, LARGURA, 8, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("Atividade / público", MARGEM + 2, y + 5);
    MESES_SANITARIOS.forEach((mes, i) => pdf.text(mes.slice(0, 3), MARGEM + COLUNA_ATIVIDADE + COLUNA_MES * (i + .5), y + 5, { align: "center" }));
    y += 8;
  }
  titulo();
  paragrafo(`Calendário anual completo · ${dados.meta.sitios.map(s => s.nome).join(", ") || "Escopo autorizado"}.`);
  const programas = Array.from(new Map(dados.meses.flatMap(m => m.eventos).map(e => [e.programacaoId, e])).values());
  paragrafo(`${programas.length} atividades. As marcações representam planejamento; dia a definir permanece sem data de execução.`);
  cabecalhoTabela();
  for (const programa of programas) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    const linhas = pdf.splitTextToSize(`${programa.nome}\n${publicoProgramacao(programa)}`, COLUNA_ATIVIDADE - 4);
    // Divide inclusive um rótulo muito longo, sem cortar o texto ou uma página.
    do {
      const trecho = linhas.splice(0, 30);
      const altura = Math.max(10, trecho.length * ALTURA_LINHA + 4);
      if (y + altura > LIMITE_CONTEUDO) { novaPagina(); cabecalhoTabela(); }
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setDrawColor(190, 207, 201);
      pdf.rect(MARGEM, y, COLUNA_ATIVIDADE, altura);
      trecho.forEach((linha, i) => pdf.text(linha, MARGEM + 2, y + 4 + i * ALTURA_LINHA));
      MESES_SANITARIOS.forEach((_, i) => {
        const x = MARGEM + COLUNA_ATIVIDADE + COLUNA_MES * i;
        pdf.rect(x, y, COLUNA_MES, altura);
        if (dados.meses.find(m => m.mes === i + 1)?.eventos.some(e => e.programacaoId === programa.programacaoId)) pdf.text("X", x + COLUNA_MES / 2, y + 5, { align: "center" });
      });
      y += altura;
    } while (linhas.length);
  }
  const paginas = pdf.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina++) {
    pdf.setPage(pagina);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text("X indica mês programado; não comprova atendimento. Programações sem ano definido não fixam uma edição.", MARGEM, 200);
    pdf.text(`${pagina} / ${paginas}`, 287, 205, { align: "right" });
  }
  await pdf.save(`agenda-sanidade-${dados.ano}.pdf`);
}
