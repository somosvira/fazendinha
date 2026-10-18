// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RelatorioPartos, type SnapshotRelatorioPartos } from "./RelatorioPartos";
import { reqV4 } from "./api";

vi.mock("./api", () => ({ reqV4: vi.fn() }));
const snapshot: SnapshotRelatorioPartos = {
  versao: 1, emitidoEm: "2026-10-14T12:00:00Z", propriedadeId: 7,
  periodo: { inicio: "2026-09-01", fim: "2026-09-30" }, totalPartos: 0, partos: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(reqV4).mockImplementation(async (path, body) => path.includes("/partos?") ? snapshot
    : body ? { id: "emissao", criadoEm: "2026-10-14", snapshot } : []);
});
afterEach(cleanup);
function consultar() {
  fireEvent.change(screen.getByLabelText("Início (inclusive)"), { target: { value: "2026-09-01" } });
  fireEvent.change(screen.getByLabelText("Fim (inclusive)"), { target: { value: "2026-09-30" } });
  fireEvent.click(screen.getByRole("button", { name: "Consultar ficha de partos" }));
}
it("leitor consulta partos por GET com sítio explícito e não recebe ação de emissão", async () => {
  render(<RelatorioPartos propriedadeId={7} podeLancar={false} />);
  consultar();
  await screen.findByText("Nenhum parto válido neste período.");
  expect(reqV4).toHaveBeenCalledWith(
    "/reproducao/relatorios/partos?propriedadeId=7&inicio=2026-09-01&fim=2026-09-30", undefined, "GET", 7,
  );
  expect(screen.queryByRole("button", { name: "Salvar emissão deste período" })).toBeNull();
  expect(vi.mocked(reqV4).mock.calls.every(([, body]) => !body)).toBe(true);
});
it("salvar emissão é uma ação separada e reenvia a mesma chave após falha", async () => {
  let falhou = false;
  vi.mocked(reqV4).mockImplementation(async (path, body) => {
    if (path.includes("/partos?")) return snapshot;
    if (!body) return [];
    if (!falhou) { falhou = true; throw new Error("Resposta perdida"); }
    return { id: "emissao", criadoEm: "2026-10-14", snapshot };
  });
  render(<RelatorioPartos propriedadeId={7} podeLancar />);
  consultar();
  const salvar = await screen.findByRole("button", { name: "Salvar emissão deste período" });
  expect(vi.mocked(reqV4).mock.calls.filter(([, body]) => body)).toHaveLength(0);
  fireEvent.click(salvar);
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Salvar emissão deste período" }));
  await screen.findByText(/Emissão preservada: emissao/);
  const escritas = vi.mocked(reqV4).mock.calls.filter(([, body]) => body);
  expect(escritas).toHaveLength(2);
  expect(escritas[0]).toEqual(escritas[1]);
  expect(escritas[0]).toEqual(["/reproducao/relatorios/emissoes", expect.objectContaining({
    propriedadeId: 7, tipo: "PARTOS", filtros: snapshot.periodo,
  }), "POST", 7]);
});
it("resposta atrasada de outro sítio não aparece após trocar escopo", async () => {
  let resolver!: (v: SnapshotRelatorioPartos) => void;
  vi.mocked(reqV4).mockImplementation(async path => path.includes("/partos?")
    ? new Promise<SnapshotRelatorioPartos>(resolve => { resolver = resolve; }) : []);
  const { rerender } = render(<RelatorioPartos propriedadeId={7} podeLancar={false} />);
  consultar();
  await waitFor(() => expect(resolver).toBeTypeOf("function"));
  rerender(<RelatorioPartos propriedadeId={8} podeLancar={false} />);
  resolver(snapshot);
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith(expect.stringContaining("propriedadeId=8"), undefined, "GET", 8));
  expect(screen.queryByText("Nenhum parto válido neste período.")).toBeNull();
});
it("reabrir emissão reflete o período salvo nos filtros sem gravar ou recalcular", async () => {
  const salvo = { ...snapshot, periodo: { inicio: "2025-01-01", fim: "2025-12-31" } };
  vi.mocked(reqV4).mockImplementation(async path => path.includes("/emissoes/antiga") ? { id: "antiga", snapshot: salvo }
    : [{ id: "antiga", criadoEm: "2026-01-02T12:00:00Z" }]);
  render(<RelatorioPartos propriedadeId={7} podeLancar={false}/>);
  await screen.findByRole("option", { name: /02\/01\/2026/ });
  fireEvent.change(screen.getByLabelText("Emissões anteriores"), { target: { value: "antiga" } });
  await screen.findByText(/Emissão preservada: antiga/);
  expect(screen.getByLabelText("Início (inclusive)")).toHaveProperty("value", "2025-01-01");
  expect(screen.getByLabelText("Fim (inclusive)")).toHaveProperty("value", "2025-12-31");
  expect(vi.mocked(reqV4).mock.calls.some(([path, body]) => path.includes("/partos?") || body !== undefined)).toBe(false);
});
it("diferencia datas em edição do período preservado sem recalcular a emissão", async () => {
  vi.mocked(reqV4).mockImplementation(async path => path.includes("/emissoes/antiga") ? { id: "antiga", snapshot }
    : [{ id: "antiga", criadoEm: "2026-10-14T12:00:00Z" }]);
  render(<RelatorioPartos propriedadeId={7} podeLancar={false}/>);
  expect(screen.getByText(/O período inicial já está preenchido/)).toBeTruthy();
  await screen.findByRole("option", { name: /14\/10\/2026/ });
  fireEvent.change(screen.getByLabelText("Emissões anteriores"), { target: { value: "antiga" } });
  await screen.findByText(/Emissão preservada: antiga/);
  expect(screen.queryByText(/As datas editadas ainda/)).toBeNull();
  fireEvent.change(screen.getByLabelText("Início (inclusive)"), { target: { value: "2026-08-01" } });
  expect(screen.getByText(/As datas editadas ainda não foram consultadas/)).toBeTruthy();
  expect(screen.getByText(/Sítio 7 · 2026-09-01 a 2026-09-30. Impressão e CSV/)).toBeTruthy();
  expect(screen.getByText(/Emissão preservada: antiga/)).toBeTruthy();
  expect(vi.mocked(reqV4).mock.calls.some(([path, body]) => path.includes("/partos?") || body !== undefined)).toBe(false);
});
