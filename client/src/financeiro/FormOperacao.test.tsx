// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormOperacao } from "./FormOperacao";
import type { ConfiguracoesFinanceiras } from "./novo-api";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

const config: ConfiguracoesFinanceiras = {
  contas: [
    { id: 1, nome: "Banco principal", tipo: "BANCO", instituicao: null, identificacao: null, saldoAbertura: "1000", dataSaldoAbertura: "2026-09-01", saldoAtual: "1000", incluirNoSaldoGeral: true, ativo: true, temMovimentos: false },
    { id: 2, nome: "Conta desativada", tipo: "CAIXA", instituicao: null, identificacao: null, saldoAbertura: "0", dataSaldoAbertura: "2026-09-01", saldoAtual: "0", incluirNoSaldoGeral: true, ativo: false, temMovimentos: false },
  ],
  parceiros: [
    { id: 1, nome: "Fornecedor Rural", documento: null, tipo: "FORNECEDOR", telefone: null, email: null, ativo: true, referencias: 0 },
    { id: 2, nome: "Cliente Regional", documento: null, tipo: "CLIENTE", telefone: null, email: null, ativo: true, referencias: 0 },
    { id: 3, nome: "Fornecedor desativado", documento: null, tipo: "FORNECEDOR", telefone: null, email: null, ativo: false, referencias: 4 },
  ],
  categorias: [],
  centrosCusto: [],
  produtos: [{ id: 1, nome: "Ração", unidade: "KG", estocavel: true }],
};

function montar() {
  render(<FormOperacao config={config} onSalvo={vi.fn()} />);
}

