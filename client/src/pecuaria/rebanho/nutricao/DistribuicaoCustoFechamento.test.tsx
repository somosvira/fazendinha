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
