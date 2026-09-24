// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ToastProvider } from "@/components/Toast";
import { DetalheLote } from "./DetalheLote";
import {
  buscarLote, desfazerMovimentacao, listarAnimais, listarMovimentacoesDoLote, movimentarAnimais, obterCatalogos, RebanhoApiError,
} from "../api";
import type { AnimalResumo, Catalogos, ListarFiltros, Lote, MovimentacaoDoLote } from "../types";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  buscarLote: vi.fn(),
  listarAnimais: vi.fn(),
  listarMovimentacoesDoLote: vi.fn(),
  desfazerMovimentacao: vi.fn(),
  movimentarAnimais: vi.fn(),
  obterCatalogos: vi.fn(),
  editarLote: vi.fn(),
}));

const lote: Lote = { id: "lote-1", nome: "Lote 1", propriedadeId: 1, propriedade: { id: 1, nome: "Sede" }, ativo: true, observacao: null, animaisAtivos: 2 };

const catalogos: Catalogos = {
  racas: [], motivosBaixa: [],
  propriedades: [{ id: 1, nome: "Sede", apelido: null }],
  lotes: [{ id: "lote-1", nome: "Lote 1", propriedadeId: 1 }, { id: "lote-2", nome: "Lote 2", propriedadeId: 1 }],
};

const catVaca = { id: "cat-vaca", nome: "Vaca" };

function criarAnimal(overrides: Partial<AnimalResumo>): AnimalResumo {
  return {
    id: "a1", brinco: "0001", nome: null, sexo: "F", categoria: catVaca, categoriaOrigem: "AUTOMATICA", categoriaCalculada: catVaca, idadeMeses: 30,
    dataNascimento: "2023-01-01", dataEntrada: "2023-01-01", origem: "NASCIDO",
    propriedade: { id: 1, nome: "Sede" }, lote: { id: "lote-1", nome: "Lote 1" }, aptidao: "LEITE", papelReprodutivo: "NENHUM",
    composicaoRotulo: "", ultimoPeso: null, situacao: "ATIVO",
    ...overrides,
  };
}

const animaisDoLote = [criarAnimal({ id: "a1", brinco: "0001" }), criarAnimal({ id: "a2", brinco: "0002" })];
const outroAnimal = criarAnimal({ id: "a3", brinco: "0003", lote: { id: "lote-2", nome: "Lote 2" } });

const painelLote = { totalAtivos: 2, porCategoria: [{ categoria: catVaca, total: 2 }], porSitio: [], femeasAtivas: 2, receptorasAtivas: 0 };
const painelVazio = { totalAtivos: 0, porCategoria: [], porSitio: [], femeasAtivas: 0, receptorasAtivas: 0 };

const movimentacaoBase: MovimentacaoDoLote = {
  id: "mov-1", data: "2026-01-10", direcao: "ENTRADA", quantidade: 2, quantidadeTotal: 2,
  origens: ["Sede · Lote Antigo"], destino: { propriedade: { id: 1, nome: "Sede" }, lote: { id: "lote-1", nome: "Lote 1" } },
  motivo: "Reagrupamento", criadoPor: "Fulano", criadoEm: "2026-01-10T12:00:00Z", desfeitaEm: null, desfeitaMotivo: null, podeDesfazer: true,
};

function montarListarAnimais() {
  vi.mocked(listarAnimais).mockImplementation((filtros: ListarFiltros) => {
    if (filtros.loteId === "lote-1") return Promise.resolve({ itens: animaisDoLote, total: 2, painel: painelLote });
    return Promise.resolve({ itens: [outroAnimal], total: 1, painel: painelVazio });
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

async function montar(onVoltar = vi.fn()) {
  render(<DetalheLote id="lote-1" onVoltar={onVoltar} />, { wrapper: Wrapper });
  await screen.findByText("Lote 1");
}

/* A TabelaFinanceira renderiza tabela E cartões simultaneamente no jsdom;
 * pegamos sempre a primeira ocorrência (mesma convenção de ListaLotes.test.tsx). */
const primeiro = (role: string, name: string | RegExp) => screen.getAllByRole(role, { name })[0];

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buscarLote).mockResolvedValue(lote);
  vi.mocked(obterCatalogos).mockResolvedValue(catalogos);
  vi.mocked(listarMovimentacoesDoLote).mockResolvedValue({ itens: [], total: 0 });
  montarListarAnimais();
});

