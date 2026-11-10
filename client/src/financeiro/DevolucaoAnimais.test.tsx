// @vitest-environment jsdom
// "Devolver cabeças" na ficha da compra de animais: seleção, valores, condição financeira e erros por animal.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { alterarControle } from "../lib/controles.fixture";
import { OperacaoFinanceiraDetalhe } from "./OperacaoFinanceiraDetalhe";
import { emDias, hoje } from "./financeiro-ui";
import * as permissoes from "./permissoes";
import type { Operacao } from "./novo-api";
import { uid } from "../lib/uid.fixture";

const mocks = vi.hoisted(() => ({ criarOperacao: vi.fn(), obterConfiguracoesFinanceiras: vi.fn(), obterOperacao: vi.fn() }));
vi.mock("./novo-api", async (importOriginal) => ({ ...(await importOriginal<typeof import("./novo-api")>()), ...mocks }));

const animal = (n: number, situacao: { baixa?: { tipo: string; data: string }; devolucao?: { id: string; numero: number } } = {}) => ({
  id: uid(100 + n), brinco: String(100 + n), nome: null, situacao: { baixa: situacao.baixa ?? null, devolucao: situacao.devolucao ?? null },
});
const itemAnimal = (n: number, valor: string, situacao = {}) => ({
  id: uid(200 + n), ordem: n, descricao: `Animal ${100 + n}`, quantidade: "1", unidade: "cab", valorUnitario: valor, valorTotal: valor, estocavel: false, produtoId: null,
  animalId: uid(100 + n), animal: animal(n, situacao), categoriaId: uid(300), categoriaNome: "Compra de animais", centroCustoId: n === 4 ? uid(401) : null, centroCustoNome: null,
});

function compra(sobrescrever: Partial<Operacao> = {}): Operacao {
  return {
    id: uid(7), numero: 7, tipo: "COMPRA_ANIMAIS", status: "CONFIRMADA", data: "2026-09-02", descricao: "Garrotes do leilão", valorTotal: "15000",
    parceiroId: uid(1), centroCustoId: uid(400), centroCusto: { id: uid(400), nome: "Corte" },
    parceiro: { id: uid(1), nome: "Fazenda Vendedora", documento: null, tipo: "FORNECEDOR", telefone: null, email: null, ativo: true },
    itens: [
      itemAnimal(1, "4500"), itemAnimal(2, "4000.50", { devolucao: { id: uid(12), numero: 12 } }), itemAnimal(3, "3500", { baixa: { tipo: "MORTE", data: "2026-10-01" } }), itemAnimal(4, "3000"),
      { id: uid(250), ordem: 5, descricao: "Frete", quantidade: "1", unidade: "un", valorUnitario: "300", valorTotal: "300", estocavel: false, produtoId: null },
    ],
    transacoes: [], compromissos: [], movimentosEstoque: [], documentos: [],
    ...sobrescrever,
  } as unknown as Operacao;
}

const configuracoes = { contas: [{ id: uid(500), nome: "Banco principal", ativo: true }, { id: uid(501), nome: "Conta velha", ativo: false }], parceiros: [], categorias: [], centrosCusto: [], produtos: [] };

beforeEach(() => {
  window.history.replaceState(null, "", `/financeiro/operacoes/${uid(7)}`);
  mocks.obterOperacao.mockResolvedValue(compra());
  mocks.obterConfiguracoesFinanceiras.mockResolvedValue(configuracoes);
  mocks.criarOperacao.mockResolvedValue({ id: uid(20), numero: 20 });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); });

async function abrir(opcoes: { operacao?: Operacao; podeLancar?: boolean; onAbrir?: (id: string) => void } = {}) {
  mocks.obterOperacao.mockResolvedValue(opcoes.operacao ?? compra());
  const onAbrir = opcoes.onAbrir ?? vi.fn();
  render(<OperacaoFinanceiraDetalhe operacaoId={uid(7)} onVoltar={vi.fn()} onAbrir={onAbrir} onCorrigir={vi.fn()} podeLancar={opcoes.podeLancar} />);
  await screen.findByText("Garrotes do leilão");
  return { onAbrir };
}
async function abrirModal() {
  fireEvent.click(await screen.findByRole("button", { name: "Devolver cabeças" }));
  const dialogo = await screen.findByRole("dialog", { name: "Devolver cabeças" });
  await waitFor(() => expect(mocks.obterConfiguracoesFinanceiras).toHaveBeenCalled());
  return dialogo;
}

