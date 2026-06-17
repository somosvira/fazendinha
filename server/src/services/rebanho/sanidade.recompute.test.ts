import { describe, it, expect } from "vitest";
import { recomputarResumoSanidade } from "./sanidade.recompute.js";
const ex = (data: string, ccs: number) => ({ tipo: "EXAME" as const, data, ccs });
describe("recomputarResumoSanidade", () => {
  it("CCS subindo (3 controles crescentes)", () => {
    const r = recomputarResumoSanidade([ex("2026-03-12", 245), ex("2026-04-12", 389), ex("2026-05-12", 512)]);
    expect(r.ccs).toBe(512);
    expect(r.ccsTendencia).toBe("subindo");
  });
  it("CCS caindo", () => {
    expect(recomputarResumoSanidade([ex("2026-03-01", 400), ex("2026-04-01", 200), ex("2026-05-01", 120)]).ccsTendencia).toBe("caindo");
  });
  it("estável quando oscila", () => {
    expect(recomputarResumoSanidade([ex("2026-03-01", 200), ex("2026-04-01", 350), ex("2026-05-01", 300)]).ccsTendencia).toBe("estavel");
  });
  it("sem exames → nulls; ignora eventos não-EXAME", () => {
    const r = recomputarResumoSanidade([{ tipo: "MASTITE", data: "2026-04-01" } as any]);
    expect(r).toEqual({ ccs: null, ccsTendencia: null });
  });
});
