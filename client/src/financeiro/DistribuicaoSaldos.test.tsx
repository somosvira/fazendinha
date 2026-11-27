// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DistribuicaoSaldos } from "./DistribuicaoSaldos";
import type { Conta } from "./novo-api";

afterEach(cleanup);
const conta = (id: string, nome: string, saldoAtual: string) => ({ id, nome, saldoAtual }) as unknown as Conta;

it("mostra a participação de cada conta no saldo e abre a conta pela legenda", () => {
  const onAbrir = vi.fn();
  render(<DistribuicaoSaldos contas={[conta("a", "Caixa", "250"), conta("b", "Banco", "750")]} onAbrir={onAbrir} />);
  expect(screen.getByRole("img", { name: "Caixa: 25%, Banco: 75%" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Banco/ }));
  expect(onAbrir).toHaveBeenCalledWith("b");
});

it("não desenha parcelas quando há saldo negativo ou total zerado", () => {
  const { container } = render(<DistribuicaoSaldos contas={[conta("a", "Caixa", "-10"), conta("b", "Banco", "40")]} onAbrir={vi.fn()} />);
  expect(container.innerHTML).toBe("");
});
