// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ConfiguracoesFinanceiras } from "./ConfiguracoesFinanceiras";
import { ApiError, atualizarConta, atualizarParceiro, criarCategoria, criarCentroCusto, criarConta, criarParceiro, obterConfiguracoesFinanceiras, type ConfiguracoesFinanceiras as Config } from "./novo-api";
import { escolherData, esperarFoco, prepararPopups } from "./campos.test-utils";

/* Mantém ApiError real (o formulário usa instanceof) e substitui só as chamadas. */
vi.mock("./novo-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./novo-api")>()),
  obterConfiguracoesFinanceiras: vi.fn(),
  criarConta: vi.fn(), atualizarConta: vi.fn(), criarParceiro: vi.fn(), atualizarParceiro: vi.fn(),
  criarCategoria: vi.fn(), atualizarCategoria: vi.fn(),
  criarCentroCusto: vi.fn(), atualizarCentroCusto: vi.fn(),
}));

const config: Config = {
  contas: [
    { id: 1, nome: "Banco principal", tipo: "BANCO", instituicao: "Sicoob", identificacao: "Ag. 1 · C/C 2", agencia: "1", numeroConta: "2", titular: "Fazenda Rio Novo", ordem: 0, saldoAbertura: "1000", dataSaldoAbertura: "2026-09-01", saldoAtual: "1200", incluirNoSaldoGeral: true, ativo: true, temMovimentos: true },
    { id: 2, nome: "Gaveta", tipo: "CAIXA", instituicao: null, identificacao: null, saldoAbertura: "0", dataSaldoAbertura: "2026-09-01", saldoAtual: "0", incluirNoSaldoGeral: false, ativo: false, temMovimentos: false },
  ],
  parceiros: [{ id: 7, nome: "Cooperativa", documento: "11222333000181", tipo: "FORNECEDOR", telefone: "3499990000", email: "coop@x.com", ativo: true, referencias: 2 }],
  categorias: [{ id: 11, nome: "Insumos", classificacao: "CUSTEIO", ativo: true, ordem: 0, _count: { operacoes: 2, produtos: 1 } }],
  centrosCusto: [{ id: 20, nome: "Atividade leiteira", ativo: true, ordem: 0, _count: { operacoes: 3, produtos: 0, safras: 0 } }], produtos: [],
};

/* A tabela responsiva renderiza tabela E cartões (CSS decide o que aparece);
 * no jsdom os dois existem, então pegamos sempre a primeira ocorrência. */
const primeiro = (role: string, name: string | RegExp) => screen.getAllByRole(role, { name })[0];

