import { limparRascunhoRelatorioAtivo, estadoRascunhoRelatorioAtivo } from "./rascunhoRelatorioAtivo";
import { alterarControle } from "../lib/controles.fixture";
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RelatoriosFinanceiros } from "./RelatoriosFinanceiros";
import { descartarRascunhoRelatorioFinanceiro, listarRelatoriosFinanceiros, obterConfiguracoesFinanceiras, obterRascunhoRelatorioFinanceiro, obterRelatorioFinanceiro, salvarPdfRelatorioFinanceiro, salvarRascunhoRelatorioFinanceiro, type RelatorioFinanceiro } from "./novo-api";
import { SEM_VINCULO } from "../lib/ids";
import { uid } from "../lib/uid.fixture";

vi.mock("../api/propriedades", () => ({ usePropriedades: () => ({ data: [], loading: false, recarregar: vi.fn() }) }));
vi.mock("./novo-api", () => ({
  listarRelatoriosFinanceiros: vi.fn(), obterConfiguracoesFinanceiras: vi.fn(), obterRascunhoRelatorioFinanceiro: vi.fn(),
  descartarRascunhoRelatorioFinanceiro: vi.fn(), salvarPdfRelatorioFinanceiro: vi.fn(), obterRelatorioFinanceiro: vi.fn(),
  salvarRascunhoRelatorioFinanceiro: vi.fn(), gerarRelatorioFinanceiro: vi.fn(),
}));

const base = { status: "CONCLUIDO" as const, propriedadeId: 1, propriedade: "Fazenda Rio Novo", concluidoEm: null, erro: null };
const parametros = { nome: "", dataInicio: "2026-08-01", dataFim: "2026-08-31", regime: "ambos" as const, tipos: [], status: ["CONFIRMADA"], centroCustoIds: [uid(1)], parceiroIds: [], categoriaIds: [uid(3), SEM_VINCULO], classificacoes: [] };
const relatorios: RelatorioFinanceiro[] = [
  { ...base, id: uid(12), nome: "Pecuária — agosto", autor: "Rafael", geradoEm: "2026-09-14T12:00:00Z", parametros },
  { ...base, id: uid(11), nome: "Fechamento julho", autor: "Contadora", geradoEm: "2026-08-02T12:00:00Z", parametros: { ...parametros, centroCustoIds: [], categoriaIds: [] }, status: "FALHOU", erro: "Não foi possível montar o relatório. Tente gerar novamente." },
];

