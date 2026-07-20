import { describe, expect, it } from "vitest";
import { statusValidade, agruparLotes, type LoteQuant } from "./lote.calc.js";

const HOJE = "2026-07-20";

describe("statusValidade", () => {
  it("sem validade → sem-validade", () => {
    expect(statusValidade(null, HOJE)).toBe("sem-validade");
  });
  it("validade passada → vencido", () => {
    expect(statusValidade("2026-07-19", HOJE)).toBe("vencido");
  });
  it("dentro da janela de alerta (≤30d) → a-vencer", () => {
    expect(statusValidade("2026-07-20", HOJE)).toBe("a-vencer"); // hoje
    expect(statusValidade("2026-08-15", HOJE)).toBe("a-vencer"); // ~26d
  });
  it("além da janela → ok", () => {
    expect(statusValidade("2026-09-30", HOJE)).toBe("ok");
  });
  it("respeita alertaDias custom", () => {
    expect(statusValidade("2026-08-15", HOJE, 10)).toBe("ok"); // ~26d > 10
  });
});

const l = (validade: string | null): LoteQuant => ({ validade });

describe("agruparLotes", () => {
  it("conta por status", () => {
    const r = agruparLotes([l("2026-07-10"), l("2026-07-25"), l("2026-12-01"), l(null)], HOJE);
    expect(r).toEqual({ vencido: 1, "a-vencer": 1, ok: 1, "sem-validade": 1, total: 4 });
  });
  it("vazio → tudo 0", () => {
    expect(agruparLotes([], HOJE)).toEqual({ vencido: 0, "a-vencer": 0, ok: 0, "sem-validade": 0, total: 0 });
  });
});
