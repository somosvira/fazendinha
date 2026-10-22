// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ImpactosOperacao, ParceiroOperacao } from "./ContextoOperacao";
import { TabelaFinanceira } from "./financeiro-ui";
import type { Operacao, ParceiroBase } from "./novo-api";
import * as permissoes from "./permissoes";
vi.mock("./permissoes", () => ({ podeVerValoresFinanceiros: vi.fn().mockReturnValue(true) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const parceiro: ParceiroBase = { id: "parceiro-1", nome: "Cooperativa", tipo: "FORNECEDOR", documento: "11222333000181", telefone: "(31) 99999-9999", email: "contato@example.test", ativo: true };
const operacao: Operacao = {
  id: "operacao-1", numero: 1, tipo: "COMPRA_ESTOQUE", status: "CONFIRMADA", data: "2026-10-01", descricao: "Compra de ração", valorTotal: "200.00", parceiro,
  itens: [{ id: "item-1", ordem: 1, descricao: "Ração", quantidade: "2", unidade: "SC", valorUnitario: "100.00", valorTotal: "200.00", estocavel: true, produtoId: "produto-1" }],
  movimentosEstoque: [{ id: "movimento-1", seq: 1, tipo: "ENTRADA", status: "CONFIRMADO", quantidade: "2", valorTotal: "200.00", produtoId: "produto-1" }],
  compromissos: [{ id: "compromisso-1", seq: 1, tipo: "PAGAR", status: "PENDENTE", valorOriginal: "200.00", valorLiquidado: "0", saldoPendente: "200.00", dataVencimento: "2026-11-01", numeroParcela: 1, totalParcelas: 1, parceiro, operacao: { id: "operacao-1", numero: 1, tipo: "COMPRA_ESTOQUE", descricao: "Compra de ração" } }],
  transacoes: [], documentos: [],
};
function montar() {
  const abrir = vi.fn();
  render(<TabelaFinanceira cartaoComLinks rotulo="Operações" onAbrir={abrir} chaveDe={op => op.id} itens={[operacao]} colunas={[
    { chave: "operacao", titulo: "Operação", principal: true, celula: op => op.descricao },
    { chave: "parceiro", titulo: "Parceiro", celula: op => <ParceiroOperacao parceiro={op.parceiro} /> },
    { chave: "impactos", titulo: "Impacto gerado", celula: op => <ImpactosOperacao operacao={op} /> },
  ]} />);
  return abrir;
}
describe("contexto da operação", () => {
  it("abre o parceiro sem abrir a linha e aponta para o cadastro exato", () => {
    const abrir = montar();
    fireEvent.click(screen.getAllByRole("button", { name: "Informações de Cooperativa" })[0]);
    const painel = screen.getByRole("dialog", { name: "Cooperativa" });
    expect(within(painel).getByText("11.222.333/0001-81")).toBeTruthy();
    expect(within(painel).getByText("contato@example.test")).toBeTruthy();
    expect(within(painel).getByRole("link", { name: "Ver cadastro do parceiro" }).getAttribute("href")).toBe("/financeiro/configuracoes?aba=parceiros&parceiro=parceiro-1");
    expect(abrir).not.toHaveBeenCalled();
  });
  it("explica estoque e preserva o vínculo com o movimento", () => {
    const abrir = montar();
    fireEvent.click(screen.getAllByRole("button", { name: "Ver impacto no estoque" })[0]);
    const painel = screen.getByRole("dialog", { name: "Movimentos de estoque" });
    expect(within(painel).getByText("Entrada · Ração")).toBeTruthy();
    expect(within(painel).getByText(/2 SC/)).toBeTruthy();
    fireEvent.click(within(painel).getByRole("button", { name: "Fechar informações" }));
    expect(abrir).not.toHaveBeenCalled();
  });
  it("explica o compromisso e oculta seus valores sem verValores", () => {
    vi.mocked(permissoes.podeVerValoresFinanceiros).mockReturnValue(false);
    const abrir = montar();
    fireEvent.click(screen.getAllByRole("button", { name: "Ver contas a pagar" })[0]);
    const painel = screen.getByRole("dialog", { name: "Contas a pagar" });
    expect(within(painel).getByText("Vencimento 01/11/2026")).toBeTruthy();
    expect(within(painel).queryByText(/200,00/)).toBeNull();
    expect(within(painel).getByRole("link", { name: "Ver compromisso" }).getAttribute("href")).toBe("/financeiro/compromissos?situacao=pagar&compromisso=compromisso-1");
    expect(abrir).not.toHaveBeenCalled();
  });
});
