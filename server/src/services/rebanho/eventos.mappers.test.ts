import { describe, it, expect } from "vitest";
import { toTimeline } from "./eventos.mappers.js";

const base = { id: 5, animalId: 7 };
describe("toTimeline", () => {
  it("DG positivo", () => {
    const t = toTimeline({ ...base, tipo: "DIAGNOSTICO", data: new Date("2026-05-28"), resultado: "positivo", dtPartoPrevista: new Date("2027-02-22") } as any);
    expect(t).toMatchObject({ id: "5", animalId: "7", data: "2026-05-28", dominio: "reproducao" });
    expect(t.titulo).toContain("POSITIVO");
  });
  it("parto recebe marcador de lactação", () => {
    const t = toTimeline({ ...base, tipo: "PARTO", data: new Date("2026-01-22"), numCrias: 1, sexoCria: "F" } as any);
    expect(t.titulo).toContain("Parto");
    expect(t.marcador).toContain("lactação");
  });
  it("DG negativo marca alerta", () => {
    const t = toTimeline({ ...base, tipo: "DIAGNOSTICO", data: new Date("2026-05-14"), resultado: "negativo" } as any);
    expect(t.alerta).toBe(true);
  });
  it("TE mostra título de transferência, doadora e marcador de receptora", () => {
    const t = toTimeline({ ...base, tipo: "TRANSFERENCIA_EMBRIAO", data: new Date("2026-04-10"), doadoraId: 42, reprodutor: "GEN 12" } as any);
    expect(t.titulo).toContain("Transferência de embrião");
    expect(t.detalhe).toContain("doadora #42");
    expect(t.marcador).toBe("receptora");
  });
  it("DESMAME mostra peso (de resultado) e marcador desmamado", () => {
    const t = toTimeline({ ...base, tipo: "DESMAME", data: new Date("2026-06-01"), resultado: "190" } as any);
    expect(t.titulo).toBe("Desmame");
    expect(t.detalhe).toContain("190 kg");
    expect(t.marcador).toBe("desmamado");
  });
  it("DESMAME sem peso → sem detalhe de peso", () => {
    const t = toTimeline({ ...base, tipo: "DESMAME", data: new Date("2026-06-01") } as any);
    expect(t.titulo).toBe("Desmame");
    expect(t.detalhe).toBeUndefined();
  });
});
