import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { agregarLavoura, type LavouraRow } from "./cadastros.js";

const lavoura: LavouraRow = {
  id: 1,
  nome: "Cafundó",
  planoAdubacao: { nome: "Padrão Catuaí 35 sc/ha" },
  talhoes: [
    { variedade: { nome: "Catuaí Vermelho IAC 144" }, areaHa: new Prisma.Decimal("4.20"), resumo: { produtividadeEsperada: new Prisma.Decimal("38.00") } },
    { variedade: { nome: "Catuaí Vermelho IAC 144" }, areaHa: new Prisma.Decimal("3.60"), resumo: { produtividadeEsperada: new Prisma.Decimal("36.00") } },
    { variedade: { nome: "Catuaí Amarelo IAC 62" }, areaHa: new Prisma.Decimal("3.00"), resumo: { produtividadeEsperada: new Prisma.Decimal("34.00") } },
    // talhão em formação: produtividade 0 → não entra na média.
    { variedade: { nome: "Catuaí Vermelho IAC 144" }, areaHa: new Prisma.Decimal("5.40"), resumo: { produtividadeEsperada: new Prisma.Decimal("0") } },
  ],
};

describe("agregarLavoura", () => {
  it("conta talhões, soma areaHa e tira média da produtividadeEsperada > 0", () => {
    const dto = agregarLavoura(lavoura);
    expect(dto.numTalhoes).toBe(4);
    expect(dto.areaHa).toBe(16.2); // 4.2 + 3.6 + 3.0 + 5.4
    expect(dto.produtividadeMedia).toBe(36); // (38 + 36 + 34) / 3 — o 0 é ignorado
    expect(dto.variedade).toBe("Catuaí Vermelho IAC 144"); // mais comum (3 de 4)
    expect(dto.planoAdubacaoNome).toBe("Padrão Catuaí 35 sc/ha");
  });

  it("ignora talhão BAIXADO na contagem e na área (lavoura viva)", () => {
    const dto = agregarLavoura({
      id: 1, nome: "Cafundó", planoAdubacao: null,
      talhoes: [
        { variedade: { nome: "Catuaí Vermelho IAC 144" }, areaHa: new Prisma.Decimal("4.20"), estado: "ATIVO", resumo: { produtividadeEsperada: new Prisma.Decimal("38.00") } },
        { variedade: { nome: "Catuaí Vermelho IAC 144" }, areaHa: new Prisma.Decimal("5.40"), estado: "FORMACAO", resumo: { produtividadeEsperada: new Prisma.Decimal("0") } },
        { variedade: { nome: "Mundo Novo IAC 379-19" }, areaHa: new Prisma.Decimal("2.20"), estado: "BAIXADO", resumo: { produtividadeEsperada: new Prisma.Decimal("0") } },
      ],
    });
    expect(dto.numTalhoes).toBe(2); // ATIVO + FORMACAO; BAIXADO fora
    expect(dto.areaHa).toBe(9.6); // 4.2 + 5.4 (sem os 2.2 do baixado)
  });

  it("sem talhões com produtividade > 0 → produtividadeMedia undefined", () => {
    const dto = agregarLavoura({
      id: 5, nome: "Novo Sul", planoAdubacao: null,
      talhoes: [{ variedade: { nome: "Catuaí Amarelo IAC 144" }, areaHa: new Prisma.Decimal("4.50"), resumo: { produtividadeEsperada: new Prisma.Decimal("0") } }],
    });
    expect(dto.numTalhoes).toBe(1);
    expect(dto.areaHa).toBe(4.5);
    expect(dto.produtividadeMedia).toBeUndefined();
    expect(dto.planoAdubacaoNome).toBeNull();
  });

  it("lavoura sem talhões → zeros", () => {
    const dto = agregarLavoura({ id: 9, nome: "Vazia", planoAdubacao: null, talhoes: [] });
    expect(dto.numTalhoes).toBe(0);
    expect(dto.areaHa).toBe(0);
    expect(dto.produtividadeMedia).toBeUndefined();
    expect(dto.variedade).toBeUndefined();
  });
});
