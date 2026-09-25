/* PDF do relatório financeiro persistido — puro, sem dependências nem browser.
 *
 * O snapshot JSON é a fonte auditável; este arquivo é a cópia humana guardada
 * no storage. Usa as fontes padrão Helvetica/Helvetica-Bold com WinAnsiEncoding
 * (acentos do português) e quebra páginas repetindo o cabeçalho das tabelas.
 */
import type { SnapshotRelatorio } from "./relatorios.calc.js";
import { ROTULO_CLASSIFICACAO, ROTULO_STATUS, ROTULO_TIPO } from "./relatorios.calc.js";

const LARGURA_PAGINA = 595.28;
const ALTURA_PAGINA = 841.89;
const MARGEM = 40;
const AREA = LARGURA_PAGINA - MARGEM * 2;
const BASE_CONTEUDO = MARGEM + 22; // reserva o rodapé

// Larguras AFM (1/1000 em) dos caracteres 32–126.
const LARGURAS_REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  278, 278, 584, 584, 584, 556, 1015,
  667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
  278, 278, 278, 469, 556, 333,
  556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500,
  334, 260, 334, 584,
];
const LARGURAS_NEGRITO = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  333, 333, 584, 584, 584, 611, 975,
  722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
  333, 278, 333, 584, 556, 333,
  556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500,
  389, 280, 389, 584,
];
const WIN_ANSI_EXTRA: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97,
  "\u202f": 0x20, "\u2009": 0x20, "\u2007": 0x20,
};
const LARGURA_EXTRA: Record<number, number> = { 0x80: 556, 0x85: 1000, 0x95: 350, 0x96: 556, 0x97: 1000, 0xa0: 278 };

function codigoWinAnsi(caractere: string): number {
  const c = caractere.codePointAt(0)!;
  if (c < 32) return 0x20;
  if (c <= 126 || (c >= 0xa0 && c <= 0xff)) return c;
  return WIN_ANSI_EXTRA[caractere] ?? 0x3f;
}

/** String literal PDF só com ASCII: bytes altos viram escape octal. */
export function literalPdf(texto: string): string {
  let saida = "";
  for (const caractere of texto) {
    const c = codigoWinAnsi(caractere);
    if (c === 0x28 || c === 0x29 || c === 0x5c) saida += `\\${String.fromCharCode(c)}`;
    else if (c < 128) saida += String.fromCharCode(c);
    else saida += `\\${c.toString(8).padStart(3, "0")}`;
  }
  return `(${saida})`;
}

export function larguraTexto(texto: string, tamanho: number, negrito = false): number {
  const tabela = negrito ? LARGURAS_NEGRITO : LARGURAS_REGULAR;
  let soma = 0;
  for (const caractere of texto) {
    const c = codigoWinAnsi(caractere);
    if (c >= 32 && c <= 126) { soma += tabela[c - 32]; continue; }
    const base = caractere.normalize("NFD").codePointAt(0)!;
    soma += base >= 32 && base <= 126 ? tabela[base - 32] : LARGURA_EXTRA[c] ?? 556;
  }
  return (soma * tamanho) / 1000;
}

function caber(texto: string, largura: number, tamanho: number, negrito = false): string {
  if (larguraTexto(texto, tamanho, negrito) <= largura) return texto;
  const caracteres = [...texto];
  while (caracteres.length && larguraTexto(`${caracteres.join("")}…`, tamanho, negrito) > largura) caracteres.pop();
  return `${caracteres.join("").trimEnd()}…`;
}

function quebrar(texto: string, largura: number, tamanho: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(/\s+/).filter(Boolean)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (larguraTexto(tentativa, tamanho) <= largura || !atual) atual = tentativa;
    else { linhas.push(atual); atual = palavra; }
  }
  if (atual) linhas.push(atual);
  return linhas.map((linha) => caber(linha, largura, tamanho));
}

const n = (v: number) => Number(v.toFixed(2));

export interface ColunaPdf { titulo: string; largura: number; alinhamento?: "esquerda" | "direita" }

/** Documento de texto com cursor vertical e quebra automática de página. */
export class DocumentoPdf {
  private paginas: string[][] = [];
  private y = 0;

  constructor() { this.novaPagina(); }

  private get ops() { return this.paginas[this.paginas.length - 1]; }

