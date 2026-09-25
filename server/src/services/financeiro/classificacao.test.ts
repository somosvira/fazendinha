import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { classificarFluxo, ratearCategorias, ratearCompromissos, type OperacaoComFluxo } from "./classificacao.js";
const d = (v: number) => new Prisma.Decimal(v);
const op = { valorTotal: 1000, itens: [
  { id: 1, categoriaId: 1, categoriaNome: "Silagem", classificacao: "CUSTEIO" as const, valorTotal: 800 },
  { id: 2, categoriaId: 2, categoriaNome: "Vacinas", classificacao: "CUSTEIO" as const, valorTotal: 200 },
] };
const valores = (partes: ReturnType<typeof ratearCategorias>) => partes.map((p) => p.valor.toNumber());
describe("classificação por item", () => {
  it("atribui apenas o valor do item à categoria em compras mistas", () => {
    expect(valores(ratearCategorias(op, 1000))).toEqual([800, 200]);
    expect(valores(ratearCategorias(op, 500))).toEqual([400, 100]);
  });
  it("mantém serviço sem itens e categoria não informada", () => {
    expect(ratearCategorias({ categoriaId: 3, categoriaNome: "Serviços", itens: [] }, 100)[0]).toMatchObject({ categoriaId: 3, categoriaNome: "Serviços" });
    expect(ratearCategorias(null, 100)[0].categoriaNome).toBe("Sem categoria");
  });
  it("fecha os centavos por pagamento e por categoria ao quitar e desfaz o original no estorno", () => {
    const pequena: OperacaoComFluxo = { valorTotal: 0.03, itens: op.itens.map((i, index) => ({ ...i, valorTotal: index ? 0.01 : 0.02 })), transacoes: [
      { id: 1, tipo: "PAGAMENTO", valorTotal: 0.01, reversaoDeId: null },
      { id: 2, tipo: "PAGAMENTO", valorTotal: 0.01, reversaoDeId: null },
      { id: 3, tipo: "PAGAMENTO", valorTotal: 0.01, reversaoDeId: null },
    ] };
    const fluxo = classificarFluxo(pequena);
    expect([...fluxo.transacoes.values()].map(valores)).toEqual([[0.01, 0], [0.01, 0], [0, 0.01]]);
    expect(valores(fluxo.saldo)).toEqual([0, 0]);
    pequena.transacoes.push({ id: 4, tipo: "REVERSAO", valorTotal: 0.01, reversaoDeId: 2 });
    expect(valores(classificarFluxo(pequena).transacoes.get(4)!)).toEqual([-0.01, -0]);
  });
  it("divide o saldo a pagar e ignora liquidação estornada", () => {
    const pendente = { ...op, transacoes: [
      { id: 1, tipo: "PAGAMENTO", valorTotal: 500, reversaoDeId: null, status: "REVERTIDA" },
      { id: 2, tipo: "REVERSAO", valorTotal: 500, reversaoDeId: 1, status: "CONFIRMADA" },
    ], compromissos: [{ id: 1, status: "PENDENTE", valorOriginal: d(1000), liquidacoes: [{ transacaoId: 1, valor: d(500) }] }] };
    expect(valores(ratearCompromissos(pendente).get(1)!)).toEqual([800, 200]);
  });
  it("um serviço parcial conserva categoria e saldo sem depender de itens", () => {
    const servico = { itens: [], valorTotal: 100, categoriaId: 3, categoriaNome: "Serviços", transacoes: [{ id: 1, tipo: "PAGAMENTO", valorTotal: 40, reversaoDeId: null, status: "CONFIRMADA" }], compromissos: [{ id: 1, valorOriginal: d(60), status: "PENDENTE", liquidacoes: [] }] };
    expect(ratearCompromissos(servico).get(1)![0]).toMatchObject({ categoriaNome: "Serviços", valor: d(60) });
  });
  it("centro efetivo de cada parte: o do item, senão o da operação, e sobrevive ao rateio de pagamento e de compromisso", () => {
    const mista: OperacaoComFluxo & { compromissos: { id: number; status: string; valorOriginal: Prisma.Decimal; liquidacoes: never[] }[] } = {
      valorTotal: 1000, centroCustoId: 9, centroCusto: { id: 9, nome: "Sede" },
      itens: [
        { id: 1, categoriaId: 1, categoriaNome: "Ração", classificacao: "CUSTEIO", valorTotal: 500, centroCustoId: 1, centroCustoNome: "Pecuária" },
        { id: 2, categoriaId: 2, categoriaNome: "Frete", classificacao: "CUSTEIO", valorTotal: 500, centroCustoId: null, centroCustoNome: null },
      ],
      transacoes: [{ id: 1, tipo: "PAGAMENTO", valorTotal: 400, reversaoDeId: null, status: "CONFIRMADA" }],
      compromissos: [{ id: 1, status: "PENDENTE", valorOriginal: d(600), liquidacoes: [] }],
    };
    const centros = (partes: ReturnType<typeof ratearCategorias>) => partes.map((p) => [p.centroCustoId, p.centroCustoNome]);
    expect(centros(ratearCategorias(mista, 1000))).toEqual([[1, "Pecuária"], [9, "Sede"]]);
    expect(centros(classificarFluxo(mista).transacoes.get(1)!)).toEqual([[1, "Pecuária"], [9, "Sede"]]);
    expect(centros(ratearCompromissos(mista).get(1)!)).toEqual([[1, "Pecuária"], [9, "Sede"]]);
    // Sem centro na operação, o item sem centro fica sem centro; serviço sem itens usa o da operação.
    expect(centros(ratearCategorias({ ...mista, centroCustoId: null, centroCusto: null }, 1000))).toEqual([[1, "Pecuária"], [null, null]]);
    expect(centros(ratearCategorias({ itens: [], centroCustoId: 9, centroCusto: { id: 9, nome: "Sede" } }, 100))).toEqual([[9, "Sede"]]);
    expect(centros(ratearCategorias(null, 100))).toEqual([[null, null]]);
  });
});
