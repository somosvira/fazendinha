// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PizzaComprasRelatorio } from "./RelatorioFinanceiroGraficos";

afterEach(cleanup);

it("mostra uma fatia única com nome, valor e percentual salvos", () => {
  render(<PizzaComprasRelatorio titulo="Compras por categoria" grupos={[{ nome: "Serviços veterinários", total: "250.00", pct: 100 }]} />);
  expect(screen.getByRole("img", { name: "Gráfico de pizza: compras por categoria" })).toBeTruthy();
  expect(screen.getByText("Serviços veterinários")).toBeTruthy();
  expect(screen.getByText("100%")).toBeTruthy();
  expect(screen.getByText(/250,00/)).toBeTruthy();
});

it("preserva ajustes negativos e grupos zerados sem desenhar fatias positivas fictícias", () => {
  render(<PizzaComprasRelatorio titulo="Compras por categoria" grupos={[{ nome: "Ajuste preservado", total: "-50.00", pct: -20 }, { nome: "Sem compras", total: "0.00", pct: 0 }]} />);
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.getByText("Ajuste preservado")).toBeTruthy();
  expect(screen.getByText(/−R\$.*50,00/)).toBeTruthy();
  expect(screen.getByText("-20%")).toBeTruthy();
  expect(screen.getByText("Sem compras")).toBeTruthy();
});
