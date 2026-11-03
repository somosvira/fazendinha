// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AgendaSanitaria } from "./AgendaSanitaria";
import { reqSanidade } from "./api";
vi.mock("./api", () => ({ reqSanidade: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("mostra tarefas reais dentro da grade mensal e abre snapshot autorizado", async () => {
  const mes = new Date()
    .toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })
    .slice(0, 7);
  const tarefa = {
    id: "t1",
    previstaPara: `${mes}-15`,
    situacao: "PENDENTE",
    parametros: { tipo: "EXAME", tipoExameNomeSnapshot: "Exame registrado" },
    execucao: { propriedadeId: 7, protocolo: { nome: "Protocolo A" } },
  };
  vi.mocked(reqSanidade).mockResolvedValue({
    itens: [tarefa],
    total: 1,
    pagina: 1,
    porPagina: 50,
  });
  const abrir = vi.fn();
  const { container } = render(<AgendaSanitaria animalId="a1" abrir={abrir} />);
  const botao = await screen.findByRole("button", { name: /Exame registrado/ });
  expect(botao.closest("td")?.getAttribute("data-dia")).toBe(`${mes}-15`);
  fireEvent.click(botao);
  expect(abrir).toHaveBeenCalledWith("tarefa", "t1", 7, tarefa);
  expect(container.querySelectorAll("thead th")).toHaveLength(7);
  fireEvent.click(screen.getByRole("button", { name: "Lista" }));
  expect(screen.queryByRole("table")).toBeNull();
  expect(
    screen.getByRole("list", { name: "Tarefas sanitárias do mês" }),
  ).toBeTruthy();
  const antes = vi.mocked(reqSanidade).mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
  await screen
    .findByRole("button", { name: /Exame registrado/ })
    .catch(() => undefined);
  expect(vi.mocked(reqSanidade).mock.calls.length).toBeGreaterThan(antes);
});
it("preserva destino da agenda, animal e lote sem tarefas fictícias", async () => {
  vi.mocked(reqSanidade).mockResolvedValue({
    itens: [],
    total: 0,
    pagina: 1,
    porPagina: 50,
  });
  render(<AgendaSanitaria animalId="a1" loteId="l1" />);
  await screen.findByText("Nenhuma tarefa sanitária neste mês.");
  const destino = new URL(
    screen.getByRole("link", { name: "Ver agenda" }).getAttribute("href")!,
    "http://local",
  );
  expect(destino.searchParams.get("animalId")).toBe("a1");
  expect(destino.searchParams.get("loteId")).toBe("l1");
  expect(destino.searchParams.get("visaoAgenda")).toBe("tarefas");
});
