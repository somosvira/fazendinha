import { descartarTrabalhoAtivo } from "./descarteTrabalhoAtivo";
import { limparRascunhoRelatorioAtivo, estadoRascunhoRelatorioAtivo, prepararPublicacaoRascunhoRelatorio } from "./rascunhoRelatorioAtivo";
import { alterarControle } from "../lib/controles.fixture";
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NovoRelatorioFinanceiro } from "./NovoRelatorioFinanceiro";
import { descartarRascunhoRelatorioFinanceiro, gerarRelatorioFinanceiro, salvarPdfRelatorioFinanceiro, salvarRascunhoRelatorioFinanceiro, type ConfiguracoesFinanceiras, type RascunhoRelatorioFinanceiro, type RelatorioFinanceiro } from "./novo-api";
import { uid } from "../lib/uid.fixture";

vi.mock("../api/propriedades", () => ({ usePropriedades: () => ({ data: [], loading: false, recarregar: vi.fn() }) }));
vi.mock("./novo-api", () => ({
  descartarRascunhoRelatorioFinanceiro: vi.fn(), gerarRelatorioFinanceiro: vi.fn(),
  salvarPdfRelatorioFinanceiro: vi.fn(), salvarRascunhoRelatorioFinanceiro: vi.fn(),
}));
class ResizeObserverMock { observe() {} unobserve() {} disconnect() {} }
beforeEach(() => {
  limparRascunhoRelatorioAtivo();
  vi.mocked(salvarRascunhoRelatorioFinanceiro).mockReset().mockResolvedValue({ ...rascunho, versao: 4 });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-14T12:00:00-03:00"));
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  if (!window.HTMLElement.prototype.scrollIntoView) window.HTMLElement.prototype.scrollIntoView = () => {};
});
afterEach(async () => { cleanup(); await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); }); limparRascunhoRelatorioAtivo(); vi.useRealTimers(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

const cadastros: ConfiguracoesFinanceiras = {
  contas: [], parceiros: [], produtos: [],
  categorias: [{ id: uid(3), nome: "Nutrição", ativo: true, ordem: 0, classificacao: "CUSTEIO", usoGenetico: false }, { id: uid(4), nome: "Silagem antiga", ativo: false, ordem: 1, classificacao: null, usoGenetico: false }],
  centrosCusto: [{ id: uid(1), nome: "Pecuária", ativo: true, ordem: 0 }],
};
const configuracao = { nome: "Pecuária — agosto", dataInicio: "2026-08-01", dataFim: "2026-08-31", regime: "ambos" as const, tipos: [], status: ["CONFIRMADA"], centroCustoIds: [], categoriaIds: [], classificacoes: [] };
const rascunho: RascunhoRelatorioFinanceiro = { id: uid(1), versao: 3, updatedAt: "2026-09-14T10:00:00Z", configuracao };
const relatorio = { id: uid(9), nome: configuracao.nome, status: "CONCLUIDO" } as unknown as RelatorioFinanceiro;

function renderizar(inicial: RascunhoRelatorioFinanceiro | null = rascunho) {
  const onGerado = vi.fn();
  render(<NovoRelatorioFinanceiro cadastros={cadastros} rascunho={inicial} onVoltar={vi.fn()} onGerado={onGerado} />);
  return { onGerado, resumo: () => within(screen.getByRole("complementary", { name: "Resumo do relatório" })) };
}

function selecionar(filtro: string, opcao: string) {
  if (!screen.queryByRole("button", { name: filtro })) fireEvent.click(screen.getByRole("button", { name: /Filtros avançados/ }));
  fireEvent.click(screen.getByRole("button", { name: filtro }));
  fireEvent.click(screen.getByRole("option", { name: opcao }));
  fireEvent.keyDown(document, { key: "Escape" });
}

describe("novo relatório financeiro", () => {
  it("continua o rascunho e resume as escolhas em tempo real", () => {
    const { resumo } = renderizar();
    expect(screen.getByLabelText<HTMLInputElement>("Nome do relatório").value).toBe("Pecuária — agosto");
    fireEvent.click(screen.getByRole("button", { name: /Filtros avançados/ }));
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
    fireEvent.click(screen.getByRole("button", { name: "Conteúdo do PDF" }));
    expect(resumo().getByText("Saldo das contas (sempre sem filtros)")).toBeTruthy();
  });

  it("aplica períodos rápidos e abre a agenda para personalizar", () => {
    const { resumo } = renderizar();
    expect(screen.getByRole("button", { name: /^Período do relatório:/ }).textContent).toContain("Mês anterior");
    fireEvent.click(screen.getByRole("button", { name: /^Período do relatório:/ }));

    fireEvent.click(screen.getByRole("button", { name: "Ano atual" }));
    expect(screen.getByRole("button", { name: /^Período do relatório:/ }).textContent).toContain("Ano atual");
    expect(resumo().getByText(/01\/01\/2026 a/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Período do relatório:/ }));
    fireEvent.click(screen.getByRole("button", { name: "Período personalizado" }));
    expect(screen.getByRole("button", { name: "Aplicar período" })).toBeTruthy();
    expect(screen.queryByText("Presets")).toBeNull();
  });

  it("apresenta formulário antes do resumo e mantém uma única ação de gerar", () => {
    renderizar();
    const titulo = screen.getByRole("heading", { name: "Novo relatório" });
    const resumo = screen.getByRole("complementary", { name: "Resumo do relatório" });
    expect(titulo.compareDocumentPosition(resumo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Gerar relatório" })).toHaveLength(1);
    expect(within(resumo).queryByRole("button", { name: "Relatórios" })).toBeNull();
    expect(within(resumo).getByText("Todas as categorias")).toBeTruthy();
  });

  it("salva o rascunho sozinho, com a versão lida", async () => {
    vi.mocked(salvarRascunhoRelatorioFinanceiro).mockResolvedValue({ ...rascunho, versao: 4 });
    renderizar();
    await alterarControle(screen.getByLabelText("Nome do relatório"), { target: { value: "Pecuária — agosto revisado" } });
    await waitFor(() => expect(salvarRascunhoRelatorioFinanceiro).toHaveBeenCalledWith(expect.objectContaining({ nome: "Pecuária — agosto revisado" }), 3), { timeout: 2000 });
    expect(await screen.findByText("Rascunho salvo")).toBeTruthy();
  });

  it("edições durante um salvamento lento viram um único salvamento seguinte, com a versão nova", async () => {
    let concluir!: (valor: RascunhoRelatorioFinanceiro) => void;
    vi.mocked(salvarRascunhoRelatorioFinanceiro)
      .mockImplementationOnce(() => new Promise((resolver) => { concluir = resolver; }))
      .mockResolvedValue({ ...rascunho, versao: 5 });
    renderizar();
    await alterarControle(screen.getByLabelText("Nome do relatório"), { target: { value: "A" } });
    await waitFor(() => expect(salvarRascunhoRelatorioFinanceiro).toHaveBeenCalledTimes(1), { timeout: 2000 });
    await alterarControle(screen.getByLabelText("Nome do relatório"), { target: { value: "AB" } });
    await new Promise((r) => setTimeout(r, 800));
    await alterarControle(screen.getByLabelText("Nome do relatório"), { target: { value: "ABC" } });
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
    await alterarControle(screen.getByLabelText("Nome do relatório"), { target: { value: "Editado agora" } });
    fireEvent.click(screen.getByRole("button", { name: "Relatórios" }));
    await waitFor(() => expect(onVoltar).toHaveBeenCalled());
    expect(salvarRascunhoRelatorioFinanceiro).toHaveBeenCalledWith(expect.objectContaining({ nome: "Editado agora" }), 3);
    expect(vi.mocked(salvarRascunhoRelatorioFinanceiro).mock.invocationCallOrder[0]).toBeLessThan(onVoltar.mock.invocationCallOrder[0]);
  });

  it("limpar logo após editar não deixa o salvamento pendente recriar o rascunho", async () => {
    vi.mocked(descartarRascunhoRelatorioFinanceiro).mockResolvedValue(undefined);
    renderizar();
    await alterarControle(screen.getByLabelText("Nome do relatório"), { target: { value: "Quase" } });
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
    expect(gerarRelatorioFinanceiro).toHaveBeenCalledWith(expect.objectContaining({ nome: "Pecuária — agosto", categoriaIds: [uid(3)], status: ["CONFIRMADA"] }), 4);
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

it("sair antes do autosave preserva a configuração recente mesmo quando a gravação falha", async () => {
  vi.mocked(salvarRascunhoRelatorioFinanceiro).mockRejectedValue(new Error("Rede indisponível"));
  const tela = render(<NovoRelatorioFinanceiro cadastros={cadastros} rascunho={rascunho} onVoltar={vi.fn()} onGerado={vi.fn()} />);
  await alterarControle(screen.getByLabelText("Nome do relatório"), { target: { value: "Última edição" } });
  tela.unmount();
  await waitFor(() => expect(estadoRascunhoRelatorioAtivo().recuperacao?.erro).toBe("Rede indisponível"));
  expect(salvarRascunhoRelatorioFinanceiro).toHaveBeenCalledWith(expect.objectContaining({ nome: "Última edição" }), 3);
  renderizar();
  expect(screen.getByLabelText<HTMLInputElement>("Nome do relatório").value).toBe("Última edição");
  expect(screen.getByRole("alert").textContent).toContain("Rede indisponível");
});

it("reabrir durante a gravação conserva a última edição e usa a versão confirmada", async () => {
  let concluir!: (valor: RascunhoRelatorioFinanceiro) => void;
  vi.mocked(salvarRascunhoRelatorioFinanceiro).mockImplementationOnce(() => new Promise(resolve => { concluir = resolve; })).mockResolvedValue({ ...rascunho, versao: 5 });
  const tela = render(<NovoRelatorioFinanceiro cadastros={cadastros} rascunho={rascunho} onVoltar={vi.fn()} onGerado={vi.fn()} />);
  await alterarControle(screen.getByLabelText("Nome do relatório"), { target: { value: "Primeira edição" } });
  await waitFor(() => expect(salvarRascunhoRelatorioFinanceiro).toHaveBeenCalledTimes(1), { timeout: 2000 });
  await alterarControle(screen.getByLabelText("Nome do relatório"), { target: { value: "Última edição antes de sair" } });
  tela.unmount();
  renderizar();
  expect(screen.getByLabelText<HTMLInputElement>("Nome do relatório").value).toBe("Última edição antes de sair");
  await alterarControle(screen.getByLabelText("Nome do relatório"), { target: { value: "Edição após voltar" } });
  await act(async () => { concluir({ ...rascunho, versao: 4 }); });
  await waitFor(() => expect(salvarRascunhoRelatorioFinanceiro).toHaveBeenCalledTimes(2), { timeout: 2000 });
  expect(salvarRascunhoRelatorioFinanceiro).toHaveBeenLastCalledWith(expect.objectContaining({ nome: "Edição após voltar" }), 4);
});

it("reabrir usa a versão confirmada em memória em vez de uma leitura atrasada", () => {
  prepararPublicacaoRascunhoRelatorio("escrita")({ ...rascunho, versao: 5, configuracao: { ...configuracao, nome: "Confirmado após a saída" } });
  renderizar(rascunho);
  expect(screen.getByLabelText<HTMLInputElement>("Nome do relatório").value).toBe("Confirmado após a saída");
});


it("o descarte da sidebar cancela autosave e não salva novamente ao desmontar o relatório", async () => {
  vi.mocked(descartarRascunhoRelatorioFinanceiro).mockResolvedValue(undefined);
  const { unmount } = render(<NovoRelatorioFinanceiro cadastros={cadastros} rascunho={rascunho} onVoltar={vi.fn()} onGerado={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Nome do relatório"), { target: { value: "Rascunho a excluir" } });
  const semEditor = vi.fn();
  await act(async () => { await descartarTrabalhoAtivo("relatorio", semEditor); });
  unmount();
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 850)); });
  expect(descartarRascunhoRelatorioFinanceiro).toHaveBeenCalledOnce();
  expect(salvarRascunhoRelatorioFinanceiro).not.toHaveBeenCalled();
  expect(semEditor).not.toHaveBeenCalled();
});
