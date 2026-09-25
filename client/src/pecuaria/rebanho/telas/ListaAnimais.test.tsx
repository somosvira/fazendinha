// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ToastProvider } from "@/components/Toast";
import { ListaAnimais } from "./ListaAnimais";
import { buscarFichaAnimal, desfazerMovimentacao, listarAnimais, listarCategorias, movimentarAnimais, obterCatalogos } from "../api";
import type { AnimalFicha, AnimalResumo, Catalogos } from "../types";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  listarAnimais: vi.fn(),
  listarCategorias: vi.fn(),
  obterCatalogos: vi.fn(),
  buscarFichaAnimal: vi.fn(),
  movimentarAnimais: vi.fn(),
  desfazerMovimentacao: vi.fn(),
}));

const painelVazio = { totalAtivos: 0, porCategoria: [], porSitio: [], femeasAtivas: 0, receptorasAtivas: 0 };
const vazio = { itens: [], total: 0, painel: painelVazio };

const categoriaVaca = { id: "cat-vaca", nome: "Vaca", sexo: "F" as const, automatica: true, ativo: true, ordem: 10, idadeMinMeses: null, idadeMaxMeses: null, partos: "COM" as const, ideagriId: 7, padrao: true, regra: "com parto", animaisAtivos: 0, manuaisAbertas: 0 };
const catVaca = { id: "cat-vaca", nome: "Vaca" };

function criarAnimal(overrides: Partial<AnimalResumo>): AnimalResumo {
  return {
    id: "a1", brinco: "0001", nome: null, sexo: "F", categoria: catVaca, categoriaOrigem: "AUTOMATICA", categoriaCalculada: catVaca, idadeMeses: 30, idadeNaBaixa: false,
    dataNascimento: "2023-01-01", dataEntrada: "2023-01-01", origem: "NASCIDO",
    propriedade: { id: 1, nome: "Sede" }, lote: null, aptidao: "LEITE", papelReprodutivo: "NENHUM",
    composicaoRotulo: "", ultimoPeso: null, situacao: "ATIVO",
    gmdRecente: null, noLocalDesde: null, baixa: null,
    ...overrides,
  };
}

function criarFicha(overrides: Partial<AnimalFicha>): AnimalFicha {
  return {
    ...criarAnimal({}),
    brincoEletronico: null, sisbov: null, nascimentoEstimado: false, partosAntesDaEntrada: 0, observacao: null,
    composicao: [], historicoLocalizacoes: [], historicoDestinos: [], historicoPesagens: [], historicoCategoriasManuais: [],
    baixa: null,
    peso: { ultimo: null, gmdRecente: null, gmdDesdeEntrada: null, gmdPeriodo: { dias: null, valor: null, pesagens: 0 } },
    historicoBaixas: [],
    ...overrides,
  };
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

function montar(props: Partial<Parameters<typeof ListaAnimais>[0]> = {}) {
  return render(<ListaAnimais onAbrirAnimal={vi.fn()} onNovoAnimal={vi.fn()} {...props} />, { wrapper: Wrapper });
}

/* A TabelaFinanceira renderiza tabela E cartões simultaneamente no jsdom;
 * pegamos sempre a primeira ocorrência (mesma convenção de ListaLotes.test.tsx). */
const primeiro = (role: string, name: string | RegExp) => screen.getAllByRole(role, { name })[0];

afterEach(() => { cleanup(); vi.useRealTimers(); window.history.pushState(null, "", "/pecuaria/rebanho/animais"); });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarAnimais).mockResolvedValue(vazio as never);
  vi.mocked(listarCategorias).mockResolvedValue({ itens: [categoriaVaca], semCategoria: 0 });
  vi.mocked(obterCatalogos).mockResolvedValue({ racas: [{ id: "raca-1", nome: "Nelore", sigla: "NE", base: true }], motivosBaixa: [], propriedades: [{ id: 1, nome: "Sede", apelido: null }], lotes: [] } as Catalogos);
});

