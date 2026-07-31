import { describe, expect, it } from "vitest";
import { relatorioQuerySchema } from "./relatorios.schemas.js";

describe("schema de consulta de relatórios", () => {
  it("normaliza filtros comuns vindos da querystring", () => {
    expect(relatorioQuerySchema.parse({
      templateId: "ia-periodo",
      dataInicio: "2026-06-01",
      dataFim: "2026-06-30",
      grupoId: "7",
      categoria: "VACA",
    })).toMatchObject({
      templateId: "ia-periodo",
      dataInicio: "2026-06-01",
      dataFim: "2026-06-30",
      grupoId: 7,
      categoria: "VACA",
      status: "ATIVO",
    });
  });

  it("aceita templates de estado sem período", () => {
    expect(relatorioQuerySchema.parse({ templateId: "gestantes-atual" })).toEqual({
      templateId: "gestantes-atual",
      status: "ATIVO",
    });
  });

  it("exige período nos templates históricos", () => {
    expect(relatorioQuerySchema.safeParse({ templateId: "ia-periodo" }).success).toBe(false);
  });

  it("exige período para o template de partos previstos", () => {
    expect(relatorioQuerySchema.safeParse({ templateId: "partos-previstos" }).success).toBe(false);
  });

  it("recusa janela invertida", () => {
    const r = relatorioQuerySchema.safeParse({
      templateId: "dg-periodo",
      dataInicio: "2026-07-01",
      dataFim: "2026-06-01",
    });
    expect(r.success).toBe(false);
  });

  it("recusa template, categoria e resultado desconhecidos", () => {
    expect(relatorioQuerySchema.safeParse({ templateId: "inventado" }).success).toBe(false);
    expect(relatorioQuerySchema.safeParse({ templateId: "gestantes-atual", categoria: "MATRIZ" }).success).toBe(false);
    expect(relatorioQuerySchema.safeParse({ templateId: "dg-periodo", dataInicio: "2026-01-01", dataFim: "2026-01-31", resultado: "talvez" }).success).toBe(false);
  });
});
