// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ExtratoGeral } from "./ExtratoGeral";
import { obterExtratoGeral, type Conta, type MovimentoGeral } from "./novo-api";
vi.mock("./novo-api", () => ({ obterExtratoGeral: vi.fn() }));
afterEach(cleanup);
const contas = [{ id: "1", nome: "Banco A", instituicao: "Instituição A", ativo: true }, { id: "2", nome: "Caixa B", instituicao: null, ativo: false }] as unknown as Conta[];
const movimentos: MovimentoGeral[] = [
  { id: "11", contaId: "1", conta: contas[0], direcao: "ENTRADA", valor: "25", transacao: { id: "21", tipo: "RECEBIMENTO", formaPagamento: null, parceiro: null, operacao: null, data: "2026-09-13", descricao: "Venda A", status: "CONFIRMADA" } },
  { id: "12", contaId: "2", conta: contas[1], direcao: "SAIDA", valor: "10", transacao: { id: "22", tipo: "PAGAMENTO", formaPagamento: null, parceiro: null, operacao: null, data: "2026-09-12", descricao: "Compra B", status: "CONFIRMADA" } },
];
it("combina filtros inclusivos de data, conta e instituição e abre o movimento exato", async () => {
  vi.mocked(obterExtratoGeral).mockResolvedValue(movimentos);
  const abrir = vi.fn(); render(<ExtratoGeral contas={contas} onAbrir={abrir} />);
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
  vi.mocked(obterExtratoGeral).mockRejectedValue(new Error("Falha na consulta"));
  render(<ExtratoGeral contas={contas} onAbrir={vi.fn()} />);
  expect(await screen.findByText("Não foi possível carregar as movimentações.")).toBeTruthy();
  expect(screen.queryByText(/Nenhuma movimentação encontrada/)).toBeNull();
});
