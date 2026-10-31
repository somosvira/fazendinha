// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HistoricoSanitario } from "./HistoricoSanitario";
import { reqSanidade } from "./api";
vi.mock("./api", () => ({ reqSanidade: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  window.history.replaceState(null, "", "/");
  localStorage.clear();
});
it("separa histórico da agenda e mantém ações no cabeçalho recolhível", async () => {
  vi.mocked(reqSanidade).mockResolvedValue([]);
  const novo = vi.fn();
  const { container } = render(
    <HistoricoSanitario animalId="animal-1" onNovoFato={novo} />,
  );
  await screen.findByText("Nenhum histórico sanitário registrado.");
  expect(container.querySelector("details")).toBeNull();
  expect(
    vi
      .mocked(reqSanidade)
      .mock.calls.some(([rota]) => rota.startsWith("/tarefas")),
  ).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Nova ocorrência" }));
  expect(novo).toHaveBeenCalledWith("ocorrencia");
  fireEvent.click(screen.getByRole("button", { name: "Histórico sanitário" }));
  expect(screen.queryByRole("button", { name: "Nova ocorrência" })).toBeNull();
});
it("abre o fato real com sítio e apresenta situação da ocorrência", async () => {
  vi.mocked(reqSanidade).mockImplementation(async (rota) =>
    rota.startsWith("/ocorrencias")
      ? [
          {
            id: "o1",
            propriedadeId: 7,
            inicio: "2026-10-01",
            fim: null,
            status: "VALIDO",
            doenca: { nome: "Mastite" },
          },
        ]
      : [],
  );
  const abrir = vi.fn();
  render(<HistoricoSanitario animalId="animal-1" abrir={abrir} />);
  await screen.findByText("Mastite");
  expect(screen.getByText(/- Aberta/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Detalhes" }));
  expect(abrir).toHaveBeenCalledWith("ocorrencia", "o1", 7);
});
it("busca em todas as páginas carregadas antes de paginar a apresentação", async () => {
  vi.mocked(reqSanidade).mockImplementation(async (rota) => {
    if (rota.startsWith("/exames")) return [];
    const pagina = new URL(rota, "http://local").searchParams.get("pagina");
    return pagina === "1"
      ? Array.from({ length: 50 }, (_, i) => ({
          id: `o${i}`,
          inicio: "2026-10-01",
          doenca: { nome: `Doença ${i}` },
        }))
      : [
          {
            id: "zz-alvo",
            inicio: "2026-10-01",
            doenca: { nome: "Último diagnóstico" },
          },
        ];
  });
  render(<HistoricoSanitario animalId="animal-1" />);
  await screen.findByText("Doença 0");
  expect(screen.queryByText("Último diagnóstico")).toBeNull();
  fireEvent.change(
    screen.getByRole("textbox", { name: "Buscar histórico sanitário" }),
    { target: { value: "ultimo diagnostico" } },
  );
  expect(await screen.findByText("Último diagnóstico")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tabela" }));
  expect(screen.getByRole("table")).toBeTruthy();
  expect(screen.getByText("Último diagnóstico")).toBeTruthy();
});
it("não publica histórico parcial quando uma consulta falha e permite repetir", async () => {
  vi.mocked(reqSanidade).mockRejectedValue(new Error("Falha na consulta"));
  render(<HistoricoSanitario animalId="animal-1" />);
  await screen.findByText("Falha na consulta");
  vi.mocked(reqSanidade).mockResolvedValue([]);
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await screen.findByText("Nenhum histórico sanitário registrado.");
  expect(screen.queryByText("Falha na consulta")).toBeNull();
});