describe("DetalheLote — animais do lote", () => {
  it("lista os animais ativos do lote", async () => {
    await montar();
    await screen.findAllByText("0001");
    expect(screen.getAllByText("0002").length).toBeGreaterThan(0);
    expect(screen.getByText(/2 animais ativos/)).toBeTruthy();
  });

  it("movimentação em massa chama movimentarAnimais com os ids selecionados e o sítio do lote", async () => {
    vi.mocked(movimentarAnimais).mockResolvedValue({ movimentacaoId: "mov-novo", movidos: 2 });
    await montar();
    await screen.findAllByText("0001");
    fireEvent.click(primeiro("checkbox", "Selecionar 0001"));
    fireEvent.click(primeiro("checkbox", "Selecionar 0002"));
    fireEvent.click(primeiro("button", "Movimentar selecionados (2)"));

    const painel = await screen.findByRole("dialog");
    expect((within(painel).getByLabelText("Sítio de destino") as HTMLSelectElement).value).toBe("1");
    fireEvent.click(within(painel).getByRole("button", { name: "Movimentar" }));
    await waitFor(() => expect(movimentarAnimais).toHaveBeenCalledWith({ animalIds: ["a1", "a2"], propriedadeId: 1, loteId: null, data: expect.any(String), motivo: null }));
  });

  it("'Trazer animais' seleciona um animal de outro lote e move para este lote", async () => {
    vi.mocked(movimentarAnimais).mockResolvedValue({ movimentacaoId: "mov-novo", movidos: 1 });
    await montar();
    fireEvent.click(primeiro("button", /Trazer animais/));

    await screen.findAllByText("0003");
    fireEvent.click(primeiro("checkbox", "Selecionar 0003"));
    fireEvent.click(primeiro("button", "Continuar (1)"));

    const painel = await screen.findByRole("dialog");
    expect(within(painel).getByText(/Lote 1/)).toBeTruthy();
    fireEvent.click(within(painel).getByRole("button", { name: "Movimentar" }));
    await waitFor(() => expect(movimentarAnimais).toHaveBeenCalledWith({ animalIds: ["a3"], propriedadeId: 1, loteId: "lote-1", data: expect.any(String), motivo: null }));
  });
});

describe("DetalheLote — histórico e desfazer", () => {
  it("mostra o erro 409 do servidor ao tentar desfazer uma movimentação bloqueada", async () => {
    vi.mocked(listarMovimentacoesDoLote).mockResolvedValue({ itens: [movimentacaoBase], total: 1 });
    vi.mocked(desfazerMovimentacao).mockRejectedValueOnce(new RebanhoApiError("Nada foi desfeito. B401: o animal já foi movimentado de novo", 409, "CONFLITO"));
    await montar();
    fireEvent.click(await screen.findByRole("button", { name: "Desfazer" }));
    const modal = await screen.findByRole("dialog");
    fireEvent.change(within(modal).getByLabelText("Motivo"), { target: { value: "Motivo do estorno" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Desfazer movimentação" }));
    expect(await screen.findByText("Nada foi desfeito. B401: o animal já foi movimentado de novo")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("desfazer com sucesso fecha o modal e recarrega o histórico", async () => {
    vi.mocked(listarMovimentacoesDoLote).mockResolvedValueOnce({ itens: [movimentacaoBase], total: 1 });
    vi.mocked(desfazerMovimentacao).mockResolvedValue({ desfeitos: 2 });
    await montar();
    fireEvent.click(await screen.findByRole("button", { name: "Desfazer" }));
    const modal = await screen.findByRole("dialog");
    vi.mocked(listarMovimentacoesDoLote).mockResolvedValueOnce({ itens: [{ ...movimentacaoBase, desfeitaEm: "2026-01-11", desfeitaMotivo: "Motivo do estorno" }], total: 1 });
    fireEvent.change(within(modal).getByLabelText("Motivo"), { target: { value: "Motivo do estorno" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Desfazer movimentação" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(listarMovimentacoesDoLote).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Desfeita em/)).toBeTruthy();
  });
});
