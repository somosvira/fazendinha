import { alterarControle } from "../lib/controles.fixture";
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormOperacao } from "./FormOperacao";
import { setPropriedadeAtiva } from "../propriedadeScope";
import type { ConfiguracoesFinanceiras } from "./novo-api";
import { uid } from "../lib/uid.fixture";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

const config: ConfiguracoesFinanceiras = {
  contas: [
    { id: uid(1), nome: "Banco principal", tipo: "BANCO", instituicao: null, identificacao: null, saldoAbertura: "1000", dataSaldoAbertura: "2026-09-01", saldoAtual: "1000", incluirNoSaldoGeral: true, ativo: true, temMovimentos: false },
    { id: uid(2), nome: "Conta desativada", tipo: "CAIXA", instituicao: null, identificacao: null, saldoAbertura: "0", dataSaldoAbertura: "2026-09-01", saldoAtual: "0", incluirNoSaldoGeral: true, ativo: false, temMovimentos: false },
  ],
  parceiros: [
    { id: uid(1), nome: "Fornecedor Rural", documento: null, tipo: "FORNECEDOR", telefone: null, email: null, ativo: true, referencias: 0 },
    { id: uid(2), nome: "Cliente Regional", documento: null, tipo: "CLIENTE", telefone: null, email: null, ativo: true, referencias: 0 },
    { id: uid(3), nome: "Fornecedor desativado", documento: null, tipo: "FORNECEDOR", telefone: null, email: null, ativo: false, referencias: 4 },
  ],
  categorias: [],
  centrosCusto: [],
  produtos: [{ id: uid(1), nome: "Ração", unidade: "KG" }],
};

function montar() {
  render(<FormOperacao config={config} onSalvo={vi.fn()} />);
}

describe("altura disponível e foco nos painéis da operação", () => {
  it("contém a rolagem da página só enquanto a operação está aberta e restaura os estilos anteriores", () => {
    document.documentElement.style.setProperty("overflow", "auto", "important");
    document.body.style.removeProperty("overflow");
    document.body.style.setProperty("overflow-x", "clip", "important");
    const { unmount } = render(<FormOperacao config={config} onSalvo={vi.fn()} />);
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.documentElement.style.overflow).toBe("auto");
    expect(document.documentElement.style.getPropertyPriority("overflow")).toBe("important");
    expect(document.body.style.getPropertyValue("overflow")).toBe("");
    expect(document.body.style.getPropertyValue("overflow-x")).toBe("clip");
    expect(document.body.style.getPropertyPriority("overflow-x")).toBe("important");
    expect(document.body.style.getPropertyValue("overflow-y")).toBe("");
    document.documentElement.style.removeProperty("overflow");
    document.body.style.removeProperty("overflow-x");
  });

  it("inclui o título no painel e recalcula o espaço quando um aviso do shell muda", () => {
    let topo = 64;
    const callbacks: ResizeObserverCallback[] = [];
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return { top: this.classList.contains("pagina-operacao") ? topo : 0 } as DOMRect;
    });
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: ResizeObserverCallback) { callbacks.push(callback); }
      observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn();
    });
    vi.stubGlobal("innerHeight", 800);
    const { container } = render(<><div role="status">Aviso do sítio</div><FormOperacao config={config} onSalvo={vi.fn()} /></>);
    const pagina = container.querySelector<HTMLElement>(".pagina-operacao")!;
    expect(pagina.style.height).toBe("736px");
    expect(screen.getByTestId("campos-operacao").contains(screen.getByRole("heading", { name: "Nova operação" }))).toBe(true);
    topo = 112;
    act(() => callbacks[0]([], {} as ResizeObserver));
    expect(pagina.style.height).toBe("688px");
    expect(callbacks.length).toBeGreaterThanOrEqual(1);
  });

  it.each([720, 1180])("rola apenas o painel interno e preserva o foco a %i px", async (largura) => {
    vi.stubGlobal("innerWidth", largura);
    const rolar = vi.fn();
    const rolarPagina = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = rolarPagina;
    montar();
    const painel = screen.getByTestId("campos-operacao");
    Object.defineProperty(painel, "scrollTo", { value: rolar, configurable: true });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Fornecedor ou parceiro")));
    expect(rolar).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }));
    expect(rolarPagina).not.toHaveBeenCalled();
    HTMLElement.prototype.scrollIntoView = original;
  });
});

