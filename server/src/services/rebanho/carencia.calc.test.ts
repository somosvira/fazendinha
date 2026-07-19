import { describe, it, expect } from "vitest";
import { fimDaCarencia, carenciaAtiva, type AplicacaoCarencia } from "./carencia.calc.js";

// Datas de evento são @db.Date → 00:00 UTC na data civil da fazenda.
const D = (s: string) => new Date(`${s}T00:00:00Z`);
// Instante "agora" arbitrário (com hora), para exercitar horas restantes.
const T = (s: string) => new Date(s);
const aplic = (data: string, carencia: number | null): AplicacaoCarencia => ({ data: D(data), carencia });

describe("fimDaCarencia", () => {
  it("soma as horas de carência ao início do dia da aplicação", () => {
    // 2026-05-10 00:00Z + 96h = 2026-05-14 00:00Z
    expect(fimDaCarencia(D("2026-05-10"), 96)).toEqual(new Date("2026-05-14T00:00:00Z"));
  });

  it("carência de 12h termina no mesmo dia ao meio-dia", () => {
    expect(fimDaCarencia(D("2026-05-10"), 12)).toEqual(new Date("2026-05-10T12:00:00Z"));
  });

  it("carência null → sem fim (null)", () => {
    expect(fimDaCarencia(D("2026-05-10"), null)).toBeNull();
  });

  it("carência 0 → sem fim (0h de carência é liberação imediata)", () => {
    expect(fimDaCarencia(D("2026-05-10"), 0)).toBeNull();
  });

  it("carência negativa (dado inválido) → sem fim", () => {
    expect(fimDaCarencia(D("2026-05-10"), -5)).toBeNull();
  });
});

describe("carenciaAtiva", () => {
  it("sem eventos → null", () => {
    expect(carenciaAtiva([], T("2026-05-12T09:00:00Z"))).toBeNull();
  });

  it("evento único com janela ainda aberta → ativa, com horas restantes", () => {
    // fim = 2026-05-14 00:00Z; agora = 2026-05-13 00:00Z → 24h / 1 dia restante
    const r = carenciaAtiva([aplic("2026-05-10", 96)], T("2026-05-13T00:00:00Z"));
    expect(r).not.toBeNull();
    expect(r!.fim).toEqual(new Date("2026-05-14T00:00:00Z"));
    expect(r!.horasRestantes).toBe(24);
    expect(r!.diasRestantes).toBe(1);
  });

  it("janela já expirada → null", () => {
    // fim = 2026-05-14 00:00Z; agora depois disso
    expect(carenciaAtiva([aplic("2026-05-10", 96)], T("2026-05-14T00:00:01Z"))).toBeNull();
  });

  it("exatamente no instante do fim → não ativa (janela é fechada no fim)", () => {
    expect(carenciaAtiva([aplic("2026-05-10", 96)], T("2026-05-14T00:00:00Z"))).toBeNull();
  });

  it("escolhe a janela que termina mais tarde entre várias ativas", () => {
    const r = carenciaAtiva(
      [aplic("2026-05-10", 96), aplic("2026-05-12", 120)], // fim 05-14 vs 05-17
      T("2026-05-13T00:00:00Z"),
    );
    expect(r!.fim).toEqual(new Date("2026-05-17T00:00:00Z"));
  });

  it("ignora eventos sem carência ao escolher a janela ativa", () => {
    const r = carenciaAtiva(
      [aplic("2026-05-10", null), aplic("2026-05-11", 0), aplic("2026-05-12", 72)],
      T("2026-05-13T00:00:00Z"),
    );
    expect(r).not.toBeNull();
    expect(r!.fim).toEqual(new Date("2026-05-15T00:00:00Z"));
  });

  it("arredonda horas restantes para cima (parte de hora ainda conta como carência)", () => {
    // fim 05-14 00:00Z; agora 05-13 01:30Z → faltam 22.5h → 23h, 1 dia
    const r = carenciaAtiva([aplic("2026-05-10", 96)], T("2026-05-13T01:30:00Z"));
    expect(r!.horasRestantes).toBe(23);
    expect(r!.diasRestantes).toBe(1);
  });
});
