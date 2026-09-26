// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { onlineManager } from "@tanstack/react-query";
import { gerarParcelasFinanceiras } from "@rionovo/shared";
import { FormOperacao } from "./FormOperacao";
import { criarQueryClientTeste, renderComQuery } from "./lib/testQueryClient";
import { enfileirarMutation } from "../lib/offline/fila";
import { lerRascunhoLocal, limparRascunhoLocal, salvarRascunhoLocal, type RascunhoLocal } from "./rascunhoLocal";
import { estoqueKeys, financeiroKeys } from "./queries";
import type { ConfiguracoesFinanceiras, Operacao, RascunhoOperacao } from "./novo-api";
import { uid } from "../lib/uid.fixture";

vi.mock("../lib/offline/fila", () => {
  const filaVazia: unknown[] = [];
  return {
    enfileirarMutation: vi.fn(() => new Promise(() => {})),
    inscrever: () => () => {},
    obterFila: () => filaVazia,
    aguardarFilaLivre: () => Promise.resolve(),
    filaTravada: () => false,
  };
});

let rascunhoNoAparelho: RascunhoLocal | null = null;
vi.mock("./rascunhoLocal", () => ({
  lerRascunhoLocal: vi.fn(async () => rascunhoNoAparelho),
  salvarRascunhoLocal: vi.fn(async (rascunho: Omit<RascunhoLocal, "salvoEm">) => { rascunhoNoAparelho = { ...rascunho, salvoEm: "2026-09-10T12:00:00Z" }; }),
  limparRascunhoLocal: vi.fn(async () => { rascunhoNoAparelho = null; }),
}));

const config: ConfiguracoesFinanceiras = {
  contas: [{ id: uid(1), nome: "Banco principal", tipo: "BANCO", instituicao: null, identificacao: null, saldoAbertura: "1000", dataSaldoAbertura: "2026-09-01", saldoAtual: "1000", incluirNoSaldoGeral: true, ativo: true, temMovimentos: false }],
  parceiros: [{ id: uid(1), nome: "Oficina", documento: null, tipo: "FORNECEDOR", papeis: ["PRESTADOR_SERVICO"], telefone: null, email: null, ativo: true, referencias: 0 }],
  categorias: [],
  centrosCusto: [{ id: uid(5), nome: "Pecuária", ativo: true, ordem: 0 }],
  produtos: [{ id: uid(1), nome: "Ração", unidade: "KG", centroCustoIds: [uid(5)] }],
};
const formularioServico = { tipo: "SERVICO", condicao: "A_VISTA", descricao: "Manutenção do trator", valorOperacao: "250.00", itens: [], parceiroId: uid(1), categoriaId: "", centroCustoId: "", contaId: uid(1), formaPagamento: "PIX", data: "2026-09-10", valorAgora: "", parcelas: [{ id: 1, valor: "", vencimento: "2026-10-10" }] };
const rascunhoServidor = (versao: number, formulario: Record<string, unknown> = formularioServico): RascunhoOperacao => ({ id: uid(8), versao, updatedAt: "2026-09-10T12:00:00Z", documentos: [], dados: { formulario } });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  rascunhoNoAparelho = null;
  vi.clearAllMocks();
  fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
  vi.stubGlobal("fetch", fetchMock);
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  onlineManager.setOnline(true);
});

function montar(props: Partial<Parameters<typeof FormOperacao>[0]> = {}) {
  const queryClient = criarQueryClientTeste();
  queryClient.setQueryData(financeiroKeys.configuracoes(), config);
  const onSalvo = vi.fn();
  renderComQuery(<FormOperacao config={config} onSalvo={onSalvo} {...props} />, { queryClient });
  return { onSalvo, queryClient };
}
const pedidos = () => vi.mocked(enfileirarMutation).mock.calls.map(([pedido]) => pedido);
const chamouServidor = (trecho: string) => fetchMock.mock.calls.some(([url]) => String(url).includes(trecho));

