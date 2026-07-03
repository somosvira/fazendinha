import { describe, it, expect } from "vitest";
import { classificarVencimento, diffDias } from "./vencimentos.js";

const HOJE = "2026-05-28";

describe("diffDias (UTC, atravessa fim de mês)", () => {
  it("mesmo dia → 0", () => {
    expect(diffDias(HOJE, HOJE)).toBe(0);
  });
  it("conta dias atravessando a virada do mês", () => {
    // 28/mai → 04/jun = 7 dias
    expect(diffDias("2026-05-28", "2026-06-04")).toBe(7);
    // 27/mai é 1 dia antes de 28/mai
    expect(diffDias("2026-05-28", "2026-05-27")).toBe(-1);
  });
});

describe("classificarVencimento — cada bucket + limites", () => {
  it("VENCIDA quando vencimento < hoje", () => {
    expect(classificarVencimento("2026-05-27", HOJE)).toBe("VENCIDA"); // -1 dia
    expect(classificarVencimento("2026-05-01", HOJE)).toBe("VENCIDA"); // muito atrasada
  });

  it("HOJE quando vencimento == hoje (0 dias)", () => {
    expect(classificarVencimento("2026-05-28", HOJE)).toBe("HOJE");
  });

  it("D3 quando 1..3 dias (limites 1 e 3)", () => {
    expect(classificarVencimento("2026-05-29", HOJE)).toBe("D3"); // 1 dia
    expect(classificarVencimento("2026-05-30", HOJE)).toBe("D3"); // 2 dias
    expect(classificarVencimento("2026-05-31", HOJE)).toBe("D3"); // 3 dias
  });

  it("D7 quando 4..7 dias (limites 4 e 7)", () => {
    expect(classificarVencimento("2026-06-01", HOJE)).toBe("D7"); // 4 dias
    expect(classificarVencimento("2026-06-04", HOJE)).toBe("D7"); // 7 dias
  });

  it("FUTURO quando > 7 dias (limite 8)", () => {
    expect(classificarVencimento("2026-06-05", HOJE)).toBe("FUTURO"); // 8 dias
    expect(classificarVencimento("2026-07-28", HOJE)).toBe("FUTURO"); // bem no futuro
  });
});

describe("classificarVencimento — ordem dos buckets ao longo dos dias", () => {
  it("a sequência de -1..8 dias produz a ordem esperada dos buckets", () => {
    // hoje ancorado; offsets de dias em torno dele.
    const seq = [-1, 0, 1, 3, 4, 7, 8].map((offset) => {
      const d = new Date(Date.parse(HOJE) + offset * 86_400_000);
      return classificarVencimento(d.toISOString().slice(0, 10), HOJE);
    });
    expect(seq).toEqual(["VENCIDA", "HOJE", "D3", "D3", "D7", "D7", "FUTURO"]);
  });
});
