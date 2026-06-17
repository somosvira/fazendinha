import { describe, it, expect } from "vitest";
import { criarAnimalSchema, baixaSchema } from "./animais.schemas.js";

describe("criarAnimalSchema", () => {
  it("aceita um animal mínimo válido", () => {
    const r = criarAnimalSchema.safeParse({ numero: "1500", sexo: "F", categoria: "NOVILHA", dataEntrada: "2026-06-01" });
    expect(r.success).toBe(true);
  });
  it("rejeita numero vazio", () => {
    expect(criarAnimalSchema.safeParse({ numero: "", sexo: "F", categoria: "VACA", dataEntrada: "2026-06-01" }).success).toBe(false);
  });
  it("rejeita categoria inválida", () => {
    expect(criarAnimalSchema.safeParse({ numero: "9", sexo: "F", categoria: "ALIEN", dataEntrada: "2026-06-01" }).success).toBe(false);
  });
});

describe("baixaSchema", () => {
  it("exige motivo", () => {
    expect(baixaSchema.safeParse({ motivo: "" }).success).toBe(false);
    expect(baixaSchema.safeParse({ motivo: "venda", data: "2026-06-10" }).success).toBe(true);
  });
});
