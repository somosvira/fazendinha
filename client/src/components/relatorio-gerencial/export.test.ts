import { describe, expect, it } from "vitest";
import { nomeArquivoRelatorio, relatorioGerencialParaCsv } from "./export";
import { alternarSecao, moverSecao, templatePadrao } from "./template";
import type { RelatorioGerencialDTO } from "./types";

export const dtoExemplo: RelatorioGerencialDTO = {
  meta: { geradoEm: "2026-09-08T12:00:00.000Z", propriedade: { id: 1, nome: "Sede" }, periodo: { inicio: "2026-03-01", fim: "2026-03-31" }, regime: "ambos", hoje: "2026-09-08" },
  resumo: { entradas: 1000.5, saidas: 400, resultado: 600.5, saldoContasFinal: 5000, nLancamentos: 3, aPagar: 250, aReceber: 0 },
  saldoContas: { contas: [{ id: "acct-1", nome: "Sicoob", banco: "756", saldoInicial: 4399.5, entradas: 1000.5, saidas: 400, saldoFinal: 5000 }], total: { saldoInicial: 4399.5, entradas: 1000.5, saidas: 400, saldoFinal: 5000 } },
  entradasSaidas: { meses: [{ mes: "2026-03", entradas: 1000.5, saidas: 400, resultado: 600.5 }], total: { entradas: 1000.5, saidas: 400, resultado: 600.5 } },
  resultado: { receita: 1000.5, custeio: 300, investimento: 100, resultado: 600.5, porAtividade: [{ atividade: "leite", receita: 1000.5, custeio: 300, investimento: 100, resultado: 600.5 }, { atividade: "cafe", receita: 0, custeio: 0, investimento: 0, resultado: 0 }, { atividade: "outros", receita: 0, custeio: 0, investimento: 0, resultado: 0 }] },
  compromissos: { hoje: "2026-09-08", aPagar: { total: 250, vencido: 250, aVencer: 0, quantidade: 1, itens: [{ id: "comp-9", descricao: "Energia", fornecedor: "Cemig", categoria: "Energia elétrica", valor: 250, dataVencimento: "2026-03-20", diasAtraso: 172, vencido: true }] }, aReceber: { total: 0, vencido: 0, aVencer: 0, quantidade: 0, itens: [] } },
  categorias: { itens: [{ categoria: "Ração", total: 300, pct: 75 }, { categoria: "Cerca", total: 100, pct: 25 }], centros: [{ centro: "Atv. Leiteira", total: 400, pct: 100 }] },
  operacoes: [{ tipo: "receita", quantidade: 1, valor: 1000.5, entraNoTotal: true }, { tipo: "custeio", quantidade: 1, valor: 300, entraNoTotal: true }, { tipo: "investimento", quantidade: 1, valor: 100, entraNoTotal: true }, { tipo: "transferencia", quantidade: 0, valor: 0, entraNoTotal: false }, { tipo: "compromisso", quantidade: 1, valor: 250, entraNoTotal: false }, { tipo: "parcial", quantidade: 0, valor: 0, entraNoTotal: false }, { tipo: "estorno", quantidade: 1, valor: 80, entraNoTotal: false }],
  rastreabilidade: { totalLancamentos: 4, estornados: 1, comDocumento: 3, semDocumento: 1, comNotaFiscal: 2, semNotaFiscal: 2, semCentroCusto: 0, mesesFechados: ["2026-03"], mesesAbertos: [] },
};

describe("relatorioGerencialParaCsv", () => {
  it("serializa as seções visíveis na ordem do template, com ; e vírgula decimal", () => {
    const t = moverSecao(alternarSecao(templatePadrao(), "operacoes"), "saldoContas", -1);
    const csv = relatorioGerencialParaCsv(dtoExemplo, t);
    expect(csv.startsWith("﻿")).toBe(true);
    const linhas = csv.slice(1).split("\r\n");
    expect(linhas[0]).toBe('"Relatório financeiro gerencial";"Sede";"2026-03-01 a 2026-03-31";"Regime: realizado e previsto"');
    const titulos = linhas.filter((l) => l.startsWith('"## '));
    expect(titulos[0]).toBe('"## Saldo por conta"');
    expect(titulos[1]).toBe('"## Resumo executivo"');
    expect(titulos).not.toContain('"## Operações por tipo"');
    expect(linhas).toContain('"Sicoob";"756";"4399,50";"1000,50";"400,00";"5000,00"');
    expect(linhas).toContain('"Energia";"Cemig";"Energia elétrica";"2026-03-20";"250,00";"Vencido"');
  });

  it("omite seções cujo dado não veio do backend", () => {
    const csv = relatorioGerencialParaCsv({ ...dtoExemplo, compromissos: null, categorias: null }, templatePadrao());
    expect(csv).not.toContain("## Compromissos");
    expect(csv).not.toContain("## Despesas por categoria");
    expect(csv).toContain("## Resultado do período");
  });
});

describe("nomeArquivoRelatorio", () => {
  it("usa período e extensão", () => {
    expect(nomeArquivoRelatorio(dtoExemplo, "pdf")).toBe("relatorio-gerencial-2026-03-01-a-2026-03-31.pdf");
  });
});
