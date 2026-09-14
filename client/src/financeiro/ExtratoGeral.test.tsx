// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ExtratoGeral } from "./ExtratoGeral";
import type { Conta, MovimentoGeral } from "./novo-api";
afterEach(cleanup);
const contas = [{ id: 1, nome: "Banco A", instituicao: "Instituição A", ativo: true }, { id: 2, nome: "Caixa B", instituicao: null, ativo: false }] as Conta[];
const movimentos: MovimentoGeral[] = [
  { id: 11, contaId: 1, conta: contas[0], direcao: "ENTRADA", valor: "25", transacao: { id: 21, tipo: "RECEBIMENTO", formaPagamento: null, parceiro: null, operacao: null, data: "2026-09-13", descricao: "Venda A", status: "CONFIRMADA" } },
  { id: 12, contaId: 2, conta: contas[1], direcao: "SAIDA", valor: "10", transacao: { id: 22, tipo: "PAGAMENTO", formaPagamento: null, parceiro: null, operacao: null, data: "2026-09-12", descricao: "Compra B", status: "CONFIRMADA" } },
];
it("combina filtros inclusivos de data, conta e instituição e abre o movimento exato", async () => {
  const abrir = vi.fn(); render(<ExtratoGeral contas={contas} movimentos={movimentos} carregando={false} erro={null} onAbrir={abrir} />);
  const tabela = within(await screen.findByRole("table", { name: "Extrato geral" }));
  fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2026-09-13" } });
  fireEvent.change(screen.getByLabelText("Data final"), { target: { value: "2026-09-13" } });
  fireEvent.change(screen.getByLabelText("Conta"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Instituição"), { target: { value: "Instituição A" } });
  expect(tabela.queryByText("Compra B")).toBeNull();
  fireEvent.click(tabela.getByText("Venda A")); expect(abrir).toHaveBeenCalledWith(movimentos[0]);
  fireEvent.change(screen.getByLabelText("Instituição"), { target: { value: "__sem__" } });
  expect(screen.getByText(/Nenhuma movimentação encontrada/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Data final"), { target: { value: "2026-09-11" } });
  expect(screen.getByRole("alert").textContent).toContain("data final");
});
it("distingue erro de carregamento de extrato vazio", async () => {
  render(<ExtratoGeral contas={contas} movimentos={[]} carregando={false} erro="Falha na consulta" onAbrir={vi.fn()} />);
  expect(await screen.findByText("Não foi possível carregar as movimentações.")).toBeTruthy();
  expect(screen.queryByText(/Nenhuma movimentação encontrada/)).toBeNull();
});

it("abre a operação da transferência sem acionar a navegação da linha", () => {
  const abrir = vi.fn();
  const transferencia: MovimentoGeral = { ...movimentos[0], transacao: { ...movimentos[0].transacao, tipo: "TRANSFERENCIA", operacao: { id: 123, descricao: "Transferência", tipo: "TRANSFERENCIA_FINANCEIRA" } } };
  render(<ExtratoGeral contas={contas} movimentos={[transferencia]} carregando={false} erro={null} onAbrir={abrir} />);
  const link = within(screen.getByRole("table", { name: "Extrato geral" })).getByRole("link", { name: "OP-0123" });
  expect(link.getAttribute("href")).toBe("/financeiro/operacoes/123");
  fireEvent.click(link, { ctrlKey: true });
  expect(abrir).not.toHaveBeenCalled();
  fireEvent.click(link);
  expect(window.location.pathname).toBe("/financeiro/operacoes/123");
  expect(abrir).not.toHaveBeenCalled();
});
