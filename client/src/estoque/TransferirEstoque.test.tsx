// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { uid } from "../lib/uid.fixture";
import { TransferirEstoque } from "./TransferirEstoque";
import { listarProdutos } from "./api";
import { listarPartidasNutricionais } from "../pecuaria/rebanho/nutricao/api";
vi.mock("./api", () => ({ listarProdutos: vi.fn().mockResolvedValue([{ id: uid(1), nome: "Vacina", unidade: "ML", rastrearPartidas: false }]) }));
vi.mock("../api/propriedades", () => ({ listarPropriedades: vi.fn().mockResolvedValue([{ id: 3, nome: "Rio Novo" }, { id: 4, nome: "Serra" }]) }));
vi.mock("../pecuaria/rebanho/nutricao/api", () => ({ listarPartidasNutricionais: vi.fn().mockResolvedValue([]) }));
vi.mock("../propriedadeScope", () => ({ getPropriedadeAtiva: () => 3, comPropriedade: (headers: unknown) => headers }));
const fetchMock = vi.fn();
beforeEach(() => { vi.stubGlobal("fetch", fetchMock); fetchMock.mockResolvedValue({ ok: true, json: async () => ({ operacaoId: uid(2) }) }); });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
async function preparar() {
  const onSalvo = vi.fn();
  render(<TransferirEstoque perda onSalvo={onSalvo} onFechar={vi.fn()} />);
  await screen.findByRole("option", { name: "Vacina" });
  fireEvent.change(screen.getByLabelText("Produto"), { target: { value: uid(1) } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Quantidade (mL)" }), { target: { value: "2" } });
  return onSalvo;
}
describe("perda de estoque", () => {
  it("mostra data antes de sítios, Produto, quantidade e seleção de lotes", async () => {
    await preparar();
    const data = screen.getByLabelText("Data");
    for (const rotulo of ["Sítio de origem", "Produto", "Quantidade (mL)"]) expect(data.compareDocumentPosition(screen.getByLabelText(rotulo)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it("troca de origem não aplica resposta antiga e exige seleção dos lotes do novo sítio", async () => {
    vi.mocked(listarProdutos).mockResolvedValueOnce([{ id: uid(1), nome: "Vacina", unidade: "ML", rastrearPartidas: true }]);
    let liberar!: (dados: Awaited<ReturnType<typeof listarPartidasNutricionais>>) => void;
    vi.mocked(listarPartidasNutricionais).mockImplementationOnce(() => new Promise((resolve) => { liberar = resolve; })).mockResolvedValueOnce([{ id: uid(12), codigo: "SERRA", nome: "Lote Serra", saldo: "5", validade: "2026-12-31" }] as Awaited<ReturnType<typeof listarPartidasNutricionais>>);
    const onSalvo = await preparar();
    fireEvent.change(screen.getByLabelText("Sítio de origem"), { target: { value: "4" } });
    await screen.findByRole("option", { name: /Lote Serra/ });
    await act(async () => { liberar([{ id: uid(11), codigo: "RIO", nome: "Lote Rio", saldo: "10", validade: "2026-12-31" }] as Awaited<ReturnType<typeof listarPartidasNutricionais>>); });
    expect(screen.queryByRole("option", { name: /Lote Rio/ })).toBeNull();
    expect((screen.getByLabelText("Lote 1") as HTMLSelectElement).value).toBe("");
    fireEvent.change(screen.getByLabelText("Motivo da perda"), { target: { value: "Embalagem danificada" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar perda" }));
    expect(fetchMock).not.toHaveBeenCalled(); expect(onSalvo).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Lote 1"), { target: { value: uid(12) } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar perda" }));
    await waitFor(() => expect(onSalvo).toHaveBeenCalledOnce());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ origemId: 4, partidas: [{ partidaId: uid(12), quantidade: 2 }] });
    expect(vi.mocked(listarPartidasNutricionais).mock.calls.map((c) => c.slice(0, 2))).toEqual([[uid(1), 3], [uid(1), 4]]);
  });
  it.each(["", "  ", " abcd ", "x".repeat(201)])("destaca motivo inválido %s, foca e conserva os campos", async (motivo) => {
    await preparar();
    const campo = screen.getByLabelText("Motivo da perda");
    fireEvent.change(campo, { target: { value: motivo } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar perda" }));
    expect(screen.getByRole("alert").textContent).toMatch(/motivo da perda/);
    expect(document.activeElement).toBe(campo);
    expect(campo.getAttribute("aria-invalid")).toBe("true");
    expect((screen.getByLabelText("Quantidade (mL)") as HTMLInputElement).value).toBe("2");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("envia motivo sem espaços e comunica sucesso", async () => {
    const onSalvo = await preparar();
    fireEvent.change(screen.getByLabelText("Motivo da perda"), { target: { value: "  Embalagem danificada  " } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar perda" }));
    await waitFor(() => expect(onSalvo).toHaveBeenCalledOnce());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ produtoId: uid(1), origemId: 3, quantidade: "2", motivo: "Embalagem danificada" });
  });
  it("erro de motivo retornado pela API permanece junto ao campo", async () => {
    await preparar();
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "Revise o motivo da perda", campo: "motivo" }) });
    fireEvent.change(screen.getByLabelText("Motivo da perda"), { target: { value: "Embalagem danificada" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar perda" }));
    expect(await screen.findByText("Revise o motivo da perda")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Motivo da perda"));
  });
  it("bloqueia campos e confirmação durante envio, preservando chave após erro para reenvio", async () => {
    const onSalvo = await preparar();
    let liberar!: (resposta: unknown) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { liberar = resolve; }));
    fireEvent.change(screen.getByLabelText("Motivo da perda"), { target: { value: "Embalagem danificada" } });
    const confirmar = screen.getByRole("button", { name: "Confirmar perda" }) as HTMLButtonElement;
    fireEvent.click(confirmar);
    expect(confirmar.disabled).toBe(true);
    expect(screen.getByLabelText("Motivo da perda").closest("fieldset")?.disabled).toBe(true);
    fireEvent.click(confirmar);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    liberar({ ok: false, json: async () => ({ error: "Tente reenviar a perda" }) });
    await screen.findByText("Tente reenviar a perda");
    expect(confirmar.disabled).toBe(false);
    fireEvent.click(confirmar);
    await waitFor(() => expect(onSalvo).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(JSON.parse(fetchMock.mock.calls[1][1].body));
  });
});
