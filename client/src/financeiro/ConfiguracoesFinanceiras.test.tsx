// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ConfiguracoesFinanceiras } from "./ConfiguracoesFinanceiras";
import { ApiError, atualizarConta, atualizarParceiro, criarConta, criarParceiro, obterConfiguracoesFinanceiras, type ConfiguracoesFinanceiras as Config } from "./novo-api";

/* Mantém ApiError real (o formulário usa instanceof) e substitui só as chamadas. */
vi.mock("./novo-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./novo-api")>()),
  obterConfiguracoesFinanceiras: vi.fn(),
  criarConta: vi.fn(), atualizarConta: vi.fn(), criarParceiro: vi.fn(), atualizarParceiro: vi.fn(),
}));

const config: Config = {
  contas: [
    { id: 1, nome: "Banco principal", tipo: "BANCO", instituicao: "Sicoob", identificacao: "Ag. 1 · C/C 2", agencia: "1", numeroConta: "2", titular: "Fazenda Rio Novo", ordem: 0, saldoAbertura: "1000", dataSaldoAbertura: "2026-09-01", saldoAtual: "1200", incluirNoSaldoGeral: true, ativo: true, temMovimentos: true },
    { id: 2, nome: "Gaveta", tipo: "CAIXA", instituicao: null, identificacao: null, saldoAbertura: "0", dataSaldoAbertura: "2026-09-01", saldoAtual: "0", incluirNoSaldoGeral: false, ativo: false, temMovimentos: false },
  ],
  parceiros: [{ id: 7, nome: "Cooperativa", documento: "11222333000181", tipo: "FORNECEDOR", telefone: "3499990000", email: "coop@x.com", ativo: true, referencias: 2 }],
  gruposCategorias: [], centrosCusto: [], produtos: [],
};

/* A tabela responsiva renderiza tabela E cartões (CSS decide o que aparece);
 * no jsdom os dois existem, então pegamos sempre a primeira ocorrência. */
const primeiro = (role: string, name: string | RegExp) => screen.getAllByRole(role, { name })[0];

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(obterConfiguracoesFinanceiras).mockResolvedValue(config);
  vi.mocked(atualizarConta).mockResolvedValue(config.contas[0]);
  vi.mocked(atualizarParceiro).mockResolvedValue(config.parceiros[0]);
});
afterEach(cleanup);

async function montar(aba: "contas" | "parceiros" = "contas") {
  render(<ConfiguracoesFinanceiras />);
  await screen.findAllByText("Banco principal");
  if (aba === "parceiros") fireEvent.click(screen.getByRole("button", { name: /Clientes e fornecedores/ }));
}

async function escolherSelect(painel: HTMLElement, rotulo: string, opcao: string) {
  fireEvent.click(within(painel).getByRole("combobox", { name: rotulo }));
  fireEvent.click(await screen.findByRole("option", { name: opcao }));
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
    fireEvent.change(within(painel).getByLabelText("Data do saldo de abertura"), { target: { value: "2026-03-15" } });
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
    expect((within(painel).getByLabelText("Data do saldo de abertura") as HTMLInputElement).disabled).toBe(true);
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
    fireEvent.change(within(painel).getByLabelText("Condição sugerida"), { target: { value: "A_PRAZO" } });
    fireEvent.change(within(painel).getByLabelText("Prazos em dias"), { target: { value: "30/60" } });
    fireEvent.change(within(painel).getByLabelText("Forma de pagamento sugerida"), { target: { value: "BOLETO" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Salvar parceiro" }));
    await waitFor(() => expect(atualizarParceiro).toHaveBeenCalledWith(7, { papeis: ["FORNECEDOR", "PRESTADOR_SERVICO"], condicaoPagamentoPreferida: "A_PRAZO", prazosPagamento: [30,60], formaPagamentoPreferida: "BOLETO" }));
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
