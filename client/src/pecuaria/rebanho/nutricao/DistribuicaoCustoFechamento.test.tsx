// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Fechamento } from "./api";
import { DistribuicaoCustoFechamento } from "./DistribuicaoCustoFechamento";
vi.mock("../../../components/ui/chart", () => ({ ChartContainer: () => null, ChartTooltip: () => null }));
afterEach(cleanup);
const dados = { verValores: true, coberturaCustoCompleta: false, itens: [
  { produtoId: "a", produto: { nome: "Ração" }, quantidadeConfirmada: "1", movimentoEstoque: { valorTotal: "90.00" } },
  { produtoId: "b", produto: { nome: "Mineral" }, quantidadeConfirmada: "99", movimentoEstoque: { valorTotal: "10.00" } },
  { produtoId: "c", produto: { nome: "Silagem sem custo" }, quantidadeConfirmada: "1000", movimentoEstoque: null },
] } as Fechamento;
it("usa custo conhecido, preservando base parcial sem confundir quantidade e valor", () => {
  render(<DistribuicaoCustoFechamento fechamento={dados} />);
  expect(screen.getByText("90%")).toBeTruthy();
  expect(screen.getByText("10%")).toBeTruthy();
  expect(screen.getByText(/Base parcial/)).toBeTruthy();
  expect(screen.queryByText("Silagem sem custo")).toBeNull();
});
it("não expõe valores sem permissão nem representa ajustes negativos como fatias", () => {
  const { container, rerender } = render(<DistribuicaoCustoFechamento fechamento={{ ...dados, verValores: false }} />);
  expect(container.textContent).toBe("");
  rerender(<DistribuicaoCustoFechamento fechamento={{ ...dados, itens: [{ ...dados.itens[0], movimentoEstoque: { ...dados.itens[0].movimentoEstoque!, valorTotal: "-90" } }] }} />);
  expect(container.textContent).toBe("");
});
it("inclui custo produtivo do leite sem usar seu preço comercial ou transformar pendência em zero", () => {
  const leite: NonNullable<Fechamento["itens"][number]["leite"]> = {
    id: "fornecimento", status: "CONFIRMADO", quantidadeLitros: "60", custoProducao: "100.00",
    referencia: {id:"ref",versao:1,fechamentoId:"venda",precoUnitario:"5",valorTotal:"300",provisoria:true,periodoInicio:"2026-09-01",periodoFim:"2026-09-30",motivo:"Referência anterior",criadoEm:"2026-10-01",criadoPorId:1},
    referencias: [], movimentos: [], parcelas: [],
  };
  const item = { ...dados.itens[0], produtoId: "leite", produto: {nome:"Leite produzido"}, movimentoEstoque: null, leite };
  const {rerender} = render(<DistribuicaoCustoFechamento fechamento={{...dados,itens:[...dados.itens,item]}} />);
  expect(screen.getByText("50%")).toBeTruthy();
  expect(screen.getByText("Leite produzido")).toBeTruthy();
  rerender(<DistribuicaoCustoFechamento fechamento={{...dados,itens:[...dados.itens,{...item,leite:{...leite,custoProducao:null}}]}} />);
  expect(screen.queryByText("Leite produzido")).toBeNull();
  expect(screen.getByText("90%")).toBeTruthy();
});
