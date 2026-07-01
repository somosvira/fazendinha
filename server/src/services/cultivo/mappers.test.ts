import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  toSafraCultivoDTO,
  toAreaCultivoDTO,
  toLancamentoCustoDTO,
  toProducaoCultivoDTO,
  toSiloDTO,
  toMovimentoSiloDTO,
  toResumoSafraCultivoDTO,
} from "./mappers.js";

describe("toSafraCultivoDTO", () => {
  const row: any = {
    id: 1, cultura: "MILHO", nome: "Safra 2026", ano: 2026,
    dataInicio: new Date("2026-09-01"), dataFim: new Date("2027-02-15"),
    areaHaTotal: new Prisma.Decimal("120.50"), fechada: false, observacao: null,
  };

  it("mapeia datas para YYYY-MM-DD e Decimal para number", () => {
    const dto = toSafraCultivoDTO(row);
    expect(dto.dataInicio).toBe("2026-09-01");
    expect(dto.dataFim).toBe("2027-02-15");
    expect(dto.areaHaTotal).toBe(120.5);
    expect(typeof dto.areaHaTotal).toBe("number");
    expect(dto.fechada).toBe(false);
  });

  it("dataFim e areaHaTotal null quando ausentes", () => {
    const dto = toSafraCultivoDTO({ ...row, dataFim: null, areaHaTotal: null });
    expect(dto.dataFim).toBeNull();
    expect(dto.areaHaTotal).toBeNull();
  });

  it("não inclui resumo quando o campo está ausente (undefined)", () => {
    const dto = toSafraCultivoDTO(row);
    expect(dto.resumo).toBeUndefined();
  });

  it("mapeia resumo aninhado quando presente", () => {
    const dto = toSafraCultivoDTO({
      ...row,
      resumo: {
        safraCultivoId: 1, custeioTotal: new Prisma.Decimal("1000"), investimentoTotal: new Prisma.Decimal("0"),
        areaHa: new Prisma.Decimal("10"), producaoGraoSc: new Prisma.Decimal("0"), producaoSilagemTon: new Prisma.Decimal("0"),
        custoHa: new Prisma.Decimal("100"), custoSaca: null, custoTonelada: null, horasMaquinaTotal: new Prisma.Decimal("0"),
        atualizadoEm: new Date("2026-09-15T10:00:00Z"),
      },
    });
    expect(dto.resumo?.custeioTotal).toBe(1000);
  });

  it("resumo null quando relação é null", () => {
    const dto = toSafraCultivoDTO({ ...row, resumo: null });
    expect(dto.resumo).toBeNull();
  });
});

describe("toAreaCultivoDTO", () => {
  it("mapeia areaHa Decimal → number e nome null quando ausente", () => {
    const dto = toAreaCultivoDTO({ id: 5, safraCultivoId: 1, codigo: "A1", nome: null, areaHa: new Prisma.Decimal("30.00") });
    expect(dto.areaHa).toBe(30);
    expect(dto.nome).toBeNull();
    expect(dto.codigo).toBe("A1");
  });
});

describe("toLancamentoCustoDTO", () => {
  const row: any = {
    id: 10, safraCultivoId: 1, areaCultivoId: 2, area: { codigo: "A1" },
    tipo: "ADUBACAO", classe: "CUSTEIO", data: new Date("2026-09-10"),
    descricao: "Adubo NPK", valor: new Prisma.Decimal("1500.00"),
    qtd: new Prisma.Decimal("300.000"), unidade: "kg",
    horasMaquina: new Prisma.Decimal("4.50"), numMaquinas: 1, numCaminhoes: null,
    lancamentoId: null, observacao: null,
  };

  it("mapeia campos e resolve areaCodigo da relação", () => {
    const dto = toLancamentoCustoDTO(row);
    expect(dto.data).toBe("2026-09-10");
    expect(dto.valor).toBe(1500);
    expect(dto.qtd).toBe(300);
    expect(dto.horasMaquina).toBe(4.5);
    expect(dto.areaCodigo).toBe("A1");
  });

  it("areaCodigo null quando não há área vinculada", () => {
    const dto = toLancamentoCustoDTO({ ...row, areaCultivoId: null, area: null });
    expect(dto.areaCodigo).toBeNull();
    expect(dto.areaCultivoId).toBeNull();
  });
});

