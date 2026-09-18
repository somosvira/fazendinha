// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NovoRelatorioFinanceiro } from "./NovoRelatorioFinanceiro";
import { descartarRascunhoRelatorioFinanceiro, gerarRelatorioFinanceiro, salvarPdfRelatorioFinanceiro, salvarRascunhoRelatorioFinanceiro, type ConfiguracoesFinanceiras, type RascunhoRelatorioFinanceiro, type RelatorioFinanceiro } from "./novo-api";

vi.mock("../rebanho/api", () => ({ usePropriedades: () => ({ data: [], loading: false, recarregar: vi.fn() }) }));
vi.mock("./novo-api", () => ({
  descartarRascunhoRelatorioFinanceiro: vi.fn(), gerarRelatorioFinanceiro: vi.fn(),
  salvarPdfRelatorioFinanceiro: vi.fn(), salvarRascunhoRelatorioFinanceiro: vi.fn(),
}));
class ResizeObserverMock { observe() {} unobserve() {} disconnect() {} }
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  if (!window.HTMLElement.prototype.scrollIntoView) window.HTMLElement.prototype.scrollIntoView = () => {};
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

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

function selecionar(filtro: string, opcao: string) {
  fireEvent.click(screen.getByRole("button", { name: filtro }));
  fireEvent.click(screen.getByRole("option", { name: opcao }));
  fireEvent.keyDown(document, { key: "Escape" });
}

