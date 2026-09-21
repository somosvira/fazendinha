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
  produtos: [{ id: 1, nome: "Ração", unidade: "kg", estocavel: true, custoUnitario: "5" }],
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

  it("bloqueia confirmação de rascunho cujo parceiro perdeu o papel necessário", () => {
    render(<FormOperacao config={config} rascunho={{ id: 8, versao: 1, updatedAt: "2026-09-11", documentos: [], dados: { formulario: { tipo: "SERVICO", condicao: "A_VISTA", descricao: "Manutenção", valorOperacao: "100", parceiroId: "2", contaId: "1", formaPagamento: "PIX", data: "2026-09-11" } } }} onSalvo={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toContain("não tem um papel compatível");
    expect((screen.getByRole("button", { name: "Confirmar operação" }) as HTMLButtonElement).disabled).toBe(true);
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
    expect(screen.getByText("Cada parcela será criada como um compromisso vinculado a esta operação.")).toBeTruthy();
    expect(screen.getByRole("spinbutton", { name: "Valor da parcela 1" })).toBeTruthy();
    expect(screen.getByLabelText("Vencimento da parcela 1")).toBeTruthy();
  });

  it("oferece documentos tipificados no próprio cadastro", () => {
    montar();
    expect(screen.getByLabelText("Anexar documentos")).toBeTruthy();
    expect(screen.getByText("PDF, XML, JPG, PNG ou WEBP, com até 10 MB por arquivo.")).toBeTruthy();
  });
});

it("herda a categoria por produto, pede centro para mistura e preserva escolha manual", () => {
  render(<FormOperacao config={{ ...config,
    categorias: [{ id: 1, nome: "Silagem", classificacao: "CUSTEIO", ativo: true, ordem: 0 }, { id: 2, nome: "Vacinas", classificacao: "CUSTEIO", ativo: true, ordem: 0 }],
    centrosCusto: [{ id: 1, nome: "Pecuária", ativo: true, ordem: 0 }, { id: 2, nome: "Agronomia", ativo: true, ordem: 0 }],
    produtos: [{ ...config.produtos[0], categoriaId: 1, centroCustoId: 1 }, { ...config.produtos[0], id: 2, nome: "Vacina", categoriaId: 2, centroCustoId: 2 }],
  }} onSalvo={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Produto do item 1"), { target: { value: "1" } });
  expect((screen.getByLabelText("Categoria do item 1") as HTMLSelectElement).value).toBe("1");
  expect((screen.getByLabelText("Centro de custo") as HTMLSelectElement).value).toBe("1");
  fireEvent.click(screen.getByRole("button", { name: /Adicionar item/i }));
  fireEvent.change(screen.getByLabelText("Produto do item 2"), { target: { value: "2" } });
  expect((screen.getByLabelText("Categoria do item 2") as HTMLSelectElement).value).toBe("2");
  expect((screen.getByLabelText("Centro de custo") as HTMLSelectElement).value).toBe("");
  expect(screen.getByText(/Os produtos sugerem áreas diferentes/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Centro de custo"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Produto do item 2"), { target: { value: "1" } });
  expect((screen.getByLabelText("Centro de custo") as HTMLSelectElement).value).toBe("2");
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

  it("mantém uma parcela editada manualmente mesmo quando o total muda depois", () => {
    montar();
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo de operação" }), { target: { value: "SERVICO" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Valor total da operação" }), { target: { value: "100" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Condição financeira" }), { target: { value: "A_PRAZO" } });
    expect((screen.getByRole("spinbutton", { name: "Valor da parcela 1" }) as HTMLInputElement).value).toBe("100.00");
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

  it("oferece frequência Personalizada e desativa a geração automática", () => {
    montar();
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo de operação" }), { target: { value: "SERVICO" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Valor total da operação" }), { target: { value: "90" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Condição financeira" }), { target: { value: "A_PRAZO" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantidade de parcelas" }), { target: { value: "3" } });
    expect(screen.getAllByRole("spinbutton", { name: /Valor da parcela/ })).toHaveLength(3);
    fireEvent.change(screen.getByRole("combobox", { name: "Intervalo das parcelas" }), { target: { value: "PERSONALIZADA" } });
    expect((screen.getByRole("button", { name: "Gerar parcelas" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole("spinbutton", { name: /Valor da parcela/ })).toHaveLength(3);
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
    expect(screen.getByText("Selecione um parceiro válido.").id).toBe("erro-parceiroId");

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
