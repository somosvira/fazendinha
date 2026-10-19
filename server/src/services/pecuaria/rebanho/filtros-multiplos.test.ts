import { describe, expect, it, vi } from "vitest";
vi.mock("../../../db.js", () => ({ prisma: {} }));
import { listarFiltrosSchema, listarMovimentacoesSchema } from "./schemas.js";
import { whereAtributos, whereSituacao } from "./animais.js";
const a = "12345678-1234-4123-8123-123456789012";
const b = "12345678-1234-4123-8123-123456789013";
describe("multiseleção do rebanho", () => {
  it("normaliza listas, mantém links escalares e rejeita famílias ambíguas", () => {
    expect(listarFiltrosSchema.parse({ categoriaIds: [a, b, a] }).categoriaIds).toEqual([a, b]);
    expect(listarFiltrosSchema.parse({ sexo: "F" }).situacao).toBe("ATIVO");
    expect(listarFiltrosSchema.parse({ sexos: "F" }).sexos).toEqual(["F"]);
    expect(listarFiltrosSchema.safeParse({ sexo: "F", sexos: ["M"] }).success).toBe(false);
    expect(listarFiltrosSchema.safeParse({ situacao: "TODOS", situacoes: ["ATIVO"] }).success).toBe(false);
    expect(listarFiltrosSchema.safeParse({ semCategoria: true, categoriaIds: [a] }).success).toBe(false);
  });
  it("mantém sítio e lote na mesma localização, sem substituir o escopo", () => {
    const where = whereSituacao({ situacao: "ATIVO", propriedadeId: 114, propriedadeIds: [114, 115], loteIds: [a, b] });
    expect(where).toMatchObject({ localizacoes: { some: { ate: null, propriedadeId: 114, loteId: { in: [a, b] } } } });
  });
  it("combina atributos com OR por campo e preserva baixa", () => {
    expect(whereAtributos({ situacao: "ATIVO", sexos: ["F", "M"], origens: ["NASCIDO"], racaIds: [a, b] })).toEqual([
      { sexo: { in: ["F", "M"] } }, { origem: { in: ["NASCIDO"] } }, { composicao: { some: { racaId: { in: [a, b] } } } },
    ]);
  });
  it("rejeita período invertido nas movimentações", () => {
    expect(listarMovimentacoesSchema.safeParse({ dataDe: "2026-10-20", dataAte: "2026-10-18" }).success).toBe(false);
  });
});