beforeEach(() => {
  vi.clearAllMocks();
  prepararPopups();
  vi.mocked(obterConfiguracoesFinanceiras).mockResolvedValue(config);
  vi.mocked(atualizarConta).mockResolvedValue(config.contas[0]);
  vi.mocked(atualizarParceiro).mockResolvedValue(config.parceiros[0]);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function montar(aba: "contas" | "parceiros" | "categorias" | "centros" = "contas") {
  render(<ConfiguracoesFinanceiras />);
  await screen.findAllByText("Banco principal");
  if (aba === "parceiros") fireEvent.click(screen.getByRole("button", { name: /Clientes e fornecedores/ }));
  if (aba === "categorias") fireEvent.click(screen.getByRole("button", { name: /^Categorias$/ }));
  if (aba === "centros") fireEvent.click(screen.getByRole("button", { name: /Centros de custo/ }));
}

async function escolherSelect(painel: HTMLElement, rotulo: string, opcao: string) {
  fireEvent.click(within(painel).getByRole("combobox", { name: rotulo }));
  fireEvent.click(await screen.findByRole("option", { name: opcao }));
  await esperarFoco();
}

describe("ConfiguracoesFinanceiras — contas", () => {
  it("mostra instituição em coluna e deixa o valor de abertura apenas nos detalhes", async () => {
    await montar();
    const tabela = screen.getByRole("table", { name: "Contas financeiras" });
    const linha = within(tabela).getByText("Banco principal").closest("tr")!;
    expect(within(tabela).getByRole("columnheader", { name: "Instituição" })).toBeTruthy();
    expect(within(linha).getByText("Sicoob")).toBeTruthy();
    expect(within(linha).getByText("01/09/2026")).toBeTruthy();
    expect(within(linha).queryByText("R$ 1.000,00")).toBeNull();
    fireEvent.click(linha);
    const painel = await screen.findByRole("dialog");
    expect((within(painel).getByLabelText("Saldo de abertura") as HTMLInputElement).value).toBe("1.000,00");
  });

  it("exige instituição para banco, aceita caixa sem banco e não oferece tipo dinheiro", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /Nova conta/ }));
    const painel = await screen.findByRole("dialog");
    fireEvent.change(within(painel).getByLabelText("Nome de exibição"), { target: { value: "Caixa de teste" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Criar conta" }));
    expect(within(painel).getByText("Informe a instituição financeira")).toBeTruthy();
    expect(criarConta).not.toHaveBeenCalled();
    expect(within(painel).queryByRole("option", { name: "Dinheiro" })).toBeNull();
    await escolherSelect(painel, "Tipo", "Caixa físico");
    fireEvent.change(within(painel).getByLabelText("Local"), { target: { value: "Escritório" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Criar conta" }));
    await waitFor(() => expect(criarConta).toHaveBeenCalledWith(expect.objectContaining({ tipo: "CAIXA", saldoAbertura: 0, local: "Escritório" })));
  });

  it("ignora eventos de teclado dos botões filhos e bloqueia reativação duplicada", async () => {
    let concluir!: (conta: Config["contas"][number]) => void;
    vi.mocked(atualizarConta).mockImplementation(() => new Promise((resolve) => { concluir = resolve; }));
    await montar();
    const botao = primeiro("button", "Reativar Gaveta");
    fireEvent.keyDown(botao, { key: "Enter" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(botao);
    fireEvent.click(botao);
    expect(atualizarConta).toHaveBeenCalledTimes(1);
    concluir(config.contas[1]);
    await waitFor(() => expect(obterConfiguracoesFinanceiras).toHaveBeenCalledTimes(2));
  });
  it("nova conta abre painel com todos os campos e envia data e saldo geral do formulário", async () => {
    vi.mocked(criarConta).mockResolvedValue(config.contas[0]);
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /Nova conta/ }));
    const painel = await screen.findByRole("dialog");
    for (const rotulo of ["Nome de exibição", "Tipo", "Instituição", "Identificação da conta", "Saldo de abertura", "Data do saldo de abertura", "Incluir no saldo geral"]) {
      expect(within(painel).getByLabelText(rotulo)).toBeTruthy();
    }
    fireEvent.change(within(painel).getByLabelText("Nome de exibição"), { target: { value: "Aplicação CDB" } });
    await escolherSelect(painel, "Tipo", "Aplicação financeira");
    fireEvent.change(within(painel).getByLabelText("Instituição"), { target: { value: "Sicredi" } });
    fireEvent.change(within(painel).getByLabelText("Saldo de abertura"), { target: { value: "500" } });
    await escolherData("Data do saldo de abertura", "15 de março de 2026", within(painel));
    fireEvent.click(within(painel).getByLabelText("Incluir no saldo geral"));
    fireEvent.click(within(painel).getByRole("button", { name: "Criar conta" }));
    await waitFor(() => expect(criarConta).toHaveBeenCalledWith(expect.objectContaining({ nome: "Aplicação CDB", tipo: "APLICACAO", instituicao: "Sicredi", identificacao: null, saldoAbertura: 500, dataSaldoAbertura: "2026-03-15", incluirNoSaldoGeral: false, ordem: 1 })));
    await waitFor(() => expect(obterConfiguracoesFinanceiras).toHaveBeenCalledTimes(2));
  });

  it("usa moeda sem setas, selects estilizados e remove a ordem numérica do formulário", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /Nova conta/ }));
    const painel = await screen.findByRole("dialog");
    const saldo = within(painel).getByLabelText("Saldo de abertura") as HTMLInputElement;
    expect(saldo.type).toBe("text");
    expect(saldo.inputMode).toBe("decimal");
    expect(saldo.value).toBe("0,00");
    expect(within(painel).getByText("R$")).toBeTruthy();
    expect(within(painel).queryByLabelText("Ordem de exibição")).toBeNull();
    expect(within(painel).getByRole("combobox", { name: "Tipo" }).getAttribute("data-slot")).toBe("select-trigger");
    expect(within(painel).getByRole("combobox", { name: "Tipo bancário" }).getAttribute("data-slot")).toBe("select-trigger");
    fireEvent.change(within(painel).getByLabelText("Titular"), { target: { value: "Fazenda 123 Rio Novo" } });
    expect((within(painel).getByLabelText("Titular") as HTMLInputElement).value).toBe("Fazenda  Rio Novo");
  });

  it("reordena contas pelas setas da listagem", async () => {
    vi.mocked(obterConfiguracoesFinanceiras).mockResolvedValue({
      ...config,
      contas: [{ ...config.contas[0], ordem: 0 }, { ...config.contas[1], ativo: true, ordem: 1 }],
    });
    await montar();
    fireEvent.click(primeiro("button", "Mover Gaveta para cima"));
    await waitFor(() => {
      expect(atualizarConta).toHaveBeenCalledWith(2, { ordem: 0 });
      expect(atualizarConta).toHaveBeenCalledWith(1, { ordem: 1 });
    });
  });

  it("editar carrega os valores atuais, trava abertura com movimentos e envia só o que mudou", async () => {
    await montar();
    fireEvent.click(primeiro("button", "Editar Banco principal"));
    const painel = await screen.findByRole("dialog");
    expect((within(painel).getByLabelText("Nome de exibição") as HTMLInputElement).value).toBe("Banco principal");
    expect((within(painel).getByLabelText("Instituição") as HTMLInputElement).value).toBe("Sicoob");
    expect((within(painel).getByLabelText("Saldo de abertura") as HTMLInputElement).disabled).toBe(true);
    expect((within(painel).getByRole("button", { name: "Data do saldo de abertura" }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(painel).getByText(/já possui movimentos/)).toBeTruthy();
    fireEvent.change(within(painel).getByLabelText("Nome de exibição"), { target: { value: "Banco BB" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Salvar conta" }));
    await waitFor(() => expect(atualizarConta).toHaveBeenCalledWith(1, { nome: "Banco BB" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("clicar na linha abre a edição e o ícone de editar não abre duas vezes", async () => {
    await montar();
    fireEvent.click(primeiro("button", "Editar Banco principal"));
    await screen.findByRole("dialog");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getAllByText("Gaveta")[0].closest("tr")!);
    const painel = await screen.findByRole("dialog");
    expect(within(painel).getByRole("heading", { name: "Editar Gaveta" })).toBeTruthy();
    expect((within(painel).getByLabelText("Saldo de abertura") as HTMLInputElement).disabled).toBe(false);
  });

  it("desativar pede confirmação e reativar não", async () => {
    await montar();
    fireEvent.click(primeiro("button", "Reativar Gaveta"));
    await waitFor(() => expect(atualizarConta).toHaveBeenCalledWith(2, { ativo: true }));
    expect(screen.queryByRole("heading", { name: /Desativar/ })).toBeNull();

    fireEvent.click(primeiro("button", "Desativar Banco principal"));
    expect(await screen.findByRole("heading", { name: "Desativar Banco principal?" })).toBeTruthy();
    expect(screen.getByText(/extrato e todos os movimentos continuam/)).toBeTruthy();
    expect(atualizarConta).not.toHaveBeenCalledWith(1, { ativo: false });
    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(atualizarConta).toHaveBeenCalledWith(1, { ativo: false }));
    await waitFor(() => expect(obterConfiguracoesFinanceiras).toHaveBeenCalledTimes(3));
  });
});

describe("ConfiguracoesFinanceiras — parceiros", () => {
  it("edita múltiplos papéis e preferências sem reenviar dados que não mudaram", async () => {
    await montar("parceiros");
    fireEvent.click(primeiro("button", "Editar Cooperativa"));
    const painel = await screen.findByRole("dialog");
    fireEvent.click(within(painel).getByRole("checkbox", { name: "Prestador de serviço" }));
    await escolherSelect(painel, "Condição sugerida", "A prazo");
    fireEvent.change(within(painel).getByLabelText("Prazos em dias"), { target: { value: "30/60" } });
    await escolherSelect(painel, "Forma de pagamento sugerida", "Boleto");
    fireEvent.click(within(painel).getByRole("button", { name: "Salvar parceiro" }));
    await waitFor(() => expect(atualizarParceiro).toHaveBeenCalledWith(7, { papeis: ["FORNECEDOR", "PRESTADOR_SERVICO"], condicaoPagamentoPreferida: "A_PRAZO", prazosPagamento: [30,60], formaPagamentoPreferida: "BOLETO" }));
  });
  it("explica à vista e a prazo na condição sugerida", async () => {
    await montar("parceiros");
    fireEvent.click(primeiro("button", "Editar Cooperativa"));
    const painel = await screen.findByRole("dialog");
    fireEvent.click(within(painel).getByRole("combobox", { name: "Condição sugerida" }));
    expect((await screen.findByRole("option", { name: "À vista" })).textContent).toContain("Tudo é pago ou recebido hoje");
    expect(screen.getByRole("option", { name: "A prazo" }).textContent).toContain("O valor vira parcelas com vencimento");
  });

  it("edição carrega nome, documento formatado, papel, telefone e e-mail", async () => {
    await montar("parceiros");
    fireEvent.click((await screen.findAllByText("Cooperativa"))[0].closest("tr")!);
    const painel = await screen.findByRole("dialog");
    expect((within(painel).getByLabelText("Nome / razão social") as HTMLInputElement).value).toBe("Cooperativa");
    expect((within(painel).getByLabelText("CPF/CNPJ") as HTMLInputElement).value).toBe("11.222.333/0001-81");
    expect((within(painel).getByRole("checkbox", { name: "Fornecedor" }) as HTMLInputElement).checked).toBe(true);
    expect((within(painel).getByLabelText("Telefone") as HTMLInputElement).value).toBe("3499990000");
    expect((within(painel).getByLabelText("E-mail") as HTMLInputElement).value).toBe("coop@x.com");
  });

  it("desativar explica o número de registros ligados", async () => {
    await montar("parceiros");
    fireEvent.click(primeiro("button", "Desativar Cooperativa"));
    expect(await screen.findByText(/Os 2 registros já ligados/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(atualizarParceiro).toHaveBeenCalledWith(7, { ativo: false }));
  });

  it.each([
    [0, "Nenhum registro está ligado"],
    [1, "O registro já ligado"],
  ])("descreve corretamente o impacto com %i referência(s)", async (referencias, mensagem) => {
    vi.mocked(obterConfiguracoesFinanceiras).mockResolvedValue({
      ...config,
      parceiros: [{ ...config.parceiros[0], referencias }],
    });
    await montar("parceiros");
    fireEvent.click(primeiro("button", "Desativar Cooperativa"));
    expect(await screen.findByText(new RegExp(mensagem))).toBeTruthy();
  });

  it("valida e-mail e documento junto ao campo sem chamar a API", async () => {
    await montar("parceiros");
    fireEvent.click(screen.getByRole("button", { name: /Novo parceiro/ }));
    const painel = await screen.findByRole("dialog");
    fireEvent.change(within(painel).getByLabelText("Nome / razão social"), { target: { value: "Zé" } });
    fireEvent.change(within(painel).getByLabelText("CPF/CNPJ"), { target: { value: "123" } });
    fireEvent.change(within(painel).getByLabelText("E-mail"), { target: { value: "abc" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Criar parceiro" }));
    expect(await within(painel).findByText("E-mail inválido")).toBeTruthy();
    expect(within(painel).getByText(/11 dígitos/)).toBeTruthy();
    expect(within(painel).getByLabelText("E-mail").getAttribute("aria-invalid")).toBe("true");
    expect(criarParceiro).not.toHaveBeenCalled();
  });

  it("erro de conflito do servidor aparece no campo documento", async () => {
    vi.mocked(criarParceiro).mockRejectedValue(new ApiError("Já existe um parceiro com este CPF/CNPJ", 409, "CONFLITO", "documento"));
    await montar("parceiros");
    fireEvent.click(screen.getByRole("button", { name: /Novo parceiro/ }));
    const painel = await screen.findByRole("dialog");
    fireEvent.change(within(painel).getByLabelText("Nome / razão social"), { target: { value: "Cooperativa 2" } });
    fireEvent.change(within(painel).getByLabelText("CPF/CNPJ"), { target: { value: "11.222.333/0001-81" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Criar parceiro" }));
    expect(await within(painel).findByText("Já existe um parceiro com este CPF/CNPJ")).toBeTruthy();
    expect(criarParceiro).toHaveBeenCalledWith(expect.objectContaining({ nome: "Cooperativa 2", documento: "11222333000181", papeis: ["FORNECEDOR"], telefone: null, email: null }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

describe("ConfiguracoesFinanceiras — categorias e centros de custo", () => {
  it("cria categoria sem exigir grupo dentro da configuração financeira", async () => {
    await montar("categorias");
    fireEvent.click(screen.getByRole("button", { name: "Nova categoria" }));
    const painel = await screen.findByRole("dialog");
    fireEvent.change(within(painel).getByLabelText("Nome da categoria"), { target: { value: "Ração" } });
    await escolherSelect(painel, "Classificação", "Custeio");
    fireEvent.click(within(painel).getByRole("button", { name: "Criar categoria" }));
    await waitFor(() => expect(criarCategoria).toHaveBeenCalledWith({ nome: "Ração", classificacao: "CUSTEIO", ordem: 1 }));
  });

  it("explica custeio e investimento na classificação da categoria", async () => {
    await montar("categorias");
    fireEvent.click(screen.getByRole("button", { name: "Nova categoria" }));
    const painel = await screen.findByRole("dialog");
    fireEvent.click(within(painel).getByRole("combobox", { name: "Classificação" }));
    expect((await screen.findByRole("option", { name: "Custeio" })).textContent).toContain("Gasto do dia a dia para produzir");
    expect(screen.getByRole("option", { name: "Investimento" }).textContent).toContain("Compra que dura anos");
  });

  it("mantém o texto de ajuda da classificação ligado ao campo", async () => {
    await montar("categorias");
    fireEvent.click(screen.getByRole("button", { name: "Nova categoria" }));
    const painel = await screen.findByRole("dialog");
    const campo = within(painel).getByRole("combobox", { name: "Classificação" });
    const ajuda = document.getElementById(campo.getAttribute("aria-describedby") ?? "");
    expect(ajuda?.textContent).toContain("A direção financeira continua sendo definida pelo tipo da operação.");
  });

  it("cria um centro de custo sem natureza financeira", async () => {
    await montar("centros");
    expect(screen.getByRole("table", { name: "Centros de custo" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Novo centro de custo" }));
    const painel = await screen.findByRole("dialog");
    fireEvent.change(within(painel).getByLabelText("Nome do centro de custo"), { target: { value: "Implantação de pomar" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Criar centro" }));
    await waitFor(() => expect(criarCentroCusto).toHaveBeenCalledWith({ nome: "Implantação de pomar", ordem: 1 }));
  });

  it("oculta ações de criação para acesso somente consulta", async () => {
    render(<ConfiguracoesFinanceiras podeEditar={false} />);
    await screen.findAllByText("Banco principal");
    expect(screen.getByText("Você tem acesso de consulta a estes cadastros.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Nova conta" })).toBeNull();
  });
});
