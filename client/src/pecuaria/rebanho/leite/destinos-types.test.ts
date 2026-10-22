import { describe, expect, it } from "vitest";
import {
  somarParcelasDestino,
  type ParcelaDestinoDraft,
} from "./destinos-types";
const parcela = (litros: string): ParcelaDestinoDraft => ({
  animalId: litros,
  brinco: litros,
  nome: null,
  litros,
});
describe("parcelas explícitas de leite", () => {
  it("dez litros repartidos em três e quatro deixam três", () =>
    expect(somarParcelasDestino([parcela("3"), parcela("4")], 10)).toEqual({
      total: 7,
      validas: true,
      remanescente: 3,
      excedeu: false,
    }));
  it("não confunde vazio ou zero com quantidade positiva servida", () => {
    expect(somarParcelasDestino([parcela("")], 10).validas).toBe(false);
    expect(somarParcelasDestino([parcela("0")], 10).validas).toBe(false);
    expect(somarParcelasDestino([], null).validas).toBe(false);
  });
  it("evita erro binário de soma e conserva saldo desconhecido", () => {
    expect(
      somarParcelasDestino([parcela("0,1"), parcela("0,2")], 0.3),
    ).toMatchObject({ total: 0.3, remanescente: 0, excedeu: false });
    expect(somarParcelasDestino([parcela("1")], null).remanescente).toBeNull();
    expect(somarParcelasDestino([parcela("10.001")], 10).excedeu).toBe(true);
  });
});
