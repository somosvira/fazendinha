// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  EditorRegrasAcompanhamentoModelo,
  type ConfiguracaoAcompanhamentoV2,
} from "./EditorRegrasAcompanhamentoModelo";
import { validarConfiguracaoAcompanhamento } from "./acompanhamento-api";
import { mudarCampo } from "@/lib/controles.fixture";
vi.mock("./api", () => ({ reqV4: vi.fn(async () => []) }));
afterEach(cleanup);
it("exige parâmetros explícitos e conserva referência TE separada de gestação", async () => {
  let ultimo: ConfiguracaoAcompanhamentoV2 | null = null;
  function Harness() {
    const [valor, setValor] = useState<ConfiguracaoAcompanhamentoV2 | null>(
      null,
    );
    return (
      <EditorRegrasAcompanhamentoModelo
        valor={valor}
        onChange={(v) => {
          ultimo = v;
          setValor(v);
        }}
      />
    );
  }
  render(<Harness />);
  fireEvent.click(
    screen.getByRole("button", { name: "Adicionar diagnóstico" }),
  );
  expect(screen.getByLabelText("Intervalo (dias)")).toHaveProperty("value", "");
  expect(validarConfiguracaoAcompanhamento(ultimo)).toContain(
    "Informe intervalo",
  );
  mudarCampo(screen.getByLabelText("Público"), { target: { value: "TE" } });
  for (const [rotulo, value] of [
    ["Intervalo (dias)", "23"],
    ["Antecedência (dias)", "0"],
    ["Tolerância (dias)", "2"],
  ])
    fireEvent.change(screen.getByLabelText(rotulo), { target: { value } });
  expect(ultimo).toMatchObject({
    regras: [
      {
        publico: "TE",
        referencia: "TE",
        intervalo: 23,
        antecedencia: 0,
        tolerancia: 2,
      },
    ],
  });
  expect(validarConfiguracaoAcompanhamento(ultimo)).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Remover acompanhamento 1" }),
  );
  expect(ultimo).toBeNull();
});
