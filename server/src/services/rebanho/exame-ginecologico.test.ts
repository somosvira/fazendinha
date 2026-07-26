import { describe, expect, it, vi } from "vitest";
import {
  RESULTADOS_GINECOLOGICOS_SEMENTE,
  listarResultadosGinecologicos,
  mapaAchadoParaResultado,
  semearResultadosGinecologicos,
} from "./exame-ginecologico.js";

describe("semearResultadosGinecologicos", () => {
  it("faz upsert por código para que execuções repetidas convirjam", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 1 });
    const db = { resultadoExameGinecologico: { upsert } } as any;
    const lista = [{
      codigo: 12,
      nomeResumido: "CL presente",
      nomeCompleto: "Corpo lúteo presente",
      tipo: "OVARIO",
      padrao: true,
    }];

    await semearResultadosGinecologicos(db, lista);
    await semearResultadosGinecologicos(db, lista);

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenNthCalledWith(1, {
      where: { codigo: 12 },
      create: lista[0],
      update: {
        nomeResumido: "CL presente",
        nomeCompleto: "Corpo lúteo presente",
        tipo: "OVARIO",
        padrao: true,
      },
    });
  });
});

describe("listarResultadosGinecologicos", () => {
  it("lista o catálogo compartilhado com padrão primeiro e nome em ordem", async () => {
    const oficial = { id: 2, codigo: 12, nomeResumido: "CL", nomeCompleto: null, tipo: "OVARIO", padrao: true };
    const findMany = vi.fn().mockResolvedValue([oficial]);
    const db = { resultadoExameGinecologico: { findMany } } as any;

    await expect(listarResultadosGinecologicos(db)).resolves.toEqual([oficial]);
    expect(findMany).toHaveBeenCalledWith({ orderBy: [{ padrao: "desc" }, { nomeResumido: "asc" }] });
  });

  it("oculta os seeds quando o catálogo oficial positivo já existe", async () => {
    const oficial = { id: 2, codigo: 12, nomeResumido: "CL", nomeCompleto: null, tipo: "OVARIO", padrao: true };
    const semente = { id: 1, codigo: -3, nomeResumido: "Corpo lúteo", nomeCompleto: null, tipo: "OVARIO", padrao: false };
    const db = { resultadoExameGinecologico: { findMany: vi.fn().mockResolvedValue([oficial, semente]) } } as any;

    await expect(listarResultadosGinecologicos(db)).resolves.toEqual([oficial]);
  });
});

describe("mapaAchadoParaResultado", () => {
  it("resolve os nove achados condensados para resultados-semente estáveis", () => {
    const codigos = new Set<number>();
    for (const achado of [
      "CICLANDO", "CIO", "CORPO_LUTEO", "GESTANTE", "ANESTRO",
      "CISTO_FOLICULAR", "CISTO_LUTEO", "ENDOMETRITE", "INDEFINIDO",
    ] as const) {
      const resultado = mapaAchadoParaResultado(achado);
      expect(resultado.nomeResumido.length).toBeGreaterThan(0);
      expect(resultado.codigo).toBeLessThan(0);
      codigos.add(resultado.codigo);
    }
    expect(codigos.size).toBe(9);
    expect(RESULTADOS_GINECOLOGICOS_SEMENTE).toHaveLength(9);
  });
});
