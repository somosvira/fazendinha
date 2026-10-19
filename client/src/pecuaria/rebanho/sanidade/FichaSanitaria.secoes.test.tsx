// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RodadasAnimal } from "./RodadasAnimal";
import { HistoricoSanitario } from "./HistoricoSanitario";
vi.mock("./api", () => ({ reqSanidade: vi.fn().mockResolvedValue([]) }));
vi.mock("./rodadas-api", () => ({ listarRodadas: vi.fn().mockResolvedValue({ itens: [{ id: "rodada 1", nome: "Calendário anual", inicioReferencia: "2026-09-10", protocolo: { nome: "Vacinação", versao: 1 }, contagens: { realizadas: 2, pendentes: 6, dispensadas: 1 } }], total: 1, pagina: 1, porPagina: 20 }) }));
afterEach(cleanup);
it("separa título de protocolo e navegação, preservando filtros do animal", async () => {
  render(<RodadasAnimal animalId="animal 1" revisao={0} />);
  const link = await screen.findByRole("link", { name: "Ver protocolo" });
  expect(link.getAttribute("href")).toContain("rodadaId=rodada%201&animalId=animal%201");
  const titulo = screen.getByRole("heading", { name: "Calendário anual · Vacinação · v1" });
  expect(titulo.querySelector("a,button")).toBeNull();
  expect(screen.queryByText("Participações em ciclos")).toBeNull();
  const recolher = screen.getByRole("button", { name: "Protocolos sanitários do animal" });
  fireEvent.click(recolher);
  expect(recolher.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("link", { name: "Ver protocolo" })).toBeNull();
});
it("mostra cabeçalhos recolhíveis completos para ocorrências, exames e agenda", async () => {
  const { container } = render(<HistoricoSanitario animalId="animal 1" />);
  await screen.findByRole("button", { name: /Ocorrências.*0 registros/ });
  for (const nome of [/Ocorrências.*0 registros/, /Exames.*0 registros/, /Agenda.*0 tarefas/]) {
    expect(screen.getByRole("button", { name: nome }).hasAttribute("aria-controls")).toBe(true);
  }
  expect(container.querySelector("summary")).toBeNull();
  const link = screen.getByRole("link", { name: "Abrir sanidade completa" });
  expect(link.getAttribute("href")).toContain("animalId=animal+1");
  const exames = screen.getByRole("button", { name: /Exames.*0 registros/ });
  expect(exames.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(exames);
  expect(screen.getByText("Nenhum exame registrado.")).toBeTruthy();
});
