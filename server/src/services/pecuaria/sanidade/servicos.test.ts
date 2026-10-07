import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { confirmarProcedimentosServicoSchema, consultaProcedimentosServicoSchema } from "./servicos.schemas.js";
import { validarAtribuicoesServico, type ProcedimentoServico } from "./servicos.js";
const id = "a0300000-0000-4000-8000-000000000001";
const fato = (patch: Partial<ProcedimentoServico> = {}): ProcedimentoServico => ({ id, tipo: "EXAME", animalId: id, animal: { id, brinco: "100", nome: "Bela" }, propriedade: { id: 1, nome: "Principal" }, nome: "Exame", dataHora: "2026-10-01T00:00:00Z", status: "VALIDO", origem: "MANUAL", valor: null, vinculado: true, podeEditar: true, execucaoId: null, operacaoServicoId: id, ...patch });
describe("contrato de procedimentos de Serviço", () => {
  it("mantém valor omitido distinto de vazio e zero explícito", () => {
    for (const item of [{ id, tipo: "EXAME" }, { id, tipo: "EXAME", valor: null }, { id, tipo: "EXAME", valor: "0" }]) {
      const result = confirmarProcedimentosServicoSchema.parse({ propriedadeId: 1, chaveIdempotencia: id, motivo: "Conferir atendimento", itens: [item] });
      expect(result.itens[0]).toEqual(item);
    }
  });
  it("rejeita decimal negativo, precisão excessiva, repetição e campos físicos", () => {
    for (const itens of [[{ id, tipo: "EXAME", valor: "-1" }], [{ id, tipo: "EXAME", valor: "0.001" }], [{ id, tipo: "EXAME", dose: 1 }], [{ id, tipo: "EXAME" }, { id, tipo: "EXAME" }]]) {
      expect(confirmarProcedimentosServicoSchema.safeParse({ propriedadeId: 1, chaveIdempotencia: id, motivo: "Conferir atendimento", itens }).success).toBe(false);
    }
  });
  it("valida datas reais e intervalo antes da consulta paginada", () => {
    expect(consultaProcedimentosServicoSchema.safeParse({ inicio: "2026-02-30" }).success).toBe(false);
    expect(consultaProcedimentosServicoSchema.safeParse({ inicio: "2026-10-02", fim: "2026-10-01" }).success).toBe(false);
    expect(consultaProcedimentosServicoSchema.safeParse({ pagina: 10001 }).success).toBe(false);
  });
  it("soma centavos sem ponto flutuante e ignora anulados somente no orçamento", () => {
    expect(validarAtribuicoesServico([fato({ valor: "0.1" }), fato({ id: "b", valor: "0.2" }), fato({ id: "c", valor: "999", status: "ANULADO" })], new Prisma.Decimal("0.3")).toString()).toBe("0.3");
    expect(() => validarAtribuicoesServico([fato({ valor: "100.01" })], new Prisma.Decimal("100"))).toThrow("ultrapassam");
  });
  it("zero conta como atribuição explícita e impede protocolo/fato simultâneos", () => {
    const protocolo = fato({ tipo: "PROTOCOLO", valor: "0", execucaoId: id });
    expect(() => validarAtribuicoesServico([protocolo, fato({ id: "filho", execucaoId: id, valor: "0" })], new Prisma.Decimal(100))).toThrow("protocolo");
    expect(validarAtribuicoesServico([protocolo, fato({ id: "filho", execucaoId: id })], new Prisma.Decimal(100)).toString()).toBe("0");
  });
});
