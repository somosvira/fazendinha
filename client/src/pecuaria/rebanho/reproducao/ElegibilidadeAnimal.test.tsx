// @vitest-environment jsdom
import { alterarControle } from "../../../lib/controles.fixture";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ElegibilidadeAnimal } from "./ElegibilidadeAnimal";
import { ConfiguracaoReprodutiva } from "./ConfiguracaoReprodutiva";
import {
  consultarElegibilidade,
  decidirElegibilidade,
  anularDecisao,
  type ElegibilidadeNaData,
  listarPoliticas,
  vincularPolitica,
} from "./elegibilidade-api";
import type { PainelReprodutivo } from "./api";
vi.mock("./elegibilidade-api", async (original) => ({
  ...(await original<typeof import("./elegibilidade-api")>()),
  consultarElegibilidade: vi.fn(),
  listarPoliticas: vi.fn().mockResolvedValue([]),
  criarPolitica: vi.fn(),
  vincularPolitica: vi.fn(),
  decidirElegibilidade: vi.fn(),
  anularDecisao: vi.fn(),
}));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-22T00:14:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.clearAllMocks();
});
const painel = {
  animais: [],
  tentativas: [],
  avaliacoes: [],
  partos: [],
  restricoes: [],
  situacoesIniciais: [],
} as PainelReprodutivo;
it("configuração inicia sem dias clínicos nem regras escolhidas", async () => {
  render(<ConfiguracaoReprodutiva propriedadeId={9} podeLancar={true} />);
  await waitFor(() => expect(listarPoliticas).toHaveBeenCalledWith(9));
  fireEvent.click(screen.getByRole("button", { name: "Nova versão da política" }));
  expect(
    (
      screen.getByLabelText(
        "PEV após primeiro parto (dias)",
      ) as HTMLInputElement
    ).value,
  ).toBe("");
  expect(
    (screen.getByLabelText("PEV após demais partos (dias)") as HTMLInputElement)
      .value,
  ).toBe("");
  expect(
    (screen.getByLabelText("Após aborto") as HTMLSelectElement).value,
  ).toBe("");
  expect(
    screen
      .getAllByRole("checkbox")
      .every((c) => !(c as HTMLInputElement).checked),
  ).toBe(true);
});

function elegibilidade(data: string, estado: "APTA" | "NAO_APTA" | "PENDENTE" = "PENDENTE"): ElegibilidadeNaData {
  return { animalId: "a", propriedadeId: 1, dataReferencia: data, situacaoReprodutiva: "VAZIA", aptidao: { estado, exameId: null, data: null, retornoEm: null, motivos: [] }, estado: "PENDENTE", baseElegivel: null, elegivel: null, aptaDesde: null, ciclo: null, vinculoCicloId: null, politicaId: null, politicaVersao: null, metodologia: "v1", decisaoId: null, motivos: [], alertas: [], restricaoIds: [] };
}
it("exibe os dois eixos sem decisão adicional nem vínculo automático", async () => {
  vi.mocked(consultarElegibilidade).mockImplementation(async (_a, _s, data) => elegibilidade(data, "APTA"));
  render(<ElegibilidadeAnimal animalId="a" propriedadeId={1} painel={painel} podeLancar/>);
  await screen.findByText("Apta");
  expect(screen.getByText("Vazia")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Registrar decisão" })).toBeNull();
  expect(decidirElegibilidade).not.toHaveBeenCalled(); expect(vincularPolitica).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Registrar exame de aptidão" }));
  expect(await screen.findByLabelText("Responsável pelo toque")).toBeTruthy();
});
it("consulta histórica não grava e leitura não oferece ações de escrita", async () => {
  vi.mocked(consultarElegibilidade).mockImplementation(async (_a, _s, data) => elegibilidade(data));
  render(<ElegibilidadeAnimal animalId="a" propriedadeId={1} painel={painel} podeLancar={false}/>);
  await screen.findByText("Pendente de avaliação");
  await alterarControle(screen.getByLabelText("Data de referência da aptidão"), { target: { value: "2020-05-02" } });
  await waitFor(() => expect(consultarElegibilidade).toHaveBeenLastCalledWith("a", 1, "2020-05-02"));
  expect(screen.queryByRole("button", { name: "Registrar exame de aptidão" })).toBeNull();
  expect(decidirElegibilidade).not.toHaveBeenCalled(); expect(vincularPolitica).not.toHaveBeenCalled();
});
it("ignora resposta antiga após atualização dos fatos, preservando o filtro", async () => {
  vi.mocked(consultarElegibilidade).mockImplementation(async (_a, _s, data) => elegibilidade(data, "APTA"));
  const { rerender } = render(<ElegibilidadeAnimal animalId="a" propriedadeId={1} painel={painel} podeLancar/>);
  await screen.findByText("Apta");
  let resolver!: (v: ElegibilidadeNaData) => void;
  vi.mocked(consultarElegibilidade).mockImplementationOnce(() => new Promise(resolve => { resolver = resolve; }));
  await alterarControle(screen.getByLabelText("Data de referência da aptidão"), { target: { value: "2026-01-02" } });
  vi.mocked(consultarElegibilidade).mockImplementation(async (_a, _s, data) => elegibilidade(data, "NAO_APTA"));
  rerender(<ElegibilidadeAnimal animalId="a" propriedadeId={1} painel={{ ...painel }} podeLancar/>);
  await screen.findByText("Não apta");
  await act(async () => resolver(elegibilidade("2026-01-02", "APTA")));
  expect(screen.queryByText("Apta")).toBeNull();
  expect(screen.getByLabelText("Data de referência da aptidão")).toHaveProperty("value", "02/01/2026");
});
it("preserva revisão de toque e permite encerrar bloqueio histórico com motivo", async () => {
  vi.mocked(consultarElegibilidade).mockImplementation(async (_a, _s, data) => ({ ...elegibilidade(data, "NAO_APTA"), vinculoCicloId: "v", aptidao: { estado: "NAO_APTA", exameId: "e", finalidadePrincipal: "APTIDAO_REPRODUTIVA", bloqueioAnteriorId: "b", data, retornoEm: null, motivos: [] } }));
  vi.mocked(decidirElegibilidade).mockResolvedValue({});
  render(<ElegibilidadeAnimal animalId="a" propriedadeId={1} painel={painel} podeLancar/>);
  await screen.findByText("Revisar exame de aptidão");
  fireEvent.click(screen.getByText("Revisar bloqueio anterior"));
  fireEvent.change(screen.getByLabelText("Motivo do encerramento"), { target: { value: "Tratamento encerrado e conferido" } });
  fireEvent.click(screen.getByRole("button", { name: "Encerrar bloqueio anterior" }));
  await waitFor(() => expect(decidirElegibilidade).toHaveBeenCalledWith({ vinculoCicloId: "v", tipo: "RETOMAR_POLITICA", aptaDesde: null, data: expect.any(String), propriedadeId: 1, motivo: "Tratamento encerrado e conferido", chave: expect.any(String) }));
});
