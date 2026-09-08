// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FormOperacao } from "./FormOperacao";
import type { ConfiguracoesFinanceiras } from "./novo-api";
import { ToastProvider } from "../components/Toast";
import { enfileirarMutation } from "../lib/offline/fila";

const onlineRef = vi.hoisted(() => ({ atual: true }));
vi.mock("../lib/offline/useOnlineStatus", () => ({ useOnlineStatus: () => onlineRef.atual }));

// FormOperacao usa useCriarOperacao (useOfflineMutation, offline) e
// useToast() (useSalvarOffline) além do fetch cru já testado aqui via
// vi.stubGlobal("fetch") — precisa de QueryClientProvider/ToastProvider no
// contexto. A fila real (idb-keyval) não roda em jsdom — mockada, igual
// useOfflineMutation.test.ts/api.liquidar-compromisso.test.ts.
vi.mock("../lib/offline/fila", () => {
  const filaVazia: unknown[] = [];
  return {
    enfileirarMutation: vi.fn(() => new Promise(() => {})), // nenhum teste aqui confirma via sync
    inscrever: () => () => {},
    obterFila: () => filaVazia,
    aguardarFilaLivre: () => Promise.resolve(),
  };
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); onlineRef.atual = true; });

const config: ConfiguracoesFinanceiras = {
  contas: [{ id: 1, nome: "Banco principal", tipo: "BANCO", instituicao: null, identificacao: null, saldoAbertura: "1000", dataSaldoAbertura: "2026-09-01", saldoAtual: "1000", incluirNoSaldoGeral: true, ativo: true }],
  parceiros: [
    { id: 1, nome: "Fornecedor Rural", documento: null, tipo: "FORNECEDOR", telefone: null, email: null, ativo: true },
    { id: 2, nome: "Cliente Regional", documento: null, tipo: "CLIENTE", telefone: null, email: null, ativo: true },
  ],
  gruposCategorias: [],
  centrosCusto: [],
  produtos: [{ id: 1, nome: "Ração", unidade: "kg", estocavel: true, custoUnitario: "5" }],
};

function comProvedores(node: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}><ToastProvider>{node}</ToastProvider></QueryClientProvider>;
}

function montar() {
  render(comProvedores(<FormOperacao config={config} onSalvo={vi.fn()} />));
}

