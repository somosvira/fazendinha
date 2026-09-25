import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { classificarFluxo, ratearCategorias, ratearCompromissos, type OperacaoComFluxo } from "./classificacao.js";
import { uid } from "../../lib/uid.fixture.js";

const d = (v: number) => new Prisma.Decimal(v);
const valores = (partes: ReturnType<typeof ratearCategorias>) => partes.map((p) => p.valor.toNumber());
const categorias = (partes: ReturnType<typeof ratearCategorias>) => partes.map((p) => [p.categoriaNome, p.valor.toNumber()]);

// Os uuids são escolhidos em ordem lexical OPOSTA à de `ordem`/`seq`
// (ordem 1 → uid(9), ordem 3 → uid(7)): ordenar pelo id em vez da coluna de
// ordem inverte o resultado e quebra os testes.
const idItem = (ordem: number) => uid(10 - ordem);
const idTransacao = (seq: number) => uid(100 - seq);
const idCompromisso = (seq: number) => uid(200 - seq);

// Três itens com o mesmo peso: o centavo que sobra do rateio vai para o item
// de menor `ordem`. Array embaralhado precisa dar o mesmo resultado do ordenado.
const itensPesoIgual = (ordens: number[]) => ordens.map((ordem) => ({
  id: idItem(ordem), ordem, categoriaId: uid(300 + ordem), categoriaNome: `Cat ${ordem}`, classificacao: "CUSTEIO" as const, valorTotal: 100,
}));

describe("ratearCategorias: ordem de entrada não muda o rateio", () => {
  it("itens embaralhados ratean igual aos itens já ordenados, inclusive quem fica com o centavo", () => {
    const ordenado = ratearCategorias({ itens: itensPesoIgual([1, 2, 3]) }, 1);
    const embaralhado = ratearCategorias({ itens: itensPesoIgual([3, 1, 2]) }, 1);
    expect(categorias(embaralhado)).toEqual(categorias(ordenado));
    expect(categorias(ordenado)).toEqual([["Cat 1", 0.34], ["Cat 2", 0.33], ["Cat 3", 0.33]]);
  });

  it("o centavo segue `ordem`, não o uuid do item", () => {
    // Item de ordem 1 tem o maior uuid; ordenar por id daria o centavo ao "Cat 3".
    expect(idItem(1) > idItem(3)).toBe(true);
    expect(categorias(ratearCategorias({ itens: itensPesoIgual([2, 3, 1]) }, 1))[0]).toEqual(["Cat 1", 0.34]);
  });
});

describe("classificarFluxo: ordem de entrada não muda o rateio de pagamentos", () => {
  const itens = [
    { id: idItem(1), ordem: 1, categoriaId: uid(301), categoriaNome: "Silagem", classificacao: "CUSTEIO" as const, valorTotal: 0.02 },
    { id: idItem(2), ordem: 2, categoriaId: uid(302), categoriaNome: "Vacinas", classificacao: "CUSTEIO" as const, valorTotal: 0.01 },
  ];
  const base = (seqs: number[]): OperacaoComFluxo => ({
    valorTotal: 0.03,
    itens,
    transacoes: seqs.map((seq) => ({ id: idTransacao(seq), seq, tipo: "PAGAMENTO", valorTotal: 0.01, reversaoDeId: null })),
  });

  it("transações embaralhadas ratean igual às transações já ordenadas", () => {
    const ordenado = classificarFluxo(base([1, 2, 3]));
    const embaralhado = classificarFluxo(base([3, 1, 2]));
    expect([...embaralhado.transacoes.entries()].map(([id, p]) => [id, valores(p)])).toEqual(
      [...ordenado.transacoes.entries()].map(([id, p]) => [id, valores(p)]),
    );
    expect(valores(embaralhado.saldo)).toEqual(valores(ordenado.saldo));
  });

  it("o rateio de cada pagamento segue `seq`, não o uuid da transação", () => {
    const fluxo = classificarFluxo(base([2, 3, 1]));
    expect([...fluxo.transacoes.keys()]).toEqual([idTransacao(1), idTransacao(2), idTransacao(3)]);
    expect(valores(fluxo.transacoes.get(idTransacao(1))!)).toEqual([0.01, 0]);
    expect(valores(fluxo.transacoes.get(idTransacao(3))!)).toEqual([0, 0.01]);
  });

  it("reversão listada antes do original no array ainda desfaz exatamente o rateio dele", () => {
    const original: OperacaoComFluxo = {
      valorTotal: 0.03,
      itens,
      transacoes: [
        { id: idTransacao(1), seq: 1, tipo: "PAGAMENTO", valorTotal: 0.01, reversaoDeId: null },
        { id: idTransacao(2), seq: 2, tipo: "PAGAMENTO", valorTotal: 0.01, reversaoDeId: null },
        { id: idTransacao(3), seq: 3, tipo: "PAGAMENTO", valorTotal: 0.01, reversaoDeId: null },
        { id: idTransacao(4), seq: 4, tipo: "REVERSAO", valorTotal: 0.01, reversaoDeId: idTransacao(2) },
      ],
    };
    // Mesmos eventos, mas a reversão (seq 4) aparece antes do pagamento que ela
    // desfaz (seq 2) na ordem do array.
    const foraDeOrdem: OperacaoComFluxo = {
      ...original,
      transacoes: [original.transacoes[3], original.transacoes[0], original.transacoes[2], original.transacoes[1]],
    };
    const esperado = classificarFluxo(original);
    const obtido = classificarFluxo(foraDeOrdem);
    expect(valores(obtido.transacoes.get(idTransacao(4))!)).toEqual(valores(esperado.transacoes.get(idTransacao(4))!));
    expect(valores(obtido.transacoes.get(idTransacao(4))!)).toEqual([-0.01, -0]);
    expect(valores(obtido.saldo)).toEqual(valores(esperado.saldo));
  });
});

describe("ratearCompromissos: ordem de entrada não muda o rateio", () => {
  const compromissoBase = (seqs: number[]) => ({
    valorTotal: 100,
    itens: itensPesoIgual([1, 2, 3]),
    transacoes: [],
    compromissos: seqs.map((seq) => ({ id: idCompromisso(seq), seq, status: "PENDENTE", valorOriginal: d(1), liquidacoes: [] })),
  });

  it("compromissos embaralhados ratean igual aos compromissos já ordenados", () => {
    const ordenado = ratearCompromissos(compromissoBase([1, 2, 3]));
    const embaralhado = ratearCompromissos(compromissoBase([3, 1, 2]));
    for (const seq of [1, 2, 3]) {
      expect(categorias(embaralhado.get(idCompromisso(seq))!)).toEqual(categorias(ordenado.get(idCompromisso(seq))!));
    }
  });

  it("o saldo é consumido na ordem de `seq`, não do uuid do compromisso", () => {
    const rateio = ratearCompromissos(compromissoBase([3, 2, 1]));
    expect([...rateio.keys()]).toEqual([idCompromisso(1), idCompromisso(2), idCompromisso(3)]);
    expect(categorias(rateio.get(idCompromisso(1))!)).toEqual([["Cat 1", 0.34], ["Cat 2", 0.33], ["Cat 3", 0.33]]);
  });
});