beforeEach(() => {
  limparRascunhoRelatorioAtivo();
  vi.mocked(salvarRascunhoRelatorioFinanceiro).mockReset().mockResolvedValue({ id: uid(1), versao: 4, updatedAt: "", configuracao: parametros });
  window.history.replaceState(null, "", "/financeiro/relatorios");
  vi.mocked(listarRelatoriosFinanceiros).mockResolvedValue(relatorios);
  vi.mocked(obterConfiguracoesFinanceiras).mockResolvedValue({ contas: [], parceiros: [], produtos: [], categorias: [], centrosCusto: [] });
  vi.mocked(obterRascunhoRelatorioFinanceiro).mockResolvedValue(null);
  vi.mocked(obterRelatorioFinanceiro).mockReturnValue(new Promise(() => {}));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

describe("central de relatórios financeiros", () => {
  it("lista o histórico com período, autor, recorte e situação", async () => {
    render(<RelatoriosFinanceiros />);
    const tabela = (await screen.findAllByRole("table", { name: "Relatórios gerados" }))[0];
    const linhas = tabela.querySelectorAll("tbody tr");
    expect(linhas[0].textContent).toContain("Pecuária — agosto");
    expect(linhas[0].textContent).toContain("01/08/2026 a 31/08/2026");
    expect(linhas[0].textContent).toContain("Rafael");
    expect(linhas[0].textContent).toContain("1 centro · 2 categorias");
    expect(linhas[1].textContent).toContain("Falhou");
    expect(linhas[1].textContent).toContain("Sem filtros");
    expect(screen.queryByText("Volume por tipo de operação")).toBeNull();
  });

  it("baixa o PDF sem abrir o detalhe e só oferece download de concluídos", async () => {
    vi.mocked(salvarPdfRelatorioFinanceiro).mockResolvedValue(undefined);
    render(<RelatoriosFinanceiros />);
    const tabela = (await screen.findAllByRole("table", { name: "Relatórios gerados" }))[0];
    const botoes = tabela.querySelectorAll("button");
    expect(botoes).toHaveLength(1);
    fireEvent.click(botoes[0]);
    await waitFor(() => expect(salvarPdfRelatorioFinanceiro).toHaveBeenCalledWith(relatorios[0]));
    expect(window.location.pathname).toBe("/financeiro/relatorios");
  });

  it("abre o relatório salvo ao clicar na linha", async () => {
    render(<RelatoriosFinanceiros />);
    const tabela = (await screen.findAllByRole("table", { name: "Relatórios gerados" }))[0];
    fireEvent.click(tabela.querySelectorAll("tbody tr")[0]);
    expect(window.location.pathname).toBe(`/financeiro/relatorios/${uid(12)}`);
    expect(obterRelatorioFinanceiro).toHaveBeenCalledWith(uid(12));
  });

  it("novo relatório descarta o rascunho anterior; continuar o preserva", async () => {
    vi.mocked(obterRascunhoRelatorioFinanceiro).mockResolvedValue({ id: uid(1), versao: 2, updatedAt: "", configuracao: { nome: "Rascunho antigo" } });
    vi.mocked(descartarRascunhoRelatorioFinanceiro).mockResolvedValue(undefined);
    render(<RelatoriosFinanceiros />);
    fireEvent.click(await screen.findByRole("button", { name: "Continuar rascunho" }));
    expect(window.location.pathname).toBe("/financeiro/relatorios/novo");
    expect(screen.getByLabelText<HTMLInputElement>("Nome do relatório").value).toBe("Rascunho antigo");
    expect(descartarRascunhoRelatorioFinanceiro).not.toHaveBeenCalled();

    cleanup(); window.history.replaceState(null, "", "/financeiro/relatorios");
    render(<RelatoriosFinanceiros />);
    fireEvent.click(await screen.findByRole("button", { name: "Novo relatório" }));
    fireEvent.click(await screen.findByRole("button", { name: "Descartar e criar" }));
    await waitFor(() => expect(window.location.pathname).toBe("/financeiro/relatorios/novo"));
    expect(descartarRascunhoRelatorioFinanceiro).toHaveBeenCalled();
    expect(screen.getByLabelText<HTMLInputElement>("Nome do relatório").value).toMatch(/^Relatório financeiro — /);
  });

  it("sem permissão de exportar, só consulta o histórico", async () => {
    render(<RelatoriosFinanceiros podeExportar={false} />);
    await screen.findAllByRole("table", { name: "Relatórios gerados" });
    expect(screen.queryByRole("button", { name: "Novo relatório" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Baixar PDF/ })).toBeNull();
    expect(obterRascunhoRelatorioFinanceiro).not.toHaveBeenCalled();
  });
});

it("filtra o histórico pela emissão sem alterar o período do documento salvo", async () => {
  render(<RelatoriosFinanceiros />);
  await screen.findAllByRole("table", { name: "Relatórios gerados" });
  fireEvent.click(screen.getByRole("button", { name: /^Período de emissão:/ }));
  fireEvent.click(screen.getByRole("button", { name: "Período personalizado" }));
  await alterarControle(screen.getByLabelText("Data inicial"), { target: { value: "2026-09-01" } });
  await alterarControle(screen.getByLabelText("Data final"), { target: { value: "2026-09-30" } });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar período" }));
  expect(screen.queryByText("Fechamento julho")).toBeNull();
  expect(screen.getAllByText("Pecuária — agosto").length).toBeGreaterThan(0);
  expect(screen.getAllByText("01/08/2026 a 31/08/2026").length).toBeGreaterThan(0);
});

it("remove atualização habitual e recarrega o histórico ao voltar do detalhe", async () => {
  render(<RelatoriosFinanceiros />);
  const tabela = (await screen.findAllByRole("table", { name: "Relatórios gerados" }))[0];
  expect(screen.queryByRole("button", { name: /Atualizar/ })).toBeNull();
  expect(listarRelatoriosFinanceiros).toHaveBeenCalledTimes(1);
  fireEvent.click(tabela.querySelectorAll("tbody tr")[0]);
  act(() => { window.history.replaceState(null, "", "/financeiro/relatorios"); window.dispatchEvent(new PopStateEvent("popstate")); });
  await waitFor(() => expect(listarRelatoriosFinanceiros).toHaveBeenCalledTimes(2));
});

it("oferece nova tentativa quando a primeira carga falha", async () => {
  vi.mocked(listarRelatoriosFinanceiros).mockRejectedValueOnce(new Error("Não foi possível carregar."));
  render(<RelatoriosFinanceiros />);
  fireEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }));
  await screen.findAllByRole("table", { name: "Relatórios gerados" });
  expect(listarRelatoriosFinanceiros).toHaveBeenCalledTimes(2);
});

