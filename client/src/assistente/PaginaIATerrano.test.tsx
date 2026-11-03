// @vitest-environment jsdom
import { useEffect, useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { registrarGuardaNavegacao } from "../navegacaoGuardada";
import { PaginaIATerrano } from "./PaginaIATerrano";
vi.mock("../api/propriedades", () => ({
  listarPropriedades: vi.fn(async () => [
    { id: 7, nome: "São Francisco", ativo: true },
  ]),
}));
vi.mock("../components/AssistenteConsulta", () => ({
  AssistenteConsulta: function ConversaFixture() {
    const [sujo, setSujo] = useState(false);
    useEffect(() => {
      if (sujo)
        return registrarGuardaNavegacao(async () =>
          window.confirm("Descartar?"),
        );
    }, [sujo]);
    return (
      <input aria-label="Rascunho de conversa" onChange={() => setSujo(true)} />
    );
  },
}));
vi.mock("./Radar", () => ({ Radar: () => <div>Radar de teste</div> }));
vi.mock("./Metas", () => ({
  default: function MetasFixture() {
    const [sujo, setSujo] = useState(false);
    useEffect(() => {
      if (sujo)
        return registrarGuardaNavegacao(async () =>
          window.confirm("Descartar?"),
        );
    }, [sujo]);
    return (
      <input aria-label="Rascunho de conversa" onChange={() => setSujo(true)} />
    );
  },
}));
beforeEach(() => {
  window.history.replaceState(null, "", "/assistente");
  vi.spyOn(window, "confirm").mockReturnValue(false);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function abrir() {
  render(
    <PaginaIATerrano
      propriedadeId={7}
      onTrocarPropriedade={vi.fn()}
      onAbrirFonte={vi.fn()}
    />,
  );
  fireEvent.change(
    screen.getByRole("textbox", { name: "Rascunho de conversa" }),
    { target: { value: "Mensagem em edição" } },
  );
}
it("cancelar troca de aba conserva formulário e URL", async () => {
  abrir();
  fireEvent.click(screen.getByRole("tab", { name: "Radar" }));
  await act(async () => {});
  expect(
    screen.getByRole("textbox", { name: "Rascunho de conversa" }),
  ).toBeTruthy();
  expect(window.location.search).toBe("");
  vi.mocked(window.confirm).mockReturnValue(true);
  fireEvent.click(screen.getByRole("tab", { name: "Radar" }));
  await act(async () => {});
  expect(
    screen.queryByRole("textbox", { name: "Rascunho de conversa" }),
  ).toBeNull();
  expect(window.location.search).toBe("?aba=radar");
});
it.each(["Histórico", "Nova conversa"])(
  "%s não descarta rascunho ao cancelar",
  async (nome) => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: nome }));
    await act(async () => {});
    expect(
      screen.getByRole("textbox", { name: "Rascunho de conversa" }),
    ).toBeTruthy();
    expect(window.location.search).toBe("");
  },
);
it("voltar do navegador respeita rascunho e restaura URL ao cancelar", async () => {
  abrir();
  window.history.pushState(null, "", "/assistente?aba=radar");
  window.dispatchEvent(new PopStateEvent("popstate"));
  await act(async () => {});
  expect(
    screen.getByRole("textbox", { name: "Rascunho de conversa" }),
  ).toBeTruthy();
  expect(window.location.search).toBe("");
});
