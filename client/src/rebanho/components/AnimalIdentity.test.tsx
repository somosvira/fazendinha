// @vitest-environment jsdom
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnimalIdentity, descricaoAnimalA11y, mencaoAnimal, rotuloAnimal } from "./AnimalIdentity";

describe("identidade canônica do animal", () => {
  it("preserva zeros à esquerda e coloca o número antes do nome", () => {
    expect(rotuloAnimal("0942", "Jurema")).toBe("#0942 · Jurema");
  });

  it("não inventa nome quando ele está ausente", () => {
    expect(rotuloAnimal("0942", null)).toBe("#0942");
    expect(rotuloAnimal("0942", "   ")).toBe("#0942");
  });

  it("prioriza o número em frases", () => {
    expect(mencaoAnimal("0942", "Jurema")).toBe("#0942 Jurema");
    expect(mencaoAnimal("0942", null)).toBe("#0942");
  });

  it("produz descrição acessível sem pronunciar o símbolo como parte do número", () => {
    expect(descricaoAnimalA11y("0942", "Jurema")).toBe("Animal número 0942, Jurema");
    expect(descricaoAnimalA11y("0942", null)).toBe("Animal número 0942");
  });

  it("renderiza número forte, separador e nome secundário nesta ordem", () => {
    const { container } = render(createElement(AnimalIdentity, { numero: "0942", nome: "Jurema" }));
    const identidade = container.firstElementChild!;
    const [descricao, numero, separador, nome] = Array.from(identidade.children);
    expect(descricao).toHaveProperty("textContent", "Animal número 0942, Jurema");
    expect(descricao.classList.contains("sr-only")).toBe(true);
    expect(numero).toHaveProperty("textContent", "#0942");
    expect(numero.classList.contains("tabular-nums")).toBe(true);
    expect(separador).toHaveProperty("textContent", "·");
    expect(nome).toHaveProperty("textContent", "Jurema");
    expect(nome.classList.contains("text-ink-2")).toBe(true);
  });

  it("usa o nome como subtítulo na variante de cabeçalho", () => {
    const { container } = render(createElement(AnimalIdentity, { numero: "0017", nome: "Mimosa", variant: "heading" }));
    const identidade = container.firstElementChild!;
    const [descricao, numero, nome] = Array.from(identidade.children);
    expect(descricao).toHaveProperty("textContent", "Animal número 0017, Mimosa");
    expect(numero).toHaveProperty("textContent", "#0017");
    expect(nome).toHaveProperty("textContent", "Mimosa");
    expect(identidade.classList.contains("flex-col")).toBe(true);
    expect(identidade.classList.contains("items-start")).toBe(true);
    expect(identidade.classList.contains("font-serif")).toBe(true);
  });
});
