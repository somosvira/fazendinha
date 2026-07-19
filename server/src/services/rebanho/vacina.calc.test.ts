import { describe, it, expect } from "vitest";
import { statusVacina, JANELA_VACINA_DIAS, type StatusVacina } from "./vacina.calc.js";

const hoje = "2026-07-19";

describe("statusVacina", () => {
  it("aplicada quando aplicadaEm != null (independente da data prevista)", () => {
    expect(statusVacina("2026-07-01", "2026-07-02", hoje)).toBe<StatusVacina>("aplicada");
    expect(statusVacina("2026-08-30", "2026-08-30", hoje)).toBe<StatusVacina>("aplicada");
  });

  it("vencida quando a data prevista já passou e não foi aplicada", () => {
    expect(statusVacina("2026-07-18", null, hoje)).toBe<StatusVacina>("vencida");
    expect(statusVacina("2026-01-01", null, hoje)).toBe<StatusVacina>("vencida");
  });

  it("proxima quando cai dentro da janela de antecedência (default 15 dias)", () => {
    expect(statusVacina("2026-07-19", null, hoje)).toBe<StatusVacina>("proxima"); // hoje mesmo
    expect(statusVacina("2026-07-25", null, hoje)).toBe<StatusVacina>("proxima");
    // fronteira exata da janela (hoje + JANELA)
    const naFronteira = new Date(Date.parse(`${hoje}T00:00:00Z`) + JANELA_VACINA_DIAS * 86_400_000).toISOString().slice(0, 10);
    expect(statusVacina(naFronteira, null, hoje)).toBe<StatusVacina>("proxima");
  });

  it("emdia quando a data prevista é futura além da janela", () => {
    expect(statusVacina("2026-09-01", null, hoje)).toBe<StatusVacina>("emdia");
    const alemDaJanela = new Date(Date.parse(`${hoje}T00:00:00Z`) + (JANELA_VACINA_DIAS + 1) * 86_400_000).toISOString().slice(0, 10);
    expect(statusVacina(alemDaJanela, null, hoje)).toBe<StatusVacina>("emdia");
  });

  it("aplicada tem precedência mesmo se a data prevista estava vencida", () => {
    expect(statusVacina("2026-01-01", "2026-07-10", hoje)).toBe<StatusVacina>("aplicada");
  });

  it("JANELA_VACINA_DIAS é positivo", () => {
    expect(JANELA_VACINA_DIAS).toBeGreaterThan(0);
  });
});
