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
