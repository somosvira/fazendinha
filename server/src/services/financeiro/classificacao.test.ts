import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { classificarFluxo, ratearCategorias, ratearCompromissos, type OperacaoComFluxo } from "./classificacao.js";
const d = (v: number) => new Prisma.Decimal(v);
const dataEm = (segundos: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, segundos));
const op = { valorTotal: 1000, itens: [
  { id: "1", ordem: 0, categoriaId: "1", categoriaNome: "Silagem", classificacao: "CUSTEIO" as const, valorTotal: 800 },
  { id: "2", ordem: 1, categoriaId: "2", categoriaNome: "Vacinas", classificacao: "CUSTEIO" as const, valorTotal: 200 },
] };
const valores = (partes: ReturnType<typeof ratearCategorias>) => partes.map((p) => p.valor.toNumber());
describe("classificação por item", () => {
  it("atribui apenas o valor do item à categoria em compras mistas", () => {
    expect(valores(ratearCategorias(op, 1000))).toEqual([800, 200]);
    expect(valores(ratearCategorias(op, 500))).toEqual([400, 100]);
  });
  it("mantém serviço sem itens e categoria não informada", () => {
    expect(ratearCategorias({ categoriaId: "3", categoriaNome: "Serviços", itens: [] }, 100)[0]).toMatchObject({ categoriaId: "3", categoriaNome: "Serviços" });
    expect(ratearCategorias(null, 100)[0].categoriaNome).toBe("Sem categoria");
  });
  it("fecha os centavos por pagamento e por categoria ao quitar e desfaz o original no estorno", () => {
    const pequena: OperacaoComFluxo = { valorTotal: 0.03, itens: op.itens.map((i, index) => ({ ...i, valorTotal: index ? 0.01 : 0.02 })), transacoes: [
      { id: "1", tipo: "PAGAMENTO", valorTotal: 0.01, reversaoDeId: null, registradoEm: dataEm(1) },
      { id: "2", tipo: "PAGAMENTO", valorTotal: 0.01, reversaoDeId: null, registradoEm: dataEm(2) },
      { id: "3", tipo: "PAGAMENTO", valorTotal: 0.01, reversaoDeId: null, registradoEm: dataEm(3) },
    ] };
    const fluxo = classificarFluxo(pequena);
    expect([...fluxo.transacoes.values()].map(valores)).toEqual([[0.01, 0], [0.01, 0], [0, 0.01]]);
    expect(valores(fluxo.saldo)).toEqual([0, 0]);
    pequena.transacoes.push({ id: "4", tipo: "REVERSAO", valorTotal: 0.01, reversaoDeId: "2", registradoEm: dataEm(4) });
    expect(valores(classificarFluxo(pequena).transacoes.get("4")!)).toEqual([-0.01, -0]);
  });
  it("divide o saldo a pagar e ignora liquidação estornada", () => {
    const pendente = { ...op, transacoes: [
      { id: "1", tipo: "PAGAMENTO", valorTotal: 500, reversaoDeId: null, status: "REVERTIDA", registradoEm: dataEm(1) },
      { id: "2", tipo: "REVERSAO", valorTotal: 500, reversaoDeId: "1", status: "CONFIRMADA", registradoEm: dataEm(2) },
    ], compromissos: [{ id: "1", numeroParcela: 1, status: "PENDENTE", valorOriginal: d(1000), liquidacoes: [{ transacaoId: "1", valor: d(500) }] }] };
    expect(valores(ratearCompromissos(pendente).get("1")!)).toEqual([800, 200]);
  });
  it("um serviço parcial conserva categoria e saldo sem depender de itens", () => {
    const servico = { itens: [], valorTotal: 100, categoriaId: "3", categoriaNome: "Serviços", transacoes: [{ id: "1", tipo: "PAGAMENTO", valorTotal: 40, reversaoDeId: null, status: "CONFIRMADA", registradoEm: dataEm(1) }], compromissos: [{ id: "1", numeroParcela: 1, valorOriginal: d(60), status: "PENDENTE", liquidacoes: [] }] };
    expect(ratearCompromissos(servico).get("1")![0]).toMatchObject({ categoriaNome: "Serviços", valor: d(60) });
  });
});
