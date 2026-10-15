// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FinanceiroContent } from "./FinanceiroContent";
const chamadas = vi.hoisted(() => ({ dashboard: vi.fn(), contas: vi.fn(), compromissos: vi.fn(), relatorios: vi.fn() }));
vi.mock("./VisaoGeralFinanceira", () => ({ VisaoGeralFinanceira: () => { chamadas.dashboard(); return <p>Dashboard carregado</p>; } }));
vi.mock("./ContasFinanceiras", () => ({ ContasFinanceiras: () => { chamadas.contas(); return <p>Contas carregadas</p>; } }));
vi.mock("./CompromissosFinanceiros", () => ({ CompromissosFinanceiros: () => { chamadas.compromissos(); return <p>Compromissos carregados</p>; } }));
vi.mock("./RelatoriosFinanceiros", () => ({ RelatoriosFinanceiros: () => { chamadas.relatorios(); return <p>Relatórios carregados</p>; } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it.each(["dashboard", "gastos", "caixinha", "relatorio"] as const)("não monta consulta monetária %s para perfil sem valores", tab => {
  render(<FinanceiroContent tab={tab} onNav={vi.fn()} podeVerValores={false} />);
  expect(screen.getByText("Valores financeiros restritos")).toBeTruthy();
  for (const fn of Object.values(chamadas)) expect(fn).not.toHaveBeenCalled();
});
it("mantém consulta financeira para perfil autorizado sem permissão de escrita", () => {
  render(<FinanceiroContent tab="dashboard" onNav={vi.fn()} podeVerValores podeLancar={false} />);
  expect(chamadas.dashboard).toHaveBeenCalledOnce();
});
