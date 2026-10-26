// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SecaoDetalhesLeite } from "./SecaoDetalhesLeite";
afterEach(cleanup);
it("expande com botão acessível, mantendo os campos montados ao recolher", () => {
  render(<SecaoDetalhesLeite titulo="Detalhes da origem"><label>Observação<input defaultValue="Conferência" /></label></SecaoDetalhesLeite>);
  const botao = screen.getByRole("button", { name: "Detalhes da origem" });
  expect(botao.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(botao);
  expect(botao.getAttribute("aria-expanded")).toBe("true");
  fireEvent.change(screen.getByLabelText("Observação"), { target: { value: "Rascunho preservado" } });
  fireEvent.click(botao);
  fireEvent.click(botao);
  expect((screen.getByLabelText("Observação") as HTMLInputElement).value).toBe("Rascunho preservado");
});
