import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { toTalhaoDTO, toResumoDTO } from "./mappers.js";

const row: any = {
  id: 7, codigo: "CAF-01", nome: "Cafundó alto",
  variedade: { id: 1, nome: "Catuaí Vermelho IAC 144" },
  lavoura: { id: 1, nome: "Cafundó" },
  espacamento: "3,80 × 0,60 m",
  plantasHa: 4385,
  areaHa: new Prisma.Decimal("4.20"),
  anoPlantio: 2010,
  altitude: 1080,
  exposicao: "leste",
  declive: new Prisma.Decimal("14.0"),
  irrigado: false,
  estado: "ATIVO",
  dataPlantio: new Date("2010-11-12"),
  ultimaRecepa: new Date("2020-08-15"),
  observacao: null,
  resumo: {
    talhaoId: 7, fase: "MATURACAO_CEREJA", diasNaFase: 38,
    proximaOperacao: "Iniciar colheita", proximaOperacaoEm: new Date("2026-06-02"),
    produtividadeEsperada: new Prisma.Decimal("38.00"), produtividadeUltima: new Prisma.Decimal("22.00"),
    bienalidade: "POSITIVA", maturacaoCereja: new Prisma.Decimal("71.00"),
    ferrugem: new Prisma.Decimal("9.00"), tendFerrugem: "subindo",
    ultimaInspecaoData: new Date("2026-05-22"), pH: new Prisma.Decimal("5.4"),
  },
};

describe("toTalhaoDTO", () => {
  it("mapeia id→string, decimals→number, datas→YYYY-MM-DD e resolve nomes de relação", () => {
    const dto = toTalhaoDTO(row);
    expect(dto.id).toBe("7");
    expect(typeof dto.id).toBe("string");
    expect(dto.variedade).toBe("Catuaí Vermelho IAC 144");
    expect(dto.lavoura).toBe("Cafundó");
    expect(dto.areaHa).toBe(4.2);
    expect(typeof dto.areaHa).toBe("number");
    expect(dto.declive).toBe(14);
    expect(dto.plantasHa).toBe(4385);
    expect(dto.dataPlantio).toBe("2010-11-12");
    expect(dto.ultimaRecepa).toBe("2020-08-15");
    expect(dto.exposicao).toBe("leste");
    expect(dto.estado).toBe("ATIVO");
    expect(dto.irrigado).toBe(false);
  });

  it("anexa o resumo mapeado (talhaoId→string, decimals→number, datas→ISO)", () => {
    const dto = toTalhaoDTO(row);
    expect(dto.resumo?.talhaoId).toBe("7");
    expect(dto.resumo?.fase).toBe("MATURACAO_CEREJA");
    expect(dto.resumo?.produtividadeEsperada).toBe(38);
    expect(typeof dto.resumo?.produtividadeEsperada).toBe("number");
    expect(dto.resumo?.ferrugem).toBe(9);
    expect(dto.resumo?.proximaOperacaoEm).toBe("2026-06-02");
    expect(dto.resumo?.ultimaInspecaoData).toBe("2026-05-22");
    expect(dto.resumo?.pH).toBe(5.4);
  });

  it("lida com relações nulas e campos ausentes", () => {
    const dto = toTalhaoDTO({ ...row, variedade: null, lavoura: null, nome: null, declive: null, ultimaRecepa: null, resumo: null });
    expect(dto.variedade).toBe("");
    expect(dto.lavoura).toBe("");
    expect(dto.nome).toBe("");
    expect(dto.declive).toBeNull();
    expect(dto.ultimaRecepa).toBeNull();
    expect(dto.resumo).toBeNull();
  });
});

describe("toResumoDTO", () => {
  it("retorna null quando o resumo é null/undefined", () => {
    expect(toResumoDTO(null)).toBeNull();
    expect(toResumoDTO(undefined)).toBeNull();
  });

  it("converte talhaoId para string e datas para ISO curto", () => {
    const dto = toResumoDTO({ talhaoId: 3, fase: "REPOUSO", proximaOperacaoEm: new Date("2026-07-15"), produtividadeEsperada: null });
    expect(dto?.talhaoId).toBe("3");
    expect(dto?.fase).toBe("REPOUSO");
    expect(dto?.proximaOperacaoEm).toBe("2026-07-15");
    expect(dto?.produtividadeEsperada).toBeUndefined();
  });
});
