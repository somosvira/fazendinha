import { describe, expect, it } from "vitest";
import {
  agregarStatusLote,
  planejarExecucaoColetiva,
  type AplicacaoLoteExec,
} from "./iatf-lote-exec.calc.js";

const apps: AplicacaoLoteExec[] = [
  {
    aplicacaoId: 1,
    animalId: 101,
    execucoes: [
      { id: 11, dia: 0, ordem: 0, status: "PENDENTE", dataPlanejada: "2026-07-06" },
      { id: 12, dia: 7, ordem: 0, status: "PENDENTE", dataPlanejada: "2026-07-13" },
    ],
  },
  {
    aplicacaoId: 2,
    animalId: 102,
    execucoes: [
      { id: 21, dia: 0, ordem: 0, status: "CONCLUIDA", dataPlanejada: "2026-07-06" },
      { id: 22, dia: 7, ordem: 0, status: "PENDENTE", dataPlanejada: "2026-07-13" },
    ],
  },
];

describe("planejarExecucaoColetiva", () => {
  it("seleciona dia+ordem para cada animal e respeita exceções", () => {
    expect(planejarExecucaoColetiva(apps, { dia: 7, ordem: 0 }, "CONCLUIDA", [101])).toEqual([
      { execucaoId: 22, aplicacaoId: 2, animalId: 102, status: "CONCLUIDA" },
    ]);
  });

  it("ignora aplicação que não possui a etapa alvo", () => {
    expect(planejarExecucaoColetiva(apps, { dia: 9, ordem: 0 }, "PULADA", [])).toEqual([]);
  });
});

describe("agregarStatusLote", () => {
  it("agrega status/atraso e aponta a primeira etapa pendente", () => {
    const r = agregarStatusLote(apps, "2026-07-14");

    expect(r.totalAnimais).toBe(2);
    expect(r.porEtapa.find((e) => e.dia === 0)).toMatchObject({
      concluidas: 1,
      pendentes: 1,
      atrasadas: 1,
    });
    expect(r.porEtapa.find((e) => e.dia === 7)).toMatchObject({
      pendentes: 2,
      atrasadas: 2,
    });
    expect(r.proximaEtapa).toEqual({ dia: 0, ordem: 0 });
    expect(r.concluido).toBe(false);
  });

  it("conclui somente quando não há pendência", () => {
    const done: AplicacaoLoteExec[] = [
      {
        aplicacaoId: 9,
        animalId: 109,
        execucoes: [
          { id: 91, dia: 0, ordem: 0, status: "CONCLUIDA", dataPlanejada: "2026-07-06" },
          { id: 92, dia: 7, ordem: 0, status: "PULADA", dataPlanejada: "2026-07-13" },
        ],
      },
    ];

    expect(agregarStatusLote(done, "2026-07-20")).toMatchObject({
      concluido: true,
      proximaEtapa: null,
    });
  });

  it("lote sem aplicações não é marcado como concluído", () => {
    expect(agregarStatusLote([], "2026-07-20")).toEqual({
      totalAnimais: 0,
      porEtapa: [],
      proximaEtapa: null,
      concluido: false,
    });
  });
});
