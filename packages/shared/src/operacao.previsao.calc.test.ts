import { describe, expect, it } from "vitest";
import { operacaoSchema, type OperacaoValidada } from "./financeiro.schemas.js";
import { preverEfeitosOperacao, valorSaidaPelaBase, type ContextoOperacao } from "./operacao.previsao.calc.js";

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const PRODUTO_UM_CENTRO = uid(1);
const PRODUTO_DOIS_CENTROS = uid(2);
const PRODUTO_SEM_ENTRADA = uid(3);
const CENTRO_A = uid(10), CENTRO_B = uid(11), CENTRO_OP = uid(12);
const CAT_PRODUTO = uid(20), CAT_ITEM = uid(21), CAT_OP = uid(22);
const CONTA = uid(30), PARCEIRO = uid(31);

const contexto: ContextoOperacao = {
  produtos: [
    { id: PRODUTO_UM_CENTRO, categoriaId: CAT_PRODUTO, centrosCustoIds: [CENTRO_A] },
    { id: PRODUTO_DOIS_CENTROS, categoriaId: CAT_PRODUTO, centrosCustoIds: [CENTRO_A, CENTRO_B] },
    { id: PRODUTO_SEM_ENTRADA, categoriaId: null, centrosCustoIds: [] },
  ],
  categorias: [
    { id: CAT_PRODUTO, nome: "Insumos", classificacao: "CUSTEIO" },
    { id: CAT_ITEM, nome: "Máquinas", classificacao: "INVESTIMENTO" },
    { id: CAT_OP, nome: "Serviços", classificacao: "CUSTEIO" },
  ],
  centrosCusto: [{ id: CENTRO_A, nome: "Pecuária" }, { id: CENTRO_B, nome: "Agronomia" }, { id: CENTRO_OP, nome: "Sede" }],
  produtosComEstoque: [PRODUTO_UM_CENTRO, PRODUTO_DOIS_CENTROS],
  basesCusto: [
    { produtoId: PRODUTO_UM_CENTRO, quantidade: "20", valor: "120" },
    { produtoId: PRODUTO_DOIS_CENTROS, quantidade: "3", valor: "100" },
  ],
};

const TIPOS = [
  "COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "SERVICO", "VENDA", "APORTE", "RETIRADA",
  "AJUSTE_ESTOQUE", "TRANSFERENCIA_ESTOQUE", "INVENTARIO_INICIAL", "BONIFICACAO", "DEVOLUCAO", "PRODUCAO",
] as const;
const CONDICOES = ["SEM_EFEITO_FINANCEIRO", "A_VISTA", "A_PRAZO", "PARCIAL"] as const;

const MOVIMENTO: Partial<Record<(typeof TIPOS)[number], [string, string]>> = {
  COMPRA_ESTOQUE: ["ENTRADA", "COMPRA"], INVENTARIO_INICIAL: ["ENTRADA", "INVENTARIO_INICIAL"],
  BONIFICACAO: ["ENTRADA", "BONIFICACAO"], PRODUCAO: ["ENTRADA", "PRODUCAO"],
  AJUSTE_ESTOQUE: ["AJUSTE", "AJUSTE_INVENTARIO"], VENDA: ["SAIDA", "AJUSTE_INVENTARIO"], DEVOLUCAO: ["SAIDA", "DEVOLUCAO"],
};
const TRANSACAO = { VENDA: ["RECEBIMENTO", "ENTRADA"], DEVOLUCAO: ["RECEBIMENTO", "ENTRADA"], APORTE: ["APORTE", "ENTRADA"], RETIRADA: ["RETIRADA", "SAIDA"] } as Record<string, [string, string]>;

// Item 1: produto de um centro, sem centro/categoria informados (herda do produto).
// Item 2: sem produto, com centro e categoria no item.
// Item 3: produto de dois centros, centro null explícito (herda o da operação), categoria no item.
function itens() {
  return [
    { produtoId: PRODUTO_UM_CENTRO, descricao: "Ração", quantidade: 5, unidade: "sc", valorUnitario: 10 },
    { descricao: "Frete", quantidade: 1, unidade: "un", valorTotal: 30, centroCustoId: CENTRO_B, categoriaId: CAT_ITEM, classificacao: null },
    { produtoId: PRODUTO_DOIS_CENTROS, descricao: "Sal", quantidade: 3, unidade: "kg", valorTotal: 20, centroCustoId: null, categoriaId: CAT_ITEM },
  ];
}

