import { describe, expect, it } from "vitest";
import { comporItens, type OperacaoComposicao, type SnapshotRelatorio } from "./relatorios.calc.js";
import { gerarPdfRelatorio, larguraTexto, literalPdf } from "./relatorios.pdf.js";

function operacoes(quantidade: number): OperacaoComposicao[] {
  return Array.from({ length: quantidade }, (_, i) => ({
    id: i + 1, data: new Date("2026-09-02T00:00:00Z"), tipo: "SERVICO", status: "CONFIRMADA", descricao: `Serviço (${i + 1}) de manutenção`, valorTotal: "150.00",
    centroCustoId: 1, centroCusto: { nome: "Pecuária" }, parceiro: null, categoriaId: 2, categoriaNome: "Manutenção", classificacao: "CUSTEIO", itens: [],
  }));
}

function snapshot(quantidade = 3): SnapshotRelatorio {
  return {
    versao: 1, nome: "Fechamento de setembro", geradoEm: "2026-09-14T12:00:00.000Z", autor: "Rafael Toledo", propriedade: { id: 1, nome: "Fazenda Rio Novo" },
    configuracao: { nome: "Fechamento de setembro", dataInicio: "2026-09-01", dataFim: "2026-09-30", regime: "ambos", tipos: [], status: [], centroCustoIds: [], categoriaIds: [2], classificacoes: [] },
    filtros: { tipos: [], status: [], centrosCusto: [], categorias: ["Manutenção"], classificacoes: [] },
    gerencial: {
      meta: { geradoEm: "2026-09-14T12:00:00.000Z", propriedade: { id: 1, nome: "Fazenda Rio Novo" }, periodo: { inicio: "2026-09-01", fim: "2026-09-30" }, regime: "ambos", hoje: "2026-09-14" },
      resumo: { entradas: 0, saidas: 450, resultado: -450, saldoContasFinal: 10000, nLancamentos: 3, aPagar: 0, aReceber: 0 },
      saldoContas: { contas: [{ id: 1, nome: "Banco do Brasil", banco: null, saldoInicial: 10450, entradas: 0, saidas: 450, saldoFinal: 10000 }], total: { saldoInicial: 10450, entradas: 0, saidas: 450, saldoFinal: 10000 } },
      entradasSaidas: { meses: [{ mes: "2026-09", entradas: 0, saidas: 450, resultado: -450 }], total: { entradas: 0, saidas: 450, resultado: -450 } },
      resultado: { receita: 0, custeio: 450, investimento: 0, resultado: -450, porAtividade: [] },
      compromissos: { hoje: "2026-09-14", aPagar: { total: 0, vencido: 0, aVencer: 0, quantidade: 0, itens: [] }, aReceber: { total: 0, vencido: 0, aVencer: 0, quantidade: 0, itens: [] } },
      categorias: { itens: [{ categoria: "Manutenção", total: 450, pct: 100 }], centros: [{ centro: "Pecuária", total: 450, pct: 100 }] },
      operacoes: [],
      rastreabilidade: { totalLancamentos: 3, estornados: 0, comDocumento: 1, semDocumento: 2, comNotaFiscal: 0, semNotaFiscal: 3, semCentroCusto: 0, mesesFechados: [], mesesAbertos: ["2026-09"] },
    },
    composicao: comporItens(operacoes(quantidade)),
  };
}

/** Confere que cada offset da tabela xref aponta para o objeto declarado. */
function validarEstrutura(pdf: Buffer) {
  const texto = pdf.toString("latin1");
  expect(texto.startsWith("%PDF-1.4\n")).toBe(true);
  expect(texto.trimEnd().endsWith("%%EOF")).toBe(true);
  const startxref = Number(/startxref\n(\d+)\n/.exec(texto)![1]);
  expect(texto.slice(startxref, startxref + 4)).toBe("xref");
  const [, total] = /xref\n0 (\d+)\n/.exec(texto)!;
  const entradas = texto.slice(startxref).split("\n").slice(3, 2 + Number(total));
  entradas.forEach((entrada, i) => expect(texto.slice(Number(entrada.slice(0, 10)), Number(entrada.slice(0, 10)) + 12)).toMatch(new RegExp(`^${i + 1} 0 obj`)));
  for (const [, tamanho, corpo] of texto.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)) expect(Buffer.byteLength(corpo, "latin1")).toBe(Number(tamanho));
  return texto;
}

describe("PDF do relatório financeiro", () => {
  it("escapa delimitadores e codifica acentos em WinAnsi", () => {
    expect(literalPdf("Serviço (a\\b)")).toBe("(Servi\\347o \\(a\\\\b\\))");
    expect(literalPdf("R$\u00a01,00 — ok")).toBe("(R$\\2401,00 \\227 ok)");
  });

  it("mede texto pelas larguras da Helvetica", () => {
    expect(larguraTexto("00", 10)).toBeCloseTo(11.12);
    expect(larguraTexto("é", 10)).toBeCloseTo(larguraTexto("e", 10));
    expect(larguraTexto("Total", 10, true)).toBeGreaterThan(larguraTexto("Total", 10));
  });

  it("gera um PDF válido com categorias, centros e itens", () => {
    const texto = validarEstrutura(gerarPdfRelatorio(snapshot()));
    expect(texto).toContain("(Compras e servi\\347os por categoria)");
    expect(texto).toContain("(Compras e servi\\347os por centro de custo)");
    expect(texto).toContain("(Itens das opera\\347\\365es)");
    expect(texto).toContain("(Manuten\\347\\343o)");
    expect(texto).toContain("(Saldo das contas \\(sem filtros\\))");
  });

  it("quebra páginas quando há muitos itens e numera o rodapé", () => {
    const texto = validarEstrutura(gerarPdfRelatorio(snapshot(400)));
    const paginas = Number(/\/Count (\d+)/.exec(texto)![1]);
    expect(paginas).toBeGreaterThan(5);
    expect(texto).toContain(`(P\\341gina ${paginas} de ${paginas})`);
  });
});
