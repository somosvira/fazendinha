// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ArremateSimulado, animalArremateSimulado } from "./ArremateSimulado";

it("apresenta a matriz para conferência e só abre a revisão após o aceite", () => {
  const revisar = vi.fn();
  render(<ArremateSimulado onFechar={vi.fn()} onRevisar={revisar} />);
  expect(screen.getByRole("dialog", { name: "Conferir compra de leilão" })).toBeTruthy();
  expect(screen.getByText("GSC-5144")).toBeTruthy();
  const botao = screen.getByRole("button", { name: "Revisar compra" }) as HTMLButtonElement;
  expect(botao.disabled).toBe(true);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(botao);
  expect(revisar).toHaveBeenCalledOnce();
  expect(animalArremateSimulado().payload).toMatchObject({ brinco: "SIM-ERURAL-40", sexo: "F", sisbov: null });
});
