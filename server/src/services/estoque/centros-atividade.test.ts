import { describe, expect, it, vi } from "vitest";
import { CENTROS_ATIVIDADE, resolverIdsCentros } from "./centros-atividade.js";

describe("CENTROS_ATIVIDADE", () => {
  it("expõe os quatro nomes canônicos", () => {
    expect(CENTROS_ATIVIDADE).toEqual({
      LEITE: "Atividade Leiteira",
      CAFE: "Plantio Café",
      CAFE_INVESTIMENTO: "Plantio Café - investimento",
      PLANTIO: "Atividade Plantio",
    });
  });
});

describe("resolverIdsCentros", () => {
  it("retorna [] sem consultar o banco quando não há nomes", async () => {
    const findMany = vi.fn();
    const ids = await resolverIdsCentros({ centroCusto: { findMany } }, []);
    expect(ids).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("resolve ids via um único findMany", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const ids = await resolverIdsCentros({ centroCusto: { findMany } }, [CENTROS_ATIVIDADE.LEITE, CENTROS_ATIVIDADE.CAFE]);
    expect(ids).toEqual([1, 2]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({ where: { nome: { in: [CENTROS_ATIVIDADE.LEITE, CENTROS_ATIVIDADE.CAFE] } }, select: { id: true } });
  });
});
