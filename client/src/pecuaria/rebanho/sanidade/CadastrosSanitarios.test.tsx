// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CadastrosSanitarios } from "./CadastrosSanitarios";
import { listarTiposAplicacao, reqSanidade, salvarTipoAplicacao } from "./api";
vi.mock("./api", () => ({ listarTiposAplicacao: vi.fn(), reqSanidade: vi.fn(), salvarTipoAplicacao: vi.fn() }));
vi.mock("./ProtocolosCadastro", () => ({ ProtocolosCadastro: () => <p>Lista de protocolos</p> }));
beforeEach(() => {
  vi.clearAllMocks(); window.history.replaceState({}, "", "/pecuaria?cadastro=sanidade&sitio=2");
  vi.mocked(listarTiposAplicacao).mockResolvedValue([{ id: "t1", nome: "Vacinação", ativo: true }]);
  vi.mocked(reqSanidade).mockImplementation(async (path, init) => {
    if (path.startsWith("/doencas")) return (init ? { id: "d1", nome: "Mastite clínica", ativo: true } : [{ id: "d1", nome: "Mastite", ativo: true }]) as never;
    return [{ id: "e1", nome: "CCS", ativo: false, tipoResultado: "NUMERO", unidade: "mil cél/mL", opcoes: null, formatoBloqueado: true }] as never;
  });
});
afterEach(cleanup);
describe("Cadastros sanitários", () => {
  it("abre protocolos e carrega somente o catálogo selecionado preservando a navegação externa", async () => {
    render(<CadastrosSanitarios podeLancar />);
    expect(screen.getByText("Lista de protocolos")).toBeTruthy();
    expect(listarTiposAplicacao).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "Doenças" }));
    await screen.findAllByText("Mastite");
    expect(window.location.search).toContain("cadastro=sanidade");
    expect(window.location.search).toContain("sitio=2");
    expect(window.location.search).toContain("cadastroSanitario=doenca");
    expect(reqSanidade).toHaveBeenCalledTimes(1);
    window.history.replaceState({}, "", "/pecuaria?cadastroSanitario=exame&sitio=2");
    fireEvent.popState(window);
    await screen.findAllByText("Número · mil cél/mL");
    expect(screen.getByRole("tab", { name: "Tipos de exame" }).getAttribute("aria-selected")).toBe("true");
  });
  it("atualiza situação localmente e confirma sem recarregar", async () => {
    window.history.replaceState({}, "", "/?cadastroSanitario=aplicacao");
    vi.mocked(salvarTipoAplicacao).mockResolvedValue({ id: "t1", nome: "Vacinação", ativo: false });
    render(<CadastrosSanitarios podeLancar />);
    await screen.findAllByText("Vacinação");
    fireEvent.click(screen.getAllByRole("button", { name: "Inativar Vacinação" })[0]);
    await screen.findByText("Cadastro atualizado.");
    expect(screen.getAllByText("Inativo")).toHaveLength(2);
    expect(listarTiposAplicacao).toHaveBeenCalledTimes(1);
    expect(salvarTipoAplicacao).toHaveBeenCalledWith({ ativo: false }, "t1");
  });
  it("edita doença com PATCH e conserva o editor", async () => {
    window.history.replaceState({}, "", "/?cadastroSanitario=doenca");
    render(<CadastrosSanitarios podeLancar />);
    await screen.findAllByText("Mastite");
    fireEvent.click(screen.getAllByRole("button", { name: "Editar Mastite" })[0]);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Mastite clínica" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(reqSanidade).toHaveBeenCalledWith("/doencas/d1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ nome: "Mastite clínica" }) })));
    await screen.findByText("Cadastro atualizado.");
  });
  it("mostra falha com nova tentativa e respeita somente leitura", async () => {
    window.history.replaceState({}, "", "/?cadastroSanitario=aplicacao");
    vi.mocked(listarTiposAplicacao).mockRejectedValueOnce(new Error("Falha no catálogo"));
    render(<CadastrosSanitarios podeLancar={false} />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findAllByText("Vacinação");
    expect(screen.queryByRole("button", { name: /Novo tipo/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Inativar/ })).toBeNull();
  });
  it("ignora a resposta antiga depois de trocar subaba", async () => {
    window.history.replaceState({}, "", "/?cadastroSanitario=aplicacao");
    let terminar!: (valor: { id: string; nome: string; ativo: boolean }[]) => void;
    vi.mocked(listarTiposAplicacao).mockReturnValueOnce(new Promise((resolve) => { terminar = resolve; }));
    render(<CadastrosSanitarios podeLancar />);
    fireEvent.click(screen.getByRole("tab", { name: "Doenças" }));
    await screen.findAllByText("Mastite");
    terminar([{ id: "t1", nome: "Resposta antiga", ativo: true }]);
    await waitFor(() => expect(screen.queryByText("Resposta antiga")).toBeNull());
  });
  it("conserva o formato de exame histórico e mostra a restrição do servidor", async () => {
    window.history.replaceState({}, "", "/?cadastroSanitario=exame");
    render(<CadastrosSanitarios podeLancar />);
    await screen.findAllByText("CCS");
    fireEvent.click(screen.getAllByRole("button", { name: "Editar CCS" })[0]);
    expect((screen.getByLabelText("Formato do resultado") as HTMLSelectElement).value).toBe("NUMERO");
    expect((screen.getByLabelText("Formato do resultado") as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText("Unidade (opcional)") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/Para mudar esses campos, crie outro tipo de exame/)).toBeTruthy();
    vi.mocked(reqSanidade).mockRejectedValueOnce(new Error("Tipo de exame com histórico não permite mudar o formato"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await screen.findAllByText("Tipo de exame com histórico não permite mudar o formato");
    expect(screen.getByRole("button", { name: "Salvar" })).toBeTruthy();
    expect(reqSanidade).toHaveBeenLastCalledWith("/tipos-exame/e1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ nome: "CCS" }) }));
  });
  it("bloqueia opções após coleta e ainda permite renomear", async () => {
    window.history.replaceState({}, "", "/?cadastroSanitario=exame");
    const usado = { id: "e1", nome: "Teste rápido", ativo: true, tipoResultado: "OPCAO", unidade: null, opcoes: ["Positivo", "Negativo"], formatoBloqueado: true };
    vi.mocked(reqSanidade).mockImplementation(async (_path, init) => (init ? { ...usado, nome: "Teste revisado" } : [usado]) as never);
    render(<CadastrosSanitarios podeLancar />);
    await screen.findAllByText("Teste rápido");
    fireEvent.click(screen.getAllByRole("button", { name: "Editar Teste rápido" })[0]);
    expect((screen.getByLabelText("Uma opção por linha") as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByLabelText("Nome") as HTMLInputElement).disabled).toBe(false);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Teste revisado" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await screen.findByText("Cadastro atualizado.");
    expect(reqSanidade).toHaveBeenLastCalledWith("/tipos-exame/e1", expect.objectContaining({ body: JSON.stringify({ nome: "Teste revisado" }) }));
    fireEvent.click(screen.getAllByRole("button", { name: "Editar Teste revisado" })[0]);
    expect((screen.getByLabelText("Formato do resultado") as HTMLSelectElement).disabled).toBe(true);
  });
  it("tipo sem coleta e novo tipo permitem configurar formato", async () => {
    window.history.replaceState({}, "", "/?cadastroSanitario=exame");
    vi.mocked(reqSanidade).mockResolvedValue([{ id: "e1", nome: "Novo exame", ativo: true, tipoResultado: "TEXTO", unidade: null, opcoes: null, formatoBloqueado: false }] as never);
    render(<CadastrosSanitarios podeLancar />);
    await screen.findAllByText("Novo exame");
    fireEvent.click(screen.getAllByRole("button", { name: "Editar Novo exame" })[0]);
    expect((screen.getByLabelText("Formato do resultado") as HTMLSelectElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Novo tipo de exame" }));
    expect((screen.getByLabelText("Formato do resultado") as HTMLSelectElement).disabled).toBe(false);
  });
});
