import { describe, expect, it } from "vitest";
import { repartirDestinoLeite } from "./destinos.calc.js";
import { destinoInternoLeiteSchema } from "./destinos.schemas.js";
const uid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const base = { chave: uid(1), propriedadeId: 1, entradaId: uid(2), data: "2026-10-01", natureza: "LEITE_NAO_COMERCIAL", declaracaoOrigem: "Leite informado pelo responsável para alimentação interna", quantidadeDisponivelEsperadaLitros: 10, parcelas: [{ animalId: uid(3), quantidadeLitros: 3 }, { animalId: uid(4), quantidadeLitros: 4 }] };
describe("parcelas explícitas de destino interno", () => {
  it("10 L com 3+4 servidos mantém 3 L na origem; não divide quantidade automaticamente", () => {
    const resultado = repartirDestinoLeite(10, base.parcelas);
    expect(resultado.quantidadeLitros.toString()).toBe("7");
    expect(resultado.saldoOrigemAntes.toString()).toBe("10");
    expect(resultado.saldoOrigemDepois.toString()).toBe("3");
    expect(repartirDestinoLeite(1, [{ quantidadeLitros: 0.1 }, { quantidadeLitros: 0.2 }]).saldoOrigemDepois.toString()).toBe("0.7");
  });
  it("recusa excesso, parcelas negativas, volume ausente e arredondamento silencioso", () => {
    expect(() => repartirDestinoLeite(6, base.parcelas)).toThrow(/caber/);
    expect(() => repartirDestinoLeite(10, [{ quantidadeLitros: -3 }, { quantidadeLitros: 5 }])).toThrow(/positivas/);
    expect(() => repartirDestinoLeite(10, [])).toThrow();
    for (const quantidadeLitros of [undefined, 0, -1, 0.0001, Infinity])
      expect(destinoInternoLeiteSchema.safeParse({ ...base, parcelas: [{ animalId: uid(3), quantidadeLitros }] }).success).toBe(false);
    expect(destinoInternoLeiteSchema.safeParse({ ...base, parcelas: [{ animalId: uid(3), quantidadeLitros: 11 }] }).success).toBe(false);
  });
  it("separa colostro de leite comum e exige declaração e cria real", () => {
    expect(destinoInternoLeiteSchema.safeParse(base).success).toBe(true);
    expect(destinoInternoLeiteSchema.safeParse({ ...base, natureza: "COLOSTRO" }).success).toBe(false);
    expect(destinoInternoLeiteSchema.safeParse({ ...base, natureza: "COLOSTRO", parcelas: [{ ...base.parcelas[0], criaId: uid(5) }] }).success).toBe(true);
    expect(destinoInternoLeiteSchema.safeParse({ ...base, parcelas: [{ ...base.parcelas[0], criaId: uid(5) }] }).success).toBe(false);
    expect(destinoInternoLeiteSchema.safeParse({ ...base, declaracaoOrigem: "" }).success).toBe(false);
    expect(destinoInternoLeiteSchema.safeParse({ ...base, parcelas: [base.parcelas[0], base.parcelas[0]] }).success).toBe(false);
  });
});
