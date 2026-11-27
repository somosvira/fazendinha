// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ComponentesProducaoLeite } from "./ComponentesProducaoLeite";
import { resumirOperacionalPeriodo } from "./resumo-producao";

afterEach(cleanup);
const ordenhas = [{ posicaoId: "manha", nome: "Manhã" }];
const props = { ordenhas, carregando: false, erro: "", onRecarregar: vi.fn(), onDetalhar: vi.fn() };

it("dia sem registros não aparece como completo nem como zero", () => {
  render(<ComponentesProducaoLeite {...props} grupo={{ periodo: "2026-11-23", litros: null, completa: true, vacasOrdenhadas: null, turnos: [{ posicaoId: "manha", litros: null }] }} operacional={resumirOperacionalPeriodo([], "2026-11-23")} />);
  const produzido = screen.getByRole("article", { name: "Leite produzido" });
  expect(within(produzido).getAllByText("Sem registros").length).toBeGreaterThan(0);
  expect(within(produzido).queryByText("Completo")).toBeNull();
  expect(within(produzido).getByText("Nenhum volume registrado")).toBeTruthy();
  expect(within(produzido).getByText("Sem medição")).toBeTruthy();
  expect(within(screen.getByRole("article", { name: "Leite consumido" })).getAllByText("Nenhum volume registrado").length).toBeGreaterThan(0);
  expect(screen.queryByText("0 L")).toBeNull();
});

it("medição válida de zero continua aparecendo como 0 L e completa", () => {
  render(<ComponentesProducaoLeite {...props} grupo={{ periodo: "2026-11-23", litros: 0, completa: true, vacasOrdenhadas: 3, turnos: [{ posicaoId: "manha", litros: 0 }] }} operacional={resumirOperacionalPeriodo([], "2026-11-23")} />);
  const produzido = screen.getByRole("article", { name: "Leite produzido" });
  expect(within(produzido).getByText("Completo")).toBeTruthy();
  expect(within(produzido).getAllByText("0 L").length).toBeGreaterThan(0);
});
