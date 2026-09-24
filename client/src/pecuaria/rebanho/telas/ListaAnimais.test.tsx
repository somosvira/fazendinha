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
    ...overrides,
  };
}

function criarFicha(overrides: Partial<AnimalFicha>): AnimalFicha {
  return {
    ...criarAnimal({}),
    brincoEletronico: null, sisbov: null, nascimentoEstimado: false, partosAntesDaEntrada: 0, observacao: null,
    composicao: [], historicoLocalizacoes: [], historicoDestinos: [], historicoPesagens: [], historicoCategoriasManuais: [], baixa: null,
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

afterEach(() => { cleanup(); vi.useRealTimers(); });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarAnimais).mockResolvedValue(vazio as never);
  vi.mocked(listarCategorias).mockResolvedValue({ itens: [categoriaVaca], semCategoria: 0 });
  vi.mocked(obterCatalogos).mockResolvedValue({ racas: [], motivosBaixa: [], propriedades: [{ id: 1, nome: "Sede", apelido: null }], lotes: [] } as Catalogos);
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
});
