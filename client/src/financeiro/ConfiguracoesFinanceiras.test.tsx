// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ConfiguracoesFinanceiras } from "./ConfiguracoesFinanceiras";
import { atualizarConta, atualizarParceiro, criarConta, criarParceiro, obterConfiguracoesFinanceiras, type ConfiguracoesFinanceiras as Config } from "./novo-api";

vi.mock("./novo-api", () => ({
  obterConfiguracoesFinanceiras: vi.fn(), criarConta: vi.fn(), atualizarConta: vi.fn(),
  criarParceiro: vi.fn(), atualizarParceiro: vi.fn(),
}));

const conta = {
  id: 1, nome: "Conta principal", tipo: "BANCO" as const, instituicao: "Banco do Brasil",
  identificacao: "Ag. 1234 · C/C 56789-0", saldoAbertura: "1000.50", dataSaldoAbertura: "2026-01-15",
  saldoAtual: "1250.50", incluirNoSaldoGeral: true, ativo: true,
};
const parceiro = {
  id: 2, nome: "Cooperativa Regional", documento: "11.444.777/0001-61", tipo: "AMBOS",
  telefone: "(34) 99999-0000", email: "financeiro@cooperativa.test", ativo: true,
};
const config: Config = { contas: [conta], parceiros: [parceiro], gruposCategorias: [], centrosCusto: [], produtos: [] };

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/financeiro/configuracoes?aba=contas");
  vi.mocked(obterConfiguracoesFinanceiras).mockResolvedValue(config);
});
afterEach(cleanup);

