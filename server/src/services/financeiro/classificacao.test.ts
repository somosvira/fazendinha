import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { classificarFluxo, ratearCategorias, ratearCompromissos, type OperacaoComFluxo } from "./classificacao.js";
import { uid } from "../../lib/uid.fixture.js";
const d = (v: number) => new Prisma.Decimal(v);
const CAT_SILAGEM = uid(101), CAT_VACINAS = uid(102), CAT_SERVICOS = uid(103);
const CENTRO_PECUARIA = uid(201), CENTRO_SEDE = uid(209);
const op = { valorTotal: 1000, itens: [
  { id: uid(1), ordem: 1, categoriaId: CAT_SILAGEM, categoriaNome: "Silagem", classificacao: "CUSTEIO" as const, valorTotal: 800 },
  { id: uid(2), ordem: 2, categoriaId: CAT_VACINAS, categoriaNome: "Vacinas", classificacao: "CUSTEIO" as const, valorTotal: 200 },
] };
const valores = (partes: ReturnType<typeof ratearCategorias>) => partes.map((p) => p.valor.toNumber());
describe("classificação por item", () => {
  it("atribui apenas o valor do item à categoria em compras mistas", () => {
    expect(valores(ratearCategorias(op, 1000))).toEqual([800, 200]);
    expect(valores(ratearCategorias(op, 500))).toEqual([400, 100]);
  });
  it("mantém serviço sem itens e categoria não informada", () => {
    expect(ratearCategorias({ categoriaId: CAT_SERVICOS, categoriaNome: "Serviços", itens: [] }, 100)[0]).toMatchObject({ categoriaId: CAT_SERVICOS, categoriaNome: "Serviços" });
    expect(ratearCategorias(null, 100)[0].categoriaNome).toBe("Sem categoria");
  });
  it("fecha os centavos por pagamento e por categoria ao quitar e desfaz o original no estorno", () => {
    const pequena: OperacaoComFluxo = { valorTotal: 0.03, itens: op.itens.map((i, index) => ({ ...i, valorTotal: index ? 0.01 : 0.02 })), transacoes: [
      { id: uid(11), seq: 1, tipo: "PAGAMENTO", valorTotal: 0.01, reversaoDeId: null },
      { id: uid(12), seq: 2, tipo: "PAGAMENTO", valorTotal: 0.01, reversaoDeId: null },
      { id: uid(13), seq: 3, tipo: "PAGAMENTO", valorTotal: 0.01, reversaoDeId: null },
    ] };
    const fluxo = classificarFluxo(pequena);
    expect([...fluxo.transacoes.values()].map(valores)).toEqual([[0.01, 0], [0.01, 0], [0, 0.01]]);
    expect(valores(fluxo.saldo)).toEqual([0, 0]);
    pequena.transacoes.push({ id: uid(14), seq: 4, tipo: "REVERSAO", valorTotal: 0.01, reversaoDeId: uid(12) });
    expect(valores(classificarFluxo(pequena).transacoes.get(uid(14))!)).toEqual([-0.01, -0]);
  });
  it("divide o saldo a pagar e ignora liquidação estornada", () => {
    const pendente = { ...op, transacoes: [
      { id: uid(11), seq: 1, tipo: "PAGAMENTO", valorTotal: 500, reversaoDeId: null, status: "REVERTIDA" },
      { id: uid(12), seq: 2, tipo: "REVERSAO", valorTotal: 500, reversaoDeId: uid(11), status: "CONFIRMADA" },
    ], compromissos: [{ id: uid(21), seq: 1, status: "PENDENTE", valorOriginal: d(1000), liquidacoes: [{ transacaoId: uid(11), valor: d(500) }] }] };
    expect(valores(ratearCompromissos(pendente).get(uid(21))!)).toEqual([800, 200]);
  });
  it("um serviço parcial conserva categoria e saldo sem depender de itens", () => {
    const servico = { itens: [], valorTotal: 100, categoriaId: CAT_SERVICOS, categoriaNome: "Serviços", transacoes: [{ id: uid(11), seq: 1, tipo: "PAGAMENTO", valorTotal: 40, reversaoDeId: null, status: "CONFIRMADA" }], compromissos: [{ id: uid(21), seq: 1, valorOriginal: d(60), status: "PENDENTE", liquidacoes: [] }] };
    expect(ratearCompromissos(servico).get(uid(21))![0]).toMatchObject({ categoriaNome: "Serviços", valor: d(60) });
  });
  it("centro efetivo de cada parte: o do item, senão o da operação, e sobrevive ao rateio de pagamento e de compromisso", () => {
    const mista: OperacaoComFluxo & { compromissos: { id: string; seq: number; status: string; valorOriginal: Prisma.Decimal; liquidacoes: never[] }[] } = {
      valorTotal: 1000, centroCustoId: CENTRO_SEDE, centroCusto: { id: CENTRO_SEDE, nome: "Sede" },
      itens: [
        { id: uid(1), ordem: 1, categoriaId: uid(111), categoriaNome: "Ração", classificacao: "CUSTEIO", valorTotal: 500, centroCustoId: CENTRO_PECUARIA, centroCustoNome: "Pecuária" },
        { id: uid(2), ordem: 2, categoriaId: uid(112), categoriaNome: "Frete", classificacao: "CUSTEIO", valorTotal: 500, centroCustoId: null, centroCustoNome: null },
      ],
      transacoes: [{ id: uid(11), seq: 1, tipo: "PAGAMENTO", valorTotal: 400, reversaoDeId: null, status: "CONFIRMADA" }],
      compromissos: [{ id: uid(21), seq: 1, status: "PENDENTE", valorOriginal: d(600), liquidacoes: [] }],
    };
    const centros = (partes: ReturnType<typeof ratearCategorias>) => partes.map((p) => [p.centroCustoId, p.centroCustoNome]);
    expect(centros(ratearCategorias(mista, 1000))).toEqual([[CENTRO_PECUARIA, "Pecuária"], [CENTRO_SEDE, "Sede"]]);
    expect(centros(classificarFluxo(mista).transacoes.get(uid(11))!)).toEqual([[CENTRO_PECUARIA, "Pecuária"], [CENTRO_SEDE, "Sede"]]);
    expect(centros(ratearCompromissos(mista).get(uid(21))!)).toEqual([[CENTRO_PECUARIA, "Pecuária"], [CENTRO_SEDE, "Sede"]]);
    // Sem centro na operação, o item sem centro fica sem centro; serviço sem itens usa o da operação.
    expect(centros(ratearCategorias({ ...mista, centroCustoId: null, centroCusto: null }, 1000))).toEqual([[CENTRO_PECUARIA, "Pecuária"], [null, null]]);
    expect(centros(ratearCategorias({ itens: [], centroCustoId: CENTRO_SEDE, centroCusto: { id: CENTRO_SEDE, nome: "Sede" } }, 100))).toEqual([[CENTRO_SEDE, "Sede"]]);
    expect(centros(ratearCategorias(null, 100))).toEqual([[null, null]]);
  });
});