describe("ListaAnimais", () => {
  it("busca espera 300 ms sem digitar e faz uma única requisição", async () => {
    vi.useFakeTimers();
    montar();
    await act(async () => { await vi.runOnlyPendingTimersAsync(); });
    const inicial = vi.mocked(listarAnimais).mock.calls.length;
    const campo = screen.getByLabelText("Buscar por brinco ou nome");
    for (const texto of ["1", "10", "100", "1001"]) {
      fireEvent.change(campo, { target: { value: texto } });
      await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    }
    expect(vi.mocked(listarAnimais).mock.calls.length).toBe(inicial);
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    const novas = vi.mocked(listarAnimais).mock.calls.slice(inicial);
    expect(novas).toHaveLength(1);
    expect(novas[0][0]).toMatchObject({ busca: "1001", page: 1 });
  });

  it("trocar um filtro dispara uma única busca, já na página 1", async () => {
    vi.useFakeTimers();
    montar();
    await act(async () => { await vi.runOnlyPendingTimersAsync(); });
    const inicial = vi.mocked(listarAnimais).mock.calls.length;
    fireEvent.change(screen.getByLabelText("Filtrar por categoria"), { target: { value: "cat-vaca" } });
    await act(async () => { await vi.runOnlyPendingTimersAsync(); });
    const novas = vi.mocked(listarAnimais).mock.calls.slice(inicial);
    expect(novas).toHaveLength(1);
    expect(novas[0][0]).toMatchObject({ categoriaId: "cat-vaca", page: 1 });
  });

  it("sem permissão de lançar não oferece Novo animal", async () => {
    montar({ podeLancar: false });
    await screen.findByText("Nenhum animal encontrado com os filtros selecionados.");
    expect(screen.queryByRole("button", { name: /Novo animal/ })).toBeNull();
  });

  it("editar ignora a resposta de um clique anterior que chega fora de ordem (U3)", async () => {
    const itens = [criarAnimal({ id: "a1", brinco: "0001" }), criarAnimal({ id: "a2", brinco: "0002" })];
    vi.mocked(listarAnimais).mockResolvedValue({ itens, total: 2, painel: painelVazio });
    let resolverA1: (v: AnimalFicha) => void = () => undefined;
    vi.mocked(buscarFichaAnimal).mockImplementation((id) => {
      if (id === "a1") return new Promise((resolve) => { resolverA1 = resolve; });
      return Promise.resolve(criarFicha({ id: "a2", brinco: "0002" }));
    });
    montar();
    await screen.findAllByText("0001");

    // clica em editar 0001 (fica pendente) e depois em 0002 (resolve primeiro)
    fireEvent.click(primeiro("button", "Editar 0001"));
    fireEvent.click(primeiro("button", "Editar 0002"));
    await screen.findByRole("heading", { name: "Editar 0002" });

    // a resposta tardia do clique em 0001 não deve substituir a ficha já aberta
    resolverA1(criarFicha({ id: "a1", brinco: "0001" }));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByRole("heading", { name: "Editar 0002" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Editar 0001" })).toBeNull();
  });

  it("animal baixado não tem checkbox nem ações de editar/movimentar (K3)", async () => {
    const itens = [criarAnimal({ id: "a1", brinco: "0001", situacao: "ATIVO" }), criarAnimal({ id: "a2", brinco: "0002", situacao: "BAIXADO" })];
    vi.mocked(listarAnimais).mockResolvedValue({ itens, total: 2, painel: painelVazio });
    montar();
    await screen.findAllByText("0002");

    expect(primeiro("checkbox", "Selecionar 0001")).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "Selecionar 0002" })).toBeNull();
    expect(primeiro("button", "Editar 0001")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Editar 0002" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Movimentar 0002" })).toBeNull();

    // "selecionar todos" considera só os ativos
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar todos os animais desta página" }));
    expect((primeiro("checkbox", "Selecionar 0001") as HTMLInputElement).checked).toBe(true);
  });

  it("movimentar mostra o toast com Desfazer, igual ao da página do lote (K8)", async () => {
    const itens = [criarAnimal({ id: "a1", brinco: "0001" })];
    vi.mocked(listarAnimais).mockResolvedValue({ itens, total: 1, painel: painelVazio });
    vi.mocked(movimentarAnimais).mockResolvedValue({ movimentacaoId: "mov-1", movidos: 1 });
    vi.mocked(desfazerMovimentacao).mockResolvedValue({ desfeitos: 1 });
    montar();
    await screen.findAllByText("0001");

    fireEvent.click(primeiro("button", "Movimentar 0001"));
    const painel = await screen.findByRole("dialog");
    fireEvent.change(within(painel).getByLabelText("Sítio de destino"), { target: { value: "1" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Movimentar" }));

    const toast = await screen.findByText("1 animal movimentado");
    expect(toast).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(desfazerMovimentacao).toHaveBeenCalledWith("mov-1", "Desfeito logo após a movimentação"));
  });

  it("sexo, origem e raça são enviados para listarAnimais", async () => {
    // itens não-vazios: uma nova busca não deve fazer a página inteira voltar
    // ao loader entre uma troca de filtro e a próxima (K1 — só a tabela recarrega)
    vi.mocked(listarAnimais).mockResolvedValue({ itens: [criarAnimal({})], total: 1, painel: painelVazio });
    montar();
    await screen.findByLabelText("Filtrar por raça");
    fireEvent.change(screen.getByLabelText("Filtrar por sexo"), { target: { value: "F" } });
    fireEvent.change(screen.getByLabelText("Filtrar por origem"), { target: { value: "COMPRADO" } });
    fireEvent.change(screen.getByLabelText("Filtrar por raça"), { target: { value: "raca-1" } });
    await waitFor(() => expect(vi.mocked(listarAnimais).mock.calls.at(-1)![0]).toMatchObject({ sexo: "F", origem: "COMPRADO", racaId: "raca-1", page: 1 }));
  });

  it("idade mínima e máxima (em meses) são enviadas como número", async () => {
    vi.mocked(listarAnimais).mockResolvedValue({ itens: [criarAnimal({})], total: 1, painel: painelVazio });
    montar();
    await screen.findByLabelText("Idade mínima (meses)");
    fireEvent.change(screen.getByLabelText("Idade mínima (meses)"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Idade máxima (meses)"), { target: { value: "24" } });
    await waitFor(() => expect(vi.mocked(listarAnimais).mock.calls.at(-1)![0]).toMatchObject({ idadeMinMeses: 12, idadeMaxMeses: 24 }));
  });

  it("categoria \"Sem categoria\" envia semCategoria e \"Só forçadas\" envia categoriaOrigem", async () => {
    vi.mocked(listarAnimais).mockResolvedValue({ itens: [criarAnimal({})], total: 1, painel: painelVazio });
    montar();
    const select = await screen.findByLabelText("Filtrar por categoria") as HTMLSelectElement;
    const opcaoSemCategoria = within(select).getByText("Sem categoria") as HTMLOptionElement;
    fireEvent.change(select, { target: { value: opcaoSemCategoria.value } });
    await waitFor(() => expect(vi.mocked(listarAnimais).mock.calls.at(-1)![0]).toMatchObject({ semCategoria: true }));
    expect(vi.mocked(listarAnimais).mock.calls.at(-1)![0].categoriaId).toBeUndefined();

    const opcaoForcadas = within(select).getByText("Só forçadas") as HTMLOptionElement;
    fireEvent.change(select, { target: { value: opcaoForcadas.value } });
    await waitFor(() => expect(vi.mocked(listarAnimais).mock.calls.at(-1)![0]).toMatchObject({ categoriaOrigem: "MANUAL" }));
  });

  it("ordenação troca ordenar e direcao", async () => {
    montar();
    const select = await screen.findByLabelText("Ordenar por") as HTMLSelectElement;
    const opcao = within(select).getByText("Nascimento — mais novos") as HTMLOptionElement;
    fireEvent.change(select, { target: { value: opcao.value } });
    await waitFor(() => expect(vi.mocked(listarAnimais).mock.calls.at(-1)![0]).toMatchObject({ ordenar: "nascimento", direcao: "desc" }));
  });

  it("tipo de baixa e período só aparecem com Baixados/Todas e são enviados", async () => {
    vi.mocked(listarAnimais).mockResolvedValue({ itens: [criarAnimal({})], total: 1, painel: painelVazio });
    montar();
    await screen.findByLabelText("Filtrar por situação");
    expect(screen.queryByLabelText("Filtrar por tipo de baixa")).toBeNull();
    fireEvent.change(screen.getByLabelText("Filtrar por situação"), { target: { value: "BAIXADO" } });
    await screen.findByLabelText("Filtrar por tipo de baixa");
    fireEvent.change(screen.getByLabelText("Filtrar por tipo de baixa"), { target: { value: "VENDA" } });
    fireEvent.change(screen.getByLabelText("Baixa de"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("Baixa até"), { target: { value: "2026-03-01" } });
    await waitFor(() => expect(vi.mocked(listarAnimais).mock.calls.at(-1)![0]).toMatchObject({ situacao: "BAIXADO", tipoBaixa: "VENDA", baixaDe: "2026-01-01", baixaAte: "2026-03-01" }));
  });

  it("lê os filtros iniciais da query string (deep-link da Visão geral/Cadastros)", async () => {
    window.history.pushState(null, "", "/pecuaria/rebanho/animais?situacao=BAIXADO&tipoBaixa=VENDA&semCategoria=true");
    montar();
    await waitFor(() => expect(listarAnimais).toHaveBeenCalled());
    expect(vi.mocked(listarAnimais).mock.calls[0][0]).toMatchObject({ situacao: "BAIXADO", tipoBaixa: "VENDA", semCategoria: true });
    expect((screen.getByLabelText("Filtrar por situação") as HTMLSelectElement).value).toBe("BAIXADO");
  });

  it("mostra o GMD recente na coluna GMD", async () => {
    const itens = [criarAnimal({ id: "a1", brinco: "0001", gmdRecente: 0.512 })];
    vi.mocked(listarAnimais).mockResolvedValue({ itens, total: 1, painel: painelVazio });
    montar();
    await screen.findAllByText("0001");
    expect(screen.getAllByText("+0,512 kg/dia").length).toBeGreaterThan(0);
  });

  it("coluna Baixa só aparece (tipo · data) quando a situação inclui baixados", async () => {
    const itens = [criarAnimal({ id: "a1", brinco: "0001", situacao: "BAIXADO", baixa: { data: "2026-01-10", tipo: "VENDA" } })];
    vi.mocked(listarAnimais).mockResolvedValue({ itens, total: 1, painel: painelVazio });
    montar();
    await screen.findAllByText("0001");
    expect(screen.queryByText("Venda")).toBeNull();

    fireEvent.change(screen.getByLabelText("Filtrar por situação"), { target: { value: "BAIXADO" } });
    await waitFor(() => expect(screen.getAllByText("Venda").length).toBeGreaterThan(0));
    expect(screen.getAllByText("10/01/2026").length).toBeGreaterThan(0);
  });

  it("mostra a faixa de resumo com o total e as pílulas por categoria do painel", async () => {
    const painelComDados = { totalAtivos: 42, porCategoria: [{ categoria: catVaca, total: 30 }, { categoria: null, total: 12 }], porSitio: [], femeasAtivas: 0, receptorasAtivas: 0 };
    vi.mocked(listarAnimais).mockResolvedValue({ itens: [], total: 0, painel: painelComDados });
    montar();
    await waitFor(() => expect(screen.getByText("42 animais ativos")).toBeTruthy());
    expect(screen.getByText(/Vaca: 30/)).toBeTruthy();
    expect(screen.getByText(/Sem categoria: 12/)).toBeTruthy();
  });
});
