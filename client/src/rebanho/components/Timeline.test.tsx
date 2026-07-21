// @vitest-environment jsdom
import { createElement } from "react";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);
import { Timeline } from "./Timeline";
import type { EventoTimeline } from "../types";

const ev = (id: string, dominio: EventoTimeline["dominio"], titulo: string): EventoTimeline =>
  ({ id, animalId: "a1", data: "2026-05-01", dominio, titulo }) as EventoTimeline;

const eventos = [
  ev("p1", "producao", "Controle 30 L"),
  ev("s1", "sanidade", "Aplicação Mastjet"),
  ev("p2", "producao", "Controle 28 L"),
];

describe("Timeline — filtro por domínio", () => {
  it("oferece 'Tudo' + domínios presentes com contagem", () => {
    const { getByRole } = render(createElement(Timeline, { eventos }));
    expect(getByRole("button", { name: "Tudo (3)" })).toBeTruthy();
    expect(getByRole("button", { name: "Produção (2)" })).toBeTruthy();
    expect(getByRole("button", { name: "Sanidade (1)" })).toBeTruthy();
  });

  it("clicar num domínio mostra só os eventos dele", () => {
    const { getByRole, queryByText } = render(createElement(Timeline, { eventos }));
    fireEvent.click(getByRole("button", { name: "Sanidade (1)" }));
    expect(queryByText("Aplicação Mastjet")).toBeTruthy();
    expect(queryByText("Controle 30 L")).toBeNull();
  });

  it("um único domínio não renderiza barra de filtro", () => {
    const so1 = [ev("p1", "producao", "Controle 30 L"), ev("p2", "producao", "Controle 28 L")];
    const { queryByRole } = render(createElement(Timeline, { eventos: so1 }));
    expect(queryByRole("group", { name: /Filtrar linha do tempo/ })).toBeNull();
  });
});
