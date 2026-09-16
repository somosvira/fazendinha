// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormOperacao } from "./FormOperacao";
import type { ConfiguracoesFinanceiras } from "./novo-api";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  Element.prototype.scrollIntoView = vi.fn();
});
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

const campo = (rotulo: string) => screen.getByRole("combobox", { name: rotulo });
const abrir = (rotulo: string) => fireEvent.click(campo(rotulo));
const fechar = () => fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
/* Ao fechar, o Radix devolve o foco ao gatilho num setTimeout(0); esperar esse
 * tick evita que o foco atrasado feche o próximo dropdown aberto pelo teste. */
async function escolher(rotulo: string, opcao: string) {
  abrir(rotulo);
  fireEvent.click(await screen.findByRole("option", { name: opcao }));
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

describe("FormOperacao", () => {
  it("não oferece ajuste de estoque como nova operação", async () => {
    montar();
    abrir("Tipo de operação");
    expect(await screen.findByRole("option", { name: "Compra para estoque" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Ajuste de estoque" })).toBeNull();
  });

  it("explica em linguagem simples o tipo escolhido", async () => {
    montar();
    expect(screen.getByText(/O produto entra no estoque e o dinheiro sai da conta/)).toBeTruthy();
    await escolher("Tipo de operação", "Venda");
    expect(screen.getByText(/O produto sai do estoque e o dinheiro entra na conta/)).toBeTruthy();
    expect(screen.queryByText(/O produto entra no estoque e o dinheiro sai da conta/)).toBeNull();
  });

  it("ilustra na lista para onde vão o produto e o dinheiro em cada tipo", async () => {
    montar();
    abrir("Tipo de operação");
    const venda = await screen.findByRole("option", { name: "Venda" });
    expect(venda.textContent).toContain("Você vende para um cliente");
    fireEvent.focus(venda);
    const previa = screen.getByRole("figure", { name: "O que acontece em Venda" });
    expect(previa.textContent).toMatch(/Produto.*de Estoque.*para Cliente/);
    expect(previa.textContent).toMatch(/Dinheiro.*de Cliente.*para Conta/);
    fireEvent.focus(screen.getByRole("option", { name: "Inventário inicial" }));
    const inventario = screen.getByRole("figure", { name: "O que acontece em Inventário inicial" });
    expect(inventario.textContent).toMatch(/Produto.*de Contagem.*para Estoque/);
    expect(inventario.textContent).toContain("Não mexe em dinheiro");
  });

  it("sugere pagamento sem aplicar automaticamente e permite escolher outra forma", async () => {
    render(<FormOperacao config={{ ...config, parceiros: [{ ...config.parceiros[0], papeis: ["PRESTADOR_SERVICO"], formaPagamentoPreferida: "BOLETO", condicaoPagamentoPreferida: "A_PRAZO", prazosPagamento: [30, 60] }] }} tipoInicial="SERVICO" onSalvo={vi.fn()} />);
    await escolher("Prestador de serviço", "Fornecedor Rural");
    fireEvent.change(screen.getByLabelText("Valor total da operação"), { target: { value: "100" } });
    expect(campo("Condição financeira").textContent).toBe("Liquidação integral na operação");
    expect(campo("Forma de liquidação").textContent).toBe("Pix");
    fireEvent.click(screen.getByRole("button", { name: "Usar sugestão" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(campo("Condição financeira").textContent).toBe("Liquidação integral na operação");
    fireEvent.click(screen.getByRole("button", { name: "Usar sugestão" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar sugestão" }));
    expect(campo("Condição financeira").textContent).toBe("Liquidação integral a prazo");
    expect((screen.getByLabelText("Valor da parcela 1") as HTMLInputElement).value).toBe("50.00");
    expect((screen.getByLabelText("Valor da parcela 2") as HTMLInputElement).value).toBe("50.00");
    await escolher("Condição financeira", "Liquidação integral na operação");
    await escolher("Forma de liquidação", "Dinheiro");
    expect(campo("Forma de liquidação").textContent).toBe("Dinheiro");
  });

  it("bloqueia confirmação de rascunho cujo parceiro perdeu o papel necessário", () => {
    render(<FormOperacao config={config} rascunho={{ id: 8, versao: 1, updatedAt: "2026-09-11", documentos: [], dados: { formulario: { tipo: "SERVICO", condicao: "A_VISTA", descricao: "Manutenção", valorOperacao: "100", parceiroId: "2", contaId: "1", formaPagamento: "PIX", data: "2026-09-11" } } }} onSalvo={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toContain("não tem um papel compatível");
    expect((screen.getByRole("button", { name: "Confirmar operação" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("abre como página e remove campos físicos quando o tipo é serviço", async () => {
    montar();
    expect(screen.getByRole("heading", { name: "Nova operação" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    await escolher("Tipo de operação", "Serviço");
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
    expect(campo("Condição financeira").textContent).toBe("Liquidação integral a prazo");
    expect(screen.getByRole("button", { name: "Data" }).textContent).toContain("07/09/2026");
    expect(screen.getByRole("button", { name: "Vencimento da parcela 1" }).textContent).toContain("07/10/2026");
  });

  it("escolhe a data da operação pelo calendário", async () => {
    render(<FormOperacao config={config} rascunho={{ id: 8, versao: 2, updatedAt: "2026-09-07T12:00:00Z", documentos: [], dados: { formulario: { tipo: "SERVICO", condicao: "A_VISTA", descricao: "Frete", valorOperacao: "80.00", parceiroId: "1", contaId: "1", formaPagamento: "PIX", data: "2026-09-07" } } }} onSalvo={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Data" }));
    fireEvent.click(screen.getByRole("button", { name: "12 de setembro de 2026" }));
    expect(screen.getByRole("button", { name: "Data" }).textContent).toContain("12/09/2026");
  });

  it("permite alternar entre valor unitário e valor total do item", async () => {
    montar();
    await escolher("Base do valor do item 1", "Valor total do item");
    expect(screen.getByRole("spinbutton", { name: "Valor total do item 1" })).toBeTruthy();
    expect(screen.queryByRole("spinbutton", { name: "Valor unitário do item 1" })).toBeNull();
  });

  it("deriva a unidade do produto sem permitir edição", async () => {
    montar();
    await escolher("Produto do item 1", "Ração");
    expect(screen.getByLabelText("Unidade do item 1").textContent).toBe("kg");
    expect(screen.queryByRole("textbox", { name: "Unidade do item 1" })).toBeNull();
  });

  it("busca produtos pelo nome sem acento", async () => {
    render(<FormOperacao config={{ ...config, produtos: [...config.produtos, { id: 2, nome: "Vacina", unidade: "dose", estocavel: true, custoUnitario: "9" }] }} onSalvo={vi.fn()} />);
    abrir("Produto do item 1");
    fireEvent.change(screen.getByPlaceholderText("Buscar produto…"), { target: { value: "racao" } });
    expect(screen.getByRole("option", { name: "Ração" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Vacina" })).toBeNull();
  });

  it("não expõe o saldo no seletor de conta", async () => {
    montar();
    abrir("Conta financeira");
    expect(await screen.findByRole("option", { name: "Banco principal" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Banco principal.*R\$/ })).toBeNull();
  });

  it("não oferece contas nem parceiros inativos em uma nova operação", async () => {
    montar();
    abrir("Conta financeira");
    expect(await screen.findByRole("option", { name: "Banco principal" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Conta desativada" })).toBeNull();
    fechar();
    abrir("Fornecedor ou parceiro");
    expect(await screen.findByRole("option", { name: "Fornecedor Rural" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Fornecedor desativado" })).toBeNull();
  });

  it("formata o valor informado com duas casas decimais", () => {
    montar();
    const valor = screen.getByRole("spinbutton", { name: "Valor unitário do item 1" });
    fireEvent.change(valor, { target: { value: "12.5" } });
    fireEvent.blur(valor);
    expect((valor as HTMLInputElement).value).toBe("12.50");
  });

  it("resume produto, quantidade e valor total de cada item", async () => {
    montar();
    await escolher("Produto do item 1", "Ração");
    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantidade do item 1" }), { target: { value: "3" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Valor unitário do item 1" }), { target: { value: "5" } });
    const resumo = screen.getAllByText("Itens da operação").at(-1)!.parentElement!;
    expect(resumo.textContent).toContain("Ração");
    expect(resumo.textContent).toContain("3 kg");
    expect(resumo.textContent?.replaceAll(" ", " ")).toContain("R$ 15,00");
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
    abrir("Condição financeira");
    const aPrazo = await screen.findByRole("option", { name: "Liquidação integral a prazo" });
    expect(aPrazo.textContent).toContain("Nada é pago hoje");
    fireEvent.focus(aPrazo);
    const previa = screen.getByRole("figure", { name: "Quando o dinheiro se move em Liquidação integral a prazo" });
    expect(previa.textContent).toMatch(/Hoje.*nada/);
    expect(previa.textContent).toMatch(/Depois.*tudo, em parcelas/);
    fireEvent.click(aPrazo);
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

describe("FormOperacao — arrastar e soltar documentos", () => {
  const documento = { id: 31, tipo: "NOTA_FISCAL", nome: "nota.pdf", numero: null, mimeType: "application/pdf", tamanhoBytes: 4 };
  function servidor() {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (url.endsWith("/rascunho/documentos") ? documento : { id: 8, dados: {}, versao: 1, documentos: [], updatedAt: "2026-09-16T12:00:00Z" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }
  const zona = () => screen.getByRole("button", { name: /Arraste os arquivos para cá/ });
  const soltar = (...arquivos: File[]) => fireEvent.drop(zona(), { dataTransfer: { files: arquivos, types: ["Files"] } });

  it("destaca a área enquanto um arquivo é arrastado por cima", () => {
    montar();
    expect(screen.queryByText("Solte para anexar")).toBeNull();
    fireEvent.dragEnter(zona(), { dataTransfer: { types: ["Files"] } });
    expect(screen.getByText("Solte para anexar")).toBeTruthy();
    fireEvent.dragLeave(zona(), { dataTransfer: { types: ["Files"] } });
    expect(screen.queryByText("Solte para anexar")).toBeNull();
  });

  it("anexa ao rascunho os arquivos soltos na área", async () => {
    const fetchMock = servidor();
    montar();
    soltar(new File(["%PDF"], "nota.pdf", { type: "application/pdf" }));
    expect(await screen.findByText("nota.pdf")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/financeiro/operacoes/rascunho/documentos", expect.objectContaining({ method: "POST" }));
    expect(screen.queryByText("Solte para anexar")).toBeNull();
  });

  it("recusa arquivos soltos com formato não aceito", async () => {
    const fetchMock = servidor();
    montar();
    soltar(new File(["MZ"], "programa.exe", { type: "application/octet-stream" }));
    expect(await screen.findByText(/não foram adicionados.*programa\.exe/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/financeiro/operacoes/rascunho/documentos", expect.anything());
  });
});

it("herda a categoria por produto, pede centro para mistura e preserva escolha manual", async () => {
  render(<FormOperacao config={{ ...config,
    categorias: [{ id: 1, nome: "Silagem", classificacao: "CUSTEIO", ativo: true, ordem: 0 }, { id: 2, nome: "Vacinas", classificacao: "CUSTEIO", ativo: true, ordem: 0 }],
    centrosCusto: [{ id: 1, nome: "Pecuária", ativo: true, ordem: 0 }, { id: 2, nome: "Agronomia", ativo: true, ordem: 0 }],
    produtos: [{ ...config.produtos[0], categoriaId: 1, centroCustoId: 1 }, { ...config.produtos[0], id: 2, nome: "Vacina", categoriaId: 2, centroCustoId: 2 }],
  }} onSalvo={vi.fn()} />);
  await escolher("Produto do item 1", "Ração");
  expect(campo("Categoria do item 1").textContent).toBe("Silagem");
  expect(campo("Centro de custo").textContent).toBe("Pecuária");
  fireEvent.click(screen.getByRole("button", { name: /Adicionar item/i }));
  await escolher("Produto do item 2", "Vacina");
  expect(campo("Categoria do item 2").textContent).toBe("Vacinas");
  expect(campo("Centro de custo").textContent).toBe("Sem centro de custo");
  expect(screen.getByText(/Os produtos sugerem áreas diferentes/)).toBeTruthy();
  await escolher("Centro de custo", "Agronomia");
  await escolher("Produto do item 2", "Ração");
  expect(campo("Centro de custo").textContent).toBe("Agronomia");
});
