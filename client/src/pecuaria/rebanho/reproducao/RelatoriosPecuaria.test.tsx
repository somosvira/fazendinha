// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RelatoriosPecuaria } from "./RelatoriosPecuaria";
import { reqV4 } from "./api";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
vi.mock("./api", () => ({ reqV4: vi.fn().mockResolvedValue([]) }));
beforeEach(() => { vi.clearAllMocks(); setPropriedadeAtiva(7); window.history.replaceState(null, "", "/pecuaria/relatorios"); });
afterEach(() => { cleanup(); setPropriedadeAtiva(null); });
it("reaproveita emissões dos dois tipos no sítio e navega pelo histórico sem consulta automática", async () => {
  render(<RelatoriosPecuaria podeLancar={false}/>);
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/relatorios/emissoes?tipo=PARTOS&propriedadeId=7", undefined, "GET", 7));
  expect(screen.getByLabelText("Início (inclusive)")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Indicadores reprodutivos" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/relatorios/emissoes?tipo=INDICADORES&propriedadeId=7", undefined, "GET", 7));
  expect(window.location.search).toBe("?tipo=indicadores");
  expect(screen.getByLabelText("Emissões preservadas")).toBeTruthy();
  expect(vi.mocked(reqV4).mock.calls.some(([p]) => p.includes("/indicadores?"))).toBe(false);
  expect(vi.mocked(reqV4).mock.calls.every(([, body]) => body === undefined)).toBe(true);
  window.history.pushState(null, "", "/pecuaria/relatorios?tipo=partos"); fireEvent(window, new PopStateEvent("popstate"));
  await screen.findByLabelText("Início (inclusive)");
});
