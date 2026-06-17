import { describe, it, expect } from "vitest";
import { criarEventoSchema } from "./eventos.schemas.js";

describe("criarEventoSchema", () => {
  it("DIAGNOSTICO exige resultado válido", () => {
    expect(criarEventoSchema.safeParse({ tipo: "DIAGNOSTICO", data: "2026-05-28", resultado: "positivo" }).success).toBe(true);
    expect(criarEventoSchema.safeParse({ tipo: "DIAGNOSTICO", data: "2026-05-28", resultado: "talvez" }).success).toBe(false);
  });
  it("INSEMINACAO exige reprodutor", () => {
    expect(criarEventoSchema.safeParse({ tipo: "INSEMINACAO", data: "2026-04-28" }).success).toBe(false);
    expect(criarEventoSchema.safeParse({ tipo: "INSEMINACAO", data: "2026-04-28", reprodutor: "Lance 884" }).success).toBe(true);
  });
  it("PARTO exige numCrias >= 1", () => {
    expect(criarEventoSchema.safeParse({ tipo: "PARTO", data: "2026-01-22", numCrias: 1 }).success).toBe(true);
    expect(criarEventoSchema.safeParse({ tipo: "PARTO", data: "2026-01-22", numCrias: 0 }).success).toBe(false);
  });
  it("CIO só precisa de data", () => {
    expect(criarEventoSchema.safeParse({ tipo: "CIO", data: "2026-04-01" }).success).toBe(true);
  });
});
