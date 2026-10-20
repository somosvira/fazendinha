// @vitest-environment jsdom
import "../lib/controles.fixture";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FiltroFaixaValor } from "./FiltroFaixaValor";
afterEach(cleanup);
function Exemplo() {
  const [minimo, setMinimo] = useState("");
  const [maximo, setMaximo] = useState("");
  return <FiltroFaixaValor minimo={minimo} maximo={maximo} limiteSugerido={200} onMinimoChange={setMinimo} onMaximoChange={setMaximo} />;
}
describe("faixa monetária com controles e digitação", () => {
  it("sincroniza centavos digitados e ajustes pelo teclado", () => {
    render(<Exemplo />);
    const minimo = screen.getByLabelText("Valor mínimo") as HTMLInputElement;
    const maximo = screen.getByLabelText("Valor máximo") as HTMLInputElement;
    fireEvent.change(minimo, { target: { value: "25,50" } });
    fireEvent.change(maximo, { target: { value: "100,75" } });
    const inicio = screen.getByRole("slider", { name: "Ajustar valor mínimo" });
    const fim = screen.getByRole("slider", { name: "Ajustar valor máximo" });
    expect(inicio.getAttribute("aria-valuenow")).toBe("25.5");
    expect(fim.getAttribute("aria-valuenow")).toBe("100.75");
    inicio.focus(); fireEvent.keyDown(inicio, { key: "ArrowRight" });
    expect(minimo.value).toBe("25,51");
    fim.focus(); fireEvent.keyDown(fim, { key: "ArrowLeft" });
    expect(maximo.value).toBe("100,74");
  });
  it("aceita um limite digitado acima da escala sugerida sem cortar o valor", async () => {
    render(<Exemplo />);
    fireEvent.change(screen.getByLabelText("Valor máximo"), { target: { value: "1.000,25" } });
    const fim = screen.getByRole("slider", { name: "Ajustar valor máximo" });
    await waitFor(() => expect(Number(fim.getAttribute("aria-valuemax"))).toBe(1000.25));
    expect(fim.getAttribute("aria-valuenow")).toBe("1000.25");
    expect((screen.getByLabelText("Valor máximo") as HTMLInputElement).value).toBe("1.000,25");
  });
  it("permite voltar a sem máximo e preserva limites inválidos para correção", () => {
    render(<Exemplo />);
    const fim = screen.getByRole("slider", { name: "Ajustar valor máximo" });
    fim.focus(); fireEvent.keyDown(fim, { key: "ArrowLeft" });
    expect((screen.getByLabelText("Valor máximo") as HTMLInputElement).value).toBe("199,99");
    fireEvent.keyDown(fim, { key: "End" });
    expect((screen.getByLabelText("Valor máximo") as HTMLInputElement).value).toBe("");
    fireEvent.change(screen.getByLabelText("Valor mínimo"), { target: { value: "150" } });
    fireEvent.change(screen.getByLabelText("Valor máximo"), { target: { value: "100" } });
    expect(screen.getByRole("slider", { name: "Ajustar valor mínimo" }).getAttribute("aria-disabled")).toBe("true");
    expect((screen.getByLabelText("Valor mínimo") as HTMLInputElement).value).toBe("150");
    expect((screen.getByLabelText("Valor máximo") as HTMLInputElement).value).toBe("100");
  });
});
