// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
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
afterEach(() => {
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
it("consultar ciclo antigo não grava e vínculo exige revisão explícita da evidência", async () => {
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  vi.mocked(consultarElegibilidade).mockResolvedValue({
    animalId: "a",
    propriedadeId: 1,
    dataReferencia: hoje,
    estado: "PENDENTE",
    baseElegivel: null,
    elegivel: null,
    aptaDesde: null,
    ciclo: { chaveCiclo: "PARTO:p", inicioCiclo: "2026-01-01", partoId: "p" },
    vinculoCicloId: null,
    politicaId: null,
    politicaVersao: null,
    metodologia: "v1",
    decisaoId: null,
    motivos: ["POLITICA_CICLO_NAO_CONGELADA"],
    alertas: [],
    restricaoIds: [],
  });
  vi.mocked(vincularPolitica).mockRejectedValue(new Error("Revisar origem"));
  render(
    <ElegibilidadeAnimal
      animalId="a"
      propriedadeId={1}
      painel={painel}
      podeLancar={true}
    />,
  );
  await screen.findByText("Pendente de informação");
  fireEvent.click(screen.getByRole("button", { name: "Registrar decisão" }));
  await screen.findByRole("button", { name: "Associar política ao acompanhamento" });
  expect(vincularPolitica).not.toHaveBeenCalled();
  expect(
    (
      screen.getByRole("button", {
        name: "Associar política ao acompanhamento",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "Associar política ao acompanhamento" }),
  );
  await screen.findByText("Revisar origem");
  expect(vincularPolitica).toHaveBeenCalledWith({
    chave: expect.any(String),
    animalId: "a",
    propriedadeId: 1,
    partoId: "p",
  });
  const primeira = vi.mocked(vincularPolitica).mock.calls[0][0];
  fireEvent.click(
    screen.getByRole("button", { name: "Associar política ao acompanhamento" }),
  );
  await waitFor(() => expect(vincularPolitica).toHaveBeenCalledTimes(2));
  expect(vi.mocked(vincularPolitica).mock.calls[1][0]).toEqual(primeira);
});
it("configuração inicia sem dias clínicos nem regras escolhidas", async () => {
  render(<ConfiguracaoReprodutiva propriedadeId={9} podeLancar={true} />);
  await waitFor(() => expect(listarPoliticas).toHaveBeenCalledWith(9));
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

function elegibilidade(data: string): ElegibilidadeNaData {
  return { animalId: "a", propriedadeId: 1, dataReferencia: data, estado: "NAO_ELEGIVEL", baseElegivel: false, elegivel: false, aptaDesde: null, ciclo: { chaveCiclo: `PARTO:${data}`, inicioCiclo: data, partoId: `parto:${data}` }, vinculoCicloId: `vinculo:${data}`, politicaId: "politica", politicaVersao: 1, metodologia: "v1", decisaoId: null, motivos: ["DIAGNOSTICO_PENDENTE"], alertas: [], restricaoIds: [] };
}
it("consulta automaticamente hoje e mantém a decisão independente do filtro histórico", async () => {
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  vi.mocked(consultarElegibilidade).mockImplementation(async (_animal, _sitio, data) => elegibilidade(data));
  vi.mocked(decidirElegibilidade).mockRejectedValue(new Error("Falha transitória da decisão"));
  render(<ElegibilidadeAnimal animalId="a" propriedadeId={1} painel={painel} podeLancar/>);
  await screen.findByText("Não elegível");
  expect(consultarElegibilidade).toHaveBeenCalledWith("a", 1, hoje);
  expect(screen.getByLabelText("Data da decisão").closest("[hidden]")).not.toBeNull();
  expect(decidirElegibilidade).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Consultar na data"), { target: { value: "2020-05-02" } });
  await waitFor(() => expect(consultarElegibilidade).toHaveBeenLastCalledWith("a", 1, "2020-05-02"));
  fireEvent.click(screen.getByRole("button", { name: "Registrar decisão" }));
  await screen.findByLabelText("Decisão");
  expect(screen.getByLabelText("Data da decisão")).toHaveProperty("value", hoje);
  fireEvent.change(screen.getByLabelText("Decisão"), { target: { value: "BLOQUEAR" } });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Decisão conferida na data do registro" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar decisão" }));
  await screen.findByText("Falha transitória da decisão");
  expect(decidirElegibilidade).toHaveBeenCalledWith(expect.objectContaining({ data: hoje, vinculoCicloId: `vinculo:${hoje}`, tipo: "BLOQUEAR", aptaDesde: null }));
  const primeira = vi.mocked(decidirElegibilidade).mock.calls[0][0];
  fireEvent.click(screen.getByRole("button", { name: "Confirmar decisão" }));
  await waitFor(() => expect(decidirElegibilidade).toHaveBeenCalledTimes(2));
  expect(vi.mocked(decidirElegibilidade).mock.calls[1][0]).toEqual(primeira);
  expect(anularDecisao).not.toHaveBeenCalled();
});
it("mudar explicitamente a data da decisão confere o vínculo daquela data e conserva rascunho ao recolher", async () => {
  vi.mocked(consultarElegibilidade).mockImplementation(async (_animal, _sitio, data) => elegibilidade(data));
  vi.mocked(decidirElegibilidade).mockResolvedValue({});
  render(<ElegibilidadeAnimal animalId="a" propriedadeId={1} painel={painel} podeLancar/>);
  await screen.findByText("Não elegível");
  fireEvent.click(screen.getByRole("button", { name: "Registrar decisão" }));
  await screen.findByLabelText("Motivo");
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Motivo já conferido" } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar decisão" }));
  fireEvent.click(screen.getByRole("button", { name: "Registrar decisão" }));
  await screen.findByLabelText("Motivo");
  expect(screen.getByLabelText("Motivo")).toHaveProperty("value", "Motivo já conferido");
  fireEvent.change(screen.getByLabelText("Data da decisão"), { target: { value: "2025-01-02" } });
  await waitFor(() => expect(consultarElegibilidade).toHaveBeenLastCalledWith("a", 1, "2025-01-02"));
  await screen.findByLabelText("Decisão");
  fireEvent.change(screen.getByLabelText("Decisão"), { target: { value: "BLOQUEAR" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar decisão" }));
  await waitFor(() => expect(decidirElegibilidade).toHaveBeenCalledWith(expect.objectContaining({ data: "2025-01-02", vinculoCicloId: "vinculo:2025-01-02", motivo: "Motivo já conferido" })));
});

it("atualiza aptidão e contexto da decisão após novos fatos sem apagar filtros ou rascunho", async () => {
  vi.mocked(consultarElegibilidade).mockImplementation(async (_a, _p, data) => ({ ...elegibilidade(data), estado: "ELEGIVEL", elegivel: true }));
  const { rerender } = render(<ElegibilidadeAnimal animalId="a" propriedadeId={1} painel={painel} podeLancar/>);
  await screen.findByText("Elegível");
  fireEvent.change(screen.getByLabelText("Consultar na data"), { target: { value: "2026-01-01" } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar decisão" }));
  await screen.findByLabelText("Motivo");
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Rascunho preservado" } });
  let resolver: (valor: ElegibilidadeNaData) => void = () => {};
  vi.mocked(consultarElegibilidade).mockImplementationOnce(() => new Promise(resolve => { resolver = resolve; }));
  fireEvent.change(screen.getByLabelText("Consultar na data"), { target: { value: "2026-01-02" } });
  vi.mocked(consultarElegibilidade).mockImplementation(async (_a, _p, data) => elegibilidade(data));
  const antes = vi.mocked(consultarElegibilidade).mock.calls.length;
  rerender(<ElegibilidadeAnimal animalId="a" propriedadeId={1} painel={{ ...painel }} podeLancar/>);
  await screen.findByText("Não elegível");
  expect(consultarElegibilidade).toHaveBeenCalledTimes(antes + 2);
  expect(screen.getByLabelText("Consultar na data")).toHaveProperty("value", "2026-01-02");
  expect(screen.getByLabelText("Motivo")).toHaveProperty("value", "Rascunho preservado");
  await act(async () => resolver({ ...elegibilidade("2026-01-02"), estado: "ELEGIVEL", elegivel: true }));
  expect(screen.queryByText("Elegível")).toBeNull();
  expect(screen.getByText("Não elegível")).toBeTruthy();
});

it("uma atualização dos fatos exige nova conferência da associação de política", async () => {
  vi.mocked(consultarElegibilidade).mockImplementation(async (_a, _p, data) => ({ ...elegibilidade(data), vinculoCicloId: null }));
  const { rerender } = render(<ElegibilidadeAnimal animalId="a" propriedadeId={1} painel={painel} podeLancar/>);
  await screen.findByText("Não elegível");
  fireEvent.click(screen.getByRole("button", { name: "Registrar decisão" }));
  await screen.findByRole("checkbox");
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByRole("button", { name: "Associar política ao acompanhamento" })).toHaveProperty("disabled", false);
  vi.mocked(consultarElegibilidade).mockImplementation(async (_a, _p, data) => ({ ...elegibilidade(data), vinculoCicloId: null, ciclo: { chaveCiclo: "PARTO:novo", inicioCiclo: data, partoId: "novo" } }));
  rerender(<ElegibilidadeAnimal animalId="a" propriedadeId={1} painel={{ ...painel }} podeLancar/>);
  await screen.findByText("Parto de origem comprovado: novo");
  expect(screen.getByRole("checkbox")).toHaveProperty("checked", false);
  expect(screen.getByRole("button", { name: "Associar política ao acompanhamento" })).toHaveProperty("disabled", true);
  expect(vincularPolitica).not.toHaveBeenCalled();
});