describe("Configurações financeiras", () => {
  it("abre a conta pela linha, carrega todos os valores e mantém o detalhe navegável", async () => {
    vi.mocked(atualizarConta).mockResolvedValue({ ...conta, nome: "Conta operacional" });
    const { container } = render(<ConfiguracoesFinanceiras />);
    await screen.findByRole("heading", { name: "Configurações financeiras" });
    fireEvent.click(container.querySelector("tbody tr")!);

    expect(await screen.findByRole("heading", { name: "Editar Conta principal" })).toBeTruthy();
    expect((screen.getByLabelText("Nome de exibição") as HTMLInputElement).value).toBe("Conta principal");
    expect((screen.getByLabelText("Tipo") as HTMLSelectElement).value).toBe("BANCO");
    expect((screen.getByLabelText("Instituição") as HTMLInputElement).value).toBe("Banco do Brasil");
    expect((screen.getByLabelText("Identificação da conta") as HTMLInputElement).value).toBe("Ag. 1234 · C/C 56789-0");
    expect((screen.getByLabelText("Saldo de abertura") as HTMLInputElement).value).toBe("1000.50");
    expect((screen.getByLabelText("Data do saldo") as HTMLInputElement).value).toBe("2026-01-15");
    expect(window.location.search).toBe("?aba=contas&conta=1");

    fireEvent.change(screen.getByLabelText("Nome de exibição"), { target: { value: "Conta operacional" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar conta" }));
    await waitFor(() => expect(atualizarConta).toHaveBeenCalledWith(1, expect.objectContaining({
      nome: "Conta operacional", tipo: "BANCO", saldoAbertura: 1000.5, dataSaldoAbertura: "2026-01-15",
    })));
  });

  it("cria uma conta com o formulário completo e atualiza a lista sem trocar de aba", async () => {
    const criada = { ...conta, id: 3, nome: "Aplicação reserva", tipo: "APLICACAO" as const, instituicao: "Cooperativa", identificacao: "CDB 2028", saldoAbertura: "2500", saldoAtual: "2500", dataSaldoAbertura: "2026-09-01", incluirNoSaldoGeral: false };
    vi.mocked(criarConta).mockResolvedValue(criada);
    render(<ConfiguracoesFinanceiras />);
    fireEvent.click(await screen.findByRole("button", { name: "Nova conta" }));

    fireEvent.change(screen.getByLabelText("Saldo de abertura"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar conta" }));
    expect(screen.getByText("Informe um valor válido.")).toBeTruthy();
    expect(criarConta).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Nome de exibição"), { target: { value: "Aplicação reserva" } });
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "APLICACAO" } });
    fireEvent.change(screen.getByLabelText("Instituição"), { target: { value: "Cooperativa" } });
    fireEvent.change(screen.getByLabelText("Identificação da conta"), { target: { value: "CDB 2028" } });
    fireEvent.change(screen.getByLabelText("Saldo de abertura"), { target: { value: "2500" } });
    fireEvent.change(screen.getByLabelText("Data do saldo"), { target: { value: "2026-09-01" } });
    fireEvent.click(screen.getByLabelText("Incluir no saldo geral"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar conta" }));

    await waitFor(() => expect(criarConta).toHaveBeenCalledWith(expect.objectContaining({
      nome: "Aplicação reserva", tipo: "APLICACAO", instituicao: "Cooperativa", identificacao: "CDB 2028",
      saldoAbertura: 2500, dataSaldoAbertura: "2026-09-01", incluirNoSaldoGeral: false, ativo: true,
    })));
    expect(await screen.findAllByText("Aplicação reserva")).not.toHaveLength(0);
    expect(window.location.search).toBe("?aba=contas");
    expect(screen.getByRole("button", { name: "Nova conta" })).toBeTruthy();
  });

  it("abre o parceiro pelo ícone, valida documento e e-mail junto aos campos e salva a edição", async () => {
    const editado = { ...parceiro, nome: "Cooperativa Atualizada", telefone: "(34) 98888-0000" };
    vi.mocked(atualizarParceiro).mockResolvedValue(editado);
    window.history.replaceState(null, "", "/financeiro/configuracoes?aba=parceiros");
    render(<ConfiguracoesFinanceiras />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Editar parceiro Cooperativa Regional" }))[0]);

    expect((screen.getByLabelText("Nome ou razão social") as HTMLInputElement).value).toBe("Cooperativa Regional");
    expect((screen.getByLabelText("CPF/CNPJ") as HTMLInputElement).value).toBe("11.444.777/0001-61");
    expect((screen.getByLabelText("Papel") as HTMLSelectElement).value).toBe("AMBOS");
    expect((screen.getByLabelText("Telefone") as HTMLInputElement).value).toBe("(34) 99999-0000");
    expect((screen.getByLabelText("E-mail") as HTMLInputElement).value).toBe("financeiro@cooperativa.test");

    fireEvent.change(screen.getByLabelText("CPF/CNPJ"), { target: { value: "123" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "email-invalido" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar parceiro" }));
    expect(screen.getByText("Informe um CPF ou CNPJ válido.")).toBeTruthy();
    expect(screen.getByText("Informe um e-mail válido.")).toBeTruthy();
    expect(atualizarParceiro).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Nome ou razão social"), { target: { value: "Cooperativa Atualizada" } });
    fireEvent.change(screen.getByLabelText("CPF/CNPJ"), { target: { value: "529.982.247-25" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "contato@cooperativa.test" } });
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "(34) 98888-0000" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar parceiro" }));
    await waitFor(() => expect(atualizarParceiro).toHaveBeenCalledWith(2, expect.objectContaining({ nome: "Cooperativa Atualizada", documento: "529.982.247-25", email: "contato@cooperativa.test" })));
    expect(await screen.findAllByText("Cooperativa Atualizada")).not.toHaveLength(0);
    expect(window.location.search).toBe("?aba=parceiros");
  });

  it("confirma a desativação com o impacto e reativa sem apagar o cadastro", async () => {
    vi.mocked(atualizarConta).mockImplementation(async (_id, input) => ({ ...conta, ativo: (input as { ativo: boolean }).ativo }));
    render(<ConfiguracoesFinanceiras />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Desativar" }))[0]);

    const dialogo = screen.getByRole("dialog", { name: "Desativar conta?" });
    expect(dialogo.textContent).toContain("deixará de aparecer em novas operações");
    expect(dialogo.textContent).toContain("continuarão preservados e identificados");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(atualizarConta).toHaveBeenCalledWith(1, { ativo: false }));

    fireEvent.click((await screen.findAllByRole("button", { name: "Reativar" }))[0]);
    await waitFor(() => expect(atualizarConta).toHaveBeenLastCalledWith(1, { ativo: true }));
    expect(screen.queryByRole("dialog", { name: "Desativar conta?" })).toBeNull();
  });

  it("abre diretamente o parceiro indicado na URL", async () => {
    window.history.replaceState(null, "", "/financeiro/configuracoes?aba=parceiros&parceiro=2");
    render(<ConfiguracoesFinanceiras />);
    expect(await screen.findByRole("heading", { name: "Editar Cooperativa Regional" })).toBeTruthy();
    expect(window.location.search).toBe("?aba=parceiros&parceiro=2");
  });

  it("cria parceiro com todos os campos suportados", async () => {
    const criado = { ...parceiro, id: 4, nome: "Cliente Novo", tipo: "CLIENTE" };
    vi.mocked(criarParceiro).mockResolvedValue(criado);
    window.history.replaceState(null, "", "/financeiro/configuracoes?aba=parceiros");
    render(<ConfiguracoesFinanceiras />);
    fireEvent.click(await screen.findByRole("button", { name: "Novo parceiro" }));
    fireEvent.change(screen.getByLabelText("Nome ou razão social"), { target: { value: "Cliente Novo" } });
    fireEvent.change(screen.getByLabelText("CPF/CNPJ"), { target: { value: "529.982.247-25" } });
    fireEvent.change(screen.getByLabelText("Papel"), { target: { value: "CLIENTE" } });
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "34999990000" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "cliente@novo.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar parceiro" }));
    await waitFor(() => expect(criarParceiro).toHaveBeenCalledWith({ nome: "Cliente Novo", documento: "529.982.247-25", tipo: "CLIENTE", telefone: "34999990000", email: "cliente@novo.test", ativo: true }));
  });
});
