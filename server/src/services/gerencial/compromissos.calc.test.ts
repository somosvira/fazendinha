import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calcularCompromissos, type CompromissoGerencial } from "./compromissos.calc.js";

const hoje = new Date("2026-10-18");
const compromisso = (data: string, valor = "1.01"): CompromissoGerencial => ({
  tipo: "PAGAR", status: "PENDENTE", dataVencimento: new Date(data),
  valorOriginal: new Prisma.Decimal(valor), liquidacoes: [],
});

describe("obrigações pendentes no corte atual", () => {
  it("inclui vencimentos antigos e futuros, com hoje, +7, +8, +30 e +31 nas faixas corretas", () => {
    const resultado = calcularCompromissos([
      compromisso("2025-01-01"), compromisso("2026-10-17"),
      compromisso("2026-10-18"), compromisso("2026-10-25"),
      compromisso("2026-10-26"), compromisso("2026-11-17"), compromisso("2026-11-18"),
    ], hoje);
    expect(resultado).toMatchObject({ data: "2026-10-18", totalPendente: "7.07", vencido: "2.02", aVencer: "5.05" });
    expect(resultado.faixas.map(f => [f.chave, f.valor])).toEqual([
      ["VENCIDO", "2.02"], ["ATE_7_DIAS", "2.02"], ["DE_8_A_30_DIAS", "2.02"], ["APOS_30_DIAS", "1.01"],
    ]);
  });

  it("calcula o restante em centavos e restaura dívida após estorno da liquidação", () => {
    const parcial = { ...compromisso("2026-10-18", "0.30"), status: "PARCIAL", liquidacoes: [
      { valor: new Prisma.Decimal("0.10"), transacao: { status: "CONFIRMADA" } },
      { valor: new Prisma.Decimal("0.15"), transacao: { status: "REVERTIDA" } },
    ] };
    expect(calcularCompromissos([parcial], hoje).totalPendente).toBe("0.20");
    const estornado = { ...parcial, liquidacoes: parcial.liquidacoes.map(l => ({ ...l, transacao: { status: "REVERTIDA" } })) };
    expect(calcularCompromissos([estornado], hoje).totalPendente).toBe("0.30");
  });

  it("exclui cancelados, liquidados e valores a receber", () => {
    expect(calcularCompromissos([
      { ...compromisso("2026-10-17", "300"), status: "CANCELADO" },
      { ...compromisso("2026-10-18", "200"), status: "LIQUIDADO" },
      { ...compromisso("2026-10-19", "100"), tipo: "RECEBER" },
    ], hoje)).toMatchObject({ totalPendente: "0.00", vencido: "0.00", aVencer: "0.00" });
  });

  it("conta dias de calendário na virada do ano", () => {
    const resultado = calcularCompromissos([
      compromisso("2026-12-31"), compromisso("2027-01-07"),
      compromisso("2027-01-08"), compromisso("2027-01-30"), compromisso("2027-01-31"),
    ], new Date("2026-12-31"));
    expect(resultado.faixas.map(f => f.valor)).toEqual(["0.00", "2.02", "2.02", "1.01"]);
  });
});
