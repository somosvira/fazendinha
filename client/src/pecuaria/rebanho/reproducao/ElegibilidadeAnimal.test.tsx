// @vitest-environment jsdom
import {
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
  expect(vincularPolitica).not.toHaveBeenCalled();
  expect(
    (
      screen.getByRole("button", {
        name: "Associar política ao ciclo",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "Associar política ao ciclo" }),
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
    screen.getByRole("button", { name: "Associar política ao ciclo" }),
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
