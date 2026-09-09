// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DomainConfig } from "../domains";
import { HerdDomainView } from "./HerdDomainView";

afterEach(cleanup);

const config: DomainConfig = {
  titulo: "Animal",
  eyebrow: "Rebanho",
  kpis: () => [],
  worklists: [{ id: "todos", label: "Todos", selecionar: (rs) => rs }],
  colunas: [],
};

const configComColunas: DomainConfig = {
  ...config,
  colunas: [
    { nome: "DEL", render: (r) => r.del ?? "—" },
    { nome: "Situação reprodutiva", render: (r) => r.statusReprodutivo },
  ],
};

describe("HerdDomainView — identidade do animal", () => {
  it("mostra o número preservado antes do nome", () => {
    const { container } = render(createElement(HerdDomainView, {
      config,
      resumos: [{ animalId: "1", statusReprodutivo: "VAZIA" }],
      nomes: { "1": { numero: "0042", nome: "Jurema" } },
      onAbrirAnimal: () => {},
    }));
    const identidade = container.querySelector("tbody td button > span")!;
    const [descricao, numero, separador, nome] = Array.from(identidade.children);
    expect(descricao).toHaveProperty("textContent", "Animal número 0042, Jurema");
    expect(numero).toHaveProperty("textContent", "#0042");
    expect(separador).toHaveProperty("textContent", "·");
    expect(nome).toHaveProperty("textContent", "Jurema");
  });

  it("abre a ficha por um botão focável e anuncia a worklist ativa", () => {
    const onAbrirAnimal = vi.fn();
    render(createElement(HerdDomainView, {
      config,
      resumos: [{ animalId: "1", statusReprodutivo: "VAZIA" }],
      nomes: { "1": { numero: "0042", nome: "Jurema" } },
      onAbrirAnimal,
    }));

    expect(screen.getByRole("button", { name: "Todos" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /Abrir ficha do animal número 0042/i }));
    expect(onAbrirAnimal).toHaveBeenCalledWith("1");
  });

  it("permite escolher e persiste as colunas da tabela", () => {
    render(createElement(HerdDomainView, {
      config: configComColunas,
      resumos: [{ animalId: "1", statusReprodutivo: "INSEMINADA", del: 82 }],
      nomes: { "1": { numero: "0042", nome: "Jurema" } },
      onAbrirAnimal: () => {},
    }));

    expect(screen.getByRole("columnheader", { name: "DEL" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Colunas \(2\/2\)/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: "DEL" }));

    expect(screen.queryByRole("columnheader", { name: "DEL" })).toBeNull();
    expect(localStorage.getItem("rionovo:tarefas-colunas:animal")).toBe('["Situação reprodutiva"]');
  });
});
