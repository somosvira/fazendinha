import { describe, it, expect } from "vitest";
import { toTimeline } from "./eventos-sanidade.mappers.js";
const b = { id: 9, animalId: 7 };
describe("toTimeline (sanidade)", () => {
  it("EXAME CCS alto marca alerta", () => { const t = toTimeline({ ...b, tipo: "EXAME", data: new Date("2026-05-12"), ccs: 512 } as any); expect(t.dominio).toBe("sanidade"); expect(t.titulo).toContain("512"); expect(t.alerta).toBe(true); });
  it("APLICACAO mostra carência e lote", () => { const t = toTimeline({ ...b, tipo: "APLICACAO", data: new Date("2026-04-14"), produto: "Mastijet", carencia: 96, loteProduto: "MAST-2231" } as any); expect(t.detalhe).toContain("carência 96h"); expect(t.detalhe).toContain("MAST-2231"); });
  it("MASTITE alerta", () => { expect(toTimeline({ ...b, tipo: "MASTITE", data: new Date("2026-04-14"), quarto: "PD" } as any).alerta).toBe(true); });
});
