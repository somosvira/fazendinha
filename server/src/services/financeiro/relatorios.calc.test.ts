import { describe, expect, it } from "vitest";
import { comporItens, descreverFiltros, LIMITE_LINHAS_COMPOSICAO, operacaoPassa, partePassa, type FiltroRelatorio, type OperacaoComposicao } from "./relatorios.calc.js";

const semFiltro: FiltroRelatorio = { tipos: [], status: [], centroCustoIds: [], categoriaIds: [], classificacoes: [] };
const filtro = (parcial: Partial<FiltroRelatorio>): FiltroRelatorio => ({ ...semFiltro, ...parcial });

function operacao(parcial: Partial<OperacaoComposicao> & { id: number }): OperacaoComposicao {
  return {
    data: new Date("2026-09-02T00:00:00Z"), tipo: "COMPRA_CONSUMO_DIRETO", status: "CONFIRMADA", descricao: `Operação ${parcial.id}`, valorTotal: "0",
    centroCustoId: 1, centroCusto: { nome: "Pecuária" }, parceiro: { nome: "Agropecuária Boa Vista" },
    categoriaId: null, categoriaNome: null, classificacao: null, itens: [], ...parcial,
  };
}

// Compra mista: ração (custeio) + cerca (investimento) na mesma operação.
const mista = operacao({
  id: 7, valorTotal: "1300.00",
  itens: [
    { id: 11, descricao: "Ração lactação", quantidade: "10", unidade: "sc", valorTotal: "800.00", categoriaId: 3, categoriaNome: "Nutrição", classificacao: "CUSTEIO", centroCustoId: null, centroCustoNome: null },
    { id: 12, descricao: "Mourões", quantidade: "50", unidade: "un", valorTotal: "500.00", categoriaId: 4, categoriaNome: "Benfeitorias", classificacao: "INVESTIMENTO", centroCustoId: null, centroCustoNome: null },
  ],
});
// Nota mista por centro: ração com centro próprio (Pecuária), adubo com outro
// centro (Agronomia) e um serviço sem centro que herda o da operação (Sede).
const mistaPorCentro = operacao({
  id: 13, valorTotal: "1000.00", centroCustoId: 9, centroCusto: { nome: "Sede" },
  itens: [
    { id: 21, descricao: "Ração", quantidade: "1", unidade: "sc", valorTotal: "500.00", categoriaId: 3, categoriaNome: "Nutrição", classificacao: "CUSTEIO", centroCustoId: 1, centroCustoNome: "Pecuária" },
    { id: 22, descricao: "Adubo", quantidade: "1", unidade: "sc", valorTotal: "300.00", categoriaId: 6, categoriaNome: "Adubação", classificacao: "CUSTEIO", centroCustoId: 2, centroCustoNome: "Agronomia" },
    { id: 23, descricao: "Frete", quantidade: "1", unidade: "un", valorTotal: "200.00", categoriaId: 7, categoriaNome: "Logística", classificacao: "CUSTEIO", centroCustoId: null, centroCustoNome: null },
  ],
});

