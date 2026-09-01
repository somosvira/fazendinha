import { describe, expect, it } from "vitest";
import { planejarCrias, type PartoParaCrias } from "./parto-cria.calc.js";

const parto = (over: Partial<PartoParaCrias> = {}): PartoParaCrias => ({
  data: "2026-07-26",
  tipoParto: "1",
  numCrias: 1,
  criasVivas: 1,
  criasNatimortas: 0,
  sexoCria: "F",
  criarCria: true,
  criaNumero: "B-101",
  ...over,
});

describe("planejarCrias", () => {
  it("planeja uma bezerra viva com a paridora como mãe", () => {
    expect(planejarCrias(parto(), 10, null)).toEqual([{
      tipo: "CRIAR",
      numero: "B-101",
      sexo: "F",
      categoria: "BEZERRA",
      maeId: 10,
      dataNascimento: "2026-07-26",
    }]);
  });

  it("usa a doadora como mãe genética no parto de receptora", () => {
    expect(planejarCrias(parto(), 10, 20)[0]).toMatchObject({ maeId: 20 });
  });

  it("não cria animal em aborto mesmo se o split vier inconsistente", () => {
    expect(planejarCrias(parto({ tipoParto: "3", criasVivas: 1 }), 10, null)).toEqual([]);
  });

  it("não cria animal em natimorto total", () => {
    expect(planejarCrias(parto({ tipoParto: "4", criasVivas: 0, criasNatimortas: 1 }), 10, null)).toEqual([]);
  });

  it("planeja duas crias vivas gemelares com números e sexos distintos", () => {
    expect(planejarCrias(parto({
      numCrias: 2,
      criasVivas: 2,
      sexoCria: "FM",
      criaNumero: "G-20",
    }), 10, null)).toEqual([
      {
        tipo: "CRIAR",
        numero: "G-20",
        sexo: "F",
        categoria: "BEZERRA",
        maeId: 10,
        dataNascimento: "2026-07-26",
      },
      {
        tipo: "CRIAR",
        numero: "G-20-2",
        sexo: "M",
        categoria: "BEZERRO",
        maeId: 10,
        dataNascimento: "2026-07-26",
      },
    ]);
  });

  it("planeja três crias com o sexo individual informado", () => {
    expect(planejarCrias(parto({
      numCrias: 3,
      criasVivas: 3,
      sexoCria: "FMF",
      criaNumero: "T-30",
    }), 10, null).map((cria) => ({ numero: cria.tipo === "CRIAR" ? cria.numero : "", sexo: cria.sexo }))).toEqual([
      { numero: "T-30", sexo: "F" },
      { numero: "T-30-2", sexo: "M" },
      { numero: "T-30-3", sexo: "F" },
    ]);
  });

  it("vincula uma cria existente em vez de planejar nova criação", () => {
    expect(planejarCrias(parto({ criarCria: false, criaNumero: undefined, criaId: 77 }), 10, null)).toEqual([{
      tipo: "VINCULAR",
      criaId: 77,
      sexo: "F",
      categoria: "BEZERRA",
      maeId: 10,
      dataNascimento: "2026-07-26",
    }]);
  });

  it("não planeja criação sem solicitação explícita", () => {
    expect(planejarCrias(parto({ criarCria: false }), 10, null)).toEqual([]);
  });
});
