import { describe, expect, it } from "vitest";
import { consultaInsercoesRetiradaSchema, filtroInsercoesRetirada, limiteInsercaoRetirada } from "./insercoes-retirada.js";
import { anteriorIatf } from "../reproducao/horarios.calc.js";

describe("origem proposta da retirada", () => {
  it("dia sem horário conserva a precisão e inclui inserção com hora do mesmo dia local", () => {
    const limite = limiteInsercaoRetirada("2026-10-19");
    expect(limite.dia.toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(limite.limiteHora.toISOString()).toBe("2026-10-20T02:59:59.999Z");
    for (const valor of ["2026-10-19T02:59:00Z", "2026-10-20T02:59:59Z", "2026-10-20T03:00:00Z"]) {
      const insercao = new Date(valor);
      expect(insercao <= limite.limiteHora).toBe(!anteriorIatf(new Date("2026-10-19"), "DIA", insercao, "HORA"));
    }
  });
  it("respeita o horário de verão histórico ao limitar o dia local", () => {
    expect(limiteInsercaoRetirada("2018-12-01").limiteHora.toISOString()).toBe("2018-12-02T01:59:59.999Z");
  });
  it("com duas horas conhecidas, não propõe inserção posterior ao atendimento", () => {
    const limite = limiteInsercaoRetirada("2026-10-19T09:00:00-03:00");
    expect(limite.limiteHora.toISOString()).toBe("2026-10-19T12:00:00.000Z");
    expect(new Date("2026-10-19T12:00:01Z") > limite.limiteHora).toBe(true);
  });
  it("restringe ao animal, evidência de inserção e ausência de retirada mantida", () => {
    const filtro = filtroInsercoesRetirada("animal", "2026-10-19");
    expect(filtro).toMatchObject({ animalId: "animal", status: "VALIDO", retiradasDispositivo: { none: { OR: [{ status: "VALIDO" }, { realizacaoMantida: true }] } } });
    expect(filtro.OR).toHaveLength(2);
    expect(filtro.AND).toBeDefined();
    expect(filtroInsercoesRetirada("animal").AND).toBeUndefined();
  });
  it("mantém limite de dez e rejeita data inválida sem consultar dados", () => {
    expect(consultaInsercoesRetiradaSchema.safeParse({ porPagina: 11 }).success).toBe(false);
    expect(consultaInsercoesRetiradaSchema.safeParse({ realizadaEm: "amanhã" }).success).toBe(false);
    expect(consultaInsercoesRetiradaSchema.parse({ realizadaEm: "2026-10-19" }).porPagina).toBe(10);
  });
});