  private novaPagina() { this.paginas.push([]); this.y = ALTURA_PAGINA - MARGEM; }

  private garantir(altura: number) { if (this.y - altura < BASE_CONTEUDO) this.novaPagina(); }

  private escrever(texto: string, x: number, y: number, tamanho: number, negrito = false, cinza = 0) {
    this.ops.push(`BT ${cinza.toFixed(2)} g /${negrito ? "F2" : "F1"} ${tamanho} Tf ${n(x)} ${n(y)} Td ${literalPdf(texto)} Tj ET`);
  }

  private linha(x1: number, y: number, x2: number, cinza = 0.8) {
    this.ops.push(`${cinza.toFixed(2)} G 0.5 w ${n(x1)} ${n(y)} m ${n(x2)} ${n(y)} l S`);
  }

  private faixa(y: number, altura: number, cinza = 0.94) {
    this.ops.push(`${cinza.toFixed(2)} g ${MARGEM} ${n(y)} ${AREA} ${n(altura)} re f`);
  }

  espaco(altura: number) { this.y -= altura; }

  titulo(texto: string) {
    this.garantir(28);
    this.y -= 20;
    for (const linha of quebrar(texto, AREA, 18).slice(0, 2)) { this.escrever(linha, MARGEM, this.y, 18, true); this.y -= 22; }
  }

  secao(texto: string) {
    this.garantir(40); // não deixa título órfão no pé da página
    this.y -= 18;
    this.escrever(texto, MARGEM, this.y, 11, true);
    this.y -= 5;
    this.linha(MARGEM, this.y, MARGEM + AREA, 0.55);
    this.y -= 4;
  }

  paragrafo(texto: string, tamanho = 8.5, cinza = 0.3) {
    for (const linha of quebrar(texto, AREA, tamanho)) {
      this.garantir(tamanho * 1.5);
      this.y -= tamanho * 1.45;
      this.escrever(linha, MARGEM, this.y, tamanho, false, cinza);
    }
  }

  pares(itens: [string, string][], tamanho = 8.5) {
    const larguraRotulo = Math.min(220, Math.max(...itens.map(([rotulo]) => larguraTexto(rotulo, tamanho, true))) + 12);
    for (const [rotulo, valor] of itens) {
      const linhas = quebrar(valor, AREA - larguraRotulo, tamanho);
      this.garantir(tamanho * 1.5 * Math.min(linhas.length, 3));
      this.y -= tamanho * 1.5;
      this.escrever(caber(rotulo, larguraRotulo - 6, tamanho, true), MARGEM, this.y, tamanho, true);
      linhas.forEach((linha, i) => {
        if (i) { this.garantir(tamanho * 1.35); this.y -= tamanho * 1.35; }
        this.escrever(linha, MARGEM + larguraRotulo, this.y, tamanho);
      });
    }
  }

  tabela(colunas: ColunaPdf[], linhas: string[][], opcoes: { tamanho?: number; rodape?: string[]; vazio?: string } = {}) {
    const tamanho = opcoes.tamanho ?? 8;
    const altura = tamanho * 1.7;
    const escala = AREA / colunas.reduce((soma, coluna) => soma + coluna.largura, 0);
    const larguras = colunas.map((coluna) => coluna.largura * escala);
    const celulas = (valores: string[], negrito: boolean) => {
      let x = MARGEM;
      valores.forEach((valor, i) => {
        const disponivel = larguras[i] - 6;
        const texto = caber(valor ?? "", disponivel, tamanho, negrito);
        const deslocamento = colunas[i].alinhamento === "direita" ? disponivel - larguraTexto(texto, tamanho, negrito) : 0;
        this.escrever(texto, x + 3 + deslocamento, this.y + tamanho * 0.5, tamanho, negrito, negrito ? 0.15 : 0);
        x += larguras[i];
      });
    };
    const cabecalho = () => {
      this.garantir(altura * 2);
      this.y -= altura;
      this.faixa(this.y, altura);
      celulas(colunas.map((coluna) => coluna.titulo), true);
    };
    this.y -= 4; // respiro entre o texto anterior e a faixa do cabeçalho
    cabecalho();
    if (!linhas.length) { this.paragrafo(opcoes.vazio ?? "Nenhum registro no recorte.", tamanho, 0.45); return; }
    for (const valores of linhas) {
      if (this.y - altura < BASE_CONTEUDO) { this.novaPagina(); cabecalho(); }
      this.y -= altura;
      celulas(valores, false);
      this.linha(MARGEM, this.y, MARGEM + AREA, 0.9);
    }
    if (opcoes.rodape) {
      this.garantir(altura);
      this.y -= altura;
      celulas(opcoes.rodape, true);
      this.linha(MARGEM, this.y, MARGEM + AREA, 0.55);
    }
  }

