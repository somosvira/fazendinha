// @vitest-environment jsdom
import { createElement } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DomainConfig } from "../domains";
import { HerdDomainView } from "./HerdDomainView";

const config: DomainConfig = {
  titulo: "Animal",
  eyebrow: "Rebanho",
  kpis: () => [],
  worklists: [{ id: "todos", label: "Todos", selecionar: (rs) => rs }],
  colunas: [],
};

describe("HerdDomainView — identidade do animal", () => {
  it("mostra o número preservado antes do nome", () => {
    const { container } = render(createElement(HerdDomainView, {
      config,
      resumos: [{ animalId: "1", statusReprodutivo: "VAZIA" }],
      nomes: { "1": { numero: "0042", nome: "Jurema" } },
      onAbrirAnimal: () => {},
    }));
    const identidade = container.querySelector("tbody td > span")!;
    const [descricao, numero, separador, nome] = Array.from(identidade.children);
    expect(descricao).toHaveProperty("textContent", "Animal número 0042, Jurema");
    expect(numero).toHaveProperty("textContent", "#0042");
    expect(separador).toHaveProperty("textContent", "·");
    expect(nome).toHaveProperty("textContent", "Jurema");
  });
});