describe("toProducaoCultivoDTO", () => {
  it("mapeia destino/silo e resolve siloNome da relação", () => {
    const dto = toProducaoCultivoDTO({
      id: 1, safraCultivoId: 1, areaCultivoId: null, area: null,
      data: new Date("2026-12-01"), tipo: "SILAGEM", quantidade: new Prisma.Decimal("200.000"),
      unidade: "TON", destino: "SILO", siloId: 3, silo: { nome: "Silo Norte" }, observacao: null,
    });
    expect(dto.quantidade).toBe(200);
    expect(dto.siloNome).toBe("Silo Norte");
    expect(dto.destino).toBe("SILO");
  });

  it("destino e silo null quando venda direta", () => {
    const dto = toProducaoCultivoDTO({
      id: 2, safraCultivoId: 1, areaCultivoId: null, area: null,
      data: new Date("2026-12-01"), tipo: "GRAO", quantidade: new Prisma.Decimal("500.000"),
      unidade: "SC", destino: null, siloId: null, silo: null, observacao: null,
    });
    expect(dto.siloNome).toBeNull();
    expect(dto.siloId).toBeNull();
  });
});

describe("toSiloDTO", () => {
  it("mapeia saldoAtual e capacidade Decimal → number", () => {
    const dto = toSiloDTO({ id: 1, nome: "Silo 1", tipo: "GRAO", capacidade: new Prisma.Decimal("1000.000"), unidade: "SC", saldoAtual: new Prisma.Decimal("250.500"), ativo: true });
    expect(dto.capacidade).toBe(1000);
    expect(dto.saldoAtual).toBe(250.5);
    expect(dto.ativo).toBe(true);
  });

  it("capacidade null quando não informada", () => {
    const dto = toSiloDTO({ id: 1, nome: "Silo 1", tipo: "SILAGEM", capacidade: null, unidade: "TON", saldoAtual: new Prisma.Decimal("0"), ativo: true });
    expect(dto.capacidade).toBeNull();
  });
});

describe("toMovimentoSiloDTO", () => {
  it("mapeia tipo/origem e producaoCultivoId opcional", () => {
    const dto = toMovimentoSiloDTO({ id: 1, siloId: 1, data: new Date("2026-12-01"), tipo: "ENTRADA", quantidade: new Prisma.Decimal("200.000"), origem: "COLHEITA", producaoCultivoId: 7, observacao: null });
    expect(dto.tipo).toBe("ENTRADA");
    expect(dto.origem).toBe("COLHEITA");
    expect(dto.producaoCultivoId).toBe(7);
  });

  it("producaoCultivoId null em movimento manual", () => {
    const dto = toMovimentoSiloDTO({ id: 2, siloId: 1, data: new Date("2026-12-05"), tipo: "SAIDA", quantidade: new Prisma.Decimal("50.000"), origem: "VENDA", producaoCultivoId: null, observacao: "venda direta" });
    expect(dto.producaoCultivoId).toBeNull();
  });
});

describe("toResumoSafraCultivoDTO", () => {
  const base: any = {
    safraCultivoId: 1, custeioTotal: new Prisma.Decimal("10000.00"), investimentoTotal: new Prisma.Decimal("5000.00"),
    areaHa: new Prisma.Decimal("100.00"), producaoGraoSc: new Prisma.Decimal("500.000"), producaoSilagemTon: new Prisma.Decimal("0.000"),
    custoHa: new Prisma.Decimal("100.00"), custoSaca: new Prisma.Decimal("20.00"), custoTonelada: null,
    horasMaquinaTotal: new Prisma.Decimal("40.00"), atualizadoEm: new Date("2026-09-20T12:00:00Z"),
  };

  it("retorna null quando resumo é null/undefined", () => {
    expect(toResumoSafraCultivoDTO(null)).toBeNull();
    expect(toResumoSafraCultivoDTO(undefined)).toBeNull();
  });

  it("mapeia Decimal→number e nota null quando não é safra mista sem áreas", () => {
    const dto = toResumoSafraCultivoDTO(base);
    expect(dto?.custeioTotal).toBe(10000);
    expect(dto?.investimentoTotal).toBe(5000);
    expect(dto?.custoSaca).toBe(20);
    expect(dto?.custoTonelada).toBeNull();
    expect(dto?.nota).toBeNull();
  });

  it("gera nota quando safra é mista (grão+silagem) e custoSaca/custoTonelada são null", () => {
    const dto = toResumoSafraCultivoDTO({
      ...base,
      producaoGraoSc: new Prisma.Decimal("500.000"),
      producaoSilagemTon: new Prisma.Decimal("200.000"),
      custoSaca: null,
      custoTonelada: null,
    });
    expect(dto?.nota).toMatch(/mista/i);
  });

  it("não gera nota quando só uma saída existe mesmo com custo unitário null (sem produção)", () => {
    const dto = toResumoSafraCultivoDTO({
      ...base,
      producaoGraoSc: new Prisma.Decimal("0"),
      producaoSilagemTon: new Prisma.Decimal("0"),
      custoSaca: null,
      custoTonelada: null,
    });
    expect(dto?.nota).toBeNull();
  });
});