describe("FormOperacao", () => {
  it("abre como página e remove campos físicos quando o tipo é serviço", () => {
    montar();
    expect(screen.getByRole("heading", { name: "Nova operação" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo de operação" }), { target: { value: "SERVICO" } });
    expect(screen.queryByRole("combobox", { name: "Produto do item 1" })).toBeNull();
    expect(screen.getByRole("spinbutton", { name: "Valor total da operação" })).toBeTruthy();
  });

  it("só expõe a ação de limpar depois que o rascunho recebe conteúdo", () => {
    montar();
    expect(screen.queryByRole("button", { name: "Limpar rascunho" })).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Descrição" }), { target: { value: "Compra mensal" } });
    expect(screen.getByText("Alterações não salvas")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Limpar rascunho" }));
    expect(screen.getByRole("heading", { name: "Limpar rascunho?" })).toBeTruthy();
    expect(screen.getByText(/Todos os dados preenchidos e documentos anexados/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Manter rascunho" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Voltar para operações" })).toBeNull();
  });

  it("salva automaticamente depois de uma alteração", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 8, dados: {}, versao: 1, documentos: [], updatedAt: "2026-09-07T12:00:00Z" }) });
    vi.stubGlobal("fetch", fetchMock);
    montar();
    fireEvent.change(screen.getByRole("textbox", { name: "Descrição" }), { target: { value: "Compra mensal de ração" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/financeiro/operacoes/rascunho", expect.objectContaining({ method: "PUT" })), { timeout: 2000 });
    expect(await screen.findByText("Rascunho salvo")).toBeTruthy();
  });

  it("mantém o formulário e informa falha quando o autosave não conclui", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Rede indisponível" }) }));
    montar();
    fireEvent.change(screen.getByRole("textbox", { name: "Descrição" }), { target: { value: "Texto que não pode ser perdido" } });
    expect(await screen.findByText("Falha ao salvar", {}, { timeout: 2000 })).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Descrição" }) as HTMLTextAreaElement).value).toBe("Texto que não pode ser perdido");
  });

  it("retoma os dados persistidos ao recarregar a página", () => {
    render(comProvedores(<FormOperacao config={config} rascunho={{ id: 8, versao: 2, updatedAt: "2026-09-07T12:00:00Z", documentos: [], dados: { formulario: { tipo: "SERVICO", condicao: "A_PRAZO", descricao: "Manutenção programada", valorOperacao: "800.00", itens: [], parceiroId: "1", categoriaId: "", centroCustoId: "", contaId: "", formaPagamento: "PIX", data: "2026-09-07", valorAgora: "", parcelas: [{ id: 1, valor: "800.00", vencimento: "2026-10-07" }] } } }} onSalvo={vi.fn()} />));
    expect((screen.getByRole("textbox", { name: "Descrição" }) as HTMLTextAreaElement).value).toBe("Manutenção programada");
    expect((screen.getByRole("combobox", { name: "Condição financeira" }) as HTMLSelectElement).value).toBe("A_PRAZO");
  });

  it("permite alternar entre valor unitário e valor total do item", () => {
    montar();
    fireEvent.change(screen.getByRole("combobox", { name: "Base do valor do item 1" }), { target: { value: "TOTAL" } });
    expect(screen.getByRole("spinbutton", { name: "Valor total do item 1" })).toBeTruthy();
    expect(screen.queryByRole("spinbutton", { name: "Valor unitário do item 1" })).toBeNull();
  });

  it("deriva a unidade do produto sem permitir edição", () => {
    montar();
    fireEvent.change(screen.getByRole("combobox", { name: "Produto do item 1" }), { target: { value: "1" } });
    expect(screen.getByLabelText("Unidade do item 1").textContent).toBe("kg");
    expect(screen.queryByRole("textbox", { name: "Unidade do item 1" })).toBeNull();
  });

  it("não expõe o saldo no seletor de conta", () => {
    montar();
    expect(screen.getByRole("option", { name: "Banco principal" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Banco principal.*R\$/ })).toBeNull();
  });

  it("formata o valor informado com duas casas decimais", () => {
    montar();
    const campo = screen.getByRole("spinbutton", { name: "Valor unitário do item 1" });
    fireEvent.change(campo, { target: { value: "12.5" } });
    fireEvent.blur(campo);
    expect((campo as HTMLInputElement).value).toBe("12.50");
  });

  it("resume produto, quantidade e valor total de cada item", () => {
    montar();
    fireEvent.change(screen.getByRole("combobox", { name: "Produto do item 1" }), { target: { value: "1" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantidade do item 1" }), { target: { value: "3" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Valor unitário do item 1" }), { target: { value: "5" } });
    const resumo = screen.getAllByText("Itens da operação").at(-1)!.parentElement!;
    expect(resumo.textContent).toContain("Ração");
    expect(resumo.textContent).toContain("3 kg");
    expect(resumo.textContent?.replaceAll("\u00a0", " ")).toContain("R$ 15,00");
  });

  it("remove a introdução e posiciona o aviso antes da confirmação", () => {
    montar();
    expect(screen.queryByText(/Registre o fato de negócio uma vez/)).toBeNull();
    const aviso = screen.getByText("A confirmação cria somente os efeitos descritos acima.");
    const botao = screen.getByRole("button", { name: "Confirmar operação" });
    expect(aviso.compareDocumentPosition(botao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("explica e configura os compromissos derivados da condição a prazo", () => {
    montar();
    fireEvent.change(screen.getByRole("combobox", { name: "Condição financeira" }), { target: { value: "A_PRAZO" } });
    expect(screen.getByText("Cada parcela será criada como um compromisso vinculado a esta operação.")).toBeTruthy();
    expect(screen.getByRole("spinbutton", { name: "Valor da parcela 1" })).toBeTruthy();
    expect(screen.getByLabelText("Vencimento da parcela 1")).toBeTruthy();
  });

  it("oferece documentos tipificados no próprio cadastro", () => {
    montar();
    expect(screen.getByLabelText("Anexar documentos")).toBeTruthy();
    expect(screen.getByText("PDF, XML, JPG, PNG ou WEBP, com até 10 MB por arquivo.")).toBeTruthy();
  });

  it("ao confirmar offline com um rascunho já persistido no servidor, enfileira o descarte dele junto com a criação", () => {
    // O autosave rodou com sucesso antes de cair a conexão (por isso o
    // rascunho chega com `versao` preenchida) — sem o descarte enfileirado,
    // esse rascunho ficaria órfão no servidor depois que a operação real for
    // criada offline (ver docs/design/offline/PLANO_FINANCEIRO.md).
    vi.mocked(enfileirarMutation).mockImplementation(() => new Promise(() => {}));
    onlineRef.atual = false;
    render(comProvedores(<FormOperacao config={config} rascunho={{ id: 8, versao: 2, updatedAt: "2026-09-07T12:00:00Z", documentos: [], dados: { formulario: { tipo: "SERVICO", condicao: "A_PRAZO", descricao: "Manutenção programada", valorOperacao: "800.00", itens: [], parceiroId: "1", categoriaId: "", centroCustoId: "", contaId: "", formaPagamento: "PIX", data: "2026-09-07", valorAgora: "", parcelas: [{ id: 1, valor: "800.00", vencimento: "2026-10-07" }] } } }} onSalvo={vi.fn()} />));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
    expect(enfileirarMutation).toHaveBeenCalledWith(expect.objectContaining({ mutationKey: "financeiro-descartar-rascunho-pos-offline", path: "/financeiro/operacoes/rascunho", method: "DELETE" }));
    expect(enfileirarMutation).toHaveBeenCalledWith(expect.objectContaining({ mutationKey: "financeiro-criar-operacao" }));
  });

  it("ao confirmar offline sem nenhum rascunho persistido, não enfileira descarte de rascunho", () => {
    vi.mocked(enfileirarMutation).mockClear();
    vi.mocked(enfileirarMutation).mockImplementation(() => new Promise(() => {}));
    onlineRef.atual = false;
    montar();
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo de operação" }), { target: { value: "SERVICO" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Fornecedor ou parceiro" }), { target: { value: "1" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Descrição" }), { target: { value: "Manutenção do trator" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Valor total da operação" }), { target: { value: "3200" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Condição financeira" }), { target: { value: "A_PRAZO" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
    expect(enfileirarMutation).toHaveBeenCalledWith(expect.objectContaining({ mutationKey: "financeiro-criar-operacao" }));
    expect(enfileirarMutation).not.toHaveBeenCalledWith(expect.objectContaining({ mutationKey: "financeiro-descartar-rascunho-pos-offline" }));
  });
});
