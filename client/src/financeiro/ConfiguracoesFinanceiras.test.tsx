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
    { id: 1, nome: "Banco principal", tipo: "BANCO", instituicao: "Sicoob", identificacao: "Ag. 1 · C/C 2", saldoAbertura: "1000", dataSaldoAbertura: "2026-09-01", saldoAtual: "1200", incluirNoSaldoGeral: true, ativo: true, temMovimentos: true },
    { id: 2, nome: "Gaveta", tipo: "DINHEIRO", instituicao: null, identificacao: null, saldoAbertura: "0", dataSaldoAbertura: "2026-09-01", saldoAtual: "0", incluirNoSaldoGeral: false, ativo: false, temMovimentos: false },
  ],
  parceiros: [{ id: 7, nome: "Cooperativa", documento: "11222333000181", tipo: "FORNECEDOR", telefone: "3499990000", email: "coop@x.com", ativo: true, referencias: 2 }],
  gruposCategorias: [], centrosCusto: [], produtos: [],
};

/* A tabela responsiva renderiza tabela E cartões (CSS decide o que aparece);
 * no jsdom os dois existem, então pegamos sempre a primeira ocorrência. */
const primeiro = (role: string, name: string | RegExp) => screen.getAllByRole(role, { name })[0];

beforeEach(() => {
  vi.clearAllMocks();
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

describe("ConfiguracoesFinanceiras — contas", () => {
  it("nova conta abre painel com todos os campos e envia data e saldo geral do formulário", async () => {
    vi.mocked(criarConta).mockResolvedValue(config.contas[0]);
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /Nova conta/ }));
    const painel = await screen.findByRole("dialog");
    for (const rotulo of ["Nome de exibição", "Tipo", "Instituição", "Identificação da conta", "Saldo de abertura", "Data do saldo de abertura", "Incluir no saldo geral"]) {
      expect(within(painel).getByLabelText(rotulo)).toBeTruthy();
    }
    fireEvent.change(within(painel).getByLabelText("Nome de exibição"), { target: { value: "Aplicação CDB" } });
    fireEvent.change(within(painel).getByLabelText("Tipo"), { target: { value: "APLICACAO" } });
    fireEvent.change(within(painel).getByLabelText("Instituição"), { target: { value: "Sicredi" } });
    fireEvent.change(within(painel).getByLabelText("Saldo de abertura"), { target: { value: "500" } });
    fireEvent.change(within(painel).getByLabelText("Data do saldo de abertura"), { target: { value: "2026-03-15" } });
    fireEvent.click(within(painel).getByLabelText("Incluir no saldo geral"));
    fireEvent.click(within(painel).getByRole("button", { name: "Criar conta" }));
    await waitFor(() => expect(criarConta).toHaveBeenCalledWith({ nome: "Aplicação CDB", tipo: "APLICACAO", instituicao: "Sicredi", identificacao: null, saldoAbertura: 500, dataSaldoAbertura: "2026-03-15", incluirNoSaldoGeral: false }));
    await waitFor(() => expect(obterConfiguracoesFinanceiras).toHaveBeenCalledTimes(2));
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
  it("edição carrega nome, documento formatado, papel, telefone e e-mail", async () => {
    await montar("parceiros");
    fireEvent.click((await screen.findAllByText("Cooperativa"))[0].closest("tr")!);
    const painel = await screen.findByRole("dialog");
    expect((within(painel).getByLabelText("Nome / razão social") as HTMLInputElement).value).toBe("Cooperativa");
    expect((within(painel).getByLabelText("CPF/CNPJ") as HTMLInputElement).value).toBe("11.222.333/0001-81");
    expect((within(painel).getByLabelText("Papel") as HTMLSelectElement).value).toBe("FORNECEDOR");
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
    expect(criarParceiro).toHaveBeenCalledWith({ nome: "Cooperativa 2", documento: "11222333000181", tipo: "FORNECEDOR", telefone: null, email: null });
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