it("revalida apenas o histórico em processamento e para após a conclusão", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.mocked(listarRelatoriosFinanceiros).mockResolvedValueOnce([{ ...relatorios[0], status: "PROCESSANDO" }]).mockResolvedValue(relatorios);
  await act(async () => { render(<RelatoriosFinanceiros />); });
  expect(listarRelatoriosFinanceiros).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
  expect(listarRelatoriosFinanceiros).toHaveBeenCalledTimes(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(12000); });
  expect(listarRelatoriosFinanceiros).toHaveBeenCalledTimes(2);
});

it("pausa a revalidação enquanto oculto, retoma ao mostrar e cancela ao sair", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.mocked(listarRelatoriosFinanceiros).mockResolvedValue([{ ...relatorios[0], status: "PROCESSANDO" }]);
  const visibilidade = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  let tela!: ReturnType<typeof render>;
  await act(async () => { tela = render(<RelatoriosFinanceiros />); });
  await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
  expect(listarRelatoriosFinanceiros).toHaveBeenCalledTimes(1);
  visibilidade.mockReturnValue("visible");
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
  await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
  expect(listarRelatoriosFinanceiros).toHaveBeenCalledTimes(2);
  tela.unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
  expect(listarRelatoriosFinanceiros).toHaveBeenCalledTimes(2);
  visibilidade.mockRestore();
});

it("falha na revalidação interrompe novas chamadas até tentar novamente", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.mocked(listarRelatoriosFinanceiros).mockResolvedValueOnce([{ ...relatorios[0], status: "PROCESSANDO" }]).mockRejectedValueOnce(new Error("Rede indisponível"));
  await act(async () => { render(<RelatoriosFinanceiros />); });
  await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
  expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(12000); });
  expect(listarRelatoriosFinanceiros).toHaveBeenCalledTimes(2);
});

it("popstate volta à lista antes de 700 ms e permite recuperar edição após falha", async () => {
  vi.mocked(salvarRascunhoRelatorioFinanceiro).mockRejectedValue(new Error("Rede indisponível"));
  render(<RelatoriosFinanceiros />);
  fireEvent.click(await screen.findByRole("button", { name: "Novo relatório" }));
  await alterarControle(screen.getByLabelText("Nome do relatório"), { target: { value: "Resumo recém-editado" } });
  act(() => { window.history.replaceState(null, "", "/financeiro/relatorios"); window.dispatchEvent(new PopStateEvent("popstate")); });
  expect(screen.getByRole("heading", { name: "Relatórios financeiros" })).toBeTruthy();
  await waitFor(() => expect(salvarRascunhoRelatorioFinanceiro).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("button", { name: "Continuar rascunho" }));
  expect(window.location.pathname).toBe("/financeiro/relatorios/novo");
  expect(screen.getByLabelText<HTMLInputElement>("Nome do relatório").value).toBe("Resumo recém-editado");
});

it("novo relatório espera a gravação em andamento antes de descartar e limpa recuperação", async () => {
  let concluir!: (valor: Awaited<ReturnType<typeof salvarRascunhoRelatorioFinanceiro>>) => void;
  vi.mocked(salvarRascunhoRelatorioFinanceiro).mockImplementationOnce(() => new Promise(resolve => { concluir = resolve; }));
  vi.mocked(descartarRascunhoRelatorioFinanceiro).mockResolvedValue(undefined);
  render(<RelatoriosFinanceiros />);
  fireEvent.click(await screen.findByRole("button", { name: "Novo relatório" }));
  await alterarControle(screen.getByLabelText("Nome do relatório"), { target: { value: "Não recriar este rascunho" } });
  await waitFor(() => expect(salvarRascunhoRelatorioFinanceiro).toHaveBeenCalledTimes(1), { timeout: 2000 });
  act(() => { window.history.replaceState(null, "", "/financeiro/relatorios"); window.dispatchEvent(new PopStateEvent("popstate")); });
  fireEvent.click(screen.getByRole("button", { name: "Novo relatório" }));
  fireEvent.click(await screen.findByRole("button", { name: "Descartar e criar" }));
  expect(descartarRascunhoRelatorioFinanceiro).not.toHaveBeenCalled();
  await act(async () => { concluir({ id: uid(1), versao: 4, updatedAt: "", configuracao: parametros }); });
  await waitFor(() => expect(descartarRascunhoRelatorioFinanceiro).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(window.location.pathname).toBe("/financeiro/relatorios/novo"));
  expect(estadoRascunhoRelatorioAtivo().recuperacao).toBeNull();
  expect(screen.getByLabelText<HTMLInputElement>("Nome do relatório").value).toMatch(/^Relatório financeiro — /);
});
