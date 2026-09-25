import { describe, expect, it } from "vitest";
import { comporItens, type FiltroRelatorio, type OperacaoComposicao } from "./relatorios.calc.js";
import { uid } from "../../lib/uid.fixture.js";

const semFiltro: FiltroRelatorio = { tipos: [], status: [], centroCustoIds: [], categoriaIds: [], classificacoes: [] };

// Os uuids dos itens estão em ordem lexical OPOSTA à de `ordem` (ordem 1 → o
// maior uuid): ordenar pelo id em vez de `ordem` inverte as linhas.
const itens = [
  { ordem: 1, descricao: "Ração", valorTotal: "800.00" },
  { ordem: 2, descricao: "Mourões", valorTotal: "500.00" },
  { ordem: 3, descricao: "Frete", valorTotal: "200.00" },
];

function operacao(ordens: number[]): OperacaoComposicao {
  return {
    id: uid(7), numero: 7, data: new Date("2026-09-02T00:00:00Z"), tipo: "COMPRA_CONSUMO_DIRETO", status: "CONFIRMADA", descricao: "Compra mista",
    valorTotal: "1500.00", centroCustoId: uid(201), centroCusto: { nome: "Pecuária" }, parceiro: { nome: "Agropecuária Boa Vista" },
    categoriaId: null, categoriaNome: null, classificacao: null,
    itens: ordens.map((ordem) => {
      const item = itens[ordem - 1];
      return {
        id: uid(10 - ordem), ordem, descricao: item.descricao, quantidade: "1", unidade: "un", valorTotal: item.valorTotal,
        categoriaId: uid(300 + ordem), categoriaNome: `Categoria ${ordem}`, classificacao: "CUSTEIO" as const, centroCustoId: null, centroCustoNome: null,
      };
    }),
  };
}

describe("comporItens: ordem dos itens na operação não muda a composição", () => {
  it("itens fora de ordem geram as mesmas linhas, na mesma ordem, dos itens já ordenados", () => {
    const ordenado = comporItens([operacao([1, 2, 3])], semFiltro);
    const foraDeOrdem = comporItens([operacao([3, 1, 2])], semFiltro);
    expect(foraDeOrdem.linhas.map((l) => [l.item, l.categoriaId, l.valor])).toEqual(
      ordenado.linhas.map((l) => [l.item, l.categoriaId, l.valor]),
    );
    expect(foraDeOrdem.despesas).toEqual(ordenado.despesas);
  });

  it("as linhas seguem `ordem`, não o uuid do item", () => {
    expect(uid(10 - 1) > uid(10 - 3)).toBe(true);
    expect(comporItens([operacao([2, 3, 1])], semFiltro).linhas.map((l) => l.item)).toEqual(["Ração", "Mourões", "Frete"]);
  });
});
