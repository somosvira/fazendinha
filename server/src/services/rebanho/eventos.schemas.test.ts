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
  it("COBERTURA aceita só data (touro opcional)", () => {
    expect(criarEventoSchema.safeParse({ tipo: "COBERTURA", data: "2026-04-28" }).success).toBe(true);
    expect(criarEventoSchema.safeParse({ tipo: "COBERTURA", data: "2026-04-28", reprodutor: "Touro 1" }).success).toBe(true);
  });
  it("PARTO exige numCrias >= 1, exceto quando é aborto", () => {
    expect(criarEventoSchema.safeParse({ tipo: "PARTO", data: "2026-01-22", numCrias: 1 }).success).toBe(true);
    expect(criarEventoSchema.safeParse({ tipo: "PARTO", data: "2026-01-22", numCrias: 0 }).success).toBe(false);
    expect(criarEventoSchema.safeParse({ tipo: "PARTO", data: "2026-01-22", tipoParto: "3", numCrias: 0 }).success).toBe(true); // 3=Aborto
  });
  it("CIO só precisa de data", () => {
    expect(criarEventoSchema.safeParse({ tipo: "CIO", data: "2026-04-01" }).success).toBe(true);
  });
  it("TRANSFERENCIA_EMBRIAO: só data obrigatória; doadoraId/reprodutor opcionais", () => {
    expect(criarEventoSchema.safeParse({ tipo: "TRANSFERENCIA_EMBRIAO", data: "2026-04-10" }).success).toBe(true);
    expect(criarEventoSchema.safeParse({ tipo: "TRANSFERENCIA_EMBRIAO", data: "2026-04-10", doadoraId: 42, reprodutor: "GEN 12" }).success).toBe(true);
    expect(criarEventoSchema.safeParse({ tipo: "TRANSFERENCIA_EMBRIAO", data: "2026-04-10", doadoraId: -1 }).success).toBe(false);
  });
  it("DESMAME: só data obrigatória; pesoKg opcional e positivo", () => {
    expect(criarEventoSchema.safeParse({ tipo: "DESMAME", data: "2026-06-01" }).success).toBe(true);
    expect(criarEventoSchema.safeParse({ tipo: "DESMAME", data: "2026-06-01", pesoKg: 190 }).success).toBe(true);
    expect(criarEventoSchema.safeParse({ tipo: "DESMAME", data: "2026-06-01", pesoKg: -5 }).success).toBe(false);
  });
});