describe("erros de distribuição dos lotes", () => {
  const mensagemSoma = "A soma dos lotes deve conferir com a quantidade do movimento: esperado 10; soma informada 7.";
  function preparar(partidas = [{ quantidade: "4", validade: null }, { quantidade: "3", validade: null }], campoApi?: string, segundoItem = false) {
    const onSalvo = vi.fn();
    const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
      const caminho = String(url);
      if (caminho.includes("/estoque/partidas?")) return { ok: true, json: async () => [] };
      if (caminho.endsWith("/financeiro/operacoes/rascunho") && init?.method === "PUT") return { ok: true, json: async () => ({ id: "draft", dados: {}, versao: 4, documentos: [] }) };
      if (caminho.endsWith("/financeiro/operacoes/rascunho/confirmacao")) return { ok: false, status: 422, json: async () => ({ error: "Confira a quantidade deste lote.", code: "VALIDACAO", campo: campoApi }) };
      return { ok: true, json: async () => ({ existente: null }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const item = { id: 900, produtoId: uid(1), descricao: "Ração", quantidade: "10", unidade: "KG", modoValor: "UNITARIO", valorUnitario: "2", valorTotal: "", categoriaId: "", classificacao: "", centroCustoId: "", partidas };
    render(<FormOperacao config={{ ...config, produtos: [{ ...config.produtos[0], rastrearPartidas: true }, { id: uid(2), nome: "Sal mineral", unidade: "KG" }] }} rascunho={{ id: "draft", versao: 3, updatedAt: "2026-10-04", documentos: [], dados: { formulario: {
      tipo: "INVENTARIO_INICIAL", condicao: "SEM_EFEITO_FINANCEIRO", descricao: "Estoque conferido", itens: segundoItem ? [{ ...item, id: 42, produtoId: uid(2), descricao: "Sal mineral", partidas: undefined }, item] : [item],
    } } }} onSalvo={onSalvo} />);
    return { onSalvo, fetchMock };
  }

  it("exibe soma esperada e informada junto aos lotes e à confirmação, preserva os dados e foca o aviso", async () => {
    const { onSalvo, fetchMock } = preparar();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
    await screen.findAllByText(mensagemSoma);
    const grupo = document.getElementById("campo-itens.0.partidas")!;
    expect(grupo.getAttribute("aria-invalid")).toBe("true");
    expect(grupo.querySelector('[role="alert"]')?.textContent).toBe(mensagemSoma);
    expect(grupo.querySelector('[role="alert"] svg')).toBeTruthy();
    expect(screen.getByTestId("confirmacao-operacao").textContent).toContain(mensagemSoma);
    await waitFor(() => expect(document.activeElement).toBe(grupo.querySelector('[role="alert"]')));
    expect((screen.getByLabelText("Quantidade do lote 1") as HTMLInputElement).value).toBe("4");
    expect((screen.getByLabelText("Quantidade do lote 2") as HTMLInputElement).value).toBe("3");
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/confirmacao"))).toBe(false);
    expect(onSalvo).not.toHaveBeenCalled();
  });

  it("foca a quantidade inválida da primeira linha sem o aviso tomar o foco", async () => {
    preparar([{ quantidade: "", validade: null }, { quantidade: "10", validade: null }]);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Quantidade do lote 1")));
    expect(document.getElementById("campo-itens.0.partidas.0")?.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByTestId("confirmacao-operacao").textContent).toContain("Informe a quantidade de cada lote.");
  });

  it.each(["itens.0.partidas", "itens.0.partidas.1.quantidade"])("localiza o campo da API %s após renderizar a mensagem", async (campo) => {
    const { onSalvo } = preparar([{ quantidade: "4", validade: null }, { quantidade: "6", validade: null }], campo);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
    await screen.findAllByText("Confira a quantidade deste lote.");
    const alvo = campo.endsWith("quantidade") ? screen.getByLabelText("Quantidade do lote 2") : document.getElementById("erro-itens.0.partidas");
    await waitFor(() => expect(document.activeElement).toBe(alvo));
    if (campo.endsWith("quantidade")) expect(document.getElementById("campo-itens.0.partidas.1")?.querySelector('[role="alert"]')?.textContent).toBe("Confira a quantidade deste lote.");
    expect(onSalvo).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Quantidade do lote 2") as HTMLInputElement).value).toBe("6");
  });

  it("localiza a distribuição pelo índice do segundo item e limpa o erro ao corrigir sua soma", async () => {
    const { fetchMock } = preparar(undefined, undefined, true);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
    const grupo = document.getElementById("campo-itens.1.partidas")!;
    await waitFor(() => expect(document.activeElement).toBe(grupo.querySelector('[role="alert"]')));
    expect(document.getElementById("item-900")?.contains(grupo)).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/confirmacao"))).toBe(false);
    await alterarControle(screen.getByLabelText("Quantidade do lote 2"), { target: { value: "6" } });
    expect(grupo.getAttribute("aria-invalid")).toBeNull();
    expect(screen.queryAllByText(mensagemSoma)).toHaveLength(0);
    expect((screen.getByLabelText("Quantidade do item 1") as HTMLInputElement).value).toBe("10");
  });

  it("erro da API no segundo item preserva validade e quantidades até a edição da linha indicada", async () => {
    preparar([{ quantidade: "4", validade: null }, { quantidade: "6", validade: null }], "itens.1.partidas.1.quantidade", true);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
    await screen.findAllByText("Confira a quantidade deste lote.");
    const quantidade = screen.getByLabelText("Quantidade do lote 2");
    await waitFor(() => expect(document.activeElement).toBe(quantidade));
    expect(quantidade.getAttribute("aria-invalid")).toBe("true");
    expect((screen.getByLabelText("Situação da validade 2") as HTMLSelectElement).value).toBe("NAO_INFORMADA");
    expect((screen.getByLabelText("Quantidade do lote 1") as HTMLInputElement).value).toBe("4");
    await alterarControle(quantidade, { target: { value: "5" } });
    expect(quantidade.getAttribute("aria-invalid")).toBeNull();
    expect(screen.queryAllByText("Confira a quantidade deste lote.")).toHaveLength(0);
  });

  it("remover o item anterior limpa o erro da API cujo índice deixou de representar a distribuição", async () => {
    preparar([{ quantidade: "4", validade: null }, { quantidade: "6", validade: null }], "itens.1.partidas.1.quantidade", true);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
    await screen.findAllByText("Confira a quantidade deste lote.");
    fireEvent.click(screen.getByRole("button", { name: "Remover item 1" }));
    expect(document.getElementById("campo-itens.1.partidas")).toBeNull();
    expect(document.getElementById("campo-itens.0.partidas")?.getAttribute("aria-invalid")).toBeNull();
    expect(screen.queryAllByText("Confira a quantidade deste lote.")).toHaveLength(0);
    expect((screen.getByLabelText("Quantidade do lote 1") as HTMLInputElement).value).toBe("4");
    expect((screen.getByLabelText("Quantidade do lote 2") as HTMLInputElement).value).toBe("6");
  });
});

it("apresenta produto e quantidade antes dos lotes por validade na compra", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: unknown) => ({ ok: true, json: async () => String(url).includes("/estoque/partidas?") ? [] : { custoMedio: null } })));
  render(<FormOperacao config={{ ...config, produtos: [{ ...config.produtos[0], rastrearPartidas: true }] }} tipoInicial="COMPRA_ESTOQUE" onSalvo={vi.fn()} />);
  const produto = screen.getByLabelText("Produto do item 1");
  await alterarControle(produto, { target: { value: uid(1) } });
  const validade = await screen.findByLabelText("Situação da validade 1");
  expect(produto.compareDocumentPosition(validade) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByLabelText("Quantidade do item 1").compareDocumentPosition(validade) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it("retry após resposta perdida repete chave e versão sem recriar o rascunho", async () => {
  const confirmacoes: Array<{ chave: string; versao: number }> = [];
  let salvamentos = 0;
  const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
    if (String(url).endsWith("/financeiro/operacoes/rascunho") && init?.method === "PUT") {
      salvamentos++;
      return { ok: true, json: async () => ({ id: "draft", dados: {}, versao: 4, documentos: [] }) };
    }
    if (String(url).endsWith("/financeiro/operacoes/rascunho/confirmacao")) {
      confirmacoes.push(JSON.parse(String(init?.body)));
      if (confirmacoes.length === 1) throw new Error("Resposta da confirmação não chegou. Tente novamente.");
      return { ok: true, json: async () => ({ id: "operacao", numero: 7, documentos: [] }) };
    }
    return { ok: true, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  const onSalvo = vi.fn();
  render(<FormOperacao config={config} tipoInicial="SERVICO" onSalvo={onSalvo} />);
  await alterarControle(screen.getByLabelText("Descrição"), { target: { value: "Consulta sanitária" } });
  await alterarControle(screen.getByLabelText("Valor total da operação"), { target: { value: "100" } });
  await alterarControle(screen.getByLabelText("Prestador de serviço"), { target: { value: uid(1) } });
  await alterarControle(screen.getByLabelText("Conta financeira"), { target: { value: uid(1) } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
  await screen.findAllByText("Resposta da confirmação não chegou. Tente novamente.");
  const antesDoRetry = salvamentos;
  fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
  await waitFor(() => expect(onSalvo).toHaveBeenCalled());
  expect(confirmacoes).toHaveLength(2);
  expect(confirmacoes[1]).toEqual(confirmacoes[0]);
  expect(confirmacoes[0].chave).toMatch(/^[0-9a-f-]{36}$/);
  expect(salvamentos).toBe(antesDoRetry);
  const persistido = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/rascunho") && init?.method === "PUT");
  expect(JSON.parse(String(persistido?.[1]?.body)).dados.operacao.chave).toBe(confirmacoes[0].chave);
});

describe("FormOperacao", () => {
  it("oferece ajuste de estoque como tipo de operação", () => {
    montar();
    fireEvent.click(screen.getByRole("combobox", { name: "Tipo de operação" }));
    expect(screen.getByRole("option", { name: "Ajuste de estoque" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Compra para estoque" })).toBeTruthy();
  });

  it("sugere pagamento sem aplicar automaticamente e permite escolher outra forma", async () => {
    render(<FormOperacao config={{ ...config, parceiros: [{ ...config.parceiros[0], papeis: ["PRESTADOR_SERVICO"], formaPagamentoPreferida: "BOLETO", condicaoPagamentoPreferida: "A_PRAZO", prazosPagamento: [30, 60] }] }} tipoInicial="SERVICO" onSalvo={vi.fn()} />);
    await alterarControle(screen.getByLabelText("Prestador de serviço"), { target: { value: uid(1) } });
    await alterarControle(screen.getByLabelText("Valor total da operação"), { target: { value: "100" } });
    expect((screen.getByLabelText("Condição financeira") as HTMLSelectElement).value).toBe("A_VISTA");
    expect((screen.getByLabelText("Forma de liquidação") as HTMLSelectElement).value).toBe("PIX");
    fireEvent.click(screen.getByRole("button", { name: "Usar sugestão" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect((screen.getByLabelText("Condição financeira") as HTMLSelectElement).value).toBe("A_VISTA");
    fireEvent.click(screen.getByRole("button", { name: "Usar sugestão" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar sugestão" }));
    expect((screen.getByLabelText("Condição financeira") as HTMLSelectElement).value).toBe("A_PRAZO");
    expect((screen.getByLabelText("Valor da parcela 1") as HTMLInputElement).value).toBe("50.00");
    expect((screen.getByLabelText("Valor da parcela 2") as HTMLInputElement).value).toBe("50.00");
    await alterarControle(screen.getByLabelText("Condição financeira"), { target: { value: "A_VISTA" } });
    await alterarControle(screen.getByLabelText("Forma de liquidação"), { target: { value: "DINHEIRO" } });
    expect((screen.getByLabelText("Forma de liquidação") as HTMLSelectElement).value).toBe("DINHEIRO");
  });

  it("não bloqueia o botão com parceiro que perdeu o papel necessário — ao clicar, rola e foca o campo em vez de deixar o usuário procurando", () => {
    const scroll = vi.fn();
    const originalScroll = HTMLElement.prototype.scrollTo;
    HTMLElement.prototype.scrollTo = scroll;
    try {
      render(<FormOperacao config={config} rascunho={{ id: uid(8), versao: 1, updatedAt: "2026-09-11", documentos: [], dados: { formulario: { tipo: "SERVICO", condicao: "A_VISTA", descricao: "Manutenção", valorOperacao: "100", parceiroId: uid(2), contaId: uid(1), formaPagamento: "PIX", data: "2026-09-11" } } }} onSalvo={vi.fn()} />);
      expect(screen.getByRole("alert").textContent).toContain("não tem um papel compatível");
      const confirmar = screen.getByRole("button", { name: "Confirmar operação" }) as HTMLButtonElement;
      expect(confirmar.disabled).toBe(false);

      fireEvent.click(confirmar);
      const parceiroSelect = screen.getByLabelText("Prestador de serviço");
      expect(parceiroSelect.getAttribute("aria-invalid")).toBe("true");
      expect(parceiroSelect.id).toBe("campo-parceiroId");
      expect(scroll).toHaveBeenCalled();
      expect(document.activeElement).toBe(parceiroSelect);
    } finally { HTMLElement.prototype.scrollTo = originalScroll; }
  });

  it("abre como página e remove campos físicos quando o tipo é serviço", async () => {
    montar();
    expect(screen.getByRole("heading", { name: "Nova operação" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    await alterarControle(screen.getByRole("combobox", { name: "Tipo de operação" }), { target: { value: "SERVICO" } });
    expect(screen.queryByRole("combobox", { name: "Produto do item 1" })).toBeNull();
    expect(screen.getByRole("spinbutton", { name: "Valor total da operação" })).toBeTruthy();
  });

  it("só expõe a ação de limpar depois que o rascunho recebe conteúdo", async () => {
    montar();
    expect(screen.queryByRole("button", { name: "Limpar rascunho" })).toBeNull();
    await alterarControle(screen.getByRole("textbox", { name: "Descrição" }), { target: { value: "Compra mensal" } });
    expect(screen.getByText("Alterações não salvas")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Limpar rascunho" }));
    expect(screen.getByRole("heading", { name: "Limpar rascunho?" })).toBeTruthy();
    expect(screen.getByText(/Todos os dados preenchidos e documentos anexados/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Manter rascunho" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Voltar para operações" })).toBeNull();
  });

  it("salva automaticamente depois de uma alteração", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: uid(8), dados: {}, versao: 1, documentos: [], updatedAt: "2026-09-07T12:00:00Z" }) });
    vi.stubGlobal("fetch", fetchMock);
    montar();
    await alterarControle(screen.getByRole("textbox", { name: "Descrição" }), { target: { value: "Compra mensal de ração" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/financeiro/operacoes/rascunho", expect.objectContaining({ method: "PUT" })), { timeout: 2000 });
    expect(await screen.findByText("Rascunho salvo")).toBeTruthy();
  });

  it("mantém o formulário e informa falha quando o autosave não conclui", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Rede indisponível" }) }));
    montar();
    await alterarControle(screen.getByRole("textbox", { name: "Descrição" }), { target: { value: "Texto que não pode ser perdido" } });
    expect(await screen.findByText("Falha ao salvar", {}, { timeout: 2000 })).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Descrição" }) as HTMLTextAreaElement).value).toBe("Texto que não pode ser perdido");
  });

  it("retoma os dados persistidos ao recarregar a página", () => {
    render(<FormOperacao config={config} rascunho={{ id: uid(8), versao: 2, updatedAt: "2026-09-07T12:00:00Z", documentos: [], dados: { formulario: { tipo: "SERVICO", condicao: "A_PRAZO", descricao: "Manutenção programada", valorOperacao: "800.00", itens: [], parceiroId: uid(1), categoriaId: "", centroCustoId: "", contaId: "", formaPagamento: "PIX", data: "2026-09-07", valorAgora: "", parcelas: [{ id: 1, valor: "800.00", vencimento: "2026-10-07" }] } } }} onSalvo={vi.fn()} />);
    expect((screen.getByRole("textbox", { name: "Descrição" }) as HTMLTextAreaElement).value).toBe("Manutenção programada");
    expect((screen.getByRole("combobox", { name: "Condição financeira" }) as HTMLSelectElement).value).toBe("A_PRAZO");
  });

  it("permite alternar entre valor unitário e valor total do item", async () => {
    montar();
    await alterarControle(screen.getByRole("combobox", { name: "Base do valor do item 1" }), { target: { value: "TOTAL" } });
    expect(screen.getByRole("spinbutton", { name: "Valor total do item 1" })).toBeTruthy();
    expect(screen.queryByRole("spinbutton", { name: "Valor unitário do item 1" })).toBeNull();
  });

  it("deriva a unidade do produto sem permitir edição", async () => {
    montar();
    await alterarControle(screen.getByRole("combobox", { name: "Produto do item 1" }), { target: { value: uid(1) } });
    expect(screen.getByLabelText("Unidade do item 1").textContent).toBe("kg");
    expect(screen.queryByRole("textbox", { name: "Unidade do item 1" })).toBeNull();
  });

  it("sugere o valor unitário da última compra do fornecedor selecionado", async () => {
    const fetchMock = vi.fn(async (url: unknown) => String(url).includes("/ultimo-preco")
      ? { ok: true, json: async () => ({ valorUnitario: "7.5", data: "2026-09-03", parceiro: { id: uid(1), nome: "Fornecedor Rural" } }) }
      : { ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    montar();
    await alterarControle(screen.getByLabelText("Fornecedor ou parceiro"), { target: { value: uid(1) } });
    await alterarControle(screen.getByRole("combobox", { name: "Produto do item 1" }), { target: { value: uid(1) } });
    await waitFor(() => expect((screen.getByRole("spinbutton", { name: "Valor unitário do item 1" }) as HTMLInputElement).value).toBe("7.50"));
    expect(fetchMock).toHaveBeenCalledWith(`/api/estoque/produtos/${uid(1)}/ultimo-preco?parceiroId=${uid(1)}`, expect.anything());
    expect(screen.getByText(/Última compra:/).textContent?.replaceAll("\u00a0", " ")).toBe("Última compra: R$ 7,50 em 03/09 (Fornecedor Rural)");
  });

  it("sem histórico de compra, deixa o valor unitário vazio e sem linha de ajuda", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => null }));
    vi.stubGlobal("fetch", fetchMock);
    montar();
    await alterarControle(screen.getByRole("combobox", { name: "Produto do item 1" }), { target: { value: uid(1) } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/estoque/produtos/${uid(1)}/ultimo-preco`, expect.anything()));
    expect((screen.getByRole("spinbutton", { name: "Valor unitário do item 1" }) as HTMLInputElement).value).toBe("");
    expect(screen.queryByText(/Última compra:/)).toBeNull();
  });

  it("não sobrescreve um valor digitado antes da sugestão chegar", async () => {
    let responder: (v: unknown) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => { responder = resolve; })));
    montar();
    await alterarControle(screen.getByRole("combobox", { name: "Produto do item 1" }), { target: { value: uid(1) } });
    const campo = screen.getByRole("spinbutton", { name: "Valor unitário do item 1" }) as HTMLInputElement;
    await alterarControle(campo, { target: { value: "9" } });
    responder({ ok: true, json: async () => ({ valorUnitario: "7.5", data: "2026-09-03", parceiro: null }) });
    await waitFor(() => expect(screen.queryByText(/Última compra:/)).toBeTruthy());
    expect(campo.value).toBe("9");
  });

  it("preenche o valor unitário sugerido com as 4 casas decimais do custo por unidade fracionária", async () => {
    const fetchMock = vi.fn(async (url: unknown) => String(url).includes("/ultimo-preco")
      ? { ok: true, json: async () => ({ valorUnitario: "0.1234", data: "2026-09-03", parceiro: null }) }
      : { ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    montar();
    await alterarControle(screen.getByRole("combobox", { name: "Produto do item 1" }), { target: { value: uid(1) } });
    await waitFor(() => expect((screen.getByRole("spinbutton", { name: "Valor unitário do item 1" }) as HTMLInputElement).value).toBe("0.1234"));
  });

  it("não trunca para zero, ao perder foco, um valor unitário digitado manualmente com 5 casas decimais", async () => {
    montar();
    const campo = screen.getByRole("spinbutton", { name: "Valor unitário do item 1" }) as HTMLInputElement;
    await alterarControle(campo, { target: { value: "0.00045" } });
    fireEvent.blur(campo);
    expect(campo.value).not.toBe("0.00");
    expect(Number(campo.value)).toBeGreaterThan(0);
  });

  it("não expõe o saldo no seletor de conta", () => {
    montar();
    fireEvent.click(screen.getByRole("combobox", { name: "Conta financeira" }));
    expect(screen.getByRole("option", { name: "Banco principal" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Banco principal.*R\$/ })).toBeNull();
  });

  it("não oferece contas nem parceiros inativos em uma nova operação", () => {
    montar();
    fireEvent.click(screen.getByRole("combobox", { name: "Conta financeira" }));
    expect(screen.queryByRole("option", { name: "Conta desativada" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Fornecedor desativado" })).toBeNull();
    expect(screen.getByRole("option", { name: "Banco principal" })).toBeTruthy();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    fireEvent.click(screen.getByRole("combobox", { name: "Fornecedor ou parceiro" }));
    expect(screen.queryByRole("option", { name: "Fornecedor desativado" })).toBeNull();
    expect(screen.getByRole("option", { name: "Fornecedor Rural" })).toBeTruthy();
  });

  it("formata o valor informado com duas casas decimais", async () => {
    montar();
    const campo = screen.getByRole("spinbutton", { name: "Valor unitário do item 1" });
    await alterarControle(campo, { target: { value: "12.5" } });
    fireEvent.blur(campo);
    expect((campo as HTMLInputElement).value).toBe("12.50");
  });

  it("resume produto, quantidade e valor total de cada item", async () => {
    montar();
    await alterarControle(screen.getByRole("combobox", { name: "Produto do item 1" }), { target: { value: uid(1) } });
    await alterarControle(screen.getByRole("spinbutton", { name: "Quantidade do item 1" }), { target: { value: "3" } });
    await alterarControle(screen.getByRole("spinbutton", { name: "Valor unitário do item 1" }), { target: { value: "5" } });
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

  it("explica e configura os compromissos derivados da condição a prazo", async () => {
    montar();
    await alterarControle(screen.getByRole("combobox", { name: "Condição financeira" }), { target: { value: "A_PRAZO" } });
    expect(screen.getByText(/Cada parcela será criada como um compromisso vinculado a esta operação/)).toBeTruthy();
    expect(screen.getByRole("spinbutton", { name: "Valor da parcela 1" })).toBeTruthy();
    expect(screen.getByLabelText("Vencimento da parcela 1")).toBeTruthy();
  });

  it("soma itens já arredondados em centavos como o backend", async () => {
    montar();
    await alterarControle(screen.getByRole("spinbutton", { name: "Quantidade do item 1" }), { target: { value: "0.001" } });
    await alterarControle(screen.getByRole("spinbutton", { name: "Valor unitário do item 1" }), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar item/i }));
    await alterarControle(screen.getByRole("spinbutton", { name: "Quantidade do item 2" }), { target: { value: "0.001" } });
    await alterarControle(screen.getByRole("spinbutton", { name: "Valor unitário do item 2" }), { target: { value: "5" } });
    // As parcelas passaram a ser geradas sob demanda pelo servidor; a regra local
    // que resta é o total da operação: cada item arredondado (0,005 → 0,01) e depois somado.
    expect(screen.getAllByText(/R\$\s*0,02/).length).toBeGreaterThan(0);
  });

  it("oferece documentos tipificados no próprio cadastro", () => {
    montar();
    expect(screen.getByLabelText("Anexar documentos")).toBeTruthy();
    expect(screen.getByText("PDF, XML, JPG, PNG ou WEBP, com até 10 MB por arquivo.")).toBeTruthy();
  });
});

function configCentrosDivergentes() {
  return { ...config,
    categorias: [{ id: uid(1), nome: "Silagem", classificacao: "CUSTEIO" as const, ativo: true, ordem: 0, usoGenetico: false }, { id: uid(2), nome: "Vacinas", classificacao: "CUSTEIO" as const, ativo: true, ordem: 0, usoGenetico: false }],
    centrosCusto: [{ id: uid(1), nome: "Pecuária", ativo: true, ordem: 0 }, { id: uid(2), nome: "Agronomia", ativo: true, ordem: 0 }],
    produtos: [{ ...config.produtos[0], categoriaId: uid(1), centroCustoIds: [uid(1)] }, { ...config.produtos[0], id: uid(2), nome: "Vacina", categoriaId: uid(2), centroCustoIds: [uid(2)] }],
  };
}

it("produto com um único centro preenche o item e sugere o centro da operação", async () => {
  render(<FormOperacao config={configCentrosDivergentes()} onSalvo={vi.fn()} />);
  await alterarControle(screen.getByLabelText("Produto do item 1"), { target: { value: uid(1) } });
  expect((screen.getByLabelText("Categoria do item 1") as HTMLSelectElement).value).toBe(uid(1));
  expect((screen.getByLabelText("Centro de custo") as HTMLSelectElement).value).toBe(uid(1));
});

it("produtos com centros divergentes mostram aviso e 'Separar por item' preenche o modo por item", async () => {
  render(<FormOperacao config={configCentrosDivergentes()} onSalvo={vi.fn()} />);
  await alterarControle(screen.getByLabelText("Produto do item 1"), { target: { value: uid(1) } });
  fireEvent.click(screen.getByRole("button", { name: /Adicionar item/i }));
  await alterarControle(screen.getByLabelText("Produto do item 2"), { target: { value: uid(2) } });
  expect((screen.getByLabelText("Categoria do item 2") as HTMLSelectElement).value).toBe(uid(2));
  expect((screen.getByLabelText("Centro de custo") as HTMLSelectElement).value).toBe("");
  expect(screen.getByText(/Os produtos pertencem a centros de custo diferentes/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Separar por item/i }));
  expect((screen.getByLabelText("Centro de custo do item 1") as HTMLSelectElement).value).toBe(uid(1));
  expect((screen.getByLabelText("Centro de custo do item 2") as HTMLSelectElement).value).toBe(uid(2));
  expect(screen.getByText("Centro padrão (itens sem centro)")).toBeTruthy();
});

it("modo por item envia centroCustoId por item e null nos itens sem centro próprio", async () => {
  const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
    const caminho = String(url);
    if (caminho.endsWith("/financeiro/operacoes/rascunho") && init?.method === "PUT") {
      return { ok: true, json: async () => ({ id: 9, dados: {}, versao: 1, documentos: [], updatedAt: "2026-09-07T12:00:00Z" }) };
    }
    if (caminho.endsWith("/financeiro/operacoes/rascunho/confirmacao")) {
      return { ok: true, json: async () => ({ id: 43, tipo: "COMPRA_ESTOQUE", status: "CONFIRMADA", data: "2026-09-22", descricao: "Compra mista", valorTotal: "100.00", parceiro: null, itens: [], compromissos: [], transacoes: [], movimentosEstoque: [], documentos: [] }) };
    }
    return { ok: true, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  const cfg = configCentrosDivergentes();
  render(<FormOperacao config={cfg} onSalvo={vi.fn()} />);
  await alterarControle(screen.getByLabelText("Descrição"), { target: { value: "Compra mista" } });
  await alterarControle(screen.getByLabelText("Fornecedor ou parceiro"), { target: { value: String(config.parceiros[0].id) } });
  await alterarControle(screen.getByLabelText("Produto do item 1"), { target: { value: uid(1) } });
  await alterarControle(screen.getByRole("spinbutton", { name: "Valor unitário do item 1" }), { target: { value: "100" } });
  fireEvent.click(screen.getByRole("button", { name: /Adicionar item/i }));
  await alterarControle(screen.getByLabelText("Produto do item 2"), { target: { value: uid(2) } });
  fireEvent.click(screen.getByRole("button", { name: /Separar por item/i }));
  await alterarControle(screen.getByLabelText("Centro de custo do item 2"), { target: { value: "" } });
  await alterarControle(screen.getByLabelText("Conta financeira"), { target: { value: String(config.contas[0].id) } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  const chamadaConfirmar = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/financeiro/operacoes/rascunho/confirmacao"));
  expect(chamadaConfirmar).toBeTruthy();
});

it("item não estocável sem centro de custo bloqueia a confirmação com mensagem no campo", async () => {
  const originalScroll = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = vi.fn();
  try {
    const cfg = configCentrosDivergentes();
    render(<FormOperacao config={cfg} tipoInicial="COMPRA_CONSUMO_DIRETO" onSalvo={vi.fn()} />);
    await alterarControle(screen.getByLabelText("Fornecedor ou parceiro"), { target: { value: String(cfg.parceiros[0].id) } });
    await alterarControle(screen.getByLabelText("Descrição"), { target: { value: "Serviço avulso" } });
    await alterarControle(screen.getByLabelText("Descrição do item 1"), { target: { value: "Item sem centro" } });
    await alterarControle(screen.getByLabelText("Quantidade do item 1"), { target: { value: "1" } });
    await alterarControle(screen.getByLabelText("Valor unitário do item 1"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
    const campo = screen.getByLabelText("Centro de custo");
    expect(campo.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(campo);
  } finally {
    HTMLElement.prototype.scrollIntoView = originalScroll;
  }
});

it("rascunho salvo antes do centro de custo por item existir (item sem centroCustoId): ao confirmar, marca o campo e não envia", () => {
  const originalScroll = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const fetchMock = vi.fn(async (_url: unknown, _init?: RequestInit) => ({ ok: true, json: async () => ({}) }));
  vi.stubGlobal("fetch", fetchMock);
  try {
    const cfg = configCentrosDivergentes();
    // Simula um rascunho persistido antes de `centroCustoPorItem` existir: o
    // item não tem a chave `centroCustoId` (não apenas ""), e o formulário
    // também não tem `centroCustoPorItem`.
    const rascunhoAntigo = {
      id: uid(8), versao: 1, updatedAt: "2026-09-11", documentos: [],
      dados: {
        formulario: {
          tipo: "COMPRA_CONSUMO_DIRETO", condicao: "SEM_EFEITO_FINANCEIRO",
          descricao: "Compra legada", valorOperacao: "10",
          itens: [{ id: 1, categoriaId: "", classificacao: "", produtoId: "", descricao: "Item legado", quantidade: "1", unidade: "un", modoValor: "UNITARIO", valorUnitario: "10", valorTotal: "" }],
          parceiroId: String(cfg.parceiros[0].id), categoriaId: "", centroCustoId: "", contaId: "", formaPagamento: "PIX", data: "2026-09-11", valorAgora: "", parcelas: [],
        },
      },
    };
    render(<FormOperacao config={cfg} rascunho={rascunhoAntigo} onSalvo={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
    const campo = screen.getByLabelText("Centro de custo");
    expect(campo.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(campo);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/financeiro/operacoes/rascunho/confirmacao"))).toBe(false);
  } finally {
    HTMLElement.prototype.scrollIntoView = originalScroll;
  }
});

it("'Separar por item' deixa vazio (herda a operação) quando o produto não tem centro único", async () => {
  const cfg = { ...configCentrosDivergentes() };
  cfg.produtos = [{ ...cfg.produtos[0], centroCustoIds: [] }, cfg.produtos[1]];
  render(<FormOperacao config={cfg} onSalvo={vi.fn()} />);
  await alterarControle(screen.getByLabelText("Produto do item 1"), { target: { value: uid(1) } });
  await alterarControle(screen.getByLabelText("Centro de custo"), { target: { value: uid(1) } });
  fireEvent.click(screen.getByRole("button", { name: /Adicionar item/i }));
  await alterarControle(screen.getByLabelText("Produto do item 2"), { target: { value: uid(2) } });
  fireEvent.click(screen.getByRole("radio", { name: /Por item/i }));
  expect((screen.getByLabelText("Centro de custo do item 1") as HTMLSelectElement).value).toBe("");
  expect((screen.getByLabelText("Centro de custo do item 2") as HTMLSelectElement).value).toBe(uid(2));
});

it("erro do servidor itens.N.centroCustoId no modo Único marca e rola até o centro da operação", async () => {
  const originalScroll = HTMLElement.prototype.scrollTo;
  const scroll = vi.fn();
  HTMLElement.prototype.scrollTo = scroll;
  const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
    const caminho = String(url);
    if (caminho.endsWith("/financeiro/operacoes/rascunho") && init?.method === "PUT") {
      return { ok: true, json: async () => ({ id: 10, dados: {}, versao: 1, documentos: [], updatedAt: "2026-09-07T12:00:00Z" }) };
    }
    if (caminho.endsWith("/financeiro/operacoes/rascunho/confirmacao")) {
      return { ok: false, status: 422, json: async () => ({ error: "Selecione um centro de custo ativo", campo: "itens.0.centroCustoId" }) };
    }
    return { ok: true, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  try {
    const cfg = configCentrosDivergentes();
    render(<FormOperacao config={cfg} onSalvo={vi.fn()} />);
    await alterarControle(screen.getByLabelText("Descrição"), { target: { value: "Compra combinada" } });
    await alterarControle(screen.getByLabelText("Fornecedor ou parceiro"), { target: { value: String(cfg.parceiros[0].id) } });
    await alterarControle(screen.getByLabelText("Produto do item 1"), { target: { value: uid(1) } });
    await alterarControle(screen.getByRole("spinbutton", { name: "Valor unitário do item 1" }), { target: { value: "100" } });
    await alterarControle(screen.getByLabelText("Centro de custo"), { target: { value: uid(1) } });
    await alterarControle(screen.getByLabelText("Conta financeira"), { target: { value: String(cfg.contas[0].id) } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
    await waitFor(() => expect(screen.getByLabelText("Centro de custo").getAttribute("aria-invalid")).toBe("true"));
    const campo = screen.getByLabelText("Centro de custo");
    expect(campo.id).toBe("campo-centroCustoId");
    expect(scroll).toHaveBeenCalled();
  } finally {
    HTMLElement.prototype.scrollTo = originalScroll;
  }
});

it("voltar para Único limpa os centros preenchidos nos itens", async () => {
  render(<FormOperacao config={configCentrosDivergentes()} onSalvo={vi.fn()} />);
  await alterarControle(screen.getByLabelText("Produto do item 1"), { target: { value: uid(1) } });
  fireEvent.click(screen.getByRole("button", { name: /Adicionar item/i }));
  await alterarControle(screen.getByLabelText("Produto do item 2"), { target: { value: uid(2) } });
  fireEvent.click(screen.getByRole("button", { name: /Separar por item/i }));
  expect((screen.getByLabelText("Centro de custo do item 1") as HTMLSelectElement).value).toBe(uid(1));
  fireEvent.click(screen.getByRole("radio", { name: /Único para a operação/i }));
  expect(screen.queryByLabelText("Centro de custo do item 1")).toBeNull();
  expect(screen.queryByLabelText("Centro de custo do item 2")).toBeNull();
});

describe("FormOperacao — geração de parcelas", () => {
  it("confirma um rascunho a prazo carregado sem exigir clique em Gerar parcelas", async () => {
    const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
      const caminho = String(url);
      if (caminho.endsWith("/financeiro/operacoes/rascunho") && init?.method === "PUT") {
        return { ok: true, json: async () => ({ id: 8, dados: {}, versao: 3, documentos: [], updatedAt: "2026-09-07T12:00:00Z" }) };
      }
      if (caminho.endsWith("/financeiro/operacoes/rascunho/confirmacao")) {
        return { ok: true, json: async () => ({ id: 42, tipo: "SERVICO", status: "CONFIRMADA", data: "2026-09-07", descricao: "Manutenção programada", valorTotal: "800.00", parceiro: null, itens: [], compromissos: [], transacoes: [], movimentosEstoque: [], documentos: [] }) };
      }
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<FormOperacao config={config} rascunho={{ id: uid(8), versao: 2, updatedAt: "2026-09-07T12:00:00Z", documentos: [], dados: { formulario: { tipo: "SERVICO", condicao: "A_PRAZO", descricao: "Manutenção programada", valorOperacao: "800.00", itens: [], parceiroId: uid(1), categoriaId: "", centroCustoId: "", contaId: "", formaPagamento: "PIX", data: "2026-09-07", valorAgora: "", parcelas: [{ id: 1, valor: "800.00", vencimento: "2026-10-07" }] } } }} onSalvo={vi.fn()} />);
    expect((screen.getByRole("button", { name: "Confirmar operação" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("confirmacao"), expect.objectContaining({ method: "POST" })));
  });

  it("começa sem parcela preenchida (personalizado por padrão) e preserva o que o usuário digitar mesmo com o total mudando depois", async () => {
    montar();
    await alterarControle(screen.getByRole("combobox", { name: "Tipo de operação" }), { target: { value: "SERVICO" } });
    await alterarControle(screen.getByRole("spinbutton", { name: "Valor total da operação" }), { target: { value: "100" } });
    await alterarControle(screen.getByRole("combobox", { name: "Condição financeira" }), { target: { value: "A_PRAZO" } });
    expect((screen.getByRole("spinbutton", { name: "Valor da parcela 1" }) as HTMLInputElement).value).toBe("");
    await alterarControle(screen.getByRole("spinbutton", { name: "Valor da parcela 1" }), { target: { value: "60.00" } });
    await alterarControle(screen.getByRole("spinbutton", { name: "Valor total da operação" }), { target: { value: "200" } });
    expect((screen.getByRole("spinbutton", { name: "Valor da parcela 1" }) as HTMLInputElement).value).toBe("60.00");
    expect(screen.getAllByText(/A soma das parcelas deve corresponder/).length).toBeGreaterThan(0);
  });

  it("mostra excedente quando a soma das parcelas ultrapassa o total", async () => {
    montar();
    await alterarControle(screen.getByRole("combobox", { name: "Tipo de operação" }), { target: { value: "SERVICO" } });
    await alterarControle(screen.getByRole("spinbutton", { name: "Valor total da operação" }), { target: { value: "100" } });
    await alterarControle(screen.getByRole("combobox", { name: "Condição financeira" }), { target: { value: "A_PRAZO" } });
    await alterarControle(screen.getByRole("spinbutton", { name: "Valor da parcela 1" }), { target: { value: "150" } });
    expect(screen.getAllByText(/Excedente/).length).toBeGreaterThan(0);
  });

  it("a grade automática fica atrás do botão Gerar parcelas — não aparece fixa na página", async () => {
    montar();
    await alterarControle(screen.getByRole("combobox", { name: "Tipo de operação" }), { target: { value: "SERVICO" } });
    await alterarControle(screen.getByRole("spinbutton", { name: "Valor total da operação" }), { target: { value: "90" } });
    await alterarControle(screen.getByRole("combobox", { name: "Condição financeira" }), { target: { value: "A_PRAZO" } });
    expect(screen.queryByRole("spinbutton", { name: "Quantidade de parcelas" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Gerar parcelas" }));
    expect(screen.getByRole("spinbutton", { name: "Quantidade de parcelas" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Intervalo das parcelas" })).toBeTruthy();
    // Não oferece mais "Personalizada": manual já é o padrão via "+ Parcela".
    expect(screen.queryByRole("option", { name: "Personalizada" })).toBeNull();
  });

  it("+ Parcela fica sempre ao fim da lista e cada clique acrescenta uma linha", async () => {
    montar();
    await alterarControle(screen.getByRole("combobox", { name: "Tipo de operação" }), { target: { value: "SERVICO" } });
    await alterarControle(screen.getByRole("spinbutton", { name: "Valor total da operação" }), { target: { value: "90" } });
    await alterarControle(screen.getByRole("combobox", { name: "Condição financeira" }), { target: { value: "A_PRAZO" } });
    expect(screen.getAllByRole("spinbutton", { name: /Valor da parcela/ })).toHaveLength(1);
    const maisParcela = screen.getByRole("button", { name: "Parcela" });
    fireEvent.click(maisParcela);
    fireEvent.click(maisParcela);
    const parcelasAtuais = screen.getAllByRole("spinbutton", { name: /Valor da parcela/ });
    expect(parcelasAtuais).toHaveLength(3);
    // O botão continua depois da última linha, não entre as parcelas.
    expect(parcelasAtuais.at(-1)!.compareDocumentPosition(maisParcela) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("gerar no popover chama a API e substitui a lista de parcelas", async () => {
    const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
      if (String(url).endsWith("/financeiro/operacoes/simulacao-parcelas") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            totalOperacao: "90.00", valorPagoAgora: "0", saldoAPrazo: "90.00",
            parcelas: [{ valor: "30.00", dataVencimento: "2026-10-01" }, { valor: "30.00", dataVencimento: "2026-11-01" }, { valor: "30.00", dataVencimento: "2026-12-01" }],
          }),
        };
      }
      return { ok: true, json: async () => ({ id: 9, dados: {}, versao: 1, documentos: [], updatedAt: "2026-09-21T12:00:00Z" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    montar();
    await alterarControle(screen.getByRole("combobox", { name: "Tipo de operação" }), { target: { value: "SERVICO" } });
    await alterarControle(screen.getByRole("spinbutton", { name: "Valor total da operação" }), { target: { value: "90" } });
    await alterarControle(screen.getByRole("combobox", { name: "Condição financeira" }), { target: { value: "A_PRAZO" } });
    fireEvent.click(screen.getByRole("button", { name: "Gerar parcelas" }));
    await alterarControle(screen.getByRole("spinbutton", { name: "Quantidade de parcelas" }), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Gerar" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/financeiro/operacoes/simulacao-parcelas", expect.objectContaining({ method: "POST" })));
    expect(await screen.findAllByRole("spinbutton", { name: /Valor da parcela/ })).toHaveLength(3);
    expect((screen.getByRole("spinbutton", { name: "Valor da parcela 1" }) as HTMLInputElement).value).toBe("30.00");
  });

  it("gerar sobre parcelas já preenchidas à mão pede confirmação antes de substituir", async () => {
    const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
      if (String(url).endsWith("/financeiro/operacoes/simulacao-parcelas") && init?.method === "POST") {
        return { ok: true, json: async () => ({ totalOperacao: "90.00", valorPagoAgora: "0", saldoAPrazo: "90.00", parcelas: [{ valor: "90.00", dataVencimento: "2026-10-01" }] }) };
      }
      return { ok: true, json: async () => ({ id: 9, dados: {}, versao: 1, documentos: [], updatedAt: "2026-09-21T12:00:00Z" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    montar();
    await alterarControle(screen.getByRole("combobox", { name: "Tipo de operação" }), { target: { value: "SERVICO" } });
    await alterarControle(screen.getByRole("spinbutton", { name: "Valor total da operação" }), { target: { value: "90" } });
    await alterarControle(screen.getByRole("combobox", { name: "Condição financeira" }), { target: { value: "A_PRAZO" } });
    await alterarControle(screen.getByRole("spinbutton", { name: "Valor da parcela 1" }), { target: { value: "90.00" } });

    fireEvent.click(screen.getByRole("button", { name: "Gerar parcelas" }));
    fireEvent.click(screen.getByRole("button", { name: "Gerar" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Substituir as parcelas atuais?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Substituir parcelas" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("simulacao-parcelas"), expect.objectContaining({ method: "POST" })));
  });

  it("sanitiza a frequência de um rascunho salvo quando 'Personalizada' ainda existia, em vez de mandá-la de volta à API", async () => {
    const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
      if (String(url).endsWith("/financeiro/operacoes/simulacao-parcelas") && init?.method === "POST") {
        expect(JSON.parse(String(init.body)).frequencia).toBe("MENSAL");
        return { ok: true, json: async () => ({ totalOperacao: "100.00", valorPagoAgora: "0", saldoAPrazo: "100.00", parcelas: [{ valor: "100.00", dataVencimento: "2026-10-21" }] }) };
      }
      return { ok: true, json: async () => ({ id: 5, dados: {}, versao: 2, documentos: [], updatedAt: "2026-09-21T00:00:00Z" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<FormOperacao config={config} rascunho={{
      id: uid(5), versao: 1, updatedAt: "2026-09-21T00:00:00Z", documentos: [],
      dados: { formulario: {
        tipo: "SERVICO", condicao: "A_PRAZO", descricao: "Manutenção", valorOperacao: "100", itens: [],
        parceiroId: uid(1), categoriaId: "", centroCustoId: "", contaId: "", formaPagamento: "PIX", data: "2026-09-21", valorAgora: "",
        parcelas: [{ id: 1, valor: "100.00", vencimento: "2026-10-21" }],
        // Formato persistido por uma versão anterior do formulário, com a
        // frequência "Personalizada" (removida) e o campo "modo" (também removido).
        geradorParcelas: { modo: "PERSONALIZADO", frequencia: "PERSONALIZADA", quantidade: "5", primeiroVencimento: "2026-10-21" } as never,
      } },
    }} onSalvo={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Gerar parcelas" }));
    expect((screen.getByRole("combobox", { name: "Intervalo das parcelas" }) as HTMLSelectElement).value).toBe("MENSAL");
    fireEvent.click(screen.getByRole("button", { name: "Gerar" }));
    // A parcela já vem preenchida do rascunho — pede confirmação antes de substituir.
    fireEvent.click(screen.getByRole("button", { name: "Substituir parcelas" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("simulacao-parcelas"), expect.objectContaining({ method: "POST" })));
  });
});

describe("FormOperacao — erro de confirmação por campo", () => {
  it("marca o campo indicado pela API, associa a mensagem por aria-describedby e limpa a marcação ao editar", async () => {
    const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
      const caminho = String(url);
      if (caminho.endsWith("/financeiro/operacoes/rascunho") && init?.method === "PUT") {
        return { ok: true, json: async () => ({ id: 9, dados: {}, versao: 1, documentos: [], updatedAt: "2026-09-07T12:00:00Z" }) };
      }
      if (caminho.endsWith("/financeiro/operacoes/rascunho/confirmacao")) {
        return { ok: false, status: 422, json: async () => ({ error: "Selecione um parceiro com papel compatível com esta operação", code: "VALIDACAO", campo: "parceiroId" }) };
      }
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<FormOperacao config={config} tipoInicial="SERVICO" onSalvo={vi.fn()} />);
    await alterarControle(screen.getByLabelText("Descrição"), { target: { value: "Manutenção do trator" } });
    await alterarControle(screen.getByLabelText("Valor total da operação"), { target: { value: "100" } });
    await alterarControle(screen.getByLabelText("Prestador de serviço"), { target: { value: uid(1) } });
    await alterarControle(screen.getByLabelText("Conta financeira"), { target: { value: uid(1) } });

    const confirmar = screen.getByRole("button", { name: "Confirmar operação" });
    fireEvent.click(confirmar);

    // Erro específico acima do botão (além do ErrorBox geral no topo do
    // formulário), associado ao botão por aria-describedby.
    const alertas = await screen.findAllByRole("alert");
    const alertaConfirmacao = alertas.find((el) => el.id === "erro-confirmacao");
    expect(alertaConfirmacao).toBeTruthy();
    expect(confirmar.getAttribute("aria-describedby")).toBe("erro-confirmacao");

    // Campo indicado pela API fica marcado e descrito pela mensagem específica —
    // não só pelo alerta geral.
    const parceiroSelect = screen.getByLabelText("Prestador de serviço");
    expect(parceiroSelect.getAttribute("aria-invalid")).toBe("true");
    expect(parceiroSelect.getAttribute("aria-describedby")).toBe("erro-parceiroId");
    expect(screen.getByText("Selecione um parceiro válido.").closest("#erro-parceiroId")).toBeTruthy();

    // Falha atômica: os dados preenchidos continuam lá para nova tentativa.
    expect((screen.getByLabelText("Descrição") as HTMLTextAreaElement).value).toBe("Manutenção do trator");
    expect((screen.getByLabelText("Valor total da operação") as HTMLInputElement).value).toBe("100");

    // Editar o campo limpa a marcação.
    await alterarControle(parceiroSelect, { target: { value: "" } });
    expect(parceiroSelect.getAttribute("aria-invalid")).toBeNull();
    expect(parceiroSelect.getAttribute("aria-describedby")).toBeNull();
    expect(screen.queryByText("Selecione um parceiro válido.")).toBeNull();
  });
});

describe("FormOperacao — botão sempre ativo; erro rola e foca o campo (não fica escondido/desabilitado)", () => {
  // jsdom não faz layout; verificamos a rolagem interna e o foco real.
  const comScrollStub = async <T,>(rodar: () => T | Promise<T>): Promise<[T, ReturnType<typeof vi.fn>]> => {
    const scroll = vi.fn();
    const original = HTMLElement.prototype.scrollTo;
    HTMLElement.prototype.scrollTo = scroll;
    try { return [await rodar(), scroll]; } finally { HTMLElement.prototype.scrollTo = original; }
  };

  it("formulário em branco: o botão de confirmar nunca fica desabilitado", () => {
    montar();
    expect((screen.getByRole("button", { name: "Confirmar operação" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("mostra o motivo pendente abaixo do botão enquanto o formulário não está completo, e some quando fica válido", async () => {
    montar();
    const motivo = screen.getByText(/Ainda há campos pendentes ou incompletos/);
    expect(motivo.closest('[role="status"]')?.id).toBe("motivo-pendencia");
    expect(screen.getByRole("button", { name: "Confirmar operação" }).getAttribute("aria-describedby")).toContain("motivo-pendencia");

    // Preenche tudo que o tipo padrão (COMPRA_ESTOQUE, com item) exige.
    await alterarControle(screen.getByLabelText("Fornecedor ou parceiro"), { target: { value: uid(1) } });
    await alterarControle(screen.getByLabelText("Descrição"), { target: { value: "Compra de ração" } });
    await alterarControle(screen.getByLabelText("Produto do item 1"), { target: { value: uid(1) } });
    await alterarControle(screen.getByLabelText("Descrição do item 1"), { target: { value: "Ração" } });
    await alterarControle(screen.getByLabelText("Valor unitário do item 1"), { target: { value: "10" } });
    await alterarControle(screen.getByLabelText("Conta financeira"), { target: { value: uid(1) } });

    expect(screen.queryByText(/Ainda há campos pendentes ou incompletos/)).toBeNull();
  });

  it("descrição vazia: rola e foca o campo ao tentar confirmar", async () => {
    const [, scroll] = await comScrollStub(async () => {
      render(<FormOperacao config={config} tipoInicial="SERVICO" onSalvo={vi.fn()} />);
      await alterarControle(screen.getByLabelText("Prestador de serviço"), { target: { value: uid(1) } });
      await alterarControle(screen.getByLabelText("Valor total da operação"), { target: { value: "100" } });
      await alterarControle(screen.getByLabelText("Conta financeira"), { target: { value: uid(1) } });
      fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
      const campo = screen.getByLabelText("Descrição");
      expect(campo.id).toBe("campo-descricao");
      expect(campo.getAttribute("aria-invalid")).toBe("true");
      expect(document.activeElement).toBe(campo);
    });
    expect(scroll).toHaveBeenCalled();
  });

  it("item que movimenta estoque sem produto selecionado: rola e foca o card do item, não um campo qualquer", async () => {
    const [, scroll] = await comScrollStub(async () => {
      montar(); // COMPRA_ESTOQUE por padrão: itens com movimentação de estoque
      await alterarControle(screen.getByLabelText("Fornecedor ou parceiro"), { target: { value: uid(1) } });
      await alterarControle(screen.getByLabelText("Descrição"), { target: { value: "Compra de insumos" } });
      await alterarControle(screen.getByLabelText("Descrição do item 1"), { target: { value: "Ração especial" } });
      await alterarControle(screen.getByLabelText("Conta financeira"), { target: { value: uid(1) } });
      fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
      const itemCard = screen.getByLabelText("Descrição do item 1").closest('[id^="item-"]') as HTMLElement;
      expect(itemCard.className).toContain("border-red-400");
      expect(document.activeElement).toBe(itemCard);
    });
    expect(scroll).toHaveBeenCalled();
  });

  it("item não estocável sem centro de custo: rola e foca o campo do item", async () => {
    const [, scroll] = await comScrollStub(async () => {
      render(<FormOperacao config={{ ...config,
        centrosCusto: [{ id: uid(1), nome: "Pecuária", ativo: true, ordem: 0 }, { id: uid(2), nome: "Agronomia", ativo: true, ordem: 0 }],
        produtos: [{ ...config.produtos[0], centroCustoIds: [uid(1)] }, { ...config.produtos[0], id: uid(2), nome: "Adubo", centroCustoIds: [uid(2)] }],
      }} tipoInicial="COMPRA_CONSUMO_DIRETO" onSalvo={vi.fn()} />);
      await alterarControle(screen.getByLabelText("Fornecedor ou parceiro"), { target: { value: uid(1) } });
      await alterarControle(screen.getByLabelText("Descrição"), { target: { value: "Compra combinada" } });
      await alterarControle(screen.getByLabelText("Descrição do item 1"), { target: { value: "Item avulso" } });
      await alterarControle(screen.getByLabelText("Quantidade do item 1"), { target: { value: "1" } });
      await alterarControle(screen.getByLabelText("Valor unitário do item 1"), { target: { value: "10" } });
      await alterarControle(screen.getByLabelText("Conta financeira"), { target: { value: uid(1) } });
      fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
      const campo = screen.getByLabelText("Centro de custo");
      expect(campo.id).toBe("campo-centroCustoId");
      expect(campo.getAttribute("aria-invalid")).toBe("true");
      expect(document.activeElement).toBe(campo);
    });
    expect(scroll).toHaveBeenCalled();
  });

  it("conta financeira vazia: rola e foca o campo", async () => {
    const [, scroll] = await comScrollStub(async () => {
      render(<FormOperacao config={config} tipoInicial="SERVICO" onSalvo={vi.fn()} />);
      await alterarControle(screen.getByLabelText("Prestador de serviço"), { target: { value: uid(1) } });
      await alterarControle(screen.getByLabelText("Descrição"), { target: { value: "Manutenção" } });
      await alterarControle(screen.getByLabelText("Valor total da operação"), { target: { value: "100" } });
      fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
      const campo = screen.getByLabelText("Conta financeira");
      expect(campo.id).toBe("campo-contaId");
      expect(campo.getAttribute("aria-invalid")).toBe("true");
      expect(document.activeElement).toBe(campo);
    });
    expect(scroll).toHaveBeenCalled();
  });

  it("parcela em branco com a soma fechando: foca a parcela, explica o motivo em português e não chama a API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const [, scroll] = await comScrollStub(async () => {
      render(<FormOperacao config={config} tipoInicial="SERVICO" onSalvo={vi.fn()} />);
      await alterarControle(screen.getByLabelText("Prestador de serviço"), { target: { value: uid(1) } });
      await alterarControle(screen.getByLabelText("Descrição"), { target: { value: "Manutenção" } });
      await alterarControle(screen.getByLabelText("Valor total da operação"), { target: { value: "100" } });
      await alterarControle(screen.getByRole("combobox", { name: "Condição financeira" }), { target: { value: "A_PRAZO" } });
      await alterarControle(screen.getByRole("spinbutton", { name: "Valor da parcela 1" }), { target: { value: "100" } });
      fireEvent.click(screen.getByRole("button", { name: "Parcela" })); // parcela 2 fica em branco: soma continua fechando
      fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));

      const campo = screen.getByRole("spinbutton", { name: "Valor da parcela 2" });
      expect(campo.getAttribute("aria-invalid")).toBe("true");
      expect(document.activeElement).toBe(campo);
      expect(screen.getByText(/A parcela 2 está sem valor\. Informe um valor maior que zero ou remova a parcela\./)).toBeTruthy();
      expect(screen.queryByText(/Number must be greater than 0/)).toBeNull();

      // Corrigir o valor limpa o erro da linha.
      await alterarControle(campo, { target: { value: "0.01" } });
      expect(campo.getAttribute("aria-invalid")).toBeNull();
      expect(screen.queryByText(/está sem valor/)).toBeNull();
    });
    expect(scroll).toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("confirmacao"))).toBe(false);
  });

  it("parcela sem vencimento: foca o vencimento da parcela e explica o motivo", async () => {
    await comScrollStub(async () => {
      render(<FormOperacao config={config} tipoInicial="SERVICO" onSalvo={vi.fn()} />);
      await alterarControle(screen.getByLabelText("Prestador de serviço"), { target: { value: uid(1) } });
      await alterarControle(screen.getByLabelText("Descrição"), { target: { value: "Manutenção" } });
      await alterarControle(screen.getByLabelText("Valor total da operação"), { target: { value: "100" } });
      await alterarControle(screen.getByRole("combobox", { name: "Condição financeira" }), { target: { value: "A_PRAZO" } });
      await alterarControle(screen.getByRole("spinbutton", { name: "Valor da parcela 1" }), { target: { value: "100" } });
      await alterarControle(screen.getByLabelText("Vencimento da parcela 1"), { target: { value: "" } });
      fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
      expect(document.activeElement).toBe(screen.getByLabelText("Vencimento da parcela 1"));
      expect(screen.getByText(/A parcela 1 está sem data de vencimento/)).toBeTruthy();
    });
  });

  it("parcelas com soma incorreta: rola e foca a seção de parcelas", async () => {
    const [, scroll] = await comScrollStub(async () => {
      render(<FormOperacao config={config} tipoInicial="SERVICO" onSalvo={vi.fn()} />);
      await alterarControle(screen.getByLabelText("Prestador de serviço"), { target: { value: uid(1) } });
      await alterarControle(screen.getByLabelText("Descrição"), { target: { value: "Manutenção" } });
      await alterarControle(screen.getByLabelText("Valor total da operação"), { target: { value: "100" } });
      await alterarControle(screen.getByRole("combobox", { name: "Condição financeira" }), { target: { value: "A_PRAZO" } });
      await alterarControle(screen.getByRole("spinbutton", { name: "Valor da parcela 1" }), { target: { value: "50" } });
      fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
      const secao = document.getElementById("secao-parcelas");
      expect(secao).toBe(document.activeElement);
    });
    expect(scroll).toHaveBeenCalled();
  });
});

describe("estocável é decidido pelo tipo da operação, não pelo produto", () => {
  const rascunhoCom = (tipo: string) => ({
    id: 8, versao: 1, updatedAt: "2026-09-11", documentos: [],
    dados: {
      formulario: {
        tipo, condicao: "SEM_EFEITO_FINANCEIRO", descricao: "Compra de ração", valorOperacao: "",
        itens: [{ id: 1, categoriaId: "", classificacao: "", centroCustoId: "", produtoId: "1", descricao: "Ração", quantidade: "2", unidade: "kg", modoValor: "UNITARIO", valorUnitario: "10", valorTotal: "" }],
        parceiroId: "1", categoriaId: "", centroCustoId: "", contaId: "", formaPagamento: "PIX", data: "2026-09-11", valorAgora: "", parcelas: [],
      },
    },
  });

  async function itemEnviado(tipo: string) {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 8, dados: {}, versao: 2, documentos: [], updatedAt: "2026-09-11T12:00:00Z" }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<FormOperacao config={config} rascunho={rascunhoCom(tipo) as never} onSalvo={vi.fn()} />);
    await alterarControle(screen.getByRole("textbox", { name: "Descrição" }), { target: { value: "Compra de ração do mês" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/financeiro/operacoes/rascunho", expect.objectContaining({ method: "PUT" })), { timeout: 2000 });
    const [, init] = fetchMock.mock.calls.find(([url]) => url === "/api/financeiro/operacoes/rascunho")!;
    return JSON.parse(String(init.body)).dados.operacao.itens[0];
  }

  it("COMPRA_ESTOQUE com produto → item estocável", async () => {
    expect(await itemEnviado("COMPRA_ESTOQUE")).toMatchObject({ produtoId: "1", estocavel: true });
  });

  it("COMPRA_CONSUMO_DIRETO com o mesmo produto → item não estocável", async () => {
    expect(await itemEnviado("COMPRA_CONSUMO_DIRETO")).toMatchObject({ produtoId: "1", estocavel: false });
  });
});

describe("tipo Ajuste de estoque", () => {
  const MSG_CONFLITO = "O estoque mudou desde que você abriu esta tela. Atualize o saldo e confira a diferença.";
  const saldo = (saldoAtual: number) => [{ produtoId: uid(1), nome: "Ração", categoria: null, unidade: "KG", centrosCusto: [], saldo: saldoAtual, custoMedio: 2, valor: 2 * saldoAtual, minimoEstoque: null, abaixoMinimo: false }];
  const resposta = (ok: boolean, corpo: unknown, status = ok ? 200 : 400) => ({ ok, status, json: async () => corpo });

  function abrir({ saldos = [saldo(1)], ajuste = resposta(true, { id: uid(9), operacaoId: uid(33), saldoAnterior: 1, quantidadeContada: 1.005, diferenca: 0.005 }), produtoInicial }: { saldos?: ReturnType<typeof saldo>[]; ajuste?: ReturnType<typeof resposta>; produtoInicial?: string } = {}) {
    let leitura = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/estoque/saldos") return resposta(true, saldos[Math.min(leitura++, saldos.length - 1)]);
      if (url === "/api/estoque/ajustes") return ajuste;
      return resposta(true, {});
    });
    vi.stubGlobal("fetch", fetchMock);
    const onSalvo = vi.fn();
    render(<FormOperacao config={{ ...config, centrosCusto: [{ id: uid(5), nome: "Pecuária", ativo: true, ordem: 0 }], produtos: [{ ...config.produtos[0], centroCustoIds: [uid(5)] }] }} tipoInicial="AJUSTE_ESTOQUE" produtoInicial={produtoInicial} onSalvo={onSalvo} />);
    return { fetchMock, onSalvo };
  }
  // jsdom não implementa scrollIntoView (usado ao destacar o campo inválido).
  const scrollOriginal = HTMLElement.prototype.scrollIntoView;
  beforeEach(() => { HTMLElement.prototype.scrollIntoView = vi.fn(); });
  afterEach(() => { HTMLElement.prototype.scrollIntoView = scrollOriginal; });
  const chamadasAjuste = (fetchMock: ReturnType<typeof vi.fn>) => fetchMock.mock.calls.filter(([url]) => url === "/api/estoque/ajustes");
  const confirmar = () => screen.getByRole("button", { name: "Confirmar ajuste" }) as HTMLButtonElement;
  async function escolherProduto() {
    const select = await screen.findByLabelText("Produto");
    await alterarControle(select, { target: { value: uid(1) } });
  }

  it("troca o formulário: sem parceiro, conta, parcelas, data e itens", async () => {
    abrir();
    await escolherProduto();
    expect(screen.queryByLabelText("Data")).toBeNull();
    expect(screen.queryByLabelText("Conta financeira")).toBeNull();
    expect(screen.queryByLabelText("Condição financeira")).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Produto do item 1" })).toBeNull();
    expect(screen.getByText("Sem movimentação financeira")).toBeTruthy();
    expect(screen.getByLabelText("Justificativa do ajuste")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Centro de custo" })).toBeTruthy();
  });

  it("mostra o saldo atual do produto e a diferença com sinal", async () => {
    abrir();
    await escolherProduto();
    expect(screen.getByLabelText("Saldo atual").textContent?.replaceAll("\u00a0", " ")).toBe("1 kg");
    await alterarControle(screen.getByLabelText("Quantidade contada"), { target: { value: "1.005" } });
    expect(screen.getByRole("status", { name: "Diferença do ajuste" }).textContent).toContain("+0,005 kg");
    await alterarControle(screen.getByLabelText("Quantidade contada"), { target: { value: "0" } });
    expect(screen.getByRole("status", { name: "Diferença do ajuste" }).textContent).toContain("-1 kg");
  });

  it("pré-seleciona o produto do atalho e sugere o centro único do produto", async () => {
    abrir({ produtoInicial: uid(1) });
    await waitFor(() => expect((screen.getByLabelText("Produto") as HTMLSelectElement).value).toBe(uid(1)));
    expect(screen.getByLabelText("Saldo atual").textContent).toContain("kg");
    expect((screen.getByRole("combobox", { name: "Centro de custo" }) as HTMLSelectElement).value).toBe(uid(5));
  });

  it("quantidade contada igual ao saldo: nenhum ajuste necessário e confirmar desabilitado", async () => {
    const { fetchMock } = abrir();
    await escolherProduto();
    await alterarControle(screen.getByLabelText("Quantidade contada"), { target: { value: "1" } });
    await alterarControle(screen.getByLabelText("Justificativa do ajuste"), { target: { value: "Contagem física" } });
    expect(screen.getAllByText(/Nenhum ajuste necessário/).length).toBeGreaterThan(0);
    expect(confirmar().disabled).toBe(true);
    fireEvent.click(confirmar());
    expect(chamadasAjuste(fetchMock)).toHaveLength(0);
  });

  it("contada 1,005 contra saldo 1: habilita e envia o ajuste com saldoEsperado e a justificativa", async () => {
    const { fetchMock, onSalvo } = abrir();
    await escolherProduto();
    await alterarControle(screen.getByLabelText("Quantidade contada"), { target: { value: "1.005" } });
    await alterarControle(screen.getByLabelText("Justificativa do ajuste"), { target: { value: "  Contagem física de setembro " } });
    expect(confirmar().disabled).toBe(false);
    fireEvent.click(confirmar());
    await waitFor(() => expect(onSalvo).toHaveBeenCalledWith({ id: uid(33) }));
    const chamadas = chamadasAjuste(fetchMock);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0][1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(chamadas[0][1].body))).toEqual({ produtoId: uid(1), quantidadeContada: 1.005, saldoEsperado: 1, observacao: "Contagem física de setembro", centroCustoId: uid(5) });
    // Não passa pelo fluxo de rascunho/operação genérica.
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/financeiro/operacoes"))).toBe(false);
  });

  it("justificativa com menos de 5 caracteres bloqueia o envio e destaca o campo", async () => {
    const { fetchMock, onSalvo } = abrir();
    await escolherProduto();
    await alterarControle(screen.getByLabelText("Quantidade contada"), { target: { value: "3" } });
    await alterarControle(screen.getByLabelText("Justificativa do ajuste"), { target: { value: "abc" } });
    fireEvent.click(confirmar());
    const campo = screen.getByLabelText("Justificativa do ajuste");
    expect(campo.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText(/pelo menos 5 caracteres/)).toBeTruthy();
    expect(chamadasAjuste(fetchMock)).toHaveLength(0);
    expect(onSalvo).not.toHaveBeenCalled();
  });

  it("recusa quantidade com mais de 3 casas ou negativa", async () => {
    const { fetchMock } = abrir();
    await escolherProduto();
    await alterarControle(screen.getByLabelText("Justificativa do ajuste"), { target: { value: "Contagem física" } });
    for (const invalido of ["1.0004", "-1"]) {
      await alterarControle(screen.getByLabelText("Quantidade contada"), { target: { value: invalido } });
      fireEvent.click(confirmar());
      expect(screen.getByLabelText("Quantidade contada").getAttribute("aria-invalid")).toBe("true");
    }
    expect(chamadasAjuste(fetchMock)).toHaveLength(0);
  });

  it("CONFLITO: explica que o estoque mudou e recarrega o saldo para reconferir a diferença", async () => {
    const { fetchMock, onSalvo } = abrir({ saldos: [saldo(1), saldo(4)], ajuste: resposta(false, { error: "O estoque mudou desde a consulta.", code: "CONFLITO" }, 409) });
    await escolherProduto();
    await alterarControle(screen.getByLabelText("Quantidade contada"), { target: { value: "5" } });
    await alterarControle(screen.getByLabelText("Justificativa do ajuste"), { target: { value: "Contagem física" } });
    fireEvent.click(confirmar());
    await waitFor(() => expect(screen.getByText(MSG_CONFLITO)).toBeTruthy());
    expect(onSalvo).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByLabelText("Saldo atual").textContent).toContain("4"));
    expect(screen.getByRole("status", { name: "Diferença do ajuste" }).textContent).toContain("+1 kg");
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/estoque/saldos")).toHaveLength(2);
    // Reconfirmando com o saldo novo, o servidor recebe o saldoEsperado atualizado.
    fireEvent.click(confirmar());
    await waitFor(() => expect(chamadasAjuste(fetchMock)).toHaveLength(2));
    expect(JSON.parse(String(chamadasAjuste(fetchMock)[1][1].body)).saldoEsperado).toBe(4);
  });

  it("outros erros do servidor aparecem sem recarregar o saldo", async () => {
    const { fetchMock } = abrir({ ajuste: resposta(false, { error: "período financeiro fechado", code: "MES_FECHADO" }, 409) });
    await escolherProduto();
    await alterarControle(screen.getByLabelText("Quantidade contada"), { target: { value: "5" } });
    await alterarControle(screen.getByLabelText("Justificativa do ajuste"), { target: { value: "Contagem física" } });
    fireEvent.click(confirmar());
    await waitFor(() => expect(screen.getAllByText("período financeiro fechado").length).toBeGreaterThan(0));
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/estoque/saldos")).toHaveLength(1);
  });

  it("não salva rascunho enquanto o tipo é ajuste", async () => {
    const { fetchMock } = abrir();
    await escolherProduto();
    await alterarControle(screen.getByLabelText("Justificativa do ajuste"), { target: { value: "Contagem física" } });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/financeiro/operacoes/rascunho")).toBe(false);
    expect(screen.queryByRole("button", { name: "Limpar rascunho" })).toBeNull();
  });

  it("aberto pelo atalho, ignora o conteúdo de um rascunho existente", async () => {
    const fetchMock = vi.fn(async (url: string) => resposta(true, url === "/api/estoque/saldos" ? saldo(1) : {}));
    vi.stubGlobal("fetch", fetchMock);
    render(<FormOperacao config={config} tipoInicial="AJUSTE_ESTOQUE" produtoInicial={uid(1)} rascunho={{ id: uid(8), versao: 1, updatedAt: "2026-09-11", documentos: [], dados: { formulario: { tipo: "SERVICO", condicao: "A_VISTA", descricao: "Manutenção", valorOperacao: "100", parceiroId: uid(1), contaId: uid(1), formaPagamento: "PIX", data: "2026-09-11" } } }} onSalvo={vi.fn()} />);
    expect((screen.getByLabelText("Tipo de operação") as HTMLSelectElement).value).toBe("AJUSTE_ESTOQUE");
    expect((screen.getByLabelText("Justificativa do ajuste") as HTMLTextAreaElement).value).toBe("");
  });

  it("aberto pelo atalho, trava o tipo em Ajuste e nunca faz autosave do rascunho", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (url: string) => resposta(true, url === "/api/estoque/saldos" ? saldo(1) : {}));
    vi.stubGlobal("fetch", fetchMock);
    render(<FormOperacao config={config} tipoInicial="AJUSTE_ESTOQUE" produtoInicial={uid(1)} rascunho={{ id: uid(8), versao: 3, updatedAt: "2026-09-11", documentos: [], dados: { formulario: { tipo: "COMPRA_ESTOQUE", condicao: "A_VISTA", descricao: "Compra com 5 itens" } } }} onSalvo={vi.fn()} />);
    const select = screen.getByLabelText("Tipo de operação") as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(screen.getByText(/para outro tipo de operação, abra Nova operação/)).toBeTruthy();
    await alterarControle(select, { target: { value: "COMPRA_ESTOQUE" } });
    await alterarControle(screen.getByLabelText("Justificativa do ajuste"), { target: { value: "Contagem física" } });
    await vi.advanceTimersByTimeAsync(3000);
    expect((screen.getByLabelText("Tipo de operação") as HTMLSelectElement).value).toBe("AJUSTE_ESTOQUE");
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/financeiro/operacoes/rascunho")).toBe(false);
    expect(screen.queryByRole("button", { name: "Limpar rascunho" })).toBeNull();
    expect(screen.queryByLabelText("Anexar documentos")).toBeNull();
  });

  describe("modo consolidado", () => {
    const sitios = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1, nome: `Sítio ${i + 1}`, apelido: null, cidade: null, uf: null, principal: i === 0, ativo: true, ordem: i }));
    function abrirCom(nSitios: number) {
      const fetchMock = vi.fn(async (url: string) => resposta(true, url === "/api/estoque/saldos" ? saldo(1) : url === "/api/propriedades" ? sitios(nSitios) : {}));
      vi.stubGlobal("fetch", fetchMock);
      render(<FormOperacao config={config} tipoInicial="AJUSTE_ESTOQUE" produtoInicial={uid(1)} onSalvo={vi.fn()} />);
    }
    afterEach(() => setPropriedadeAtiva(null));

    it("vários sítios e nenhum ativo: avisa para escolher a fazenda e bloqueia o envio", async () => {
      setPropriedadeAtiva(null);
      abrirCom(2);
      expect(await screen.findByText(/Selecione uma fazenda no seletor do topo para ajustar o estoque/)).toBeTruthy();
      expect(screen.queryByLabelText("Quantidade contada")).toBeNull();
      expect(confirmar().disabled).toBe(true);
    });

    it("um só sítio: formulário normal", async () => {
      setPropriedadeAtiva(null);
      abrirCom(1);
      await waitFor(() => expect((screen.getByLabelText("Produto") as HTMLSelectElement).value).toBe(uid(1)));
      expect(screen.queryByText(/Selecione uma fazenda no seletor do topo/)).toBeNull();
      expect(screen.getByLabelText("Quantidade contada")).toBeTruthy();
    });

    it("vários sítios com sítio ativo: formulário normal", async () => {
      setPropriedadeAtiva(2);
      abrirCom(3);
      await waitFor(() => expect((screen.getByLabelText("Produto") as HTMLSelectElement).value).toBe(uid(1)));
      expect(screen.queryByText(/Selecione uma fazenda no seletor do topo/)).toBeNull();
      expect(screen.getByLabelText("Quantidade contada")).toBeTruthy();
    });
  });
});

describe("painel de revisão — movimentos de estoque", () => {
  it("VENDA e DEVOLUCAO não prometem N movimentos; a compra mantém a contagem exata", () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })));
    const { unmount } = render(<FormOperacao config={config} tipoInicial="VENDA" onSalvo={vi.fn()} />);
    expect(screen.getByText("Movimenta o estoque dos produtos que já tiveram entrada nesta fazenda.")).toBeTruthy();
    expect(screen.queryByText(/Nenhum movimento físico/)).toBeNull();
    unmount();
    render(<FormOperacao config={config} tipoInicial="COMPRA_ESTOQUE" onSalvo={vi.fn()} />);
    expect(screen.queryByText(/Movimenta o estoque dos produtos/)).toBeNull();
    expect(screen.getByText("Nenhum movimento físico de estoque será gerado.")).toBeTruthy();
  });
});
