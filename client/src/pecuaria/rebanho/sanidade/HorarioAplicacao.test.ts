import { expect, it } from "vitest";
import { erroHorarioAplicacao } from "./HorarioAplicacao";

it("rejeita hora inexistente e preenchimento parcial", () => {
  for (const valor of ["24:00", "09:60", "9:30", "09:"]) expect(erroHorarioAplicacao(valor)).not.toBe("");
  expect(erroHorarioAplicacao("23:59")).toBe("");
});
it("limita a hora de hoje sem restringir dias anteriores", () => {
  expect(erroHorarioAplicacao("10:01", "10:00")).not.toBe("");
  expect(erroHorarioAplicacao("10:00", "10:00")).toBe("");
  expect(erroHorarioAplicacao("23:59")).toBe("");
});
