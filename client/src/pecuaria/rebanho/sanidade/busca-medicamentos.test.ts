import { describe, expect, it } from "vitest";
import { criarFiltroMedicamentos } from "./busca-medicamentos";
describe("pesquisa de medicamentos", () => {
  const nome = "Abamectina 1% Calbosinjetável (Frasco 20 ml)";
  it("combina termos separados, em qualquer ordem", () => {
    expect(criarFiltroMedicamentos("abamectina 20")(nome)).toBe(true);
    expect(criarFiltroMedicamentos("20 calbos abamectina")(nome)).toBe(true);
    expect(criarFiltroMedicamentos("abamectina 20")(nome.replace("20 ml", "200 ml"))).toBe(false);
    expect(criarFiltroMedicamentos("abamectina 20")("Outro medicamento (Frasco 20 ml)")).toBe(false);
  });
  it("ignora acentos, caixa, espaços e separação entre número e unidade", () => {
    expect(criarFiltroMedicamentos("  ABAMECTINA   injetavel  20mL ")(nome)).toBe(true);
    expect(criarFiltroMedicamentos("solucao 0,5")("Solução 0.5% (Frasco 100 mL)")).toBe(true);
    expect(criarFiltroMedicamentos(" ")(nome)).toBe(true);
  });
});