describe("filtros do relatório", () => {
  it("sem filtro deixa tudo passar", () => {
    expect(operacaoPassa(semFiltro, { tipo: "VENDA", status: "CANCELADA" })).toBe(true);
    expect(operacaoPassa(semFiltro, null)).toBe(true);
    expect(partePassa(semFiltro, { categoriaId: null, classificacao: null })).toBe(true);
  });

  it("filtra operação por tipo e situação; o centro é decidido por parte", () => {
    const f = filtro({ tipos: ["SERVICO"], status: ["CONFIRMADA"], centroCustoIds: [0, 2] });
    expect(operacaoPassa(f, { tipo: "SERVICO", status: "CONFIRMADA" })).toBe(true);
    expect(operacaoPassa(f, { tipo: "VENDA", status: "CONFIRMADA" })).toBe(false);
    expect(operacaoPassa(f, { tipo: "SERVICO", status: "CANCELADA" })).toBe(false);
  });

  it("filtra a parte por centro de custo efetivo, com 0 = sem centro", () => {
    const f = filtro({ centroCustoIds: [0, 2] });
    expect(partePassa(f, { centroCustoId: 2 })).toBe(true);
    expect(partePassa(f, { centroCustoId: null })).toBe(true);
    expect(partePassa(f, {})).toBe(true);
    expect(partePassa(f, { centroCustoId: 1 })).toBe(false);
  });

  it("lançamento sem operação só entra sem filtro de tipo/situação; o centro fica com a parte", () => {
    expect(operacaoPassa(filtro({ centroCustoIds: [0] }), null)).toBe(true);
    expect(operacaoPassa(filtro({ centroCustoIds: [1] }), null)).toBe(true);
    expect(partePassa(filtro({ centroCustoIds: [1] }), { centroCustoId: null })).toBe(false);
    expect(operacaoPassa(filtro({ tipos: ["SERVICO"] }), null)).toBe(false);
    expect(operacaoPassa(filtro({ status: ["CONFIRMADA"] }), null)).toBe(false);
  });

  it("filtra fatias por categoria (0 = sem categoria) e classificação", () => {
    expect(partePassa(filtro({ categoriaIds: [0] }), { categoriaId: null })).toBe(true);
    expect(partePassa(filtro({ categoriaIds: [3] }), { categoriaId: 4 })).toBe(false);
    expect(partePassa(filtro({ classificacoes: ["SEM_CLASSIFICACAO"] }), { classificacao: null })).toBe(true);
    expect(partePassa(filtro({ classificacoes: ["INVESTIMENTO"] }), { classificacao: "CUSTEIO" })).toBe(false);
  });

  it("descreve filtros com os nomes vigentes na emissão", () => {
    expect(descreverFiltros(filtro({ tipos: ["SERVICO"], status: ["CANCELADA"], centroCustoIds: [0, 2], categoriaIds: [3], classificacoes: ["INVESTIMENTO"] }), {
      categorias: [{ id: 3, nome: "Nutrição" }], centrosCusto: [{ id: 2, nome: "Agronomia" }],
    })).toEqual({ tipos: ["Serviço"], status: ["Cancelada"], centrosCusto: ["Sem centro de custo", "Agronomia"], parceiros: [], categorias: ["Nutrição"], classificacoes: ["Investimento"] });
  });
});

