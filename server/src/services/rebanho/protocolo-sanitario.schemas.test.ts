import { describe, expect, it } from "vitest";
import { criarProtocoloSanitarioSchema, aplicarProtocoloSanitarioSchema } from "./protocolo-sanitario.schemas.js";

describe("criarProtocoloSanitarioSchema", () => {
  it("aceita protocolo com etapas válidas", () => {
    const r = criarProtocoloSanitarioSchema.safeParse({
      nome: "Protocolo de recria", etapas: [{ dia: 0, acao: "Vacina clostridiose 1ª dose", produto: "Poli-Star" }, { dia: 21, acao: "Reforço" }],
    });
    expect(r.success).toBe(true);
  });
  it("rejeita sem etapas", () => {
    expect(criarProtocoloSanitarioSchema.safeParse({ nome: "X", etapas: [] }).success).toBe(false);
  });
  it("rejeita dia negativo", () => {
    expect(criarProtocoloSanitarioSchema.safeParse({ nome: "X", etapas: [{ dia: -1, acao: "y" }] }).success).toBe(false);
  });
  it("rejeita ação vazia", () => {
    expect(criarProtocoloSanitarioSchema.safeParse({ nome: "X", etapas: [{ dia: 0, acao: "" }] }).success).toBe(false);
  });
});

describe("aplicarProtocoloSanitarioSchema", () => {
  it("aceita protocoloId + data", () => {
    expect(aplicarProtocoloSanitarioSchema.safeParse({ protocoloId: 3, dataInicio: "2026-07-01" }).success).toBe(true);
  });
  it("rejeita data mal formatada", () => {
    expect(aplicarProtocoloSanitarioSchema.safeParse({ protocoloId: 3, dataInicio: "01/07/2026" }).success).toBe(false);
  });
});
