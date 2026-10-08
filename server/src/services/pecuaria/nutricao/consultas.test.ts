import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
vi.mock("../../../db.js", () => ({ prisma: {} }));
import { apresentarResumoCusto } from "./consultas.js";

describe("resumo de custo nutricional", () => {
  const agregado = { loteId: "lote", fechamentos: 27, animalDias: 159, custoConhecido: new Prisma.Decimal("174"), coberturaCustoCompleta: true };
  it("usa a base histórica inteira e calcula a média ponderada", () => {
    expect(apresentarResumoCusto(agregado, true)).toEqual({ fechamentos: 27, animalDias: 159, custoConhecido: "174.00", custoPorAnimalDia: "1.09", coberturaCustoCompleta: true });
  });
  it("não revela total nem média sem permissão financeira", () => {
    expect(apresentarResumoCusto(agregado, false)).toMatchObject({ custoConhecido: null, custoPorAnimalDia: null, animalDias: 159 });
  });
  it("distingue ausência, custo zero e custo parcial", () => {
    expect(apresentarResumoCusto(undefined, true)).toEqual({ fechamentos: 0, animalDias: 0, custoConhecido: null, custoPorAnimalDia: null, coberturaCustoCompleta: false });
    expect(apresentarResumoCusto({ ...agregado, custoConhecido: null, coberturaCustoCompleta: false }, true)).toMatchObject({ custoConhecido: null, custoPorAnimalDia: null, coberturaCustoCompleta: false });
    expect(apresentarResumoCusto({ ...agregado, custoConhecido: new Prisma.Decimal(0) }, true)).toMatchObject({ custoConhecido: "0.00", custoPorAnimalDia: "0.00" });
    expect(apresentarResumoCusto({ ...agregado, coberturaCustoCompleta: false }, true)).toMatchObject({ custoConhecido: "174.00", custoPorAnimalDia: "1.09", coberturaCustoCompleta: false });
  });
});