describe("novo relatório financeiro", () => {
  it("continua o rascunho e resume as escolhas em tempo real", () => {
    const { resumo } = renderizar();
    expect(screen.getByLabelText<HTMLInputElement>("Nome do relatório").value).toBe("Pecuária — agosto");
    fireEvent.click(screen.getByRole("button", { name: "Categoria dos itens" }));
    expect(screen.getByRole("option", { name: "Silagem antiga (inativa)" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Sem categoria" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(resumo().getByText("Todas as categorias")).toBeTruthy();

    selecionar("Categoria dos itens", "Nutrição");
    selecionar("Centro de custo", "Sem centro de custo");
    selecionar("Classificação", "Investimento");

    expect(resumo().getByText("Nutrição")).toBeTruthy();
    expect(resumo().getByText("Sem centro de custo")).toBeTruthy();
    expect(resumo().getByText("Investimento")).toBeTruthy();
    expect(resumo().getByText("Saldo das contas (sempre sem filtros)")).toBeTruthy();
  });

  it("aplica períodos rápidos e abre a agenda para personalizar", () => {
    const { resumo } = renderizar();
    expect(screen.getByRole("button", { name: "Período do relatório" }).textContent).toContain("Mês anterior");
    fireEvent.click(screen.getByRole("button", { name: "Período do relatório" }));

    fireEvent.click(screen.getByRole("button", { name: "Ano atual" }));
    expect(screen.getByRole("button", { name: "Período do relatório" }).textContent).toContain("Ano atual");
    expect(resumo().getByText(/01\/01\/2026 a/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Período do relatório" }));
    fireEvent.click(screen.getByRole("button", { name: "Período personalizado" }));
    expect(screen.getByRole("button", { name: "Aplicar período" })).toBeTruthy();
    expect(screen.queryByText("Presets")).toBeNull();
  });

  it("mantém a ação de gerar fora da área rolável do resumo", () => {
    renderizar();
    const resumo = screen.getByRole("complementary", { name: "Resumo do relatório" });
    const gerar = within(resumo).getByRole("button", { name: "Gerar relatório" });
    const aviso = within(resumo).getByText("O PDF é baixado ao gerar e fica salvo no histórico da propriedade.");
    expect(gerar.parentElement?.className).toContain("shrink-0");
    expect(gerar.parentElement).toBe(aviso.parentElement);
    expect(gerar.parentElement?.className).toContain("border-t");
    expect(gerar.parentElement?.className).toContain("pb-2");
    expect(gerar.closest(".overflow-y-auto")).toBeNull();
    expect(resumo.className).toContain("xl:absolute");
    expect(resumo.className).toContain("xl:inset-y-0");
  });

  it("salva o rascunho sozinho, com a versão lida", async () => {
    vi.mocked(salvarRascunhoRelatorioFinanceiro).mockResolvedValue({ ...rascunho, versao: 4 });
    renderizar();
    fireEvent.change(screen.getByLabelText("Nome do relatório"), { target: { value: "Pecuária — agosto revisado" } });
    await waitFor(() => expect(salvarRascunhoRelatorioFinanceiro).toHaveBeenCalledWith(expect.objectContaining({ nome: "Pecuária — agosto revisado" }), 3), { timeout: 2000 });
    expect(await screen.findByText("Rascunho salvo")).toBeTruthy();
  });

  it("edições durante um salvamento lento viram um único salvamento seguinte, com a versão nova", async () => {
    let concluir!: (valor: RascunhoRelatorioFinanceiro) => void;
    vi.mocked(salvarRascunhoRelatorioFinanceiro)
      .mockImplementationOnce(() => new Promise((resolver) => { concluir = resolver; }))
      .mockResolvedValue({ ...rascunho, versao: 5 });
    renderizar();
    fireEvent.change(screen.getByLabelText("Nome do relatório"), { target: { value: "A" } });
    await waitFor(() => expect(salvarRascunhoRelatorioFinanceiro).toHaveBeenCalledTimes(1), { timeout: 2000 });
    fireEvent.change(screen.getByLabelText("Nome do relatório"), { target: { value: "AB" } });
    await new Promise((r) => setTimeout(r, 800));
    fireEvent.change(screen.getByLabelText("Nome do relatório"), { target: { value: "ABC" } });
    await new Promise((r) => setTimeout(r, 800));
    expect(salvarRascunhoRelatorioFinanceiro).toHaveBeenCalledTimes(1);
    concluir({ ...rascunho, versao: 4 });
    await waitFor(() => expect(salvarRascunhoRelatorioFinanceiro).toHaveBeenCalledTimes(2));
    expect(salvarRascunhoRelatorioFinanceiro).toHaveBeenLastCalledWith(expect.objectContaining({ nome: "ABC" }), 4);
    await new Promise((r) => setTimeout(r, 50));
    expect(salvarRascunhoRelatorioFinanceiro).toHaveBeenCalledTimes(2);
  }, 8000);

  it("voltar salva a edição pendente antes de sair", async () => {
    vi.mocked(salvarRascunhoRelatorioFinanceiro).mockResolvedValue({ ...rascunho, versao: 4 });
    const onVoltar = vi.fn();
    render(<NovoRelatorioFinanceiro cadastros={cadastros} rascunho={rascunho} onVoltar={onVoltar} onGerado={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Nome do relatório"), { target: { value: "Editado agora" } });
    fireEvent.click(screen.getByRole("button", { name: "Relatórios" }));
    await waitFor(() => expect(onVoltar).toHaveBeenCalled());
    expect(salvarRascunhoRelatorioFinanceiro).toHaveBeenCalledWith(expect.objectContaining({ nome: "Editado agora" }), 3);
    expect(vi.mocked(salvarRascunhoRelatorioFinanceiro).mock.invocationCallOrder[0]).toBeLessThan(onVoltar.mock.invocationCallOrder[0]);
  });

  it("limpar logo após editar não deixa o salvamento pendente recriar o rascunho", async () => {
    vi.mocked(descartarRascunhoRelatorioFinanceiro).mockResolvedValue(undefined);
    renderizar();
    fireEvent.change(screen.getByLabelText("Nome do relatório"), { target: { value: "Quase" } });
    fireEvent.click(screen.getByRole("button", { name: "Limpar rascunho" }));
    await waitFor(() => expect(descartarRascunhoRelatorioFinanceiro).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 900));
    expect(salvarRascunhoRelatorioFinanceiro).not.toHaveBeenCalled();
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
    selecionar("Categoria dos itens", "Nutrição");
    fireEvent.click(screen.getByRole("button", { name: "Gerar relatório" }));
    await waitFor(() => expect(onGerado).toHaveBeenCalledWith(relatorio, null));
    expect(gerarRelatorioFinanceiro).toHaveBeenCalledWith(expect.objectContaining({ nome: "Pecuária — agosto", categoriaIds: [3], status: ["CONFIRMADA"] }), 4);
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
