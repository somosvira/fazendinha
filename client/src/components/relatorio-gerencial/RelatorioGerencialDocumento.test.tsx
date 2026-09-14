// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RelatorioGerencialDocumento } from "./RelatorioGerencialDocumento";
import { dtoExemplo } from "./export.test";
import { editarTexto, templatePadrao } from "./template";
import type { RelatorioGerencialDTO } from "./types";

afterEach(cleanup);

const vazio: RelatorioGerencialDTO = {
  ...dtoExemplo,
  resumo: { entradas: 0, saidas: 0, resultado: 0, saldoContasFinal: 0, nLancamentos: 0, aPagar: 0, aReceber: 0 },
  saldoContas: { contas: [], total: { saldoInicial: 0, entradas: 0, saidas: 0, saldoFinal: 0 } },
  entradasSaidas: { meses: [{ mes: "2026-03", entradas: 0, saidas: 0, resultado: 0 }], total: { entradas: 0, saidas: 0, resultado: 0 } },
  resultado: { receita: 0, custeio: 0, investimento: 0, resultado: 0, porAtividade: [] },
  compromissos: { hoje: "2026-09-08", aPagar: { total: 0, vencido: 0, aVencer: 0, quantidade: 0, itens: [] }, aReceber: { total: 0, vencido: 0, aVencer: 0, quantidade: 0, itens: [] } },
  categorias: { itens: [], centros: [] },
  operacoes: dtoExemplo.operacoes.map((o) => ({ ...o, quantidade: 0, valor: 0 })),
  rastreabilidade: { totalLancamentos: 0, estornados: 0, comDocumento: 0, semDocumento: 0, comNotaFiscal: 0, semNotaFiscal: 0, semCentroCusto: 0, mesesFechados: [], mesesAbertos: ["2026-03"] },
};

describe("RelatorioGerencialDocumento", () => {
  it("mostra título e observações personalizados, com metadados de geração", () => {
    const t = editarTexto(editarTexto(templatePadrao(), "titulo", "Relatório da Sede"), "observacoes", "Conferido pela contabilidade.");
    render(<RelatorioGerencialDocumento dto={dtoExemplo} template={t} />);
    expect(screen.getByRole("heading", { level: 1, name: "Relatório da Sede" })).toBeTruthy();
    expect(screen.getByText("Conferido pela contabilidade.")).toBeTruthy();
    expect(screen.getByText(/Gerado em/)).toBeTruthy();
    expect(screen.getAllByText(/Sede/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Regime: realizado e previsto/).length).toBeGreaterThanOrEqual(1);
  });

  it("mantém realizado e previsto em blocos separados, sem somar compromissos ao saldo", () => {
    render(<RelatorioGerencialDocumento dto={dtoExemplo} template={templatePadrao()} />);
    const realizado = screen.getByRole("region", { name: "Resumo executivo" });
    expect(within(realizado).getByText("R$ 5.000,00")).toBeTruthy();
    const previsto = screen.getByRole("region", { name: "Compromissos a pagar e a receber" });
    expect(within(previsto).getByText(/Previsto/)).toBeTruthy();
    expect(within(previsto).getByText("Energia")).toBeTruthy();
    expect(within(realizado).queryByText("Energia")).toBeNull();
  });

  it("no regime realizado não renderiza a seção de compromissos", () => {
    render(<RelatorioGerencialDocumento dto={{ ...dtoExemplo, meta: { ...dtoExemplo.meta, regime: "realizado" }, compromissos: null }} template={templatePadrao()} />);
    expect(screen.queryByRole("region", { name: "Compromissos a pagar e a receber" })).toBeNull();
  });

  it("estado vazio produz documento válido com avisos, sem tabelas enganosas", () => {
    render(<RelatorioGerencialDocumento dto={vazio} template={templatePadrao()} />);
    expect(screen.getAllByText("Sem registros no período").length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText("Sicoob")).toBeNull();
    expect(within(screen.getByRole("region", { name: "Resumo executivo" })).getByText(/^0 lançamentos realizados/)).toBeTruthy();
  });
});