function financeiro(condicao: (typeof CONDICOES)[number], total: number) {
  if (condicao === "SEM_EFEITO_FINANCEIRO") return { condicao };
  if (condicao === "A_VISTA") return { condicao, contaId: CONTA, formaPagamento: "PIX" };
  const parcelas = [{ id: uid(40), valor: total - 25, dataVencimento: "2026-10-01" }, { valor: 5, dataVencimento: "2026-11-01" }];
  if (condicao === "A_PRAZO") return { condicao, parcelas: [...parcelas, { valor: 20, dataVencimento: "2026-12-01" }] };
  return { condicao, contaId: CONTA, valorPago: 20, parcelas };
}

function casos() {
  const lista: { tipo: (typeof TIPOS)[number]; condicao: (typeof CONDICOES)[number]; comItens: boolean; input: OperacaoValidada }[] = [];
  for (const tipo of TIPOS) for (const condicao of CONDICOES) for (const comItens of [true, false]) {
    const total = comItens ? 100 : 80;
    const r = operacaoSchema.safeParse({
      tipo, data: "2026-09-10", descricao: "Operação de teste", parceiroId: PARCEIRO, centroCustoId: CENTRO_OP,
      categoriaId: CAT_OP, ...(comItens ? { itens: itens() } : { valorTotal: total }), financeiro: financeiro(condicao, total),
    });
    if (r.success) lista.push({ tipo, condicao, comItens, input: r.data });
  }
  return lista;
}

