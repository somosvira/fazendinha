// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RelatoriosFinanceiros } from "./RelatoriosFinanceiros";
import { descartarRascunhoRelatorioFinanceiro, listarRelatoriosFinanceiros, obterConfiguracoesFinanceiras, obterRascunhoRelatorioFinanceiro, obterRelatorioFinanceiro, salvarPdfRelatorioFinanceiro, type RelatorioFinanceiro } from "./novo-api";

vi.mock("../rebanho/api", () => ({ usePropriedades: () => ({ data: [], loading: false, recarregar: vi.fn() }) }));
vi.mock("./novo-api", () => ({
  listarRelatoriosFinanceiros: vi.fn(), obterConfiguracoesFinanceiras: vi.fn(), obterRascunhoRelatorioFinanceiro: vi.fn(),
  descartarRascunhoRelatorioFinanceiro: vi.fn(), salvarPdfRelatorioFinanceiro: vi.fn(), obterRelatorioFinanceiro: vi.fn(),
  salvarRascunhoRelatorioFinanceiro: vi.fn(), gerarRelatorioFinanceiro: vi.fn(),
}));

const base = { status: "CONCLUIDO" as const, propriedadeId: 1, propriedade: "Fazenda Rio Novo", concluidoEm: null, erro: null };
const parametros = { nome: "", dataInicio: "2026-08-01", dataFim: "2026-08-31", regime: "ambos" as const, tipos: [], status: ["CONFIRMADA"], centroCustoIds: [1], parceiroIds: [], categoriaIds: [3, 0], classificacoes: [] };
const relatorios: RelatorioFinanceiro[] = [
  { ...base, id: 12, nome: "Pecuária — agosto", autor: "Rafael", geradoEm: "2026-09-14T12:00:00Z", parametros },
  { ...base, id: 11, nome: "Fechamento julho", autor: "Contadora", geradoEm: "2026-08-02T12:00:00Z", parametros: { ...parametros, centroCustoIds: [], categoriaIds: [] }, status: "FALHOU", erro: "Não foi possível montar o relatório. Tente gerar novamente." },
];

beforeEach(() => {
  window.history.replaceState(null, "", "/financeiro/relatorios");
  vi.mocked(listarRelatoriosFinanceiros).mockResolvedValue(relatorios);
  vi.mocked(obterConfiguracoesFinanceiras).mockResolvedValue({ contas: [], parceiros: [], produtos: [], categorias: [], centrosCusto: [] });
  vi.mocked(obterRascunhoRelatorioFinanceiro).mockResolvedValue(null);
  vi.mocked(obterRelatorioFinanceiro).mockReturnValue(new Promise(() => {}));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

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
    expect(window.location.pathname).toBe("/financeiro/relatorios/12");
    expect(obterRelatorioFinanceiro).toHaveBeenCalledWith(12);
  });

  it("novo relatório descarta o rascunho anterior; continuar o preserva", async () => {
    vi.mocked(obterRascunhoRelatorioFinanceiro).mockResolvedValue({ id: 1, versao: 2, updatedAt: "", configuracao: { nome: "Rascunho antigo" } });
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
