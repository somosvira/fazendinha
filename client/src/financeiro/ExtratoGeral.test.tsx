// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { ExtratoGeral, FILTROS_EXTRATO_GERAL_INICIAIS, type FiltrosExtratoGeral } from "./ExtratoGeral";
import type { Conta, MovimentoGeral } from "./novo-api";
afterEach(cleanup);
const contas = [{ id: 1, nome: "Banco A", instituicao: "Instituição A", ativo: true }, { id: 2, nome: "Caixa B", instituicao: null, ativo: false }] as Conta[];
const movimentos: MovimentoGeral[] = [
  { id: 11, contaId: 1, conta: contas[0], direcao: "ENTRADA", valor: "25", transacao: { id: 21, tipo: "RECEBIMENTO", formaPagamento: null, parceiro: null, operacao: null, data: "2026-09-13", descricao: "Venda A", status: "CONFIRMADA" } },
  { id: 12, contaId: 2, conta: contas[1], direcao: "SAIDA", valor: "10", transacao: { id: 22, tipo: "PAGAMENTO", formaPagamento: null, parceiro: null, operacao: null, data: "2026-09-12", descricao: "Compra B", status: "CONFIRMADA" } },
];
// O período agora é um único controle compartilhado, renderizado pelo
// componente pai (ContasFinanceiras) — ver ContasFinanceiras.test/VisualizacoesFinanceiras.test.
// Este harness expõe inicio/fim diretamente para testar a combinação de
// filtros e a mensagem de intervalo inválido que ExtratoGeral ainda calcula.
function ExtratoControlado({ itens = movimentos, erro = null, onAbrir = vi.fn() }: { itens?: MovimentoGeral[]; erro?: string | null; onAbrir?: (movimento: MovimentoGeral) => void }) {
  const [filtros, setFiltros] = useState<FiltrosExtratoGeral>({ ...FILTROS_EXTRATO_GERAL_INICIAIS });
  return <>
    <label>Início do teste<input aria-label="Início do teste" type="date" value={filtros.inicio} onChange={e => setFiltros(f => ({ ...f, inicio: e.target.value }))} /></label>
    <label>Fim do teste<input aria-label="Fim do teste" type="date" value={filtros.fim} onChange={e => setFiltros(f => ({ ...f, fim: e.target.value }))} /></label>
    <ExtratoGeral contas={contas} movimentos={itens} filtros={filtros} onChangeFiltros={setFiltros} carregando={false} erro={erro} onAbrir={onAbrir} />
  </>;
}
it("combina filtros inclusivos de data, conta e instituição e abre o movimento exato", async () => {
  const abrir = vi.fn(); render(<ExtratoControlado onAbrir={abrir} />);
  const tabela = within(await screen.findByRole("table", { name: "Extrato geral" }));
  fireEvent.change(screen.getByLabelText("Início do teste"), { target: { value: "2026-09-13" } });
  fireEvent.change(screen.getByLabelText("Fim do teste"), { target: { value: "2026-09-13" } });
  fireEvent.change(screen.getByLabelText("Conta"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Instituição"), { target: { value: "Instituição A" } });
  expect(tabela.queryByText("Compra B")).toBeNull();
  fireEvent.click(tabela.getByText("Venda A")); expect(abrir).toHaveBeenCalledWith(movimentos[0]);
  fireEvent.change(screen.getByLabelText("Instituição"), { target: { value: "__sem__" } });
  expect(screen.getByText(/Nenhuma movimentação encontrada/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Fim do teste"), { target: { value: "2026-09-11" } });
  expect(screen.getByRole("alert").textContent).toContain("data final");
});
it("distingue erro de carregamento de extrato vazio", async () => {
  render(<ExtratoControlado itens={[]} erro="Falha na consulta" />);
  expect(await screen.findByText("Não foi possível carregar as movimentações.")).toBeTruthy();
  expect(screen.queryByText(/Nenhuma movimentação encontrada/)).toBeNull();
});

it("abre a operação da transferência sem acionar a navegação da linha", () => {
  const abrir = vi.fn();
  const transferencia: MovimentoGeral = { ...movimentos[0], transacao: { ...movimentos[0].transacao, tipo: "TRANSFERENCIA", operacao: { id: 123, descricao: "Transferência", tipo: "TRANSFERENCIA_FINANCEIRA" } } };
  render(<ExtratoControlado itens={[transferencia]} onAbrir={abrir} />);
  const link = within(screen.getByRole("table", { name: "Extrato geral" })).getByRole("link", { name: "OP-0123" });
  expect(link.getAttribute("href")).toBe("/financeiro/operacoes/123");
  fireEvent.click(link, { ctrlKey: true });
  expect(abrir).not.toHaveBeenCalled();
  fireEvent.click(link);
  expect(window.location.pathname).toBe("/financeiro/operacoes/123");
  expect(abrir).not.toHaveBeenCalled();
});
