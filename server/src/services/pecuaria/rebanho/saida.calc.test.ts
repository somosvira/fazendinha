import { describe, expect, it } from "vitest";
import { SaidaError, planejarEstornoSaida, planejarSaida } from "./saida.calc.js";

describe("planejarSaida", () => {
  it("fecha localização e destino abertos", () => {
    const plano = planejarSaida({
      animalAtivo: true,
      localizacaoAberta: { id: "loc1", desde: "2026-01-01" },
      destinoAberto: { id: "dst1", desde: "2026-01-01" },
      data: "2026-03-01",
    });
    expect(plano).toEqual({
      fecharLocalizacao: { id: "loc1", ate: "2026-03-01" },
      fecharDestino: { id: "dst1", ate: "2026-03-01" },
    });
  });

  it("sem linhas abertas: nada a fechar", () => {
    const plano = planejarSaida({ animalAtivo: true, localizacaoAberta: null, destinoAberto: null, data: "2026-03-01" });
    expect(plano).toEqual({ fecharLocalizacao: null, fecharDestino: null });
  });

  it("bloqueia saída de animal já inativo", () => {
    expect(() =>
      planejarSaida({ animalAtivo: false, localizacaoAberta: null, destinoAberto: null, data: "2026-03-01" }),
    ).toThrow(SaidaError);
  });
});

it("planejarSaida bloqueia data anterior ao início da localização/destino abertos", () => {
  expect(() =>
    planejarSaida({ animalAtivo: true, localizacaoAberta: { id: "l", desde: "2026-03-10" }, destinoAberto: null, data: "2026-03-01" }),
  ).toThrow(SaidaError);
  expect(() =>
    planejarSaida({ animalAtivo: true, localizacaoAberta: null, destinoAberto: { id: "d", desde: "2026-03-10" }, data: "2026-03-01" }),
  ).toThrow(SaidaError);
  // mesma data da movimentação é permitida
  expect(planejarSaida({ animalAtivo: true, localizacaoAberta: { id: "l", desde: "2026-03-01" }, destinoAberto: null, data: "2026-03-01" }).fecharLocalizacao)
    .toEqual({ id: "l", ate: "2026-03-01" });
});

describe("planejarEstornoSaida", () => {
  it("reabre exatamente as linhas que a saída fechou", () => {
    const plano = planejarEstornoSaida({
      saida: { localizacaoFechadaId: "loc-principal", destinoFechadoId: "dst1" },
      localizacaoAberta: null,
      destinoAberto: null,
    });
    expect(plano).toEqual({ reabrirLocalizacao: { id: "loc-principal" }, reabrirDestino: { id: "dst1" } });
  });

  it("regressão: movimentação e saída no mesmo dia — reabre a linha da saída, não a anterior", () => {
    // Mexicana (fechada pela movimentação em 2026-03-01) → Principal (fechada pela saída em 2026-03-01).
    // As duas têm ate = 2026-03-01; só o id gravado na saída desambigua.
    const plano = planejarEstornoSaida({
      saida: { localizacaoFechadaId: "loc-principal", destinoFechadoId: null },
      localizacaoAberta: null,
      destinoAberto: null,
    });
    expect(plano.reabrirLocalizacao).toEqual({ id: "loc-principal" });
  });

  it("saída sem linhas fechadas (ex.: legado sem localização): nada a reabrir", () => {
    expect(planejarEstornoSaida({ saida: { localizacaoFechadaId: null, destinoFechadoId: null }, localizacaoAberta: null, destinoAberto: null }))
      .toEqual({ reabrirLocalizacao: null, reabrirDestino: null });
  });

  it("recusa se já existe outra linha aberta", () => {
    expect(() => planejarEstornoSaida({
      saida: { localizacaoFechadaId: "l1", destinoFechadoId: null },
      localizacaoAberta: { id: "l2" },
      destinoAberto: null,
    })).toThrow(SaidaError);
  });
});
