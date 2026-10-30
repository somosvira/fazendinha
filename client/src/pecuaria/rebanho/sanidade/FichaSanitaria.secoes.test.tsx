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
  expect(screen.queryByRole("button", { name: "Protocolos sanitários do animal" })).toBeNull();
  expect(screen.getByRole("heading", { name: "Protocolos sanitários do animal" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Ver protocolo" })).toBeTruthy();
});
it("mostra ocorrências, exames e agenda diretamente, sem acordeões", async () => {
  const { container } = render(<HistoricoSanitario animalId="animal 1" />);
  await screen.findByRole("heading", { name: /Ocorrências.*0 registros/ });
  for (const nome of [/Ocorrências.*0 registros/, /Exames.*0 registros/, /Agenda.*0 tarefas/]) {
    expect(screen.getByRole("heading", { name: nome })).toBeTruthy();
    expect(screen.queryByRole("button", { name: nome })).toBeNull();
  }
  expect(container.querySelector("summary")).toBeNull();
  const link = screen.getByRole("link", { name: "Abrir sanidade completa" });
  expect(link.getAttribute("href")).toContain("animalId=animal+1");
  expect(screen.getByText("Nenhum exame registrado.")).toBeTruthy();
});

it("reúne a ausência de protocolos e participações sem repetir títulos vazios", async () => {
  vi.mocked(listarRodadas).mockResolvedValueOnce({ itens: [], total: 0, pagina: 1, porPagina: 10 });
  render(<RodadasAnimal animalId="animal sem protocolos" revisao={0} />);
  await screen.findByText("Nenhuma participação ou protocolo sanitário registrado para este animal.");
  expect(screen.queryByText("Nenhuma participação individual registrada.")).toBeNull();
  expect(screen.queryByText("Nenhum protocolo sanitário para este animal.")).toBeNull();
  expect(screen.queryByRole("heading", { name: "Participações individuais" })).toBeNull();
  expect(screen.getByRole("heading", { name: "Protocolos sanitários do animal" })).toBeTruthy();
});
