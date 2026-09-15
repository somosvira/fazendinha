// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NovoRelatorioFinanceiro } from "./NovoRelatorioFinanceiro";
import { descartarRascunhoRelatorioFinanceiro, gerarRelatorioFinanceiro, salvarPdfRelatorioFinanceiro, salvarRascunhoRelatorioFinanceiro, type ConfiguracoesFinanceiras, type RascunhoRelatorioFinanceiro, type RelatorioFinanceiro } from "./novo-api";

vi.mock("./novo-api", () => ({
  descartarRascunhoRelatorioFinanceiro: vi.fn(), gerarRelatorioFinanceiro: vi.fn(),
  salvarPdfRelatorioFinanceiro: vi.fn(), salvarRascunhoRelatorioFinanceiro: vi.fn(),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const cadastros: ConfiguracoesFinanceiras = {
  contas: [], parceiros: [], produtos: [],
  categorias: [{ id: 3, nome: "Nutrição", ativo: true, ordem: 0, classificacao: "CUSTEIO" }, { id: 4, nome: "Silagem antiga", ativo: false, ordem: 1, classificacao: null }],
  centrosCusto: [{ id: 1, nome: "Pecuária", ativo: true, ordem: 0 }],
};
const configuracao = { nome: "Pecuária — agosto", dataInicio: "2026-08-01", dataFim: "2026-08-31", regime: "ambos" as const, tipos: [], status: ["CONFIRMADA"], centroCustoIds: [], categoriaIds: [], classificacoes: [] };
const rascunho: RascunhoRelatorioFinanceiro = { id: 1, versao: 3, updatedAt: "2026-09-14T10:00:00Z", configuracao };
const relatorio = { id: 9, nome: configuracao.nome, status: "CONCLUIDO" } as RelatorioFinanceiro;

function renderizar(inicial: RascunhoRelatorioFinanceiro | null = rascunho) {
  const onGerado = vi.fn();
  render(<NovoRelatorioFinanceiro cadastros={cadastros} rascunho={inicial} onVoltar={vi.fn()} onGerado={onGerado} />);
  return { onGerado, resumo: () => within(screen.getByRole("complementary", { name: "Resumo do relatório" })) };
}

describe("novo relatório financeiro", () => {
  it("continua o rascunho e resume as escolhas em tempo real", () => {
    const { resumo } = renderizar();
    expect(screen.getByLabelText<HTMLInputElement>("Nome do relatório").value).toBe("Pecuária — agosto");
    expect(screen.getByLabelText("Silagem antiga (inativa)")).toBeTruthy();
    expect(screen.getByLabelText("Sem categoria")).toBeTruthy();
    expect(resumo().getByText("Todas as categorias")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Nutrição"));
    fireEvent.click(screen.getByLabelText("Sem centro de custo"));
    fireEvent.click(screen.getByLabelText("Investimento"));

    expect(resumo().getByText("Nutrição")).toBeTruthy();
    expect(resumo().getByText("Sem centro de custo")).toBeTruthy();
    expect(resumo().getByText("Investimento")).toBeTruthy();
    expect(resumo().getByText("Saldo das contas (sempre sem filtros)")).toBeTruthy();
  });

  it("limita as datas entre si e bloqueia período inválido", () => {
    renderizar();
    fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2026-08-10" } });
    expect(screen.getByLabelText("Data final").getAttribute("min")).toBe("2026-08-10");
    expect(screen.getByLabelText("Data inicial").getAttribute("max")).toBe("2026-08-31");
    fireEvent.change(screen.getByLabelText("Data final"), { target: { value: "2026-08-01" } });
    expect(screen.getByRole("alert").textContent).toMatch("anterior à inicial");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Gerar relatório" }).disabled).toBe(true);
  });

  it("salva o rascunho sozinho, com a versão lida", async () => {
    vi.mocked(salvarRascunhoRelatorioFinanceiro).mockResolvedValue({ ...rascunho, versao: 4 });
    renderizar();
    fireEvent.change(screen.getByLabelText("Nome do relatório"), { target: { value: "Pecuária — agosto revisado" } });
    await waitFor(() => expect(salvarRascunhoRelatorioFinanceiro).toHaveBeenCalledWith(expect.objectContaining({ nome: "Pecuária — agosto revisado" }), 3), { timeout: 2000 });
    expect(await screen.findByText("Rascunho salvo")).toBeTruthy();
  });

  it("limpa o rascunho explicitamente", async () => {
    vi.mocked(descartarRascunhoRelatorioFinanceiro).mockResolvedValue(undefined);
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: "Limpar rascunho" }));
    await waitFor(() => expect(descartarRascunhoRelatorioFinanceiro).toHaveBeenCalled());
    expect(screen.getByLabelText<HTMLInputElement>("Nome do relatório").value).toMatch(/^Relatório financeiro — /);
    expect(screen.queryByRole("button", { name: "Limpar rascunho" })).toBeNull();
  });

  it("gera, inicia o download e volta ao histórico", async () => {
    vi.mocked(gerarRelatorioFinanceiro).mockResolvedValue(relatorio);
    vi.mocked(salvarPdfRelatorioFinanceiro).mockResolvedValue(undefined);
    const { onGerado } = renderizar();
    fireEvent.click(screen.getByLabelText("Nutrição"));
    fireEvent.click(screen.getByRole("button", { name: "Gerar relatório" }));
    await waitFor(() => expect(onGerado).toHaveBeenCalledWith(relatorio, null));
    expect(gerarRelatorioFinanceiro).toHaveBeenCalledWith(expect.objectContaining({ nome: "Pecuária — agosto", categoriaIds: [3], status: ["CONFIRMADA"] }));
    expect(salvarPdfRelatorioFinanceiro).toHaveBeenCalledWith(relatorio);
  });

  it("avisa quando o PDF foi gerado mas o download falhou", async () => {
    vi.mocked(gerarRelatorioFinanceiro).mockResolvedValue(relatorio);
    vi.mocked(salvarPdfRelatorioFinanceiro).mockRejectedValue(new Error("rede"));
    const { onGerado } = renderizar();
    fireEvent.click(screen.getByRole("button", { name: "Gerar relatório" }));
    await waitFor(() => expect(onGerado).toHaveBeenCalledWith(relatorio, expect.stringContaining("Baixar PDF")));
  });

  it("falha de geração mostra a mensagem e mantém o formulário", async () => {
    vi.mocked(gerarRelatorioFinanceiro).mockRejectedValue(new Error("Uma das categorias selecionadas não existe mais"));
    vi.mocked(salvarRascunhoRelatorioFinanceiro).mockResolvedValue({ ...rascunho, versao: 4 });
    const { onGerado } = renderizar();
    fireEvent.click(screen.getByRole("button", { name: "Gerar relatório" }));
    expect((await screen.findByRole("alert")).textContent).toMatch("não existe mais");
    expect(onGerado).not.toHaveBeenCalled();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Gerar relatório" }).disabled).toBe(false);
  });
});