describe("FormOperacao sem conexão", () => {
  it("confirma pela fila com o id gerado no aparelho e descarta o rascunho que estava no servidor", async () => {
    onlineManager.setOnline(false);
    const { onSalvo } = montar({ rascunho: rascunhoServidor(3) });
    expect(screen.getByText(/O rascunho fica salvo neste aparelho/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));

    await waitFor(() => expect(onSalvo).toHaveBeenCalled());
    const criacao = pedidos().find((pedido) => pedido.path === "/financeiro/operacoes");
    expect(criacao).toMatchObject({ method: "POST", body: { tipo: "SERVICO", valorTotal: "250.00", financeiro: { condicao: "A_VISTA", contaId: uid(1) } } });
    const id = (criacao!.body as { id: string }).id;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(onSalvo).toHaveBeenCalledWith({ id });
    expect(pedidos()).toContainEqual(expect.objectContaining({ path: "/financeiro/operacoes/rascunho", method: "DELETE" }));
    expect(chamouServidor("/rascunho")).toBe(false);
  });

  it("erro de validação aparece no formulário e nada vai para a fila", async () => {
    onlineManager.setOnline(false);
    const { onSalvo } = montar({ rascunho: rascunhoServidor(1, { ...formularioServico, categoriaId: uid(99) }) });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
    expect(await screen.findAllByText("Selecione uma categoria ativa")).not.toHaveLength(0);
    expect(screen.getByLabelText("Categoria").getAttribute("aria-invalid")).toBe("true");
    expect(enfileirarMutation).not.toHaveBeenCalled();
    expect(onSalvo).not.toHaveBeenCalled();
  });

  it("gera as parcelas no aparelho, iguais às do servidor, sem chamar a simulação", async () => {
    onlineManager.setOnline(false);
    montar({ rascunho: rascunhoServidor(1, { ...formularioServico, condicao: "A_PRAZO", valorOperacao: "100.00" }) });
    fireEvent.click(screen.getByRole("button", { name: "Gerar parcelas" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantidade de parcelas" }), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Primeiro vencimento"), { target: { value: "2026-01-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Gerar" }));

    const esperado = gerarParcelasFinanceiras(100, 3, "MENSAL", "2026-01-31");
    expect(await screen.findAllByRole("spinbutton", { name: /Valor da parcela/ })).toHaveLength(3);
    esperado.forEach((parcela, indice) => {
      expect(Number((screen.getByRole("spinbutton", { name: `Valor da parcela ${indice + 1}` }) as HTMLInputElement).value)).toBe(parcela.valor);
      expect((screen.getByLabelText(`Vencimento da parcela ${indice + 1}`) as HTMLInputElement).value).toBe(parcela.dataVencimento);
    });
    expect(chamouServidor("simulacao-parcelas")).toBe(false);
  });

  it("anexar documento fica bloqueado", () => {
    onlineManager.setOnline(false);
    montar();
    expect((screen.getByLabelText("Anexar documentos") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("Sem conexão: anexe os documentos depois de sincronizar.")).toBeTruthy();
  });

  it("correção não vai para a fila sem conexão: mostra aviso", async () => {
    onlineManager.setOnline(false);
    const operacaoBase: Operacao = { id: uid(30), numero: 30, tipo: "SERVICO", status: "CANCELADA", data: "2026-09-10", descricao: "Manutenção do trator", valorTotal: "250.00", parceiro: { id: uid(1), nome: "Oficina", documento: null, tipo: "FORNECEDOR", telefone: null, email: null, ativo: true }, itens: [], compromissos: [], transacoes: [], movimentosEstoque: [], documentos: [] };
    const { onSalvo } = montar({ operacaoBase });
    expect(screen.getAllByText("Criar uma correção precisa de conexão.")).not.toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Criar uma correção precisa de conexão.");
    expect(enfileirarMutation).not.toHaveBeenCalled();
    expect(onSalvo).not.toHaveBeenCalled();
  });

  it("ajuste de estoque vai para a fila com o saldo lido do cache", async () => {
    onlineManager.setOnline(false);
    const queryClient = criarQueryClientTeste();
    queryClient.setQueryData(financeiroKeys.configuracoes(), config);
    queryClient.setQueryData(estoqueKeys.saldos(), [{ produtoId: uid(1), nome: "Ração", categoria: null, unidade: "KG", centrosCusto: [], saldo: 4, custoMedio: 2, valor: 8, minimoEstoque: null, abaixoMinimo: false }]);
    const onSalvo = vi.fn();
    renderComQuery(<FormOperacao config={config} tipoInicial="AJUSTE_ESTOQUE" produtoInicial={uid(1)} onSalvo={onSalvo} />, { queryClient });

    await waitFor(() => expect(screen.getByLabelText("Saldo atual").textContent).toContain("4"));
    fireEvent.change(screen.getByLabelText("Quantidade contada"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Justificativa do ajuste"), { target: { value: "Contagem de setembro" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));

    await waitFor(() => expect(onSalvo).toHaveBeenCalled());
    const [pedido] = pedidos();
    expect(pedido).toMatchObject({ path: "/estoque/ajustes", method: "POST", body: { produtoId: uid(1), quantidadeContada: 3, saldoEsperado: 4, observacao: "Contagem de setembro" } });
    expect(onSalvo).toHaveBeenCalledWith({ id: (pedido.body as { id: string }).id });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("FormOperacao — rascunho no aparelho", () => {
  it("sem conexão, o autosave grava no aparelho e não no servidor", async () => {
    onlineManager.setOnline(false);
    montar({ rascunho: rascunhoServidor(4) });
    vi.useFakeTimers();
    fireEvent.change(screen.getByRole("textbox", { name: "Descrição" }), { target: { value: "Troca de óleo" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    vi.useRealTimers();

    expect(salvarRascunhoLocal).toHaveBeenCalledWith(expect.objectContaining({ versao: 4, dados: expect.objectContaining({ formulario: expect.objectContaining({ descricao: "Troca de óleo" }) }) }));
    expect(screen.getByText("Salvo neste aparelho")).toBeTruthy();
    expect(chamouServidor("/rascunho")).toBe(false);
  });

  it("ao reabrir, restaura o que ficou no aparelho em vez do rascunho do servidor", async () => {
    onlineManager.setOnline(false);
    rascunhoNoAparelho = { versao: 4, salvoEm: "2026-09-10T12:00:00Z", dados: { formulario: { ...formularioServico, descricao: "Editado sem sinal" }, operacao: {} } };
    montar({ rascunho: rascunhoServidor(4) });
    await waitFor(() => expect((screen.getByRole("textbox", { name: "Descrição" }) as HTMLTextAreaElement).value).toBe("Editado sem sinal"));
  });

  it("ao reconectar, envia o conteúdo do aparelho com a versão que tinha e limpa o local", async () => {
    rascunhoNoAparelho = { versao: 4, salvoEm: "2026-09-10T12:00:00Z", dados: { formulario: { ...formularioServico, descricao: "Editado sem sinal" }, operacao: {} } };
    fetchMock.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({ ...rascunhoServidor(5), dados: rascunhoNoAparelho!.dados }) }));
    montar({ rascunho: rascunhoServidor(4) });

    await waitFor(() => expect(limparRascunhoLocal).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls.find(([url, opcoes]) => url === "/api/financeiro/operacoes/rascunho" && opcoes?.method === "PUT")!;
    expect(JSON.parse(String(init.body))).toMatchObject({ versao: 4, dados: { formulario: { descricao: "Editado sem sinal" } } });
  });

  it("se outro aparelho mudou o rascunho, avisa e mantém o conteúdo local", async () => {
    rascunhoNoAparelho = { versao: 4, salvoEm: "2026-09-10T12:00:00Z", dados: { formulario: { ...formularioServico, descricao: "Editado sem sinal" }, operacao: {} } };
    fetchMock.mockImplementation(async () => ({ ok: false, status: 409, json: async () => ({ error: "O rascunho foi atualizado em outra sessão. Recarregue a página antes de continuar.", code: "CONFLITO" }) }));
    montar({ rascunho: rascunhoServidor(6) });

    expect(await screen.findByText(/atualizado em outra sessão/)).toBeTruthy();
    expect(screen.getByText("Falha ao salvar")).toBeTruthy();
    expect(limparRascunhoLocal).not.toHaveBeenCalled();
    expect(await lerRascunhoLocal()).not.toBeNull();
  });
});