describe("preverEfeitosOperacao — tipo × condição financeira", () => {
  const todos = casos();

  it("cobre todos os tipos e condições que o schema aceita", () => {
    const combinacoes = new Set(todos.map((c) => `${c.tipo}/${c.condicao}`));
    for (const tipo of ["AJUSTE_ESTOQUE", "INVENTARIO_INICIAL", "BONIFICACAO", "PRODUCAO"]) {
      expect([...combinacoes].filter((c) => c.startsWith(`${tipo}/`))).toEqual([`${tipo}/SEM_EFEITO_FINANCEIRO`]);
    }
    for (const tipo of ["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "SERVICO", "VENDA", "APORTE", "RETIRADA", "TRANSFERENCIA_ESTOQUE", "DEVOLUCAO"]) {
      for (const condicao of CONDICOES) expect(combinacoes.has(`${tipo}/${condicao}`)).toBe(true);
    }
  });

  it.each(todos.map((c) => [c.tipo, c.condicao, c.comItens ? "com itens" : "sem itens", c] as const))("%s %s %s", (_t, _c, _i, { tipo, condicao, comItens, input }) => {
    const efeitos = preverEfeitosOperacao(input, contexto);
    const movimento = MOVIMENTO[tipo];
    expect(efeitos.valorTotal).toBe(comItens ? 100 : 80);
    expect(efeitos.centroCustoId).toBe(CENTRO_OP);

    if (comItens) {
      expect(efeitos.categoriaId).toBeNull();
      const [produto, avulso, doisCentros] = efeitos.itens;
      expect(efeitos.itens.map((i) => i.ordem)).toEqual([1, 2, 3]);
      expect(produto).toMatchObject({
        valorUnitario: 10, valorTotal: 50, categoriaId: CAT_PRODUTO, categoriaNome: "Insumos", classificacao: "CUSTEIO",
        centroCustoId: CENTRO_A, centroCustoNome: "Pecuária", centroCustoEfetivoId: CENTRO_A, estocavel: movimento !== undefined,
      });
      expect(avulso).toMatchObject({
        valorUnitario: 30, valorTotal: 30, categoriaId: CAT_ITEM, categoriaNome: "Máquinas", classificacao: null,
        centroCustoId: CENTRO_B, centroCustoNome: "Agronomia", centroCustoEfetivoId: CENTRO_B, estocavel: false,
      });
      expect(doisCentros).toMatchObject({
        valorUnitario: 6.6667, valorTotal: 20, categoriaId: CAT_ITEM, classificacao: "INVESTIMENTO",
        centroCustoId: null, centroCustoNome: null, centroCustoEfetivoId: CENTRO_OP, estocavel: movimento !== undefined,
      });

      if (!movimento) expect(efeitos.movimentosEstoque).toEqual([]);
      else if (movimento[0] === "SAIDA") {
        expect(efeitos.movimentosEstoque).toEqual([
          { ordemItem: 1, produtoId: PRODUTO_UM_CENTRO, tipo: "SAIDA", origem: movimento[1], quantidade: 5, custoUnitario: 6, valorTotal: 30, centroCustoId: CENTRO_A },
          { ordemItem: 3, produtoId: PRODUTO_DOIS_CENTROS, tipo: "SAIDA", origem: movimento[1], quantidade: 3, custoUnitario: 33.3333, valorTotal: 100, centroCustoId: CENTRO_OP },
        ]);
      } else {
        expect(efeitos.movimentosEstoque).toEqual([
          { ordemItem: 1, produtoId: PRODUTO_UM_CENTRO, tipo: movimento[0], origem: movimento[1], quantidade: 5, custoUnitario: 10, valorTotal: 50, centroCustoId: CENTRO_A },
          { ordemItem: 3, produtoId: PRODUTO_DOIS_CENTROS, tipo: movimento[0], origem: movimento[1], quantidade: 3, custoUnitario: 6.6667, valorTotal: 20, centroCustoId: CENTRO_OP },
        ]);
      }
    } else {
      expect(efeitos).toMatchObject({ itens: [], movimentosEstoque: [], categoriaId: CAT_OP, categoriaNome: "Serviços", classificacao: "CUSTEIO" });
    }

    const tipoCompromisso = tipo === "VENDA" || tipo === "DEVOLUCAO" ? "RECEBER" : "PAGAR";
    const total = comItens ? 100 : 80;
    if (condicao === "A_PRAZO") {
      expect(efeitos.compromissos).toEqual([
        { id: uid(40), tipo: tipoCompromisso, valorOriginal: total - 25, dataVencimento: new Date("2026-10-01"), numeroParcela: 1, totalParcelas: 3 },
        { tipo: tipoCompromisso, valorOriginal: 5, dataVencimento: new Date("2026-11-01"), numeroParcela: 2, totalParcelas: 3 },
        { tipo: tipoCompromisso, valorOriginal: 20, dataVencimento: new Date("2026-12-01"), numeroParcela: 3, totalParcelas: 3 },
      ]);
    } else if (condicao === "PARCIAL") {
      expect(efeitos.compromissos.map((c) => [c.valorOriginal, c.numeroParcela, c.totalParcelas, c.tipo])).toEqual([[total - 25, 1, 2, tipoCompromisso], [5, 2, 2, tipoCompromisso]]);
    } else {
      expect(efeitos.compromissos).toEqual([]);
    }

    const [tipoTransacao, direcao] = TRANSACAO[tipo] ?? ["PAGAMENTO", "SAIDA"];
    if (condicao === "A_VISTA") expect(efeitos.transacao).toEqual({ tipo: tipoTransacao, direcao, valor: total, contaId: CONTA, formaPagamento: "PIX" });
    else if (condicao === "PARCIAL") expect(efeitos.transacao).toEqual({ tipo: tipoTransacao, direcao, valor: 20, contaId: CONTA });
    else expect(efeitos.transacao).toBeNull();
  });
});

describe("preverEfeitosOperacao — regras de estoque e centro", () => {
  const base = { tipo: "VENDA", data: "2026-09-10", descricao: "Venda", parceiroId: PARCEIRO, financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" } };
  const prever = (dados: Record<string, unknown>, ctx: ContextoOperacao = contexto) => preverEfeitosOperacao(operacaoSchema.parse({ ...base, ...dados }), ctx);

  it("venda de produto sem entrada no sítio não baixa estoque e exige centro", () => {
    const item = { produtoId: PRODUTO_SEM_ENTRADA, descricao: "Bezerro", quantidade: 1, unidade: "un", valorTotal: 900, estocavel: true };
    expect(() => prever({ itens: [item] })).toThrow(expect.objectContaining({ campo: "itens.0.centroCustoId" }));
    const efeitos = prever({ itens: [item], centroCustoId: CENTRO_OP });
    expect(efeitos.itens[0].estocavel).toBe(false);
    expect(efeitos.movimentosEstoque).toEqual([]);
  });

  it("sem base de custo a saída vale zero", () => {
    const efeitos = prever({ itens: [{ produtoId: PRODUTO_UM_CENTRO, descricao: "Ração", quantidade: 2, unidade: "sc", valorTotal: 50 }] }, { ...contexto, basesCusto: [] });
    expect(efeitos.movimentosEstoque[0]).toMatchObject({ custoUnitario: 0, valorTotal: 0 });
  });

  it("item estocável sem produto ativo é recusado", () => {
    expect(() => prever({ tipo: "COMPRA_ESTOQUE", itens: [{ produtoId: uid(99), descricao: "Inativo", quantidade: 1, unidade: "un", valorTotal: 1 }] }))
      .toThrow("O item “Inativo” movimenta estoque e precisa apontar para um produto ativo");
    expect(() => prever({ tipo: "COMPRA_ESTOQUE", itens: [{ descricao: "Solto", quantidade: 1, unidade: "un", valorTotal: 1, estocavel: true }] }))
      .toThrow("O item “Solto” movimenta estoque e precisa apontar para um produto ativo");
  });

  it("centro e categoria inativos apontam o campo", () => {
    const item = { descricao: "Frete", quantidade: 1, unidade: "un", valorTotal: 1 };
    expect(() => prever({ tipo: "COMPRA_CONSUMO_DIRETO", centroCustoId: uid(98), itens: [item] })).toThrow(expect.objectContaining({ campo: "centroCustoId", message: "Selecione um centro de custo ativo" }));
    expect(() => prever({ tipo: "COMPRA_CONSUMO_DIRETO", itens: [{ ...item, centroCustoId: uid(98) }] })).toThrow(expect.objectContaining({ campo: "itens.0.centroCustoId" }));
    expect(() => prever({ tipo: "COMPRA_CONSUMO_DIRETO", itens: [{ ...item, centroCustoId: CENTRO_A, categoriaId: uid(97) }] })).toThrow(expect.objectContaining({ campo: "categoriaId", message: "Selecione uma categoria ativa" }));
    expect(() => prever({ tipo: "SERVICO", valorTotal: 5, centroCustoId: CENTRO_A, categoriaId: uid(97) })).toThrow(expect.objectContaining({ campo: "categoriaId" }));
  });

  it("categoria da operação é ignorada quando há itens", () => {
    const efeitos = prever({ tipo: "COMPRA_CONSUMO_DIRETO", categoriaId: uid(97), classificacao: "INVESTIMENTO", centroCustoId: CENTRO_A, itens: [{ descricao: "Frete", quantidade: 1, unidade: "un", valorTotal: 1 }] });
    expect(efeitos).toMatchObject({ categoriaId: null, categoriaNome: null, classificacao: "INVESTIMENTO" });
  });

  it("totais precisam fechar", () => {
    const item = { descricao: "Frete", quantidade: 0.335, unidade: "un", valorUnitario: 1, centroCustoId: CENTRO_A };
    expect(prever({ tipo: "COMPRA_CONSUMO_DIRETO", itens: [item, item] }).valorTotal).toBe(0.68);
    expect(() => prever({ tipo: "COMPRA_CONSUMO_DIRETO", valorTotal: 0.67, itens: [item, item] })).toThrow("O valor total informado deve corresponder à soma dos itens");
    expect(() => prever({ tipo: "SERVICO", valorTotal: 10, centroCustoId: CENTRO_A, financeiro: { condicao: "A_PRAZO", parcelas: [{ valor: 9.99, dataVencimento: "2026-10-01" }] } }))
      .toThrow("A soma das parcelas deve ser igual ao total da operação");
    expect(() => prever({ tipo: "SERVICO", valorTotal: 10, centroCustoId: CENTRO_A, financeiro: { condicao: "PARCIAL", contaId: CONTA, valorPago: 5, parcelas: [{ valor: 4, dataVencimento: "2026-10-01" }] } }))
      .toThrow("O valor pago somado às parcelas deve ser igual ao total da operação");
    expect(prever({ tipo: "SERVICO", valorTotal: 0.3, centroCustoId: CENTRO_A, financeiro: { condicao: "A_PRAZO", parcelas: [{ valor: 0.1, dataVencimento: "2026-10-01" }, { valor: 0.2, dataVencimento: "2026-11-01" }] } }).compromissos).toHaveLength(2);
  });

  it("à vista de valor zero é recusado", () => {
    expect(() => prever({ tipo: "COMPRA_CONSUMO_DIRETO", centroCustoId: CENTRO_A, itens: [{ descricao: "Brinde", quantidade: 1, unidade: "un", valorUnitario: 0 }], financeiro: { condicao: "A_VISTA", contaId: CONTA } }))
      .toThrow("valor deve ser maior que zero");
  });
});

describe("valorSaidaPelaBase", () => {
  it("usa a base inteira, sem arredondar o custo médio antes", () => {
    expect(valorSaidaPelaBase(1000, { quantidade: "20000", valor: "9" })).toEqual({ custoUnitario: 0.0005, valorTotal: 0.45 });
    expect(valorSaidaPelaBase(1, { quantidade: 0, valor: 10 })).toEqual({ custoUnitario: 0, valorTotal: 0 });
  });
});
