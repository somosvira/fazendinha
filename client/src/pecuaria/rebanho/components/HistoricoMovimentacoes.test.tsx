// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HistoricoMovimentacoes } from "./HistoricoMovimentacoes";
import { buscarMovimentacao, desfazerMovimentacao, RebanhoApiError } from "../api";
import type { MovimentacaoDetalhe, MovimentacaoResumo } from "../types";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  buscarMovimentacao: vi.fn(),
  desfazerMovimentacao: vi.fn(),
}));

function criarMovimentacao(overrides: Partial<MovimentacaoResumo>): MovimentacaoResumo {
  return {
    id: "mov-1", data: "2026-01-10", direcao: "ENTRADA", quantidade: 2, quantidadeTotal: 2,
    origens: ["Sede, Lote Antigo"], destino: { propriedade: { id: 1, nome: "Sede" }, lote: { id: "lote-1", nome: "Lote 1" } },
    motivo: "Reagrupamento", criadoPor: "Fulano", criadoEm: "2026-01-10T12:00:00Z", desfeitaEm: null, desfeitaMotivo: null, podeDesfazer: true,
    ...overrides,
  };
}

function criarDetalhe(overrides: Partial<MovimentacaoDetalhe> = {}): MovimentacaoDetalhe {
  return {
    id: "mov-1", data: "2026-01-10", direcao: "ENTRADA", quantidade: 2, quantidadeTotal: 2,
    origens: ["Sede, Lote Antigo"], destino: { propriedade: { id: 1, nome: "Sede" }, lote: { id: "lote-1", nome: "Lote 1" } },
    motivo: "Reagrupamento", criadoPor: "Fulano", criadoEm: "2026-01-10T12:00:00Z", desfeitaEm: null, desfeitaMotivo: null, podeDesfazer: true,
    animais: [
      { animalId: "a1", brinco: "0001", nome: null, categoria: { id: "cat-vaca", nome: "Vaca" }, origem: "Lote Antigo (Sede)", situacao: "NO_DESTINO", desfeitoEm: null },
      { animalId: "a2", brinco: "0002", nome: null, categoria: { id: "cat-crescimento", nome: "Em crescimento" }, origem: "Lote Antigo (Sede)", situacao: "NO_DESTINO", desfeitoEm: null },
    ],
    ...overrides,
  };
}

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buscarMovimentacao).mockResolvedValue(criarDetalhe());
});

