import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { agregarSafra } from "./planejamento.mappers.js";

// Tarefas sintéticas: custos previstos/realizados em Decimal, status variados.
const tarefas = [
  { status: "CONCLUIDA", custoPrev: new Prisma.Decimal("1200.00"), custoReal: new Prisma.Decimal("1150.50") },
  { status: "CONCLUIDA", custoPrev: new Prisma.Decimal("800.00"), custoReal: new Prisma.Decimal("820.00") },
  { status: "PLANEJADA", custoPrev: new Prisma.Decimal("500.00"), custoReal: null },
  { status: "EM_ANDAMENTO", custoPrev: null, custoReal: null },
];

// Apontamentos sintéticos: 2 MAQUINA + 2 HOMEM, com valorTotal em Decimal.
const apontamentos = [
  { tipo: "MAQUINA", horas: new Prisma.Decimal("6.50"), valorTotal: new Prisma.Decimal("650.00") },
  { tipo: "MAQUINA", horas: new Prisma.Decimal("3.50"), valorTotal: new Prisma.Decimal("280.00") },
  { tipo: "HOMEM", horas: new Prisma.Decimal("16.00"), valorTotal: new Prisma.Decimal("320.00") },
  { tipo: "HOMEM", horas: new Prisma.Decimal("8.00"), valorTotal: null },
];

describe("agregarSafra", () => {
  it("conta tarefas e concluídas (status CONCLUIDA)", () => {
    const r = agregarSafra(tarefas, apontamentos);
    expect(r.tarefasTotal).toBe(4);
    expect(r.tarefasConcluidas).toBe(2);
  });

  it("soma custoPrev/custoReal ignorando nulos", () => {
    const r = agregarSafra(tarefas, apontamentos);
    expect(r.custoPrevTotal).toBe(2500); // 1200 + 800 + 500
    expect(r.custoRealTotal).toBe(1970.5); // 1150.50 + 820
  });

  it("separa horas por tipo MAQUINA/HOMEM", () => {
    const r = agregarSafra(tarefas, apontamentos);
    expect(r.horasMaquina).toBe(10); // 6.5 + 3.5
    expect(r.horasHomem).toBe(24); // 16 + 8
  });

  it("soma custoOperacional dos apontamentos (valorTotal, nulos ignorados)", () => {
    const r = agregarSafra(tarefas, apontamentos);
    expect(r.custoOperacional).toBe(1250); // 650 + 280 + 320
  });

  it("safra vazia → todos zeros", () => {
    const r = agregarSafra([], []);
    expect(r).toEqual({
      tarefasTotal: 0, tarefasConcluidas: 0,
      custoPrevTotal: 0, custoRealTotal: 0,
      horasMaquina: 0, horasHomem: 0, custoOperacional: 0,
    });
  });
});
