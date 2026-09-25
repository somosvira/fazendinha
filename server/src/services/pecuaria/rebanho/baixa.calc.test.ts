import { describe, expect, it } from "vitest";
import { BaixaError, CLASSES_POR_TIPO, mensagemMotivoRecusado, motivoAceito, planejarEstornoBaixa, planejarBaixa } from "./baixa.calc.js";

describe("planejarBaixa", () => {
  it("fecha localização e destino abertos", () => {
    const plano = planejarBaixa({
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
    const plano = planejarBaixa({ animalAtivo: true, localizacaoAberta: null, destinoAberto: null, data: "2026-03-01" });
    expect(plano).toEqual({ fecharLocalizacao: null, fecharDestino: null });
  });

  it("bloqueia baixa de animal já inativo", () => {
    expect(() =>
      planejarBaixa({ animalAtivo: false, localizacaoAberta: null, destinoAberto: null, data: "2026-03-01" }),
    ).toThrow(BaixaError);
  });
});

it("planejarBaixa bloqueia data anterior ao início da localização/destino abertos", () => {
  expect(() =>
    planejarBaixa({ animalAtivo: true, localizacaoAberta: { id: "l", desde: "2026-03-10" }, destinoAberto: null, data: "2026-03-01" }),
  ).toThrow(BaixaError);
  expect(() =>
    planejarBaixa({ animalAtivo: true, localizacaoAberta: null, destinoAberto: { id: "d", desde: "2026-03-10" }, data: "2026-03-01" }),
  ).toThrow(BaixaError);
  // mesma data da movimentação é permitida
  expect(planejarBaixa({ animalAtivo: true, localizacaoAberta: { id: "l", desde: "2026-03-01" }, destinoAberto: null, data: "2026-03-01" }).fecharLocalizacao)
    .toEqual({ id: "l", ate: "2026-03-01" });
});

describe("planejarEstornoBaixa", () => {
  it("reabre exatamente as linhas que a baixa fechou", () => {
    const plano = planejarEstornoBaixa({
      baixa: { localizacaoFechadaId: "loc-principal", destinoFechadoId: "dst1" },
      localizacaoAberta: null,
      destinoAberto: null,
    });
    expect(plano).toEqual({ reabrirLocalizacao: { id: "loc-principal" }, reabrirDestino: { id: "dst1" } });
  });

  it("regressão: movimentação e baixa no mesmo dia — reabre a linha da baixa, não a anterior", () => {
    // Mexicana (fechada pela movimentação em 2026-03-01) → Principal (fechada pela baixa em 2026-03-01).
    // As duas têm ate = 2026-03-01; só o id gravado na baixa desambigua.
    const plano = planejarEstornoBaixa({
      baixa: { localizacaoFechadaId: "loc-principal", destinoFechadoId: null },
      localizacaoAberta: null,
      destinoAberto: null,
    });
    expect(plano.reabrirLocalizacao).toEqual({ id: "loc-principal" });
  });

  it("baixa sem linhas fechadas (ex.: legado sem localização): nada a reabrir", () => {
    expect(planejarEstornoBaixa({ baixa: { localizacaoFechadaId: null, destinoFechadoId: null }, localizacaoAberta: null, destinoAberto: null }))
      .toEqual({ reabrirLocalizacao: null, reabrirDestino: null });
  });

  it("recusa se já existe outra linha aberta", () => {
    expect(() => planejarEstornoBaixa({
      baixa: { localizacaoFechadaId: "l1", destinoFechadoId: null },
      localizacaoAberta: { id: "l2" },
      destinoAberto: null,
    })).toThrow(BaixaError);
  });
});

describe("motivoAceito (tipo × classe)", () => {
  const matriz: Array<[Parameters<typeof motivoAceito>[0], Parameters<typeof motivoAceito>[1], boolean]> = [
    ["VENDA", "DESCARTE_VOLUNTARIO", true],
    ["VENDA", "DESCARTE_INVOLUNTARIO", true],
    ["VENDA", "MORTE", false],
    ["ABATE", "DESCARTE_VOLUNTARIO", true],
    ["ABATE", "DESCARTE_INVOLUNTARIO", true],
    ["ABATE", "MORTE", false],
    ["DOACAO", "DESCARTE_VOLUNTARIO", true],
    ["DOACAO", "DESCARTE_INVOLUNTARIO", true],
    ["DOACAO", "MORTE", false],
    ["MORTE", "MORTE", true],
    ["MORTE", "DESCARTE_VOLUNTARIO", false],
    ["MORTE", "DESCARTE_INVOLUNTARIO", false],
    ["EXTRAVIO", "DESCARTE_VOLUNTARIO", false],
    ["EXTRAVIO", "MORTE", false],
    ["CADASTRO_INDEVIDO", "DESCARTE_INVOLUNTARIO", false],
    ["CADASTRO_INDEVIDO", "MORTE", false],
  ];
  it.each(matriz)("%s + %s → %s", (tipo, classe, esperado) => {
    expect(motivoAceito(tipo, classe)).toBe(esperado);
  });

  it("todo tipo está na tabela", () => {
    expect(Object.keys(CLASSES_POR_TIPO).sort()).toEqual(["ABATE", "CADASTRO_INDEVIDO", "DOACAO", "EXTRAVIO", "MORTE", "VENDA"]);
  });

  it("mensagens explicam a recusa", () => {
    expect(mensagemMotivoRecusado("VENDA", "MORTE")).toBe("Motivo de morte não serve para baixa por venda");
    expect(mensagemMotivoRecusado("MORTE", "DESCARTE_VOLUNTARIO")).toBe("Motivo de descarte voluntário não serve para baixa por morte");
    expect(mensagemMotivoRecusado("EXTRAVIO", "MORTE")).toMatch(/não usa motivo/);
  });
});
