import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { calcularVolumeGeral, type DiaGeral } from "./leite.js";
const dia = (): DiaGeral => ({
  dataOperacional: new Date(),
  configuracao: { fonteProducao: "GERAL", ordenhas: [{ posicaoId: "manha" }] },
  sessoes: [
    {
      posicaoId: "manha",
      medicoesGerais: [
        {
          id: "a",
          litros: new Prisma.Decimal(100),
          natureza: "COMERCIAL",
          entradasEstoque: [{ status: "CONFIRMADA" }],
        },
        {
          id: "b",
          litros: new Prisma.Decimal(20),
          natureza: "DESCARTE",
          entradasEstoque: [{ status: "CONFIRMADA" }],
        },
      ],
    },
  ],
});
describe("LEITE_GERAL_DIARIO_V1", () => {
  it("soma só parcelas gerais confirmadas de todas as naturezas com proveniência", () => {
    const r = calcularVolumeGeral(dia());
    expect(r.valor).toBe(120);
    expect(r.proveniencia.parcelas).toHaveLength(2);
  });
  it("não transforma ausência, fonte individual ou ordenha faltante em zero", () => {
    expect(() => calcularVolumeGeral(null)).toThrow();
    const d = dia();
    d.configuracao.fonteProducao = "INDIVIDUAL";
    expect(() => calcularVolumeGeral(d)).toThrow();
    d.configuracao.fonteProducao = "GERAL";
    d.configuracao.ordenhas.push({ posicaoId: "tarde" });
    expect(() => calcularVolumeGeral(d)).toThrow();
  });
  it("recusa cobertura incompleta por confirmação pendente", () => {
    const d = dia();
    d.sessoes[0]!.medicoesGerais[0]!.entradasEstoque = [];
    expect(() => calcularVolumeGeral(d)).toThrow();
  });
});
