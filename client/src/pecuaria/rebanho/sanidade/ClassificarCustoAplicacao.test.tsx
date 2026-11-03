// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ClassificarCustoAplicacao } from "./ClassificarCustoAplicacao";
vi.mock("../custos/CustosDiretos", () => ({ CustosDiretos: ({ aoAlterarRascunho, aoGravar, aoSalvar }: { aoAlterarRascunho: (v: boolean) => void; aoGravar: (v: boolean) => void; aoSalvar: () => void }) => <><input aria-label="Rascunho" onChange={() => aoAlterarRascunho(true)} /><button onClick={() => aoGravar(true)}>Gravar pendente</button><button onClick={() => { aoAlterarRascunho(false); aoGravar(false); aoSalvar(); }}>Salvar classificação</button></> }));
afterEach(cleanup);
it("protege rascunho ao fechar e permite retomar a edição", () => {
  const aoFechar = vi.fn();
  render(<ClassificarCustoAplicacao id="a" propriedadeId={1} aoFechar={aoFechar} />);
  fireEvent.change(screen.getByLabelText("Rascunho"), { target: { value: "Evidência em edição" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Fechar" })[0]);
  expect(screen.getByRole("alert").textContent).toContain("Descartar alterações");
  expect(aoFechar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
  expect(screen.getByLabelText("Rascunho")).toHaveProperty("value", "Evidência em edição");
  fireEvent.click(screen.getByRole("button", { name: "Salvar classificação" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Fechar" })[0]);
  expect(aoFechar).toHaveBeenCalledWith(true);
});
it("bloqueia fechamento durante a gravação", () => {
  const aoFechar = vi.fn();
  render(<ClassificarCustoAplicacao id="a" propriedadeId={1} aoFechar={aoFechar} />);
  fireEvent.click(screen.getByRole("button", { name: "Gravar pendente" }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(aoFechar).not.toHaveBeenCalled();
});
