// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AjudaCampo } from "./Dica";

afterEach(cleanup);

describe("Dica", () => {
  it("abre ao passar o mouse e fecha ao sair", async () => {
    render(<AjudaCampo texto="Explicação do campo" rotulo="Ajuda do campo" />);
    expect(screen.queryByText("Explicação do campo")).toBeNull();
    const gatilho = screen.getByRole("button", { name: "Ajuda do campo" });
    fireEvent.mouseEnter(gatilho);
    expect(await screen.findByText("Explicação do campo")).toBeTruthy();
    fireEvent.mouseLeave(gatilho);
    expect(screen.queryByText("Explicação do campo")).toBeNull();
  });

  it("abre ao clicar e não fecha se já estava aberta pelo hover", async () => {
    render(<AjudaCampo texto="Explicação do campo" rotulo="Ajuda do campo" />);
    const gatilho = screen.getByRole("button", { name: "Ajuda do campo" });
    fireEvent.mouseEnter(gatilho);
    fireEvent.click(gatilho);
    expect(await screen.findByText("Explicação do campo")).toBeTruthy();
  });

  it("fecha com Esc", async () => {
    render(<AjudaCampo texto="Explicação do campo" rotulo="Ajuda do campo" />);
    fireEvent.click(screen.getByRole("button", { name: "Ajuda do campo" }));
    const texto = await screen.findByText("Explicação do campo");
    fireEvent.keyDown(texto, { key: "Escape" });
    expect(screen.queryByText("Explicação do campo")).toBeNull();
  });
});
