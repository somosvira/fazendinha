// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { consultarLeite } from "./operacoes-api";
import { QualidadeAnimalLeite } from "./QualidadeAnimalLeite";
import { HistoricoProdutivoLeite } from "./HistoricoProdutivoLeite";
vi.mock("./operacoes-api", () => ({ consultarLeite: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("consulta só amostras do animal e preserva zero, falso e unidades do laudo", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({
    total: 1,
    tamanho: 20,
    pagina: 1,
    itens: [
      {
        id: "a",
        data: "2026-10-10",
        dataResultadoLaboratorial: "2026-10-15",
        dataRecebimentoLaudo: "2026-10-16",
        criadoEm: "2026-10-23T12:00:00Z",
        formatoSnapshot: {
          nome: "Controle",
          campos: [
            { codigo: "GORDURA", rotulo: "Gordura", unidade: "%" },
            { codigo: "PRESENCA", rotulo: "Presença" },
          ],
        },
        resultados: [
          { campo: "GORDURA", valor: 0 },
          { campo: "PRESENCA", valor: false },
        ],
        versao: 1,
        status: "VALIDO",
      },
    ],
  });
  render(<QualidadeAnimalLeite animalId="vaca-1" propriedadeId={2} />);
  await screen.findByText("Gordura");
  expect(screen.getByText("0 %")).toBeTruthy();
  expect(screen.getByText("Não")).toBeTruthy();
  expect(screen.getByText("Resultado laboratorial: 15/10/2026")).toBeTruthy();
  expect(screen.getByText("Recebimento do laudo: 16/10/2026")).toBeTruthy();
  expect(screen.getByText(/Cadastro da amostra: 23\/10\/2026/)).toBeTruthy();
  const [url, sitio] = vi.mocked(consultarLeite).mock.calls[0];
  expect(url).toContain("animalId=vaca-1");
  expect(url).toContain("sujeito=ANIMAL");
  expect(sitio).toBe(2);
});
it("sem sítio não consulta nem mistura amostras coletivas", async () => {
  render(<QualidadeAnimalLeite animalId="vaca-1" propriedadeId={null} />);
  await waitFor(() => expect(consultarLeite).not.toHaveBeenCalled());
  expect(screen.getByText(/Selecione o sítio autorizado/)).toBeTruthy();
});
it("falha de consulta não é apresentada como ausência de exames", async () => {
  vi.mocked(consultarLeite).mockRejectedValue(new Error("Falha ao consultar"));
  render(<QualidadeAnimalLeite animalId="vaca-1" propriedadeId={2} />);
  await screen.findByRole("alert");
  expect(screen.queryByText(/Nenhuma análise/)).toBeNull();
});
it("preserva o recorte ao recolher a qualidade e um único estado vazio sem paginação inútil", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({ total: 0, tamanho: 20, pagina: 1, itens: [] });
  const { container } = render(<QualidadeAnimalLeite animalId="vaca-1" propriedadeId={2} />);
  await screen.findByText("Nenhuma análise individual registrada neste recorte.");
  expect(screen.getByRole("region", { name: "Qualidade individual do leite" })).toBeTruthy();
  const recolher = screen.getByRole("button", { name: "Qualidade individual do leite" });
  const conteudo = container.querySelector("#qualidade-individual-leite-conteudo")!;
  fireEvent.click(recolher);
  expect(conteudo.hasAttribute("hidden")).toBe(true);
  expect(conteudo.textContent).toContain("Nenhuma análise individual registrada neste recorte.");
  fireEvent.click(recolher);
  expect(conteudo.hasAttribute("hidden")).toBe(false);
  expect(container.querySelector("details")).toBeNull();
  expect(screen.queryByText("0 amostra(s) no período e sítio consultados.")).toBeNull();
  expect(screen.queryByRole("button", { name: "Próximas análises" })).toBeNull();
});

it("altera o período de qualidade sem consultar novamente a produção", async () => {
  vi.mocked(consultarLeite).mockImplementation((url) => url.startsWith("/animais/")
    ? new Promise(() => {})
    : Promise.resolve({ total: 0, tamanho: 20, pagina: 1, itens: [] }));
  render(<><HistoricoProdutivoLeite animalId="vaca-1" propriedadeId={2} /><QualidadeAnimalLeite animalId="vaca-1" propriedadeId={2} /></>);
  await screen.findByText("Nenhuma análise individual registrada neste recorte.");
  const producaoAntes = vi.mocked(consultarLeite).mock.calls.filter(([url]) => url.startsWith("/animais/")).length;
  fireEvent.click(screen.getByRole("button", { name: /Período das amostras/ }));
  fireEvent.click(screen.getByRole("button", { name: "Todo o período" }));
  await waitFor(() => expect(vi.mocked(consultarLeite).mock.calls.filter(([url]) => url.startsWith("/qualidade/")).length).toBe(2));
  expect(vi.mocked(consultarLeite).mock.calls.filter(([url]) => url.startsWith("/animais/")).length).toBe(producaoAntes);
  expect(vi.mocked(consultarLeite).mock.calls.at(-1)?.[0]).not.toContain("fim=");
});
