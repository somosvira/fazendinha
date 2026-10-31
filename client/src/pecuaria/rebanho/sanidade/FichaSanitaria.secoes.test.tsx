// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RodadasAnimal } from "./RodadasAnimal";
import { HistoricoSanitario } from "./HistoricoSanitario";
import { listarRodadas } from "./rodadas-api";
vi.mock("./api", () => ({ reqSanidade: vi.fn().mockResolvedValue([]) }));
vi.mock("./rodadas-api", () => ({ listarRodadas: vi.fn().mockResolvedValue({ itens: [{ id: "rodada 1", nome: "Calendário anual", inicioReferencia: "2026-09-10", protocolo: { nome: "Vacinação", versao: 1 }, contagens: { realizadas: 2, pendentes: 6, dispensadas: 1 } }], total: 1, pagina: 1, porPagina: 20 }) }));
vi.mock("../protocolos/api", () => ({ reqProtocolo: vi.fn().mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 10 }), consultaProtocolo: () => "", obterCabecalhoProtocolo: vi.fn() }));
afterEach(cleanup);
it("separa título de protocolo e navegação, preservando filtros do animal", async () => {
  render(<RodadasAnimal animalId="animal 1" revisao={0} />);
  const link = await screen.findByRole("link", { name: "Ver protocolo" });
  expect(link.getAttribute("href")).toContain("rodadaId=rodada%201&animalId=animal%201");
  const titulo = screen.getByRole("heading", { name: "Calendário anual · Vacinação · v1" });
  expect(titulo.querySelector("a,button")).toBeNull();
  expect(screen.queryByText("Participações em ciclos")).toBeNull();
  expect(screen.getByRole("button", { name: "Protocolos sanitários" }).getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByRole("heading", { name: "Protocolos sanitários" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Ver protocolo" })).toBeTruthy();
});
it("mantém histórico separado da agenda com cabeçalho padronizado", async () => {
  const { container } = render(<HistoricoSanitario animalId="animal 1" />);
  await screen.findByText("Nenhum histórico sanitário registrado.");
  expect(screen.getByRole("heading", { name: "Histórico sanitário" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Histórico sanitário" }).getAttribute("aria-expanded")).toBe("true");
  expect(screen.queryByRole("heading", { name: "Agenda sanitária" })).toBeNull();
  expect(container.querySelector("summary")).toBeNull();
  expect(container.querySelector(".ficha-geral-secao")).toBeTruthy();
});

it("reúne a ausência de protocolos e participações sem repetir títulos vazios", async () => {
  vi.mocked(listarRodadas).mockResolvedValueOnce({ itens: [], total: 0, pagina: 1, porPagina: 10 });
  render(<RodadasAnimal animalId="animal sem protocolos" revisao={0} />);
  await screen.findByText("Nenhum protocolo sanitário registrado para este animal");
  expect(screen.queryByText("Nenhuma participação individual registrada.")).toBeNull();
  expect(screen.queryByText("Nenhum protocolo sanitário para este animal.")).toBeNull();
  expect(screen.queryByRole("heading", { name: "Participações individuais" })).toBeNull();
  expect(screen.getByRole("heading", { name: "Protocolos sanitários" })).toBeTruthy();
});
