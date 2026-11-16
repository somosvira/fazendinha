// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useConferenciaImpactos } from "./ConferenciaImpactos";
import type { EntradaImpacto } from "./impactos-api";
import { reqSanidade } from "./api";
vi.mock("./api", () => ({ reqSanidade: vi.fn() }));
afterEach(cleanup);
const entrada: EntradaImpacto = {
  origem: "PROCEDIMENTO",
  animalId: "animal",
  propriedadeId: 2,
  data: "2026-10-10",
  tipoAplicacaoId: "tipo",
};
import { previaImpactosTeste } from "./impactos.fixture";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(reqSanidade).mockImplementation(async (_p, init) =>
    previaImpactosTeste(JSON.parse(String(init?.body))),
  );
});
function Fluxo({ escrever }: { escrever: (payload: unknown) => void }) {
  const impactos = useConferenciaImpactos();
  return (
    <>
      {impactos.painel}
      <button
        onClick={() =>
          void (async () => {
            const c = await impactos.conferir([entrada], { animal: "Vaca 24" });
            if (c) escrever({ ...entrada, impacto: c[0] });
          })()
        }
      >
        Salvar fato
      </button>
    </>
  );
}
async function confirmar() {
  fireEvent.change(screen.getByLabelText("Motivo da confirmação"), {
    target: { value: "Conferência operacional explícita" },
  });
  fireEvent.click(screen.getByLabelText(/Conferi as participações/));
  fireEvent.click(
    screen.getByRole("button", { name: "Confirmar dados e impactos" }),
  );
}
it("não escreve antes da conferência e transmite revisão, motivo e entrada capturados", async () => {
  const escrever = vi.fn();
  render(<Fluxo escrever={escrever} />);
  fireEvent.click(screen.getByText("Salvar fato"));
  await screen.findByText("Preparo autorizado · v2");
  expect(escrever).not.toHaveBeenCalled();
  expect(
    screen.getByText(/1 tarefas pendentes · 1 automações serão canceladas/),
  ).toBeTruthy();
  expect(screen.getByText(/cuidado continua disponível/)).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Confirmar dados e impactos" }),
  ).toHaveProperty("disabled", true);
  await confirmar();
  await waitFor(() =>
    expect(escrever).toHaveBeenCalledWith({
      ...entrada,
      impacto: {
        revisao: "a".repeat(64),
        motivo: "Conferência operacional explícita",
      },
    }),
  );
  expect(reqSanidade).toHaveBeenCalledWith(
    "/impactos-protocolares/previa",
    expect.objectContaining({ method: "POST" }),
    2,
  );
});
it("cancelar não escreve e reabrir consulta novamente a revisão vigente", async () => {
  const escrever = vi.fn();
  render(<Fluxo escrever={escrever} />);
  fireEvent.click(screen.getByText("Salvar fato"));
  await screen.findByText("Preparo autorizado · v2");
  fireEvent.click(screen.getByRole("button", { name: "Voltar ao registro" }));
  await waitFor(() =>
    expect(screen.queryByText("Preparo autorizado · v2")).toBeNull(),
  );
  expect(escrever).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Salvar fato"));
  await screen.findByText("Preparo autorizado · v2");
  expect(reqSanidade).toHaveBeenCalledTimes(2);
});
it("sem regra aplicável segue sem motivo ou efeito inventado", async () => {
  vi.mocked(reqSanidade).mockResolvedValue({
    ...previaImpactosTeste(entrada),
    exigeConfirmacao: false,
    itens: [],
  });
  const escrever = vi.fn();
  render(<Fluxo escrever={escrever} />);
  fireEvent.click(screen.getByText("Salvar fato"));
  await waitFor(() =>
    expect(escrever).toHaveBeenCalledWith({ ...entrada, impacto: undefined }),
  );
  expect(screen.queryByText("Motivo da confirmação")).toBeNull();
});
it("confere todas as entradas antes de confirmar qualquer fato do conjunto", async () => {
  const escrever = vi.fn();
  function Coletivo() {
    const impactos = useConferenciaImpactos();
    return (
      <>
        {impactos.painel}
        <button
          onClick={() =>
            void (async () => {
              const confirmacoes = await impactos.conferir([
                entrada,
                { ...entrada, animalId: "outro" },
              ]);
              if (confirmacoes) escrever(confirmacoes);
            })()
          }
        >
          Conferir conjunto
        </button>
      </>
    );
  }
  render(<Coletivo />);
  fireEvent.click(screen.getByText("Conferir conjunto"));
  await screen.findByLabelText("Motivo da confirmação");
  expect(reqSanidade).toHaveBeenCalledTimes(2);
  expect(escrever).not.toHaveBeenCalled();
  await confirmar();
  await waitFor(() =>
    expect(escrever).toHaveBeenCalledWith([
      { revisao: "a".repeat(64), motivo: "Conferência operacional explícita" },
      { revisao: "a".repeat(64), motivo: "Conferência operacional explícita" },
    ]),
  );
});
it("segunda conferência da execução reutiliza o mesmo aceite somente para o payload idêntico", async () => {
  const confirmado = vi.fn();
  function DuasEtapas() {
    const impactos = useConferenciaImpactos();
    return (
      <>
        {impactos.painel}
        <button
          onClick={() =>
            void (async () => {
              const c = await impactos.conferir(
                [entrada],
                {},
                JSON.stringify({ entrada, dose: 1 }),
              );
              if (c) confirmado(c);
            })()
          }
        >
          Conferir execução
        </button>
        <button
          onClick={() =>
            void (async () => {
              const c = await impactos.conferir(
                [entrada],
                {},
                JSON.stringify({ entrada, dose: 2 }),
              );
              if (c) confirmado(c);
            })()
          }
        >
          Alterar dose
        </button>
      </>
    );
  }
  render(<DuasEtapas />);
  fireEvent.click(screen.getByText("Conferir execução"));
  await screen.findByLabelText("Motivo da confirmação");
  await confirmar();
  await waitFor(() => expect(confirmado).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByText("Conferir execução"));
  await waitFor(() => expect(confirmado).toHaveBeenCalledTimes(2));
  expect(reqSanidade).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText("Alterar dose"));
  await screen.findByLabelText("Motivo da confirmação");
  expect(reqSanidade).toHaveBeenCalledTimes(2);
  expect(confirmado).toHaveBeenCalledTimes(2);
});
