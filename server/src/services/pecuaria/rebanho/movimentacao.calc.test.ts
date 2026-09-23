import { describe, expect, it } from "vitest";
import { MovimentacaoError, planejarDesfazer, planejarDestino, planejarMovimentacao } from "./movimentacao.calc.js";

describe("planejarMovimentacao", () => {
  it("sem localização atual: abre a primeira", () => {
    const plano = planejarMovimentacao({ atual: null, destino: { propriedadeId: 1, loteId: "l1" }, data: "2026-01-01" });
    expect(plano).toEqual({
      tipo: "MOVER",
      fechar: null,
      abrir: { propriedadeId: 1, loteId: "l1", desde: "2026-01-01" },
    });
  });

  it("mesmo sítio e lote: sem mudança", () => {
    const plano = planejarMovimentacao({
      atual: { propriedadeId: 1, loteId: "l1", desde: "2026-01-01" },
      destino: { propriedadeId: 1, loteId: "l1" },
      data: "2026-02-01",
    });
    expect(plano).toEqual({ tipo: "SEM_MUDANCA" });
  });

  it("mudança de lote no mesmo sítio: fecha e abre", () => {
    const plano = planejarMovimentacao({
      atual: { propriedadeId: 1, loteId: "l1", desde: "2026-01-01" },
      destino: { propriedadeId: 1, loteId: "l2" },
      data: "2026-02-01",
    });
    expect(plano).toEqual({
      tipo: "MOVER",
      fechar: { ate: "2026-02-01" },
      abrir: { propriedadeId: 1, loteId: "l2", desde: "2026-02-01" },
    });
  });

  it("lança erro se a data for anterior ao início da localização atual", () => {
    expect(() =>
      planejarMovimentacao({
        atual: { propriedadeId: 1, loteId: "l1", desde: "2026-02-01" },
        destino: { propriedadeId: 2, loteId: null },
        data: "2026-01-01",
      }),
    ).toThrow(MovimentacaoError);
  });
});

describe("planejarDestino", () => {
  it("sem destino atual: abre o primeiro", () => {
    const plano = planejarDestino({
      atual: null,
      novo: { aptidao: "LEITE", papelReprodutivo: "NENHUM" },
      data: "2026-01-01",
    });
    expect(plano).toEqual({
      tipo: "MOVER",
      fechar: null,
      abrir: { aptidao: "LEITE", papelReprodutivo: "NENHUM", desde: "2026-01-01" },
    });
  });

  it("mesmo destino: sem mudança", () => {
    const plano = planejarDestino({
      atual: { aptidao: "LEITE", papelReprodutivo: "NENHUM", desde: "2026-01-01" },
      novo: { aptidao: "LEITE", papelReprodutivo: "NENHUM" },
      data: "2026-02-01",
    });
    expect(plano).toEqual({ tipo: "SEM_MUDANCA" });
  });

  it("vaca de leite vira receptora: fecha e abre", () => {
    const plano = planejarDestino({
      atual: { aptidao: "LEITE", papelReprodutivo: "NENHUM", desde: "2026-01-01" },
      novo: { aptidao: "LEITE", papelReprodutivo: "RECEPTORA" },
      data: "2026-02-01",
    });
    expect(plano).toEqual({
      tipo: "MOVER",
      fechar: { ate: "2026-02-01" },
      abrir: { aptidao: "LEITE", papelReprodutivo: "RECEPTORA", desde: "2026-02-01" },
    });
  });

  it("lança erro se a data for anterior ao início do destino atual", () => {
    expect(() =>
      planejarDestino({
        atual: { aptidao: "LEITE", papelReprodutivo: "NENHUM", desde: "2026-02-01" },
        novo: { aptidao: "CORTE", papelReprodutivo: "NENHUM" },
        data: "2026-01-01",
      }),
    ).toThrow(MovimentacaoError);
  });
});

describe("planejarDesfazer", () => {
  it("remove a linha aberta e reabre a anterior", () => {
    const plano = planejarDesfazer([
      { id: "l1", desde: "2026-01-01", ate: "2026-02-01" },
      { id: "l2", desde: "2026-02-01", ate: null },
    ]);
    expect(plano).toEqual({ remover: { id: "l2" }, reabrir: { id: "l1" } });
  });

  it("com mais de duas linhas, reabre a imediatamente anterior por desde", () => {
    const plano = planejarDesfazer([
      { id: "l1", desde: "2026-01-01", ate: "2026-02-01" },
      { id: "l2", desde: "2026-02-01", ate: "2026-03-01" },
      { id: "l3", desde: "2026-03-01", ate: null },
    ]);
    expect(plano).toEqual({ remover: { id: "l3" }, reabrir: { id: "l2" } });
  });

  it("lança erro com menos de duas linhas", () => {
    expect(() => planejarDesfazer([{ id: "l1", desde: "2026-01-01", ate: null }])).toThrow(MovimentacaoError);
    expect(() => planejarDesfazer([])).toThrow(MovimentacaoError);
  });

  it("lança erro se não houver linha aberta", () => {
    expect(() =>
      planejarDesfazer([
        { id: "l1", desde: "2026-01-01", ate: "2026-02-01" },
        { id: "l2", desde: "2026-02-01", ate: "2026-03-01" },
      ]),
    ).toThrow(MovimentacaoError);
  });
});