  gerar(rodape: string): Buffer {
    const total = this.paginas.length;
    const conteudos = this.paginas.map((ops, i) => {
      const direita = `Página ${i + 1} de ${total}`;
      const pe = [
        `0.80 G 0.5 w ${MARGEM} ${MARGEM + 12} m ${MARGEM + AREA} ${MARGEM + 12} l S`,
        `BT 0.45 g /F1 7 Tf ${MARGEM} ${MARGEM} Td ${literalPdf(caber(rodape, AREA - 90, 7))} Tj ET`,
        `BT 0.45 g /F1 7 Tf ${n(MARGEM + AREA - larguraTexto(direita, 7))} ${MARGEM} Td ${literalPdf(direita)} Tj ET`,
      ];
      return [...ops, ...pe].join("\n");
    });
    // 1 catálogo, 2 árvore de páginas, 3–4 fontes, depois (página, conteúdo) por página.
    const idsPaginas = conteudos.map((_, i) => 5 + i * 2);
    const objetos = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      `<< /Type /Pages /Kids [${idsPaginas.map((id) => `${id} 0 R`).join(" ")}] /Count ${total} >>`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
      ...conteudos.flatMap((conteudo, i) => [
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${LARGURA_PAGINA} ${ALTURA_PAGINA}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${idsPaginas[i] + 1} 0 R >>`,
        `<< /Length ${Buffer.byteLength(conteudo, "latin1")} >>\nstream\n${conteudo}\nendstream`,
      ]),
    ];
    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [];
    objetos.forEach((objeto, i) => { offsets.push(Buffer.byteLength(pdf, "latin1")); pdf += `${i + 1} 0 obj\n${objeto}\nendobj\n`; });
    const xref = Buffer.byteLength(pdf, "latin1");
    pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
    pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(pdf, "latin1");
  }
}

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dinheiro = (valor: number | string | null | undefined) => moeda.format(Number(valor ?? 0));
const percentual = (valor: number) => `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const data = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const dataHora = (iso: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
const lista = (itens: string[]) => itens.length ? itens.join(", ") : "Todos";
const REGIME: Record<string, string> = { ambos: "Realizado + compromissos em aberto", realizado: "Somente realizado (caixa)", previsto: "Somente compromissos em aberto" };

export function gerarPdfRelatorio(snapshot: SnapshotRelatorio): Buffer {
  const { gerencial: g, composicao: c, filtros, configuracao } = snapshot;
  const filtrado = [filtros.tipos, filtros.status, filtros.centrosCusto, filtros.parceiros ?? [], filtros.categorias, filtros.classificacoes].some((itens) => itens.length > 0);
  const doc = new DocumentoPdf();

  doc.titulo(snapshot.nome);
  doc.paragrafo(`${snapshot.propriedade?.nome ?? "Todas as propriedades"} · ${data(configuracao.dataInicio)} a ${data(configuracao.dataFim)} · ${REGIME[configuracao.regime]}`, 9, 0.2);
  doc.paragrafo(`Gerado em ${dataHora(snapshot.geradoEm)} por ${snapshot.autor}. Valores extraídos das operações, compromissos e movimentos registrados até a emissão.`, 8, 0.45);

  doc.secao("Filtros aplicados");
  doc.pares([
    ["Tipos de operação", lista(filtros.tipos)],
    ["Situação (operações e itens)", lista(filtros.status)],
    ["Centros de custo", lista(filtros.centrosCusto)],
    ["Parceiros", lista(filtros.parceiros ?? [])],
    ["Categorias", lista(filtros.categorias)],
    ["Classificação", lista(filtros.classificacoes)],
  ]);

  doc.secao("Resumo");
  const resumo: [string, string][] = [["Compras e serviços (competência)", dinheiro(c.despesas.total)]];
  if (g.resumo.entradas != null) resumo.push(["Entradas realizadas", dinheiro(g.resumo.entradas)], ["Saídas realizadas", dinheiro(g.resumo.saidas)], ["Resultado do caixa", dinheiro(g.resumo.resultado)]);
  if (g.resumo.aPagar != null) resumo.push(["A pagar em aberto", dinheiro(g.resumo.aPagar)], ["A receber em aberto", dinheiro(g.resumo.aReceber)]);
  if (g.resumo.saldoContasFinal != null) resumo.push([filtrado ? "Saldo final das contas (sem filtros)" : "Saldo final das contas", dinheiro(g.resumo.saldoContasFinal)]);
  doc.pares(resumo);

  doc.secao("Compras e serviços por categoria");
  doc.paragrafo("Itens de compras e serviços confirmados, pela data da operação. Cada item conta na própria categoria.", 7.5, 0.45);
  doc.tabela(
    [{ titulo: "Categoria", largura: 170 }, { titulo: "Custeio", largura: 70, alinhamento: "direita" }, { titulo: "Investimento", largura: 70, alinhamento: "direita" }, { titulo: "Não classif.", largura: 70, alinhamento: "direita" }, { titulo: "Total", largura: 75, alinhamento: "direita" }, { titulo: "%", largura: 45, alinhamento: "direita" }],
    c.despesas.porCategoria.map((item) => [item.nome, dinheiro(item.custeio), dinheiro(item.investimento), dinheiro(item.semClassificacao), dinheiro(item.total), percentual(item.pct)]),
    { rodape: ["Total", dinheiro(c.despesas.custeio), dinheiro(c.despesas.investimento), dinheiro(c.despesas.semClassificacao), dinheiro(c.despesas.total), c.despesas.porCategoria.length ? "100%" : ""] },
  );

  doc.secao("Compras e serviços por centro de custo");
  doc.tabela(
    [{ titulo: "Centro de custo", largura: 330 }, { titulo: "Total", largura: 110, alinhamento: "direita" }, { titulo: "%", largura: 60, alinhamento: "direita" }],
    c.despesas.porCentro.map((item) => [item.nome, dinheiro(item.total), percentual(item.pct)]),
  );

  if (g.categorias) {
    doc.secao("Pagamentos por categoria");
    doc.paragrafo("Saídas de caixa no período, rateadas entre as categorias dos itens de cada operação. Estornos reduzem a categoria original.", 7.5, 0.45);
    doc.tabela(
      [{ titulo: "Categoria", largura: 330 }, { titulo: "Total", largura: 110, alinhamento: "direita" }, { titulo: "% das saídas", largura: 60, alinhamento: "direita" }],
      g.categorias.itens.map((item) => [item.categoria, dinheiro(item.total), percentual(item.pct)]),
    );
    doc.secao("Pagamentos por centro de custo");
    doc.tabela(
      [{ titulo: "Centro de custo", largura: 330 }, { titulo: "Total", largura: 110, alinhamento: "direita" }, { titulo: "% das saídas", largura: 60, alinhamento: "direita" }],
      g.categorias.centros.map((item) => [item.centro, dinheiro(item.total), percentual(item.pct)]),
    );
  }

  if (g.resultado) {
    doc.secao("Resultado do caixa por natureza");
    doc.pares([["Receitas", dinheiro(g.resultado.receita)], ["Custeio", dinheiro(g.resultado.custeio)], ["Investimento", dinheiro(g.resultado.investimento)], ["Resultado", dinheiro(g.resultado.resultado)]]);
  }

  doc.secao("Operações confirmadas por tipo");
  doc.tabela(
    [{ titulo: "Tipo", largura: 300 }, { titulo: "Operações", largura: 80, alinhamento: "direita" }, { titulo: "Total", largura: 120, alinhamento: "direita" }],
    c.porTipo.map((item) => [item.rotulo, String(item.operacoes), dinheiro(item.total)]),
  );

  if (g.compromissos) {
    for (const [titulo, bloco] of [["Compromissos a pagar em aberto", g.compromissos.aPagar], ["Compromissos a receber em aberto", g.compromissos.aReceber]] as const) {
      doc.secao(titulo);
      doc.paragrafo(`${bloco.quantidade} compromisso(s) · vencido ${dinheiro(bloco.vencido)} · a vencer ${dinheiro(bloco.aVencer)}.`, 8, 0.3);
      doc.tabela(
        [{ titulo: "Vencimento", largura: 60 }, { titulo: "Descrição", largura: 170 }, { titulo: "Parceiro", largura: 95 }, { titulo: "Categoria", largura: 90 }, { titulo: "Valor", largura: 75, alinhamento: "direita" }],
        bloco.itens.map((item) => [data(item.dataVencimento), item.descricao ?? "—", item.fornecedor ?? "—", item.categoria, dinheiro(item.valor)]),
        { tamanho: 7.5, rodape: ["Total", "", "", "", dinheiro(bloco.total)] },
      );
    }
  }

  if (g.saldoContas) {
    doc.secao(filtrado ? "Saldo das contas (sem filtros)" : "Saldo das contas");
    doc.paragrafo("Saldo histórico de todas as contas da fazenda, inclusive inativas e fora do saldo geral. A disponibilidade atual da visão geral considera somente contas ativas incluídas nesse total.");
    doc.tabela(
      [{ titulo: "Conta", largura: 150 }, { titulo: "Saldo inicial", largura: 85, alinhamento: "direita" }, { titulo: "Entradas", largura: 85, alinhamento: "direita" }, { titulo: "Saídas", largura: 85, alinhamento: "direita" }, { titulo: "Saldo final", largura: 95, alinhamento: "direita" }],
      g.saldoContas.contas.map((conta) => [conta.nome, dinheiro(conta.saldoInicial), dinheiro(conta.entradas), dinheiro(conta.saidas), dinheiro(conta.saldoFinal)]),
      { rodape: ["Total", dinheiro(g.saldoContas.total.saldoInicial), dinheiro(g.saldoContas.total.entradas), dinheiro(g.saldoContas.total.saidas), dinheiro(g.saldoContas.total.saldoFinal)] },
    );
  }

  doc.secao("Itens das operações");
  doc.paragrafo(c.truncado
    ? `Exibindo as primeiras ${c.linhas.length} de ${c.totalLinhas} linhas. Os totais acima consideram todas as linhas.`
    : `${c.totalLinhas} linha(s), uma por item de operação no recorte.`, 7.5, 0.45);
  doc.tabela(
    [{ titulo: "Data", largura: 46 }, { titulo: "Tipo", largura: 74 }, { titulo: "Operação / item", largura: 113 }, { titulo: "Qtd.", largura: 42, alinhamento: "direita" }, { titulo: "Categoria", largura: 72 }, { titulo: "Centro", largura: 57 }, { titulo: "Classif.", largura: 52 }, { titulo: "Valor", largura: 54, alinhamento: "direita" }],
    c.linhas.map((linha) => [
      data(linha.data),
      `${ROTULO_TIPO[linha.tipo] ?? linha.tipo}${linha.status === "CONFIRMADA" ? "" : ` (${ROTULO_STATUS[linha.status] ?? linha.status})`}`,
      [`OP-${String(linha.operacaoNumero).padStart(4, "0")}`, linha.item ?? linha.descricao].filter(Boolean).join(" · "),
      linha.quantidade ? `${linha.quantidade}${linha.unidade ? ` ${linha.unidade}` : ""}` : "—",
      linha.categoria, linha.centroCusto,
      linha.classificacao ? ROTULO_CLASSIFICACAO[linha.classificacao] : "—",
      dinheiro(linha.valor),
    ]),
    { tamanho: 7 },
  );

  doc.secao("Rastreabilidade");
  const r = g.rastreabilidade;
  doc.pares([
    ["Lançamentos no recorte", `${r.totalLancamentos} ativos · ${r.estornados} estornados`],
    ["Com documento", `${r.comDocumento} · sem documento: ${r.semDocumento}`],
    ["Com nota fiscal", `${r.comNotaFiscal} · sem nota fiscal: ${r.semNotaFiscal}`],
    ["Meses fechados", r.mesesFechados.length ? r.mesesFechados.map((mes) => mes.split("-").reverse().join("/")).join(", ") : "Nenhum"],
    ["Meses abertos", r.mesesAbertos.length ? r.mesesAbertos.map((mes) => mes.split("-").reverse().join("/")).join(", ") : "Nenhum"],
  ]);

  return doc.gerar(`${snapshot.nome} · ${snapshot.propriedade?.nome ?? "Todas as propriedades"}`);
}