describe("botão Devolver cabeças", () => {
  it("aparece na compra de animais confirmada para quem lança e vê valores", async () => {
    await abrir();
    expect(screen.getByRole("button", { name: "Devolver cabeças" })).toBeTruthy();
  });

  it("não aparece sem permissão de lançar ou de ver valores", async () => {
    await abrir({ podeLancar: false });
    expect(screen.queryByRole("button", { name: "Devolver cabeças" })).toBeNull();
    cleanup();
    vi.spyOn(permissoes, "podeVerValoresFinanceiros").mockReturnValue(false);
    await abrir();
    expect(screen.queryByRole("button", { name: "Devolver cabeças" })).toBeNull();
  });

  it("não aparece em outro tipo, em compra cancelada nem em compra sem animal", async () => {
    await abrir({ operacao: compra({ tipo: "COMPRA_ESTOQUE" }) });
    expect(screen.queryByRole("button", { name: "Devolver cabeças" })).toBeNull();
    cleanup();
    await abrir({ operacao: compra({ status: "CANCELADA" }) });
    expect(screen.queryByRole("button", { name: "Devolver cabeças" })).toBeNull();
    cleanup();
    await abrir({ operacao: compra({ itens: compra().itens.filter((item) => !item.animalId) }) });
    expect(screen.queryByRole("button", { name: "Devolver cabeças" })).toBeNull();
  });
});

describe("ficha da compra", () => {
  it("lista a situação de cada animal, com link para a devolução", async () => {
    const { onAbrir } = await abrir();
    expect(screen.getByRole("columnheader", { name: "Situação do animal" })).toBeTruthy();
    expect(screen.getAllByText("Fora do rebanho: Morte").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ativo").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Devolvido na OP-0012" })[0]);
    expect(onAbrir).toHaveBeenCalledWith(uid(12));
  });
});