describe("HistoricoMovimentacoes", () => {
  it("renderiza as linhas retornadas por carregar", async () => {
    const carregar = vi.fn().mockResolvedValue({ itens: [criarMovimentacao({ id: "mov-1" }), criarMovimentacao({ id: "mov-2", motivo: null, origens: [] })], total: 2 });
    render(<HistoricoMovimentacoes carregar={carregar} />);
    await waitFor(() => expect(carregar).toHaveBeenCalledWith(1));
    expect(await screen.findByText(/Reagrupamento/)).toBeTruthy();
    expect(screen.getByText(/Sede, Lote Antigo → Lote 1 \(Sede\)/)).toBeTruthy();
    expect(screen.getByText(/Origem não identificada/)).toBeTruthy();
  });

  it("mostra vazio quando não há movimentações", async () => {
    const carregar = vi.fn().mockResolvedValue({ itens: [], total: 0 });
    render(<HistoricoMovimentacoes carregar={carregar} />);
    expect(await screen.findByText("Nenhuma movimentação registrada.")).toBeTruthy();
  });

  it("mostrarDirecao exibe o selo Entrada/Saída", async () => {
    const carregar = vi.fn().mockResolvedValue({ itens: [criarMovimentacao({ direcao: "SAIDA" })], total: 1 });
    render(<HistoricoMovimentacoes carregar={carregar} mostrarDirecao />);
    expect(await screen.findByText("Saída")).toBeTruthy();
  });

  it("sem mostrarDirecao o selo Entrada/Saída não aparece", async () => {
    const carregar = vi.fn().mockResolvedValue({ itens: [criarMovimentacao({ direcao: "SAIDA" })], total: 1 });
    render(<HistoricoMovimentacoes carregar={carregar} />);
    await screen.findByText(/Reagrupamento/);
    expect(screen.queryByText("Saída")).toBeNull();
  });

  it("a paginação chama carregar com a próxima página", async () => {
    const carregar = vi.fn().mockResolvedValue({ itens: [criarMovimentacao({})], total: 50 });
    render(<HistoricoMovimentacoes carregar={carregar} />);
    await waitFor(() => expect(carregar).toHaveBeenCalledWith(1));
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() => expect(carregar).toHaveBeenCalledWith(2));
  });

  it("recarregarToken volta a paginação para a página 1", async () => {
    const carregar = vi.fn().mockResolvedValue({ itens: [criarMovimentacao({})], total: 50 });
    const { rerender } = render(<HistoricoMovimentacoes carregar={carregar} recarregarToken="a" />);
    await waitFor(() => expect(carregar).toHaveBeenCalledWith(1));
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() => expect(carregar).toHaveBeenCalledWith(2));

    rerender(<HistoricoMovimentacoes carregar={carregar} recarregarToken="b" />);
    await waitFor(() => expect(carregar).toHaveBeenLastCalledWith(1));
  });

  it("clicar numa linha chama onAbrir com a movimentação", async () => {
    const mov = criarMovimentacao({ id: "mov-9" });
    const carregar = vi.fn().mockResolvedValue({ itens: [mov], total: 1 });
    const onAbrir = vi.fn();
    render(<HistoricoMovimentacoes carregar={carregar} onAbrir={onAbrir} />);
    fireEvent.click(await screen.findByText(/Reagrupamento/));
    expect(onAbrir).toHaveBeenCalledWith(mov);
  });

  it("desfazer busca o detalhe e mostra os animais que voltam dentro do modal", async () => {
    const mov = criarMovimentacao({});
    const carregar = vi.fn().mockResolvedValue({ itens: [mov], total: 1 });
    render(<HistoricoMovimentacoes carregar={carregar} />);
    fireEvent.click(await screen.findByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(buscarMovimentacao).toHaveBeenCalledWith("mov-1"));
    const modal = await screen.findByRole("dialog", { name: "Desfazer movimentação?" });
    expect(await within(modal).findByText("0001")).toBeTruthy();
    expect(within(modal).getByText("0002")).toBeTruthy();
  });

  it("desfazer com erro 409 mostra a mensagem do servidor sem fechar o modal", async () => {
    const mov = criarMovimentacao({});
    const carregar = vi.fn().mockResolvedValue({ itens: [mov], total: 1 });
    vi.mocked(desfazerMovimentacao).mockRejectedValueOnce(new RebanhoApiError("Nada foi desfeito. B401: o animal já foi movimentado de novo", 409, "CONFLITO"));
    render(<HistoricoMovimentacoes carregar={carregar} />);
    fireEvent.click(await screen.findByRole("button", { name: "Desfazer" }));
    const modal = await screen.findByRole("dialog", { name: "Desfazer movimentação?" });
    await within(modal).findByText("0001");
    fireEvent.change(within(modal).getByLabelText("Motivo"), { target: { value: "Motivo do estorno" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Desfazer movimentação" }));
    expect(await screen.findByText("Nada foi desfeito. B401: o animal já foi movimentado de novo")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Desfazer movimentação?" })).toBeTruthy();
  });

  it("desfazer com sucesso fecha o modal e chama onMudou", async () => {
    const mov = criarMovimentacao({});
    const carregar = vi.fn().mockResolvedValue({ itens: [mov], total: 1 });
    vi.mocked(desfazerMovimentacao).mockResolvedValue({ desfeitos: 2 });
    const onMudou = vi.fn();
    render(<HistoricoMovimentacoes carregar={carregar} onMudou={onMudou} />);
    fireEvent.click(await screen.findByRole("button", { name: "Desfazer" }));
    const modal = await screen.findByRole("dialog", { name: "Desfazer movimentação?" });
    await within(modal).findByText("0001");
    fireEvent.change(within(modal).getByLabelText("Motivo"), { target: { value: "Motivo do estorno" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Desfazer movimentação" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onMudou).toHaveBeenCalledTimes(1);
  });

  it("sem podeLancar não mostra o botão Desfazer", async () => {
    const carregar = vi.fn().mockResolvedValue({ itens: [criarMovimentacao({})], total: 1 });
    render(<HistoricoMovimentacoes carregar={carregar} podeLancar={false} />);
    await screen.findByText(/Reagrupamento/);
    expect(screen.queryByRole("button", { name: "Desfazer" })).toBeNull();
  });
});
