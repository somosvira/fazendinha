import { describe, expect, it } from "vitest";
import { MovimentacaoError, planejarDesfazer, planejarDestino, planejarMovimentacao, planejarMovimentacaoEmMassa, type AnimalParaMover } from "./movimentacao.calc.js";

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

describe("planejarDesfazer — desempate por criadoEm", () => {
  it("cadastro e movimentação no mesmo dia: remove a aberta e reabre a outra, em qualquer ordem de entrada", () => {
    const fechada = { id: "cadastro", desde: "2026-09-22", ate: "2026-09-22", criadoEm: "2026-09-22T10:00:00Z" };
    const aberta = { id: "movida", desde: "2026-09-22", ate: null, criadoEm: "2026-09-22T10:05:00Z" };
    expect(planejarDesfazer([fechada, aberta])).toEqual({ remover: { id: "movida" }, reabrir: { id: "cadastro" } });
    expect(planejarDesfazer([aberta, fechada])).toEqual({ remover: { id: "movida" }, reabrir: { id: "cadastro" } });
  });
});

describe("planejarMovimentacaoEmMassa", () => {
  const normalizar = (b: string) => b.trim().toUpperCase();
  const animal = (id: string, brinco: string, atual: AnimalParaMover["atual"], extra: Partial<AnimalParaMover> = {}): AnimalParaMover => ({
    id, brinco, dataEntrada: "2025-01-01", ativo: true, noEscopo: true, atual, ...extra,
  });
  const naMexicana = (id: string) => ({ id: `loc-${id}`, propriedadeId: 2, loteId: null, desde: "2025-01-01" });

  it("fecha e abre para cada animal que muda de lugar", () => {
    const plano = planejarMovimentacaoEmMassa({
      animais: [animal("a", "1", naMexicana("a")), animal("b", "2", naMexicana("b"))],
      destino: { propriedadeId: 1, loteId: null }, data: "2026-09-22", ativosDestino: new Map(), normalizar,
    });
    expect(plano.erros).toEqual([]);
    expect(plano.fechar).toEqual(["loc-a", "loc-b"]);
    expect(plano.abrir).toEqual([{ animalId: "a", anteriorId: "loc-a" }, { animalId: "b", anteriorId: "loc-b" }]);
  });

  it("ignora quem já está no destino", () => {
    const plano = planejarMovimentacaoEmMassa({
      animais: [animal("a", "1", { id: "loc-a", propriedadeId: 1, loteId: null, desde: "2025-01-01" })],
      destino: { propriedadeId: 1, loteId: null }, data: "2026-09-22", ativosDestino: new Map([["1", "a"]]), normalizar,
    });
    expect(plano.semMudanca).toEqual(["a"]);
    expect(plano.abrir).toEqual([]);
  });

  it("brinco já ativo no destino e brinco repetido no próprio lote viram erro com o brinco", () => {
    const plano = planejarMovimentacaoEmMassa({
      animais: [animal("a", "10", naMexicana("a")), animal("b", " 20", naMexicana("b")), animal("c", "20", naMexicana("c"))],
      destino: { propriedadeId: 1, loteId: null }, data: "2026-09-22", ativosDestino: new Map([["10", "outro"]]), normalizar,
    });
    expect(plano.erros.map((e) => [e.brinco, e.mensagem])).toEqual([
      ["10", "brinco 10 já está ativo no sítio de destino"],
      ["20", "brinco 20 repetido entre os animais movidos"],
    ]);
  });

  it("mudar só de lote no mesmo sítio não checa brinco", () => {
    const plano = planejarMovimentacaoEmMassa({
      animais: [animal("a", "10", { id: "loc-a", propriedadeId: 1, loteId: null, desde: "2025-01-01" })],
      destino: { propriedadeId: 1, loteId: "lote-x" }, data: "2026-09-22", ativosDestino: new Map([["10", "a"]]), normalizar,
    });
    expect(plano.erros).toEqual([]);
    expect(plano.abrir).toHaveLength(1);
  });

  it("recusa animal inativo, fora do escopo e data anterior à localização atual", () => {
    const plano = planejarMovimentacaoEmMassa({
      animais: [
        animal("a", "1", naMexicana("a"), { ativo: false }),
        animal("b", "2", naMexicana("b"), { noEscopo: false }),
        animal("c", "3", { id: "loc-c", propriedadeId: 2, loteId: null, desde: "2026-09-30" }),
      ],
      destino: { propriedadeId: 1, loteId: null }, data: "2026-09-22", ativosDestino: new Map(), normalizar,
    });
    expect(plano.erros.map((e) => e.animalId)).toEqual(["a", "b", "c"]);
    expect(plano.abrir).toEqual([]);
  });
});