describe("modal Devolver cabeças", () => {
  it("desabilita animais devolvidos ou fora do rebanho e diz o motivo", async () => {
    await abrir();
    const dialogo = await abrirModal();
    const lista = within(dialogo).getByRole("list", { name: "Animais da compra" });
    expect((within(lista).getByLabelText("Devolver animal 101") as HTMLInputElement).disabled).toBe(false);
    expect((within(lista).getByLabelText("Devolver animal 102") as HTMLInputElement).disabled).toBe(true);
    expect((within(lista).getByLabelText("Devolver animal 103") as HTMLInputElement).disabled).toBe(true);
    expect(within(lista).getByText("Devolvido na OP-0012")).toBeTruthy();
    expect(within(lista).getByText("Fora do rebanho: Morte")).toBeTruthy();
    expect(within(dialogo).getByText(/não abate parcelas em aberto/)).toBeTruthy();
  });

  it("preenche o valor pago, calcula o total e a descrição padrão", async () => {
    await abrir();
    const dialogo = await abrirModal();
    fireEvent.click(within(dialogo).getByLabelText("Devolver animal 101"));
    expect((within(dialogo).getByLabelText("Valor devolvido do animal 101") as HTMLInputElement).value).toBe("4500");
    expect((within(dialogo).getByLabelText("Descrição da devolução") as HTMLInputElement).value).toBe("Devolução de 1 cabeça da OP-0007");
    fireEvent.click(within(dialogo).getByLabelText("Devolver animal 104"));
    expect(within(dialogo).getByLabelText("Total da devolução").textContent).toContain("7.500,00");
    expect((within(dialogo).getByLabelText("Descrição da devolução") as HTMLInputElement).value).toBe("Devolução de 2 cabeças da OP-0007");
  });

  it("sem animal selecionado, não envia", async () => {
    await abrir();
    const dialogo = await abrirModal();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar devolução" }));
    expect(await within(dialogo).findByText("Selecione ao menos um animal para devolver.")).toBeTruthy();
    expect(mocks.criarOperacao).not.toHaveBeenCalled();
  });

  it("a receber: envia a devolução ao fornecedor, com valor editado e uma parcela, e abre a ficha criada", async () => {
    const { onAbrir } = await abrir();
    const dialogo = await abrirModal();
    fireEvent.click(within(dialogo).getByLabelText("Devolver animal 101"));
    fireEvent.change(within(dialogo).getByLabelText("Valor devolvido do animal 101"), { target: { value: "4000" } });
    fireEvent.click(within(dialogo).getByLabelText("Devolver animal 104"));
    fireEvent.change(within(dialogo).getByLabelText("Descrição da devolução"), { target: { value: "Devolução por vício redibitório" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar devolução" }));
    await waitFor(() => expect(mocks.criarOperacao).toHaveBeenCalledOnce());
    const corpo = mocks.criarOperacao.mock.calls[0][0];
    expect(corpo).toMatchObject({
      tipo: "DEVOLUCAO", data: hoje(), descricao: "Devolução por vício redibitório", parceiroId: uid(1), centroCustoId: uid(400),
      financeiro: { condicao: "A_PRAZO", parcelas: [{ valor: "7000.00", dataVencimento: emDias(30) }] },
    });
    expect(corpo.chave).toMatch(/^[0-9a-f-]{36}$/);
    expect(corpo.itens).toEqual([
      { descricao: "Devolução animal 101", quantidade: 1, unidade: "cab", valorTotal: "4000", animalId: uid(101), categoriaId: uid(300), centroCustoId: null, estocavel: false },
      { descricao: "Devolução animal 104", quantidade: 1, unidade: "cab", valorTotal: "3000", animalId: uid(104), categoriaId: uid(300), centroCustoId: uid(401), estocavel: false },
    ]);
    await waitFor(() => expect(onAbrir).toHaveBeenCalledWith(uid(20)));
  });

  it("recebido em conta: envia a conta ativa e a forma de recebimento", async () => {
    await abrir();
    const dialogo = await abrirModal();
    fireEvent.click(within(dialogo).getByLabelText("Devolver animal 101"));
    await alterarControle(within(dialogo).getByLabelText("Condição da devolução"), { target: { value: "RECEBIDO" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar devolução" }));
    expect(await within(dialogo).findByText("Escolha a conta que recebeu o valor.")).toBeTruthy();
    expect(mocks.criarOperacao).not.toHaveBeenCalled();
    fireEvent.click(within(dialogo).getByLabelText("Conta de recebimento"));
    expect(screen.queryByRole("option", { name: "Conta velha" })).toBeNull();
    fireEvent.click(await screen.findByRole("option", { name: "Banco principal" }));
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar devolução" }));
    await waitFor(() => expect(mocks.criarOperacao).toHaveBeenCalledOnce());
    expect(mocks.criarOperacao.mock.calls[0][0].financeiro).toEqual({ condicao: "A_VISTA", contaId: uid(500), formaPagamento: "PIX" });
  });

  it("mostra o erro itens.N.animalId no animal certo e mantém a chave ao reenviar sem mudanças", async () => {
    const { ApiError } = await import("./novo-api");
    const recusa = () => Promise.reject(new ApiError("O animal já foi devolvido na operação #12", 409, "CONFLITO", "itens.1.animalId"));
    mocks.criarOperacao.mockImplementationOnce(recusa).mockImplementationOnce(recusa);
    await abrir();
    const dialogo = await abrirModal();
    fireEvent.click(within(dialogo).getByLabelText("Devolver animal 101"));
    fireEvent.click(within(dialogo).getByLabelText("Devolver animal 104"));
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar devolução" }));
    const linhaErro = await waitFor(() => {
      const el = dialogo.querySelector<HTMLElement>(`#devolucao-animal-${uid(204)}`)!;
      expect(within(el).getByLabelText("Valor devolvido do animal 104").getAttribute("aria-invalid")).toBe("true");
      return el;
    });
    expect(within(linhaErro).getByText("O animal já foi devolvido na operação #12")).toBeTruthy();
    expect(within(dialogo).getByLabelText("Valor devolvido do animal 101").getAttribute("aria-invalid")).toBeNull();
    fireEvent.click(await within(dialogo).findByRole("button", { name: "Confirmar devolução" }));
    await waitFor(() => expect(mocks.criarOperacao).toHaveBeenCalledTimes(2));
    expect(mocks.criarOperacao.mock.calls[1][0].chave).toBe(mocks.criarOperacao.mock.calls[0][0].chave);
    fireEvent.change(within(dialogo).getByLabelText("Valor devolvido do animal 104"), { target: { value: "2900" } });
    fireEvent.click(await within(dialogo).findByRole("button", { name: "Confirmar devolução" }));
    await waitFor(() => expect(mocks.criarOperacao).toHaveBeenCalledTimes(3));
    expect(mocks.criarOperacao.mock.calls[2][0].chave).not.toBe(mocks.criarOperacao.mock.calls[0][0].chave);
  });

  it("erro do fornecedor (parceiroId) aparece como mensagem geral", async () => {
    const { ApiError } = await import("./novo-api");
    mocks.criarOperacao.mockRejectedValueOnce(new ApiError("Devolva ao fornecedor da compra #7", 422, "VALIDACAO", "parceiroId"));
    await abrir();
    const dialogo = await abrirModal();
    fireEvent.click(within(dialogo).getByLabelText("Devolver animal 101"));
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar devolução" }));
    expect(await within(dialogo).findByText("Devolva ao fornecedor da compra #7")).toBeTruthy();
  });
});
