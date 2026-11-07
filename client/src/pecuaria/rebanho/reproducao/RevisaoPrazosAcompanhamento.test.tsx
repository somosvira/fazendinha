// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RevisaoPrazosAcompanhamento } from "./RevisaoPrazosAcompanhamento";
import { mudarCampo } from "@/lib/controles.fixture";
const mocks = vi.hoisted(() => ({ req: vi.fn() }));
vi.mock("./api", () => ({ reqV4: mocks.req }));
const politica = {
  id: "p",
  versao: 2,
  vigenteDesde: "2026-11-07",
  parametros: { versao: 2 as const, efeito: "ALERTA" as const, regras: [] },
};
const proposta = {
  demandaId: "d",
  animalId: "a",
  versao: 3,
  previstaAnterior: "2026-11-08",
  proposta: { previstaPara: "2026-11-10" },
  impedimento: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.req.mockImplementation(async (path) =>
    path.endsWith("/previa")
      ? { revisao: "a".repeat(64), propostas: [proposta] }
      : path.includes("?estado")
        ? {
            itens: [
              {
                id: "d",
                animalId: "a",
                animal: { id: "a", brinco: "123", nome: "Estrela" },
                finalidade: "DIAGNOSTICO",
                previstaPara: "2026-11-08",
                origemAdocao: "FATO_NOVO",
              },
            ],
            total: 1,
          }
        : {},
  );
});
afterEach(cleanup);
async function abrir() {
  render(
    <RevisaoPrazosAcompanhamento propriedadeId={7} politicas={[politica]} />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Revisar prazos existentes" }),
  );
  await screen.findByText(/123 · Estrela/);
  mudarCampo(screen.getByLabelText("Versão a aplicar"), {
    target: { value: "p" },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: /Diagnóstico/ }));
  fireEvent.click(screen.getByRole("button", { name: "Conferir prévia" }));
  await screen.findByText("Prévia da revisão");
}
it("confirma só depois da prévia, motivo e ciência, enviando revisão esperada", async () => {
  await abrir();
  const btn = screen.getByRole("button", { name: "Confirmar revisão" });
  expect(btn).toHaveProperty("disabled", true);
  fireEvent.change(screen.getByLabelText("Motivo da revisão"), {
    target: { value: "Conferido pelo responsável" },
  });
  fireEvent.click(
    screen.getByLabelText(
      "Conferi a seleção e as novas datas; confirmo a revisão.",
    ),
  );
  fireEvent.click(btn);
  await screen.findByText(/Prazos revisados/);
  expect(mocks.req).toHaveBeenCalledWith(
    "/reproducao/acompanhamento/prazos/revisao",
    {
      propriedadeId: 7,
      politicaId: "p",
      demandaIds: ["d"],
      motivo: "Conferido pelo responsável",
      revisao: "a".repeat(64),
      chave: expect.any(String),
    },
    "POST",
    7,
  );
});
it("preserva agendamento individual e impede revisão da seleção bloqueada", async () => {
  mocks.req.mockImplementation(async (path) =>
    path.endsWith("/previa")
      ? {
          revisao: "a".repeat(64),
          propostas: [
            { ...proposta, impedimento: "AGENDAMENTO_INDIVIDUAL_PRESERVADO" },
          ],
        }
      : {
          itens: [
            {
              id: "d",
              animalId: "a",
              animal: { id: "a", brinco: "123", nome: "Estrela" },
              finalidade: "DIAGNOSTICO",
              previstaPara: "2026-11-08",
              origemAdocao: "INDIVIDUAL",
            },
          ],
          total: 1,
        },
  );
  await abrir();
  expect(
    screen.getByText(/Preservada: agendamento individual preservado/),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Confirmar revisão" }),
  ).toHaveProperty("disabled", true);
});
it("alterar política invalida prévia e confirmação", async () => {
  await abrir();
  mudarCampo(screen.getByLabelText("Versão a aplicar"), {
    target: { value: "" },
  });
  await waitFor(() =>
    expect(screen.queryByText("Prévia da revisão")).toBeNull(),
  );
});

it("erro transitório conserva a prévia e a chave da confirmação no retry", async () => {
  let n = 0;
  const original = mocks.req.getMockImplementation()!;
  mocks.req.mockImplementation(async (path, ...args) => {
    if (path.endsWith("/revisao") && n++ === 0) throw Error("Falha temporária");
    return original(path, ...args);
  });
  await abrir();
  fireEvent.change(screen.getByLabelText("Motivo da revisão"), {
    target: { value: "Conferência explícita" },
  });
  fireEvent.click(
    screen.getByLabelText(
      "Conferi a seleção e as novas datas; confirmo a revisão.",
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirmar revisão" }));
  await screen.findByText("Falha temporária");
  expect(screen.getByText("Prévia da revisão")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar revisão" }));
  await screen.findByText(/Prazos revisados/);
  const escritas = mocks.req.mock.calls.filter(([p]) => p.endsWith("/revisao"));
  expect(escritas[0]).toEqual(escritas[1]);
});
