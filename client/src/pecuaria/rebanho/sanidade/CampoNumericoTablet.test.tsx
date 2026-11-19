// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CampoNumericoTablet, erroNumeroTablet, numeroDigitadoTablet } from "./CampoNumericoTablet";
afterEach(cleanup);
it("aceita vírgula ou ponto sem aceitar frações indevidas, expoentes ou separadores ambíguos", () => {
  expect(numeroDigitadoTablet("10,25")).toBe(10.25);
  for (const v of ["10,25", "10.25", "0,001", ",5", ".5", "10,"]) expect(erroNumeroTablet(v)).toBe("");
  for (const v of ["1,0001", "-1", "1e2", "1.000,50", "0"]) expect(erroNumeroTablet(v)).not.toBe("");
  expect(erroNumeroTablet("1,5", true)).not.toBe("");
  expect(erroNumeroTablet("0", true, 0)).toBe("");
});
it("seleciona o valor para substituir e avança pelo teclado sem enviar o formulário", () => {
  render(<form><CampoNumericoTablet valor="10,5" onChange={() => {}} rotulo="Primeiro" /><CampoNumericoTablet valor="" onChange={() => {}} rotulo="Segundo" /></form>);
  const a = screen.getByLabelText("Primeiro") as HTMLInputElement;
  a.focus(); expect(a.selectionStart).toBe(0); expect(a.selectionEnd).toBe(4);
  fireEvent.keyDown(a, { key: "Enter" });
  expect(document.activeElement).toBe(screen.getByLabelText("Segundo"));
  expect(a.getAttribute("inputmode")).toBe("decimal");
});
