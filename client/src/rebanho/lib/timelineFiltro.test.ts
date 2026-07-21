import { describe, expect, it } from "vitest";
import { contarPorDominio, filtrarEventos } from "./timelineFiltro";
import type { EventoTimeline } from "../types";

const ev = (id: string, dominio: EventoTimeline["dominio"]): EventoTimeline =>
  ({ id, animalId: "a1", data: "2026-05-01", dominio, titulo: id }) as EventoTimeline;

describe("contarPorDominio", () => {
  it("conta só os domínios presentes, do mais frequente para o menos", () => {
    const eventos = [ev("1", "producao"), ev("2", "sanidade"), ev("3", "producao"), ev("4", "producao")];
    expect(contarPorDominio(eventos)).toEqual([
      { dominio: "producao", n: 3 },
      { dominio: "sanidade", n: 1 },
    ]);
  });

  it("empate mantém a ordem canônica de domínio", () => {
    const eventos = [ev("1", "sanidade"), ev("2", "reproducao")];
    expect(contarPorDominio(eventos).map((d) => d.dominio)).toEqual(["reproducao", "sanidade"]);
  });

  it("lista vazia → sem domínios", () => {
    expect(contarPorDominio([])).toEqual([]);
  });
});

describe("filtrarEventos", () => {
  const eventos = [ev("1", "producao"), ev("2", "sanidade")];

  it("'tudo' devolve todos", () => {
    expect(filtrarEventos(eventos, "tudo")).toHaveLength(2);
  });

  it("um domínio devolve só ele", () => {
    expect(filtrarEventos(eventos, "producao").map((e) => e.id)).toEqual(["1"]);
  });
});
