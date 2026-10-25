import { describe, expect, it } from "vitest";
import {
  avaliarMetaRetirada,
  preverRetiradas,
  type RegraRetirada,
} from "./programacao.calc.js";
import { programacaoRetiradaSchema } from "./programacao.schemas.js";
const regra = (patch: Partial<RegraRetirada> = {}): RegraRetirada => ({
  id: "p",
  vigenteDesde: "2026-10-19",
  tipo: "DIARIA",
  diaSemana: null,
  diasSemana: [],
  metaLitros: null,
  produtoId: null,
  ...patch,
});
const base = {
  chave: "10000000-0000-4000-8000-000000000001",
  propriedadeId: 1,
  vigenteDesde: "2026-10-19",
  versaoEsperada: 0,
};
describe("previsões de retirada", () => {
  it("calendário respeita vigência sem transformar produção ou meta em datas", () => {
    const regras = [
      regra(),
      regra({
        id: "meta",
        vigenteDesde: "2026-10-21",
        tipo: "META_LITROS",
        metaLitros: "100",
      }),
    ];
    expect(preverRetiradas(regras, "2026-10-18", 5).map((p) => p.data)).toEqual(
      ["2026-10-19", "2026-10-20"],
    );
  });
  it("semanal e dias escolhidos usam dias da semana explícitos", () => {
    expect(
      preverRetiradas(
        [regra({ tipo: "SEMANAL", diaSemana: 1 })],
        "2026-10-19",
      ).map((p) => p.data),
    ).toEqual(["2026-10-19", "2026-10-26"]);
    expect(
      preverRetiradas(
        [regra({ tipo: "DIAS_ESCOLHIDOS", diasSemana: [2, 4] })],
        "2026-10-19",
        7,
      ).map((p) => p.data),
    ).toEqual(["2026-10-20", "2026-10-22"]);
  });
  it("meta considera saldo residual e volta a abaixo da meta após retirada parcial", () => {
    const saldo = {
      confiavel: true,
      quantidadeLitros: "100",
      motivoNaoAferivel: null,
    };
    expect(avaliarMetaRetirada("100", saldo, true).estado).toBe("ATINGIDA");
    expect(
      avaliarMetaRetirada("100", { ...saldo, quantidadeLitros: "40" }, true)
        .estado,
    ).toBe("ABAIXO_DA_META");
    expect(
      avaliarMetaRetirada("100", { ...saldo, quantidadeLitros: "0" }, true)
        .saldoLitros,
    ).toBe("0");
  });
  it("não supõe saldo confiável, histórico ou negativo", () => {
    expect(avaliarMetaRetirada("10", null, true)).toMatchObject({
      estado: "NAO_AFERIVEL",
      saldoLitros: null,
    });
    expect(
      avaliarMetaRetirada(
        "10",
        {
          confiavel: false,
          quantidadeLitros: null,
          motivoNaoAferivel: "Divergência física",
        },
        true,
      ).motivo,
    ).toBe("Divergência física");
    expect(
      avaliarMetaRetirada(
        "10",
        { confiavel: true, quantidadeLitros: "20", motivoNaoAferivel: null },
        false,
      ).estado,
    ).toBe("NAO_AFERIVEL");
    expect(
      avaliarMetaRetirada(
        "10",
        { confiavel: true, quantidadeLitros: "-1", motivoNaoAferivel: null },
        true,
      ).estado,
    ).toBe("NAO_AFERIVEL");
  });
  it("schema recusa combinações, duplicatas, metas zero e precisão excessiva", () => {
    expect(
      programacaoRetiradaSchema.safeParse({
        ...base,
        tipo: "DIARIA",
        metaLitros: 100,
      }).success,
    ).toBe(false);
    expect(
      programacaoRetiradaSchema.safeParse({
        ...base,
        tipo: "SEMANAL",
        diaSemana: 7,
      }).success,
    ).toBe(false);
    expect(
      programacaoRetiradaSchema.safeParse({
        ...base,
        tipo: "DIAS_ESCOLHIDOS",
        diasSemana: [1, 1],
      }).success,
    ).toBe(false);
    for (const metaLitros of [0, -1, 1.0001])
      expect(
        programacaoRetiradaSchema.safeParse({
          ...base,
          tipo: "META_LITROS",
          produtoId: base.chave,
          metaLitros,
        }).success,
      ).toBe(false);
    expect(
      programacaoRetiradaSchema.safeParse({
        ...base,
        tipo: "META_LITROS",
        produtoId: base.chave,
        metaLitros: 12.125,
      }).success,
    ).toBe(true);
  });
});
