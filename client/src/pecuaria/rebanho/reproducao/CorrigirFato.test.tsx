// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CorrigirFato } from "./CorrigirFato";
import { obterReproducao, reqV4 } from "./api";
vi.mock("./api", () => ({ obterReproducao: vi.fn(), reqV4: vi.fn() }));
afterEach(cleanup);
it("desvincula parto somente por escolha explícita e conserva período físico da lactação", async () => {
  vi.mocked(obterReproducao).mockResolvedValue({
    animais: [],
    tentativas: [],
    avaliacoes: [],
    restricoes: [],
    partos: [
      {
        id: "p",
        animalId: "a",
        data: "2026-10-13",
        tipo: "NORMAL",
        status: "VALIDO",
      },
    ],
  });
  vi.mocked(reqV4).mockResolvedValue({});
  render(
    <CorrigirFato
      tipo="lactacao"
      id="l"
      animalId="a"
      propriedadeId={1}
      partoInicial="p"
      onFechar={vi.fn()}
      onSalvo={vi.fn()}
    />,
  );
  await screen.findByRole("option", { name: "2026-10-13 · NORMAL" });
  expect(
    (screen.getByLabelText("Parto vinculado") as HTMLSelectElement).value,
  ).toBe("p");
  fireEvent.change(screen.getByLabelText("Parto vinculado"), {
    target: { value: "" },
  });
  fireEvent.change(screen.getByLabelText("Motivo da correção"), {
    target: { value: "Parto duplicado; lactação real permanece" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar correção" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalled());
  expect(vi.mocked(reqV4).mock.calls[0]).toEqual([
    "/reproducao/lactacoes/l/correcao",
    {
      propriedadeId: 1,
      partoId: null,
      motivo: "Parto duplicado; lactação real permanece",
    },
  ]);
});
