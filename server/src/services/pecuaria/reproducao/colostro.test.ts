import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
vi.mock("../rebanho/animais.js", () => ({ registrarPesagemTx: vi.fn() }));
vi.mock("../sanidade/ocorrencias.js", () => ({ criarOcorrenciaTx: vi.fn() }));
import { normalizarColostro } from "./colostro.js";
import { fornecimentoColostroSchema } from "./colostro.schemas.js";
const anterior = (extra = {}) => ({ quantidadeLitros: null, unidadeInformada: null, metodoQualidade: null, qualidadeBrix: null, qualidadeClassificacao: null, ocorridoEm: null, horarioEstimado: false, ...extra } as Prisma.FornecimentoColostroGetPayload<Record<string, never>>);
describe("fornecimento de colostro por cria", () => {
  it("converte mL em litros sem arredondamento silencioso", () => {
    expect(normalizarColostro({ quantidade: 2500, unidade: "ML" }, "2026-01-01").quantidadeLitros?.toString()).toBe("2.5");
    expect(normalizarColostro({ quantidade: 2.5, unidade: "L" }, "2026-01-01").quantidadeLitros?.toString()).toBe("2.5");
    expect(() => normalizarColostro({ quantidade: 0.1, unidade: "ML" }, "2026-01-01")).toThrow(/precisão/);
  });
  it("preserva ausência e exige quantidade/unidade juntas", () => {
    expect(normalizarColostro({}, "2026-01-01").quantidadeLitros).toBeNull();
    expect(() => normalizarColostro({ quantidade: 2 }, "2026-01-01")).toThrow(/juntas/);
    expect(() => normalizarColostro({ unidade: "ML" }, "2026-01-01")).toThrow(/juntas/);
  });
  it("não interpreta Brix zero como ausência nem inventa classificação", () => {
    const normalizado = normalizarColostro({ metodoQualidade: "REFRATOMETRO_BRIX", qualidadeBrix: 0 }, "2026-01-01");
    expect(normalizado.qualidadeBrix?.toString()).toBe("0");
    expect(normalizado.qualidadeClassificacao).toBeNull();
  });
  it("recusa qualidade sem método e mistura de métodos", () => {
    expect(() => normalizarColostro({ qualidadeBrix: 23 }, "2026-01-01")).toThrow(/método explícito/);
    expect(() => normalizarColostro({ metodoQualidade: "REFRATOMETRO_BRIX", qualidadeBrix: 23, qualidadeClassificacao: "ALTA" }, "2026-01-01")).toThrow(/não admite/);
    expect(() => normalizarColostro({ metodoQualidade: "COLOSTROMETRO" }, "2026-01-01")).toThrow(/classificação/);
  });
  it("conserva precisão existente em correção parcial e não aceita futuro", () => {
    const existente = anterior({ ocorridoEm: new Date("2026-01-01T12:00:00Z"), horarioEstimado: true });
    expect(normalizarColostro({}, "2026-01-01", existente).horarioEstimado).toBe(true);
    expect(() => normalizarColostro({ ocorridoEm: "2099-01-01T12:00:00-03:00" }, "2099-01-01")).toThrow(/futuro/);
  });
  it("contrato separa tipos, formas e resultado sérico", () => {
    const base = { chave: "7e59821f-4c09-4e95-8d4e-699f32738c2b", criaId: "7e59821f-4c09-4e95-8d4e-699f32738c2b", propriedadeId: 1, data: "2026-01-01" };
    expect(fornecimentoColostroSchema.safeParse({ ...base, tipo: "FRESCO", forma: "MAMADEIRA", metodoQualidade: "COLOSTROMETRO", qualidadeClassificacao: "MEDIA" }).success).toBe(true);
    expect(fornecimentoColostroSchema.safeParse({ ...base, proteinaSerica: 5.5 }).success).toBe(false);
    expect(fornecimentoColostroSchema.safeParse({ ...base, tipo: "OUTRO_INFERIDO" }).success).toBe(false);
  });
});