describe("composição por item", () => {
  it("gera uma linha por item com a categoria do próprio item", () => {
    const c = comporItens([mista], semFiltro);
    expect(c.linhas.map((l) => [l.item, l.categoria, l.classificacao, l.valor, l.centroCusto])).toEqual([
      ["Ração lactação", "Nutrição", "CUSTEIO", "800.00", "Pecuária"],
      ["Mourões", "Benfeitorias", "INVESTIMENTO", "500.00", "Pecuária"],
    ]);
    expect(c.despesas).toMatchObject({ total: "1300.00", custeio: "800.00", investimento: "500.00", semClassificacao: "0.00" });
    expect(c.despesas.porCategoria.map((p) => [p.nome, p.total, p.pct])).toEqual([["Nutrição", "800.00", 61.54], ["Benfeitorias", "500.00", 38.46]]);
    expect(c.despesas.porCentro).toEqual([{ nome: "Pecuária", total: "1300.00", pct: 100 }]);
  });

  it("nota mista por centro: cada item vai ao seu centro e o item sem centro herda o da operação", () => {
    const c = comporItens([mistaPorCentro], semFiltro);
    expect(c.linhas.map((l) => [l.item, l.centroCusto, l.valor])).toEqual([
      ["Ração", "Pecuária", "500.00"], ["Adubo", "Agronomia", "300.00"], ["Frete", "Sede", "200.00"],
    ]);
    expect(c.despesas.porCentro.map((p) => [p.nome, p.total])).toEqual([["Pecuária", "500.00"], ["Agronomia", "300.00"], ["Sede", "200.00"]]);
  });

  it("filtro por centro devolve só as partes daquele centro; o centro da operação vale para o item sem centro", () => {
    const agronomia = comporItens([mistaPorCentro, mista], filtro({ centroCustoIds: [2] }));
    expect(agronomia.linhas.map((l) => l.item)).toEqual(["Adubo"]);
    expect(agronomia.despesas.total).toBe("300.00");
    const sede = comporItens([mistaPorCentro], filtro({ centroCustoIds: [9] }));
    expect(sede.linhas.map((l) => l.item)).toEqual(["Frete"]);
    // Nenhuma parte fica sem centro efetivo: a operação tem centro.
    expect(comporItens([mistaPorCentro], filtro({ centroCustoIds: [0] })).linhas).toEqual([]);
    // Operação sem centro: os itens sem centro próprio caem em "sem centro".
    const semCentro = comporItens([{ ...mistaPorCentro, centroCustoId: null, centroCusto: null }], filtro({ centroCustoIds: [0] }));
    expect(semCentro.linhas.map((l) => [l.item, l.centroCusto])).toEqual([["Frete", "Sem centro de custo"]]);
  });

  it("filtro de categoria mantém só a fatia correspondente da operação mista", () => {
    const c = comporItens([mista], filtro({ categoriaIds: [4] }));
    expect(c.linhas).toHaveLength(1);
    expect(c.linhas[0]).toMatchObject({ item: "Mourões", valor: "500.00" });
    expect(c.despesas.total).toBe("500.00");
    expect(c.porTipo).toEqual([{ tipo: "COMPRA_CONSUMO_DIRETO", rotulo: "Compra para consumo direto", operacoes: 1, total: "500.00" }]);
  });

  it("operação sem itens usa a classificação da operação", () => {
    const servico = operacao({ id: 8, tipo: "SERVICO", valorTotal: "250.00", centroCustoId: null, centroCusto: null, categoriaId: 5, categoriaNome: "Manutenção", classificacao: "CUSTEIO" });
    const [linha] = comporItens([servico], semFiltro).linhas;
    expect(linha).toMatchObject({ item: null, categoria: "Manutenção", centroCusto: "Sem centro de custo", classificacao: "CUSTEIO", valor: "250.00" });
  });

  it("vendas e canceladas aparecem nas linhas, mas não somam despesa nem volume por tipo", () => {
    const venda = operacao({ id: 9, tipo: "VENDA", valorTotal: "900.00", categoriaNome: "Leite" });
    const cancelada = operacao({ id: 10, status: "CANCELADA", valorTotal: "100.00" });
    const correcao = operacao({ id: 11, valorTotal: "100.00" });
    const c = comporItens([mista, venda, cancelada, correcao], semFiltro);
    expect(c.totalLinhas).toBe(5);
    expect(c.linhas.some((l) => l.status === "CANCELADA")).toBe(true);
    expect(c.despesas.total).toBe("1400.00");
    expect(c.porTipo.map((t) => [t.tipo, t.operacoes, t.total])).toEqual([["COMPRA_CONSUMO_DIRETO", 2, "1400.00"], ["VENDA", 1, "900.00"]]);
  });

  it("limita as linhas guardadas sem perder os totais", () => {
    const muitas = Array.from({ length: LIMITE_LINHAS_COMPOSICAO + 5 }, (_, i) => operacao({ id: i + 1, valorTotal: "1.00" }));
    const c = comporItens(muitas, semFiltro);
    expect(c.linhas).toHaveLength(LIMITE_LINHAS_COMPOSICAO);
    expect(c).toMatchObject({ truncado: true, totalLinhas: LIMITE_LINHAS_COMPOSICAO + 5 });
    expect(c.despesas.total).toBe(`${LIMITE_LINHAS_COMPOSICAO + 5}.00`);
  });
});
