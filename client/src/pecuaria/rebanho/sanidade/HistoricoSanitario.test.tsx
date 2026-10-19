// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HistoricoSanitario } from "./HistoricoSanitario";
import { reqSanidade } from "./api";
vi.mock("./api", () => ({ reqSanidade: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("mostra seções diretas e links canônicos preservando animal e lote", async () => {
  vi.mocked(reqSanidade).mockResolvedValue([]);
  const { container } = render(<HistoricoSanitario animalId="animal-1" loteId="lote-1" />);
  await screen.findByRole("heading", { name: /^Ocorrências/ });
  expect(container.querySelector("details")).toBeNull();
  expect(screen.queryByText("Até 10 registros")).toBeNull();
  expect(screen.getByRole("heading", { name: "Exames · 0 registros" })).toBeTruthy();
  expect(screen.getByText("Nenhuma ocorrência registrada para este animal.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Exames/ })).toBeNull();
  for (const [nome, aba] of [["Ver ocorrências", "ocorrencias"], ["Ver exames", "exames"], ["Ver agenda", "agenda"], ["Abrir sanidade completa", "agenda"]]) {
    const endereco = new URL(screen.getByRole("link", { name: nome }).getAttribute("href")!, "http://localhost");
    expect(endereco.pathname).toBe("/pecuaria/sanidade");
    expect(endereco.searchParams.get("animalId")).toBe("animal-1");
    expect(endereco.searchParams.get("loteId")).toBe("lote-1");
    expect(endereco.searchParams.get("aba")).toBe(aba);
    expect(endereco.searchParams.get("visaoAgenda")).toBe(aba === "agenda" ? "tarefas" : null);
  }
});
it("abre o fato e mantém consulta de dez registros sem inventar total", async () => {
  vi.mocked(reqSanidade).mockImplementation(async (rota) => rota.startsWith("/ocorrencias") ? [{ id: "o1", propriedadeId: 7, inicio: "2026-10-01", doenca: { nome: "Mastite" } }] : []);
  const abrir = vi.fn();
  render(<HistoricoSanitario animalId="animal-1" abrir={abrir} />);
  await screen.findByText("Mastite");
  fireEvent.click(screen.getByRole("button", { name: "Ver detalhes" }));
  expect(abrir).toHaveBeenCalledWith("ocorrencia", "o1", 7);
  expect(vi.mocked(reqSanidade).mock.calls.every(([rota]) => rota.includes("porPagina=10") && rota.includes("pagina=1"))).toBe(true);
});
it("permite tentar novamente e anuncia carregamento", async () => {
  vi.mocked(reqSanidade).mockRejectedValue(new Error("Falha na consulta"));
  render(<HistoricoSanitario animalId="animal-1" />);
  await screen.findByText("Falha na consulta");
  vi.mocked(reqSanidade).mockResolvedValue([]);
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await screen.findByText("Nenhuma ocorrência registrada para este animal.");
  expect(screen.queryByText("Falha na consulta")).toBeNull();
});

it("navega da agenda da ficha às tarefas sem recarregar o documento", async () => {
  vi.mocked(reqSanidade).mockResolvedValue([]);
  render(<HistoricoSanitario animalId="animal-1" loteId="lote-1" />);
  const link = await screen.findByRole("link", { name: "Ver agenda" });
  expect(fireEvent.click(link)).toBe(false);
  const destino = new URL(window.location.href);
  expect(destino.pathname).toBe("/pecuaria/sanidade");
  expect(destino.searchParams.get("visaoAgenda")).toBe("tarefas");
  expect(destino.searchParams.get("animalId")).toBe("animal-1");
  expect(destino.searchParams.get("loteId")).toBe("lote-1");
  window.history.replaceState(null, "", "/");
});
