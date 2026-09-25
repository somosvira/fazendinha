// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ConfirmarDesfazerMovimentacao } from "./ConfirmarDesfazerMovimentacao";
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
    id: "mov-1", data: "2026-01-10", direcao: "ENTRADA", quantidade: 3, quantidadeTotal: 3,
    origens: ["Sede, Lote Antigo"], destino: { propriedade: { id: 1, nome: "Sede" }, lote: { id: "lote-1", nome: "Lote 1" } },
    motivo: "Reagrupamento", criadoPor: "Fulano", criadoEm: "2026-01-10T12:00:00Z", desfeitaEm: null, desfeitaMotivo: null, podeDesfazer: true,
    animais: [
      { animalId: "a1", brinco: "0001", nome: "Mimosa", categoria: { id: "cat-vaca", nome: "Vaca" }, origem: "Lote Antigo (Sede)", situacao: "NO_DESTINO", desfeitoEm: null },
      { animalId: "a2", brinco: "0002", nome: null, categoria: { id: "cat-crescimento", nome: "Em crescimento" }, origem: "Sede, sem lote", situacao: "NO_DESTINO", desfeitoEm: null },
      { animalId: "a3", brinco: "0003", nome: null, categoria: { id: "cat-crescimento-m", nome: "Em crescimento" }, origem: "Lote Antigo (Sede)", situacao: "DESFEITO", desfeitoEm: "2026-01-11" },
    ],
    ...overrides,
  };
}

afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); });

describe("ConfirmarDesfazerMovimentacao", () => {
  it("busca o detalhe quando não recebe `detalhe` e lista os animais que voltam com a origem de cada um", async () => {
    vi.mocked(buscarMovimentacao).mockResolvedValue(criarDetalhe());
    render(<ConfirmarDesfazerMovimentacao movimentacaoId="mov-1" onConfirmado={vi.fn()} onFechar={vi.fn()} />);
    await waitFor(() => expect(buscarMovimentacao).toHaveBeenCalledWith("mov-1"));
    expect(await screen.findByText("0001")).toBeTruthy();
    expect(screen.getByText("Lote Antigo (Sede)")).toBeTruthy();
    expect(screen.getByText("Sede, sem lote")).toBeTruthy();
    expect(screen.getByText(/2 animais saem de Lote 1 \(Sede\) e voltam para onde estavam em 10\/01\/2026/)).toBeTruthy();
  });

  it("usa o `detalhe` recebido sem buscar de novo", async () => {
    render(<ConfirmarDesfazerMovimentacao movimentacaoId="mov-1" detalhe={criarDetalhe()} onConfirmado={vi.fn()} onFechar={vi.fn()} />);
    expect(await screen.findByText("0001")).toBeTruthy();
    expect(buscarMovimentacao).not.toHaveBeenCalled();
  });

  it("separa os animais já desfeitos individualmente da tabela dos que voltam", async () => {
    render(<ConfirmarDesfazerMovimentacao movimentacaoId="mov-1" detalhe={criarDetalhe()} onConfirmado={vi.fn()} onFechar={vi.fn()} />);
    await screen.findByText("0001");
    expect(screen.queryByText("0003")).toBeNull();
    expect(screen.getByText(/Já desfeitos \(não mudam\): 0003/)).toBeTruthy();
  });

  it("sem nenhum animal já desfeito não mostra a lista de já desfeitos", async () => {
    render(<ConfirmarDesfazerMovimentacao movimentacaoId="mov-1" detalhe={criarDetalhe({ animais: criarDetalhe().animais.filter((a) => a.situacao !== "DESFEITO") })} onConfirmado={vi.fn()} onFechar={vi.fn()} />);
    await screen.findByText("0001");
    expect(screen.queryByText(/Já desfeitos/)).toBeNull();
  });

  it("clicar no brinco navega para a ficha do animal e fecha o modal", async () => {
    const onFechar = vi.fn();
    render(<ConfirmarDesfazerMovimentacao movimentacaoId="mov-1" detalhe={criarDetalhe()} onConfirmado={vi.fn()} onFechar={onFechar} />);
    fireEvent.click(await screen.findByText("0001"));
    expect(navegarPara).toHaveBeenCalledWith("/pecuaria/rebanho/animais/a1");
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it("confirmar envia o motivo e chama onConfirmado", async () => {
    vi.mocked(desfazerMovimentacao).mockResolvedValue({ desfeitos: 2 });
    const onConfirmado = vi.fn();
    render(<ConfirmarDesfazerMovimentacao movimentacaoId="mov-1" detalhe={criarDetalhe()} onConfirmado={onConfirmado} onFechar={vi.fn()} />);
    await screen.findByText("0001");
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Motivo do estorno" } });
    fireEvent.click(screen.getByRole("button", { name: "Desfazer movimentação" }));
    await waitFor(() => expect(desfazerMovimentacao).toHaveBeenCalledWith("mov-1", "Motivo do estorno"));
    await waitFor(() => expect(onConfirmado).toHaveBeenCalledTimes(1));
  });

  it("erro 409 do servidor aparece na modal sem fechar", async () => {
    vi.mocked(desfazerMovimentacao).mockRejectedValueOnce(new RebanhoApiError("Nada foi desfeito. B401: o animal já foi movimentado de novo", 409, "CONFLITO"));
    const onConfirmado = vi.fn();
    render(<ConfirmarDesfazerMovimentacao movimentacaoId="mov-1" detalhe={criarDetalhe()} onConfirmado={onConfirmado} onFechar={vi.fn()} />);
    await screen.findByText("0001");
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Motivo do estorno" } });
    fireEvent.click(screen.getByRole("button", { name: "Desfazer movimentação" }));
    expect(await screen.findByText("Nada foi desfeito. B401: o animal já foi movimentado de novo")).toBeTruthy();
    expect(onConfirmado).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("mostra Loader e desabilita o botão de confirmar enquanto carrega o detalhe", async () => {
    let resolver!: (v: MovimentacaoDetalhe) => void;
    vi.mocked(buscarMovimentacao).mockReturnValue(new Promise((r) => { resolver = r; }));
    render(<ConfirmarDesfazerMovimentacao movimentacaoId="mov-1" onConfirmado={vi.fn()} onFechar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Motivo válido" } });
    expect((screen.getByRole("button", { name: "Salvando…" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Carregando movimentação")).toBeTruthy();
    resolver(criarDetalhe());
    await screen.findByText("0001");
    expect((screen.getByRole("button", { name: "Desfazer movimentação" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("erro ao carregar o detalhe mostra o ErrorBox", async () => {
    vi.mocked(buscarMovimentacao).mockRejectedValue(new RebanhoApiError("Movimentação não encontrada", 404, "NAO_ENCONTRADO"));
    render(<ConfirmarDesfazerMovimentacao movimentacaoId="mov-1" onConfirmado={vi.fn()} onFechar={vi.fn()} />);
    expect(await screen.findByText("Movimentação não encontrada")).toBeTruthy();
  });
});
