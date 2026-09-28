import { describe, expect, it } from "vitest";
import { formatarGmd, formatarKg, rotuloPeriodoGmd, inicioJanelaGmd } from "./peso";

describe("formatarGmd", () => {
  it("mostra sinal, três casas e unidade", () => {
    expect(formatarGmd(0.5123)).toBe("+0,512 kg/dia");
    expect(formatarGmd(-0.1)).toBe("−0,100 kg/dia");
    expect(formatarGmd(0)).toBe("0,000 kg/dia");
  });
  it("sem valor vira travessão", () => {
    expect(formatarGmd(null)).toBe("—");
    expect(formatarGmd(undefined)).toBe("—");
  });
});

describe("formatarKg e rotuloPeriodoGmd", () => {
  it("formata peso", () => {
    expect(formatarKg(262)).toBe("262 kg");
    expect(formatarKg(262.5)).toBe("262,5 kg");
    expect(formatarKg(null)).toBe("—");
  });
  it("descreve o período", () => {
    expect(rotuloPeriodoGmd(90)).toBe("últimos 90 dias");
    expect(rotuloPeriodoGmd(365)).toBe("últimos 12 meses");
    expect(rotuloPeriodoGmd("entrada")).toBe("desde a entrada");
    expect(rotuloPeriodoGmd(null)).toBe("desde a entrada");
  });
});

describe("inicioJanelaGmd", () => {
  it("conta os dias para trás a partir do limite", () => {
    expect(inicioJanelaGmd(30, "2026-09-26")).toBe("2026-08-27");
    expect(inicioJanelaGmd(365, "2026-09-26")).toBe("2025-09-26");
  });
  it("'desde a entrada' não tem limite inferior", () => {
    expect(inicioJanelaGmd("entrada", "2026-09-26")).toBeNull();
  });
});
