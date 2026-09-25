import { describe, expect, it, vi } from "vitest";
import { CENTROS_ATIVIDADE, obterCentrosAtividade, resolverIdsCentros } from "./centros-atividade.js";
import { uid } from "../../lib/uid.fixture.js";

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
    const findMany = vi.fn().mockResolvedValue([{ id: uid(1) }, { id: uid(2) }]);
    const ids = await resolverIdsCentros({ centroCusto: { findMany } }, [CENTROS_ATIVIDADE.LEITE, CENTROS_ATIVIDADE.CAFE]);
    expect(ids).toEqual([uid(1), uid(2)]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({ where: { nome: { in: [CENTROS_ATIVIDADE.LEITE, CENTROS_ATIVIDADE.CAFE] } }, select: { id: true } });
  });
});

describe("obterCentrosAtividade", () => {
  it("resolve café num único findMany", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: uid(9), nome: CENTROS_ATIVIDADE.CAFE },
    ]);
    const resultado = await obterCentrosAtividade({ centroCusto: { findMany } });
    expect(resultado).toEqual({ cafe: uid(9) });
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { nome: { in: [CENTROS_ATIVIDADE.CAFE] } },
      select: { id: true, nome: true },
    });
  });

  it("retorna null para o que não for encontrado", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const resultado = await obterCentrosAtividade({ centroCusto: { findMany } });
    expect(resultado).toEqual({ cafe: null });
  });
});