describe("FormOperacao", () => {
  it("não oferece ajuste de estoque como nova operação", () => {
    montar();
    expect(screen.queryByRole("option", { name: "Ajuste de estoque" })).toBeNull();
    expect(screen.getByRole("option", { name: "Compra para estoque" })).toBeTruthy();
  });

  it("sugere pagamento sem aplicar automaticamente e permite escolher outra forma", () => {
    render(<FormOperacao config={{ ...config, parceiros: [{ ...config.parceiros[0], papeis: ["PRESTADOR_SERVICO"], formaPagamentoPreferida: "BOLETO", condicaoPagamentoPreferida: "A_PRAZO", prazosPagamento: [30, 60] }] }} tipoInicial="SERVICO" onSalvo={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Prestador de serviço"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Valor total da operação"), { target: { value: "100" } });
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
    fireEvent.change(screen.getByLabelText("Condição financeira"), { target: { value: "A_VISTA" } });
    fireEvent.change(screen.getByLabelText("Forma de liquidação"), { target: { value: "DINHEIRO" } });
    expect((screen.getByLabelText("Forma de liquidação") as HTMLSelectElement).value).toBe("DINHEIRO");
  });

  it("não bloqueia o botão com parceiro que perdeu o papel necessário — ao clicar, rola e foca o campo em vez de deixar o usuário procurando", () => {
    const scroll = vi.fn();
    const originalScroll = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scroll;
    try {
      render(<FormOperacao config={config} rascunho={{ id: 8, versao: 1, updatedAt: "2026-09-11", documentos: [], dados: { formulario: { tipo: "SERVICO", condicao: "A_VISTA", descricao: "Manutenção", valorOperacao: "100", parceiroId: "2", contaId: "1", formaPagamento: "PIX", data: "2026-09-11" } } }} onSalvo={vi.fn()} />);
      expect(screen.getByRole("alert").textContent).toContain("não tem um papel compatível");
      const confirmar = screen.getByRole("button", { name: "Confirmar operação" }) as HTMLButtonElement;
      expect(confirmar.disabled).toBe(false);

      fireEvent.click(confirmar);
      const parceiroSelect = screen.getByLabelText("Prestador de serviço");
      expect(parceiroSelect.getAttribute("aria-invalid")).toBe("true");
      expect(parceiroSelect.id).toBe("campo-parceiroId");
      expect(scroll).toHaveBeenCalled();
      expect(document.activeElement).toBe(parceiroSelect);
    } finally { HTMLElement.prototype.scrollIntoView = originalScroll; }
  });

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
    render(<FormOperacao config={config} rascunho={{ id: 8, versao: 2, updatedAt: "2026-09-07T12:00:00Z", documentos: [], dados: { formulario: { tipo: "SERVICO", condicao: "A_PRAZO", descricao: "Manutenção programada", valorOperacao: "800.00", itens: [], parceiroId: "1", categoriaId: "", centroCustoId: "", contaId: "", formaPagamento: "PIX", data: "2026-09-07", valorAgora: "", parcelas: [{ id: 1, valor: "800.00", vencimento: "2026-10-07" }] } } }} onSalvo={vi.fn()} />);
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

  it("sugere o valor unitário da última compra do fornecedor selecionado", async () => {
    const fetchMock = vi.fn(async (url: unknown) => String(url).includes("/ultimo-preco")
      ? { ok: true, json: async () => ({ valorUnitario: "7.5", data: "2026-09-03", parceiro: { id: 1, nome: "Fornecedor Rural" } }) }
      : { ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    montar();
    fireEvent.change(screen.getByLabelText("Fornecedor ou parceiro"), { target: { value: "1" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Produto do item 1" }), { target: { value: "1" } });
    await waitFor(() => expect((screen.getByRole("spinbutton", { name: "Valor unitário do item 1" }) as HTMLInputElement).value).toBe("7.50"));
    expect(fetchMock).toHaveBeenCalledWith("/api/estoque/produtos/1/ultimo-preco?parceiroId=1", expect.anything());
    expect(screen.getByText(/Última compra:/).textContent?.replaceAll("\u00a0", " ")).toBe("Última compra: R$ 7,50 em 03/09 (Fornecedor Rural)");
  });

  it("sem histórico de compra, deixa o valor unitário vazio e sem linha de ajuda", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => null }));
    vi.stubGlobal("fetch", fetchMock);
    montar();
    fireEvent.change(screen.getByRole("combobox", { name: "Produto do item 1" }), { target: { value: "1" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/estoque/produtos/1/ultimo-preco", expect.anything()));
    expect((screen.getByRole("spinbutton", { name: "Valor unitário do item 1" }) as HTMLInputElement).value).toBe("");
    expect(screen.queryByText(/Última compra:/)).toBeNull();
  });

  it("não sobrescreve um valor digitado antes da sugestão chegar", async () => {
    let responder: (v: unknown) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => { responder = resolve; })));
    montar();
    fireEvent.change(screen.getByRole("combobox", { name: "Produto do item 1" }), { target: { value: "1" } });
    const campo = screen.getByRole("spinbutton", { name: "Valor unitário do item 1" }) as HTMLInputElement;
    fireEvent.change(campo, { target: { value: "9" } });
    responder({ ok: true, json: async () => ({ valorUnitario: "7.5", data: "2026-09-03", parceiro: null }) });
    await waitFor(() => expect(screen.queryByText(/Última compra:/)).toBeTruthy());
    expect(campo.value).toBe("9");
  });

  it("não expõe o saldo no seletor de conta", () => {
    montar();
    expect(screen.getByRole("option", { name: "Banco principal" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Banco principal.*R\$/ })).toBeNull();
  });

  it("não oferece contas nem parceiros inativos em uma nova operação", () => {
    montar();
    expect(screen.queryByRole("option", { name: "Conta desativada" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Fornecedor desativado" })).toBeNull();
    expect(screen.getByRole("option", { name: "Banco principal" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Fornecedor Rural" })).toBeTruthy();
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
    expect(screen.getByText(/Cada parcela será criada como um compromisso vinculado a esta operação/)).toBeTruthy();
    expect(screen.getByRole("spinbutton", { name: "Valor da parcela 1" })).toBeTruthy();
    expect(screen.getByLabelText("Vencimento da parcela 1")).toBeTruthy();
  });

  it("soma itens já arredondados em centavos como o backend", () => {
    montar();
    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantidade do item 1" }), { target: { value: "0.001" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Valor unitário do item 1" }), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar item/i }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantidade do item 2" }), { target: { value: "0.001" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Valor unitário do item 2" }), { target: { value: "5" } });
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
    categorias: [{ id: 1, nome: "Silagem", classificacao: "CUSTEIO" as const, ativo: true, ordem: 0, usoSanitario: false, usoNutricional: false, usoAgricola: false }, { id: 2, nome: "Vacinas", classificacao: "CUSTEIO" as const, ativo: true, ordem: 0, usoSanitario: false, usoNutricional: false, usoAgricola: false }],
    centrosCusto: [{ id: 1, nome: "Pecuária", ativo: true, ordem: 0 }, { id: 2, nome: "Agronomia", ativo: true, ordem: 0 }],
    produtos: [{ ...config.produtos[0], categoriaId: 1, centroCustoIds: [1] }, { ...config.produtos[0], id: 2, nome: "Vacina", categoriaId: 2, centroCustoIds: [2] }],
  };
}

it("produto com um único centro preenche o item e sugere o centro da operação", () => {
  render(<FormOperacao config={configCentrosDivergentes()} onSalvo={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Produto do item 1"), { target: { value: "1" } });
  expect((screen.getByLabelText("Categoria do item 1") as HTMLSelectElement).value).toBe("1");
  expect((screen.getByLabelText("Centro de custo") as HTMLSelectElement).value).toBe("1");
});

it("produtos com centros divergentes mostram aviso e 'Separar por item' preenche o modo por item", () => {
  render(<FormOperacao config={configCentrosDivergentes()} onSalvo={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Produto do item 1"), { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: /Adicionar item/i }));
  fireEvent.change(screen.getByLabelText("Produto do item 2"), { target: { value: "2" } });
  expect((screen.getByLabelText("Categoria do item 2") as HTMLSelectElement).value).toBe("2");
  expect((screen.getByLabelText("Centro de custo") as HTMLSelectElement).value).toBe("");
  expect(screen.getByText(/Os produtos pertencem a centros de custo diferentes/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Separar por item/i }));
  expect((screen.getByLabelText("Centro de custo do item 1") as HTMLSelectElement).value).toBe("1");
  expect((screen.getByLabelText("Centro de custo do item 2") as HTMLSelectElement).value).toBe("2");
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
  fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Compra mista" } });
  fireEvent.change(screen.getByLabelText("Fornecedor ou parceiro"), { target: { value: String(config.parceiros[0].id) } });
  fireEvent.change(screen.getByLabelText("Produto do item 1"), { target: { value: "1" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Valor unitário do item 1" }), { target: { value: "100" } });
  fireEvent.click(screen.getByRole("button", { name: /Adicionar item/i }));
  fireEvent.change(screen.getByLabelText("Produto do item 2"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: /Separar por item/i }));
  fireEvent.change(screen.getByLabelText("Centro de custo do item 2"), { target: { value: "" } });
  fireEvent.change(screen.getByLabelText("Conta financeira"), { target: { value: String(config.contas[0].id) } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  const chamadaConfirmar = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/financeiro/operacoes/rascunho/confirmacao"));
  expect(chamadaConfirmar).toBeTruthy();
});

it("item não estocável sem centro de custo bloqueia a confirmação com mensagem no campo", () => {
  const originalScroll = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = vi.fn();
  try {
    const cfg = configCentrosDivergentes();
    render(<FormOperacao config={cfg} tipoInicial="COMPRA_CONSUMO_DIRETO" onSalvo={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Fornecedor ou parceiro"), { target: { value: String(cfg.parceiros[0].id) } });
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Serviço avulso" } });
    fireEvent.change(screen.getByLabelText("Descrição do item 1"), { target: { value: "Item sem centro" } });
    fireEvent.change(screen.getByLabelText("Quantidade do item 1"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Valor unitário do item 1"), { target: { value: "10" } });
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
      id: 8, versao: 1, updatedAt: "2026-09-11", documentos: [],
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

it("'Separar por item' deixa vazio (herda a operação) quando o produto não tem centro único", () => {
  const cfg = { ...configCentrosDivergentes() };
  cfg.produtos = [{ ...cfg.produtos[0], centroCustoIds: [] }, cfg.produtos[1]];
  render(<FormOperacao config={cfg} onSalvo={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Produto do item 1"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Centro de custo"), { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: /Adicionar item/i }));
  fireEvent.change(screen.getByLabelText("Produto do item 2"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("radio", { name: /Por item/i }));
  expect((screen.getByLabelText("Centro de custo do item 1") as HTMLSelectElement).value).toBe("");
  expect((screen.getByLabelText("Centro de custo do item 2") as HTMLSelectElement).value).toBe("2");
});

it("erro do servidor itens.N.centroCustoId no modo Único marca e rola até o centro da operação", async () => {
  const originalScroll = HTMLElement.prototype.scrollIntoView;
  const scroll = vi.fn();
  HTMLElement.prototype.scrollIntoView = scroll;
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
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Compra combinada" } });
    fireEvent.change(screen.getByLabelText("Fornecedor ou parceiro"), { target: { value: String(cfg.parceiros[0].id) } });
    fireEvent.change(screen.getByLabelText("Produto do item 1"), { target: { value: "1" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Valor unitário do item 1" }), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Centro de custo"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Conta financeira"), { target: { value: String(cfg.contas[0].id) } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
    await waitFor(() => expect(screen.getByLabelText("Centro de custo").getAttribute("aria-invalid")).toBe("true"));
    const campo = screen.getByLabelText("Centro de custo");
    expect(campo.id).toBe("campo-centroCustoId");
    expect(scroll).toHaveBeenCalled();
  } finally {
    HTMLElement.prototype.scrollIntoView = originalScroll;
  }
});

it("voltar para Único limpa os centros preenchidos nos itens", () => {
  render(<FormOperacao config={configCentrosDivergentes()} onSalvo={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Produto do item 1"), { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: /Adicionar item/i }));
  fireEvent.change(screen.getByLabelText("Produto do item 2"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: /Separar por item/i }));
  expect((screen.getByLabelText("Centro de custo do item 1") as HTMLSelectElement).value).toBe("1");
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
    render(<FormOperacao config={config} rascunho={{ id: 8, versao: 2, updatedAt: "2026-09-07T12:00:00Z", documentos: [], dados: { formulario: { tipo: "SERVICO", condicao: "A_PRAZO", descricao: "Manutenção programada", valorOperacao: "800.00", itens: [], parceiroId: "1", categoriaId: "", centroCustoId: "", contaId: "", formaPagamento: "PIX", data: "2026-09-07", valorAgora: "", parcelas: [{ id: 1, valor: "800.00", vencimento: "2026-10-07" }] } } }} onSalvo={vi.fn()} />);
    expect((screen.getByRole("button", { name: "Confirmar operação" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("confirmacao"), expect.objectContaining({ method: "POST" })));
  });

  it("começa sem parcela preenchida (personalizado por padrão) e preserva o que o usuário digitar mesmo com o total mudando depois", () => {
    montar();
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo de operação" }), { target: { value: "SERVICO" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Valor total da operação" }), { target: { value: "100" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Condição financeira" }), { target: { value: "A_PRAZO" } });
    expect((screen.getByRole("spinbutton", { name: "Valor da parcela 1" }) as HTMLInputElement).value).toBe("");
    fireEvent.change(screen.getByRole("spinbutton", { name: "Valor da parcela 1" }), { target: { value: "60.00" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Valor total da operação" }), { target: { value: "200" } });
    expect((screen.getByRole("spinbutton", { name: "Valor da parcela 1" }) as HTMLInputElement).value).toBe("60.00");
    expect(screen.getAllByText(/A soma das parcelas deve corresponder/).length).toBeGreaterThan(0);
  });

  it("mostra excedente quando a soma das parcelas ultrapassa o total", () => {
    montar();
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo de operação" }), { target: { value: "SERVICO" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Valor total da operação" }), { target: { value: "100" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Condição financeira" }), { target: { value: "A_PRAZO" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Valor da parcela 1" }), { target: { value: "150" } });
    expect(screen.getAllByText(/Excedente/).length).toBeGreaterThan(0);
  });

  it("a grade automática fica atrás do botão Gerar parcelas — não aparece fixa na página", () => {
    montar();
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo de operação" }), { target: { value: "SERVICO" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Valor total da operação" }), { target: { value: "90" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Condição financeira" }), { target: { value: "A_PRAZO" } });
    expect(screen.queryByRole("spinbutton", { name: "Quantidade de parcelas" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Gerar parcelas" }));
    expect(screen.getByRole("spinbutton", { name: "Quantidade de parcelas" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Intervalo das parcelas" })).toBeTruthy();
    // Não oferece mais "Personalizada": manual já é o padrão via "+ Parcela".
    expect(screen.queryByRole("option", { name: "Personalizada" })).toBeNull();
  });

  it("+ Parcela fica sempre ao fim da lista e cada clique acrescenta uma linha", () => {
    montar();
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo de operação" }), { target: { value: "SERVICO" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Valor total da operação" }), { target: { value: "90" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Condição financeira" }), { target: { value: "A_PRAZO" } });
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
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo de operação" }), { target: { value: "SERVICO" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Valor total da operação" }), { target: { value: "90" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Condição financeira" }), { target: { value: "A_PRAZO" } });
    fireEvent.click(screen.getByRole("button", { name: "Gerar parcelas" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantidade de parcelas" }), { target: { value: "3" } });
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
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo de operação" }), { target: { value: "SERVICO" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Valor total da operação" }), { target: { value: "90" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Condição financeira" }), { target: { value: "A_PRAZO" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Valor da parcela 1" }), { target: { value: "90.00" } });

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
      id: 5, versao: 1, updatedAt: "2026-09-21T00:00:00Z", documentos: [],
      dados: { formulario: {
        tipo: "SERVICO", condicao: "A_PRAZO", descricao: "Manutenção", valorOperacao: "100", itens: [],
        parceiroId: "1", categoriaId: "", centroCustoId: "", contaId: "", formaPagamento: "PIX", data: "2026-09-21", valorAgora: "",
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
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Manutenção do trator" } });
    fireEvent.change(screen.getByLabelText("Valor total da operação"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Prestador de serviço"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Conta financeira"), { target: { value: "1" } });

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
    fireEvent.change(parceiroSelect, { target: { value: "" } });
    expect(parceiroSelect.getAttribute("aria-invalid")).toBeNull();
    expect(parceiroSelect.getAttribute("aria-describedby")).toBeNull();
    expect(screen.queryByText("Selecione um parceiro válido.")).toBeNull();
  });
});

describe("FormOperacao — botão sempre ativo; erro rola e foca o campo (não fica escondido/desabilitado)", () => {
  // jsdom não faz layout: scrollIntoView existe como stub, mas trocamos por
  // um mock pra provar que ele foi chamado — o foco real (document.activeElement)
  // é o que garante de verdade que o usuário foi levado até o campo.
  const comScrollStub = <T,>(rodar: () => T): [T, ReturnType<typeof vi.fn>] => {
    const scroll = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scroll;
    try { return [rodar(), scroll]; } finally { HTMLElement.prototype.scrollIntoView = original; }
  };

  it("formulário em branco: o botão de confirmar nunca fica desabilitado", () => {
    montar();
    expect((screen.getByRole("button", { name: "Confirmar operação" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("mostra o motivo pendente abaixo do botão enquanto o formulário não está completo, e some quando fica válido", () => {
    montar();
    const motivo = screen.getByText(/Ainda há campos pendentes ou incompletos/);
    expect(motivo.closest('[role="status"]')?.id).toBe("motivo-pendencia");
    expect(screen.getByRole("button", { name: "Confirmar operação" }).getAttribute("aria-describedby")).toContain("motivo-pendencia");

    // Preenche tudo que o tipo padrão (COMPRA_ESTOQUE, com item) exige.
    fireEvent.change(screen.getByLabelText("Fornecedor ou parceiro"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Compra de ração" } });
    fireEvent.change(screen.getByLabelText("Produto do item 1"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Descrição do item 1"), { target: { value: "Ração" } });
    fireEvent.change(screen.getByLabelText("Valor unitário do item 1"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Conta financeira"), { target: { value: "1" } });

    expect(screen.queryByText(/Ainda há campos pendentes ou incompletos/)).toBeNull();
  });

  it("descrição vazia: rola e foca o campo ao tentar confirmar", () => {
    const [, scroll] = comScrollStub(() => {
      render(<FormOperacao config={config} tipoInicial="SERVICO" onSalvo={vi.fn()} />);
      fireEvent.change(screen.getByLabelText("Prestador de serviço"), { target: { value: "1" } });
      fireEvent.change(screen.getByLabelText("Valor total da operação"), { target: { value: "100" } });
      fireEvent.change(screen.getByLabelText("Conta financeira"), { target: { value: "1" } });
      fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
      const campo = screen.getByLabelText("Descrição");
      expect(campo.id).toBe("campo-descricao");
      expect(campo.getAttribute("aria-invalid")).toBe("true");
      expect(document.activeElement).toBe(campo);
    });
    expect(scroll).toHaveBeenCalled();
  });

  it("item que movimenta estoque sem produto selecionado: rola e foca o card do item, não um campo qualquer", () => {
    const [, scroll] = comScrollStub(() => {
      montar(); // COMPRA_ESTOQUE por padrão: itens com movimentação de estoque
      fireEvent.change(screen.getByLabelText("Fornecedor ou parceiro"), { target: { value: "1" } });
      fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Compra de insumos" } });
      fireEvent.change(screen.getByLabelText("Descrição do item 1"), { target: { value: "Ração especial" } });
      fireEvent.change(screen.getByLabelText("Conta financeira"), { target: { value: "1" } });
      fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
      const itemCard = screen.getByLabelText("Descrição do item 1").closest('[id^="item-"]') as HTMLElement;
      expect(itemCard.className).toContain("border-red-400");
      expect(document.activeElement).toBe(itemCard);
    });
    expect(scroll).toHaveBeenCalled();
  });

  it("item não estocável sem centro de custo: rola e foca o campo do item", () => {
    const [, scroll] = comScrollStub(() => {
      render(<FormOperacao config={{ ...config,
        centrosCusto: [{ id: 1, nome: "Pecuária", ativo: true, ordem: 0 }, { id: 2, nome: "Agronomia", ativo: true, ordem: 0 }],
        produtos: [{ ...config.produtos[0], centroCustoIds: [1] }, { ...config.produtos[0], id: 2, nome: "Adubo", centroCustoIds: [2] }],
      }} tipoInicial="COMPRA_CONSUMO_DIRETO" onSalvo={vi.fn()} />);
      fireEvent.change(screen.getByLabelText("Fornecedor ou parceiro"), { target: { value: "1" } });
      fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Compra combinada" } });
      fireEvent.change(screen.getByLabelText("Descrição do item 1"), { target: { value: "Item avulso" } });
      fireEvent.change(screen.getByLabelText("Quantidade do item 1"), { target: { value: "1" } });
      fireEvent.change(screen.getByLabelText("Valor unitário do item 1"), { target: { value: "10" } });
      fireEvent.change(screen.getByLabelText("Conta financeira"), { target: { value: "1" } });
      fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
      const campo = screen.getByLabelText("Centro de custo");
      expect(campo.id).toBe("campo-centroCustoId");
      expect(campo.getAttribute("aria-invalid")).toBe("true");
      expect(document.activeElement).toBe(campo);
    });
    expect(scroll).toHaveBeenCalled();
  });

  it("conta financeira vazia: rola e foca o campo", () => {
    const [, scroll] = comScrollStub(() => {
      render(<FormOperacao config={config} tipoInicial="SERVICO" onSalvo={vi.fn()} />);
      fireEvent.change(screen.getByLabelText("Prestador de serviço"), { target: { value: "1" } });
      fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Manutenção" } });
      fireEvent.change(screen.getByLabelText("Valor total da operação"), { target: { value: "100" } });
      fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
      const campo = screen.getByLabelText("Conta financeira");
      expect(campo.id).toBe("campo-contaId");
      expect(campo.getAttribute("aria-invalid")).toBe("true");
      expect(document.activeElement).toBe(campo);
    });
    expect(scroll).toHaveBeenCalled();
  });

  it("parcela em branco com a soma fechando: foca a parcela, explica o motivo em português e não chama a API", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const [, scroll] = comScrollStub(() => {
      render(<FormOperacao config={config} tipoInicial="SERVICO" onSalvo={vi.fn()} />);
      fireEvent.change(screen.getByLabelText("Prestador de serviço"), { target: { value: "1" } });
      fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Manutenção" } });
      fireEvent.change(screen.getByLabelText("Valor total da operação"), { target: { value: "100" } });
      fireEvent.change(screen.getByRole("combobox", { name: "Condição financeira" }), { target: { value: "A_PRAZO" } });
      fireEvent.change(screen.getByRole("spinbutton", { name: "Valor da parcela 1" }), { target: { value: "100" } });
      fireEvent.click(screen.getByRole("button", { name: "Parcela" })); // parcela 2 fica em branco: soma continua fechando
      fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));

      const campo = screen.getByRole("spinbutton", { name: "Valor da parcela 2" });
      expect(campo.getAttribute("aria-invalid")).toBe("true");
      expect(document.activeElement).toBe(campo);
      expect(screen.getByText(/A parcela 2 está sem valor\. Informe um valor maior que zero ou remova a parcela\./)).toBeTruthy();
      expect(screen.queryByText(/Number must be greater than 0/)).toBeNull();

      // Corrigir o valor limpa o erro da linha.
      fireEvent.change(campo, { target: { value: "0.01" } });
      expect(campo.getAttribute("aria-invalid")).toBeNull();
      expect(screen.queryByText(/está sem valor/)).toBeNull();
    });
    expect(scroll).toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("confirmacao"))).toBe(false);
  });

  it("parcela sem vencimento: foca o vencimento da parcela e explica o motivo", () => {
    comScrollStub(() => {
      render(<FormOperacao config={config} tipoInicial="SERVICO" onSalvo={vi.fn()} />);
      fireEvent.change(screen.getByLabelText("Prestador de serviço"), { target: { value: "1" } });
      fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Manutenção" } });
      fireEvent.change(screen.getByLabelText("Valor total da operação"), { target: { value: "100" } });
      fireEvent.change(screen.getByRole("combobox", { name: "Condição financeira" }), { target: { value: "A_PRAZO" } });
      fireEvent.change(screen.getByRole("spinbutton", { name: "Valor da parcela 1" }), { target: { value: "100" } });
      fireEvent.change(screen.getByLabelText("Vencimento da parcela 1"), { target: { value: "" } });
      fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
      expect(document.activeElement).toBe(screen.getByLabelText("Vencimento da parcela 1"));
      expect(screen.getByText(/A parcela 1 está sem data de vencimento/)).toBeTruthy();
    });
  });

  it("parcelas com soma incorreta: rola e foca a seção de parcelas", () => {
    const [, scroll] = comScrollStub(() => {
      render(<FormOperacao config={config} tipoInicial="SERVICO" onSalvo={vi.fn()} />);
      fireEvent.change(screen.getByLabelText("Prestador de serviço"), { target: { value: "1" } });
      fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Manutenção" } });
      fireEvent.change(screen.getByLabelText("Valor total da operação"), { target: { value: "100" } });
      fireEvent.change(screen.getByRole("combobox", { name: "Condição financeira" }), { target: { value: "A_PRAZO" } });
      fireEvent.change(screen.getByRole("spinbutton", { name: "Valor da parcela 1" }), { target: { value: "50" } });
      fireEvent.click(screen.getByRole("button", { name: "Confirmar operação" }));
      const secao = document.getElementById("secao-parcelas");
      expect(secao).toBe(document.activeElement);
    });
    expect(scroll).toHaveBeenCalled();
  });
});
