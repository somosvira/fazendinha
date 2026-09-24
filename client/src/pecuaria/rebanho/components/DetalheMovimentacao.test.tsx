// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { DetalheMovimentacao } from "./DetalheMovimentacao";
import { buscarMovimentacao, desfazerMovimentacao, RebanhoApiError } from "../api";
import type { MovimentacaoDetalhe } from "../types";
import { navegarPara } from "../../../router";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  buscarMovimentacao: vi.fn(),
  desfazerMovimentacao: vi.fn(),
}));
vi.mock("../../../router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../router")>()),
  navegarPara: vi.fn(),
}));

function criarDetalhe(overrides: Partial<MovimentacaoDetalhe> = {}): MovimentacaoDetalhe {
  return {
    id: "mov-1", data: "2026-01-10", direcao: "ENTRADA", quantidade: 2, quantidadeTotal: 2,
    origens: ["Sede, Lote Antigo"], destino: { propriedade: { id: 1, nome: "Sede" }, lote: { id: "lote-1", nome: "Lote 1" } },
    motivo: "Reagrupamento", criadoPor: "Fulano", criadoEm: "2026-01-10T12:00:00Z", desfeitaEm: null, desfeitaMotivo: null, podeDesfazer: true,
    animais: [
      { animalId: "a1", brinco: "0001", nome: "Mimosa", categoria: { id: "cat-vaca", nome: "Vaca" }, origem: "Lote Antigo (Sede)", situacao: "NO_DESTINO", desfeitoEm: null },
      { animalId: "a2", brinco: "0002", nome: null, categoria: { id: "cat-crescimento", nome: "Em crescimento" }, origem: null, situacao: "SAIU_DO_DESTINO", desfeitoEm: null },
    ],
    ...overrides,
  };
}

afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); });

async function montar(props: Partial<{ podeLancar: boolean; onFechar: () => void; onMudou: () => void }> = {}) {
  const onFechar = props.onFechar ?? vi.fn();
  render(<DetalheMovimentacao id="mov-1" podeLancar={props.podeLancar} onFechar={onFechar} onMudou={props.onMudou} />);
  await screen.findByRole("heading", { name: "Movimentação" });
  return { onFechar };
}

describe("DetalheMovimentacao", () => {
  it("carrega e lista os animais da movimentação, mesmo com situações diferentes", async () => {
    vi.mocked(buscarMovimentacao).mockResolvedValue(criarDetalhe());
    await montar();
    expect(screen.getByText("0001 · Mimosa")).toBeTruthy();
    expect(screen.getByText("0002")).toBeTruthy();
    expect(screen.getByText("No destino")).toBeTruthy();
    expect(screen.getByText("Saiu do destino")).toBeTruthy();
    expect(screen.getByText(/Lote Antigo \(Sede\)/)).toBeTruthy();
  });

  it("uma movimentação desfeita continua listando os animais, marcados como Desfeito", async () => {
    vi.mocked(buscarMovimentacao).mockResolvedValue(criarDetalhe({
      desfeitaEm: "2026-01-11T00:00:00Z", desfeitaMotivo: "Engano no lote", podeDesfazer: false,
      animais: [{ animalId: "a1", brinco: "0001", nome: "Mimosa", categoria: { id: "cat-vaca", nome: "Vaca" }, origem: "Lote Antigo (Sede)", situacao: "DESFEITO", desfeitoEm: "2026-01-11T00:00:00Z" }],
    }));
    await montar();
    expect(screen.getByText("0001 · Mimosa")).toBeTruthy();
    expect(screen.getByText("Desfeito")).toBeTruthy();
    expect(screen.getByText(/Desfeita em/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Desfazer movimentação" })).toBeNull();
  });

  it("clicar no brinco de um animal fecha o painel e navega para a ficha dele", async () => {
    vi.mocked(buscarMovimentacao).mockResolvedValue(criarDetalhe());
    const { onFechar } = await montar();
    fireEvent.click(screen.getByText("0001 · Mimosa"));
    expect(navegarPara).toHaveBeenCalledWith("/pecuaria/rebanho/animais/a1");
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it("sem podeLancar não mostra a ação de desfazer", async () => {
    vi.mocked(buscarMovimentacao).mockResolvedValue(criarDetalhe());
    await montar({ podeLancar: false });
    expect(screen.queryByRole("button", { name: "Desfazer movimentação" })).toBeNull();
  });

  it("desfazer com sucesso recarrega o detalhe e chama onMudou", async () => {
    vi.mocked(buscarMovimentacao).mockResolvedValueOnce(criarDetalhe());
    vi.mocked(desfazerMovimentacao).mockResolvedValue({ desfeitos: 2 });
    const onMudou = vi.fn();
    await montar({ onMudou });

    fireEvent.click(screen.getByRole("button", { name: "Desfazer movimentação" }));
    const modal = await screen.findByRole("dialog", { name: "Desfazer movimentação?" });
    vi.mocked(buscarMovimentacao).mockResolvedValueOnce(criarDetalhe({ desfeitaEm: "2026-01-11", desfeitaMotivo: "Motivo do estorno", podeDesfazer: false }));
    fireEvent.change(within(modal).getByLabelText("Motivo"), { target: { value: "Motivo do estorno" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Desfazer movimentação" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Desfazer movimentação?" })).toBeNull());
    expect(onMudou).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Desfeita em/)).toBeTruthy();
  });

  it("desfazer com erro 409 mostra a mensagem do servidor", async () => {
    vi.mocked(buscarMovimentacao).mockResolvedValue(criarDetalhe());
    vi.mocked(desfazerMovimentacao).mockRejectedValueOnce(new RebanhoApiError("Nada foi desfeito. B401: o animal já foi movimentado de novo", 409, "CONFLITO"));
    await montar();

    fireEvent.click(screen.getByRole("button", { name: "Desfazer movimentação" }));
    const modal = await screen.findByRole("dialog", { name: "Desfazer movimentação?" });
    fireEvent.change(within(modal).getByLabelText("Motivo"), { target: { value: "Motivo do estorno" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Desfazer movimentação" }));

    expect(await screen.findByText("Nada foi desfeito. B401: o animal já foi movimentado de novo")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Desfazer movimentação?" })).toBeTruthy();
  });
});
