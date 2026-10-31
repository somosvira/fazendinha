import { describe, expect, it } from "vitest";
import { avaliarBrixColostro, conciliarDestinacaoColostro, conferirCronologiaColostro, saldoColostro, saldoUnidadeColostro } from "./colostro.calc.js";
import { destinacaoColostroSchema, enriquecimentoColostroSchema, retiradaColostroSchema } from "./colostro.schemas.js";
const chave = "11111111-1111-4111-8111-111111111111";
describe("colostro: conservação e contratos", () => {
  it("concilia retirada de 6L em 4L à cria e unidade de 2L sem criar outro estoque", () => {
    const plano = conciliarDestinacaoColostro(6, [4], 1);
    expect(plano.sobra.toString()).toBe("0");
    const saldo = saldoColostro({ volume: 6, fornecido: 4, enriquecido: 0, congelado: 2 });
    expect(saldo.livre.toString()).toBe("0"); expect(saldo.disponivel.toString()).toBe("2");
  });
  it("conserva 0,2L do enriquecimento de 2,2L e Brix continua pendente", () => {
    expect(conciliarDestinacaoColostro("2.2", [], 1).sobra.toString()).toBe("0.2");
    expect(avaliarBrixColostro(null, 25)).toBe("PENDENTE");
  });
  it("a retirada da unidade troca reserva por consumo, sem baixar duas vezes", () => {
    const saldo = saldoColostro({ volume: "2.2", fornecido: 2, enriquecido: 0, congelado: 0 });
    expect(saldo.livre.toString()).toBe("0.2"); expect(saldo.consumido.toString()).toBe("2");
  });
  it("bloqueia volume excedente, fracionamento artificial de unidade e ledger inconsistente", () => {
    expect(() => conciliarDestinacaoColostro(5, [4], 1)).toThrow(/excede/);
    expect(() => conciliarDestinacaoColostro(6, [], 1.5)).toThrow(/inteira/);
    expect(() => saldoColostro({ volume: 6, fornecido: 5, enriquecido: 0, congelado: 2 })).toThrow(/divergem/);
  });
  it("Brix é inclusivo e não equivale a exame de imunidade", () => {
    expect(avaliarBrixColostro(25, 25)).toBe("ADEQUADO");
    expect(avaliarBrixColostro("24.99", 25)).toBe("ABAIXO_REFERENCIA");
    expect(() => avaliarBrixColostro(101, 25)).toThrow(/Brix/);
  });
  it("data sem hora não infere meia-noite ou ordem intradiária", () => {
    const data = new Date("2026-10-28T00:00:00Z");
    expect(() => conferirCronologiaColostro({ data, ocorridoEm: new Date("2026-10-28T15:00:00Z") }, { data, ocorridoEm: null })).not.toThrow();
    expect(() => conferirCronologiaColostro({ data, ocorridoEm: new Date("2026-10-28T15:00:00Z") }, { data, ocorridoEm: new Date("2026-10-28T14:00:00Z") })).toThrow(/anteceder/);
    expect(() => conferirCronologiaColostro({ data }, { data: new Date("2026-10-27") })).toThrow(/anteceder/);
  });
  it("exige origem real e recipiente no núcleo para uma nova retirada", () => {
    expect(retiradaColostroSchema.safeParse({ chave, propriedadeId: 1, partoId: chave, data: "2026-10-28", primeiraRetirada: true,
      quantidadeLitros: 6, responsavel: "Operador", producao: { tipo: "EXISTENTE", versaoEsperada: 1 } }).success).toBe(false);
    expect(retiradaColostroSchema.safeParse({ chave, propriedadeId: 1, partoId: chave, data: "2026-10-28", primeiraRetirada: true,
      quantidadeLitros: 6, responsavel: "Operador", producao: { tipo: "NOVA", posicaoId: chave,
        parcela: { versaoEsperada: 0, litros: 6, natureza: "COLOSTRO", animaisOrigem: [chave], responsavel: "Operador" } } }).success).toBe(false);
  });
  it("unidade enriquecida conserva origem e não aceita recongelamento da retirada", () => {
    const base = { chave, propriedadeId: 1, versaoEsperada: 1, data: "2026-10-28", responsavel: "Operador", unidadeId: chave };
    expect(destinacaoColostroSchema.safeParse({ ...base, crias: [{ criaId: chave, quantidadeLitros: 1 }] }).success).toBe(true);
    expect(destinacaoColostroSchema.safeParse({ ...base, crias: [{ criaId: chave, quantidadeLitros: 2 }], unidades: [{ codigo: "nova" }] }).success).toBe(false);
    expect(destinacaoColostroSchema.parse({ ...base, crias: [{ criaId: chave, quantidadeLitros: 2 }] }).ocorridoEm).toBeUndefined();
  });
  it("retirada parcial mantém remanescente segregado fora do banco, sem liberar litros para recongelar", () => {
    const restante = saldoUnidadeColostro(2, "0.75", "0.25");
    expect(restante.toString()).toBe("1");
    const saldo = saldoColostro({ volume: "2.2", fornecido: "0.75", enriquecido: "0.25", congelado: restante });
    expect(saldo.livre.toString()).toBe("0.2"); expect(saldo.reservado.toString()).toBe("1");
    expect(conciliarDestinacaoColostro(restante, ["0.6"], 0).sobra.toString()).toBe("0.4");
    expect(() => saldoUnidadeColostro(2, "1.5", "0.6")).toThrow(/diverge/);
  });
  it("exige insumo real e volume final medido, sem inventar receita", () => {
    const base = { chave, propriedadeId: 1, data: "2026-10-28", responsavel: "Operador", volumeFinalLitros: 2.2,
      origens: [{ origemId: chave, versaoEsperada: 1, quantidadeLitros: 2 }] };
    expect(enriquecimentoColostroSchema.safeParse({ ...base, insumos: [] }).success).toBe(false);
    expect(enriquecimentoColostroSchema.parse({ ...base, insumos: [{ produtoId: chave, quantidade: 0.2, unidade: "KG" }] }).volumeFinalLitros).toBe(2.2);
  });
});
