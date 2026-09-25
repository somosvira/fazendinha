import { describe, expect, it } from "vitest";
import {
  agregarOperacoesPorTipo,
  agregarPrevisto,
  agregarRastreabilidade,
  agregarRealizado,
  agregarSaldoContas,
  atividadeDe,
  classificarLinha,
  mesesEntre,
  type LinhaLancamento,
} from "./relatorio-gerencial.calc.js";
import { uid } from "../lib/uid.fixture.js";

const mov = (n: number) => uid(n);
const comp = (n: number) => uid(100 + n);
const CONTA_SICOOB = uid(501), CONTA_CAIXA = uid(502);

const base: LinhaLancamento = {
  id: mov(1),
  seq: 1,
  natureza: "DEBITO",
  valor: 100,
  situacao: "LIQUIDADO",
  estornado: false,
  dataLiquidacao: "2026-03-10",
  dataVencimento: "2026-03-10",
  descricao: "Ração",
  numeroDocumento: "NF 1",
  categoria: { nome: "Ração", classificacao: null },
  centroCusto: { nome: "Atv. Leiteira" },
  contaBancariaId: CONTA_SICOOB,
  fornecedor: "Coop",
  temNotaFiscal: true,
};
const linha = (p: Partial<LinhaLancamento>): LinhaLancamento => ({ ...base, ...p });

describe("classificarLinha", () => {
  it("separa estorno, parcial, transferência, receita, custeio e investimento", () => {
    expect(classificarLinha(linha({ estornado: true }))).toBe("estorno");
    expect(classificarLinha(linha({ situacao: "LIQUIDADO_PARCIAL" }))).toBe("parcial");
    expect(classificarLinha(linha({ situacao: "ABERTO", dataLiquidacao: null }))).toBe("compromisso");
    expect(classificarLinha(linha({ transferencia: true, centroCusto: { nome: "(Sem centro de custo)" } }))).toBe("transferencia");
    expect(classificarLinha(linha({ natureza: "CREDITO" }))).toBe("receita");
    expect(classificarLinha(linha({}))).toBe("custeio");
    expect(classificarLinha(linha({ centroCusto: { nome: "Investimento Leite" } }))).toBe("custeio");
    expect(classificarLinha(linha({ categoria: { nome: "Trator", classificacao: "INVESTIMENTO" } }))).toBe("investimento");
  });
});

describe("atividadeDe", () => {
  it("mapeia centro de custo para leite, café ou outros", () => {
    expect(atividadeDe("Atv. Leiteira")).toBe("leite");
    expect(atividadeDe("Atv. Café")).toBe("cafe");
    expect(atividadeDe("Plantio 2025")).toBe("cafe");
    expect(atividadeDe("Sede")).toBe("outros");
  });
});

describe("mesesEntre", () => {
  it("lista os meses do período, inclusive", () => {
    expect(mesesEntre("2025-11-15", "2026-02-01")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("agregarRealizado", () => {
  it("soma só o liquidado no período, excluindo estornos, parciais, abertos e transferências", () => {
    const linhas = [
      linha({ id: mov(1), seq: 1, natureza: "CREDITO", valor: 1000.5, categoria: { nome: "Leite", classificacao: null } }),
      linha({ id: mov(2), seq: 2, valor: 300.25 }),
      linha({ id: mov(3), seq: 3, valor: 50, estornado: true }),
      linha({ id: mov(4), seq: 4, valor: 60, situacao: "LIQUIDADO_PARCIAL" }),
      linha({ id: mov(5), seq: 5, valor: 70, situacao: "ABERTO", dataLiquidacao: null }),
      linha({ id: mov(6), seq: 6, valor: 5000, transferencia: true, centroCusto: { nome: "(Sem centro de custo)" } }),
      linha({ id: mov(7), seq: 7, valor: 80, dataLiquidacao: "2026-05-01" }),
      linha({ id: mov(8), seq: 8, valor: 200, centroCusto: { nome: "Investimento Café" }, categoria: { nome: "Cerca", classificacao: "INVESTIMENTO" } }),
    ];
    const r = agregarRealizado(linhas, "2026-03-01", "2026-04-30");
    expect(r.totais).toEqual({ entradas: 1000.5, saidas: 500.25, resultado: 500.25 });
    expect(r.nLancamentos).toBe(3);
    expect(r.meses).toEqual([
      { mes: "2026-03", entradas: 1000.5, saidas: 500.25, resultado: 500.25 },
      { mes: "2026-04", entradas: 0, saidas: 0, resultado: 0 },
    ]);
    expect(r.resultado).toMatchObject({ receita: 1000.5, custeio: 300.25, investimento: 200, resultado: 500.25 });
    expect(r.resultado.porAtividade).toEqual([
      { atividade: "leite", receita: 1000.5, custeio: 300.25, investimento: 0, resultado: 700.25 },
      { atividade: "cafe", receita: 0, custeio: 0, investimento: 200, resultado: -200 },
      { atividade: "outros", receita: 0, custeio: 0, investimento: 0, resultado: 0 },
    ]);
  });

  it("agrupa despesas por categoria e por centro de custo com percentual", () => {
    const linhas = [
      linha({ id: mov(1), seq: 1, valor: 300 }),
      linha({ id: mov(2), seq: 2, valor: 100, categoria: { nome: "Sal mineral", classificacao: null } }),
      linha({ id: mov(3), seq: 3, valor: 100, categoria: { nome: "Diesel", classificacao: null }, centroCusto: { nome: "Atv. Café" } }),
      linha({ id: mov(4), seq: 4, natureza: "CREDITO", valor: 999 }),
    ];
    const r = agregarRealizado(linhas, "2026-03-01", "2026-03-31");
    expect(r.categorias.itens).toEqual([
      { categoria: "Ração", total: 300, pct: 60 },
      { categoria: "Sal mineral", total: 100, pct: 20 },
      { categoria: "Diesel", total: 100, pct: 20 },
    ]);
    expect(r.categorias.centros).toEqual([
      { centro: "Atv. Leiteira", total: 400, pct: 80 },
      { centro: "Atv. Café", total: 100, pct: 20 },
    ]);
  });

  it("período vazio produz zeros e listas vazias", () => {
    const r = agregarRealizado([], "2026-03-01", "2026-03-31");
    expect(r.totais).toEqual({ entradas: 0, saidas: 0, resultado: 0 });
    expect(r.nLancamentos).toBe(0);
    expect(r.categorias).toEqual({ itens: [], centros: [] });
  });
});

describe("agregarPrevisto", () => {
  it("separa a pagar e a receber, vencidos e a vencer, sem misturar estornos", () => {
    const linhas = [
      linha({ id: comp(1), seq: 1, situacao: "ABERTO", dataLiquidacao: null, valor: 100, dataVencimento: "2026-03-01" }),
      linha({ id: comp(2), seq: 2, situacao: "ABERTO", dataLiquidacao: null, valor: 200, dataVencimento: "2026-03-20" }),
      linha({ id: comp(3), seq: 3, situacao: "ABERTO", dataLiquidacao: null, natureza: "CREDITO", valor: 500, dataVencimento: "2026-03-25" }),
      linha({ id: comp(4), seq: 4, situacao: "ABERTO", dataLiquidacao: null, valor: 999, estornado: true }),
      linha({ id: comp(5), seq: 5, valor: 999 }),
    ];
    const r = agregarPrevisto(linhas, "2026-03-10");
    expect(r.aPagar).toMatchObject({ total: 300, vencido: 100, aVencer: 200, quantidade: 2 });
    expect(r.aPagar.itens.map((i) => i.id)).toEqual([comp(1), comp(2)]);
    expect(r.aPagar.itens[0]).toMatchObject({ dataVencimento: "2026-03-01", diasAtraso: 9, vencido: true });
    expect(r.aReceber).toMatchObject({ total: 500, vencido: 0, aVencer: 500, quantidade: 1 });
  });
});

describe("agregarSaldoContas", () => {
  it("parte do saldo inicial + movimentos anteriores e aplica o período, incluindo transferências", () => {
    const contas = [
      { id: CONTA_SICOOB, nome: "Sicoob", banco: "756", saldoInicial: 1000 },
      { id: CONTA_CAIXA, nome: "Caixa", banco: null, saldoInicial: 0 },
    ];
    const anteriores = [
      { contaBancariaId: CONTA_SICOOB, natureza: "CREDITO" as const, total: 500 },
      { contaBancariaId: CONTA_SICOOB, natureza: "DEBITO" as const, total: 200 },
      { contaBancariaId: null, natureza: "DEBITO" as const, total: 999 },
    ];
    const linhas = [
      linha({ id: mov(1), seq: 1, natureza: "CREDITO", valor: 100, contaBancariaId: CONTA_SICOOB }),
      linha({ id: mov(2), seq: 2, valor: 30, contaBancariaId: CONTA_SICOOB }),
      linha({ id: mov(3), seq: 3, valor: 50, contaBancariaId: CONTA_SICOOB, transferencia: true, centroCusto: { nome: "(Sem centro de custo)" } }),
      linha({ id: mov(4), seq: 4, natureza: "CREDITO", valor: 50, contaBancariaId: CONTA_CAIXA, transferencia: true, centroCusto: { nome: "(Sem centro de custo)" } }),
      linha({ id: mov(5), seq: 5, valor: 999, contaBancariaId: CONTA_SICOOB, situacao: "ABERTO", dataLiquidacao: null }),
      linha({ id: mov(6), seq: 6, valor: 999, contaBancariaId: CONTA_SICOOB, estornado: true }),
      linha({ id: mov(7), seq: 7, valor: 999, contaBancariaId: null }),
    ];
    const r = agregarSaldoContas(contas, anteriores, linhas, "2026-03-01", "2026-03-31");
    expect(r.contas).toEqual([
      { id: CONTA_SICOOB, nome: "Sicoob", banco: "756", saldoInicial: 1300, entradas: 100, saidas: 80, saldoFinal: 1320 },
      { id: CONTA_CAIXA, nome: "Caixa", banco: null, saldoInicial: 0, entradas: 50, saidas: 0, saldoFinal: 50 },
    ]);
    expect(r.total).toEqual({ saldoInicial: 1300, entradas: 150, saidas: 80, saldoFinal: 1370 });
  });
});

describe("agregarOperacoesPorTipo", () => {
  it("conta e soma cada tipo, marcando o que entra nos totais", () => {
    const linhas = [
      linha({ id: mov(1), seq: 1, natureza: "CREDITO", valor: 10 }),
      linha({ id: mov(2), seq: 2, valor: 20 }),
      linha({ id: mov(3), seq: 3, valor: 30, categoria: { nome: "Trator", classificacao: "INVESTIMENTO" }, centroCusto: { nome: "Pecuária" } }),
      linha({ id: mov(4), seq: 4, valor: 40, transferencia: true, centroCusto: { nome: "(Sem centro de custo)" } }),
      linha({ id: mov(5), seq: 5, valor: 50, estornado: true }),
      linha({ id: mov(6), seq: 6, valor: 60, situacao: "LIQUIDADO_PARCIAL" }),
      linha({ id: mov(7), seq: 7, valor: 70, situacao: "ABERTO", dataLiquidacao: null }),
    ];
    expect(agregarOperacoesPorTipo(linhas)).toEqual([
      { tipo: "receita", quantidade: 1, valor: 10, entraNoTotal: true },
      { tipo: "custeio", quantidade: 1, valor: 20, entraNoTotal: true },
      { tipo: "investimento", quantidade: 1, valor: 30, entraNoTotal: true },
      { tipo: "transferencia", quantidade: 1, valor: 40, entraNoTotal: false },
      { tipo: "compromisso", quantidade: 1, valor: 70, entraNoTotal: false },
      { tipo: "parcial", quantidade: 1, valor: 60, entraNoTotal: false },
      { tipo: "estorno", quantidade: 1, valor: 50, entraNoTotal: false },
    ]);
  });
});

describe("agregarRastreabilidade", () => {
  it("conta documentos, notas fiscais, sem centro de custo e meses fechados no período", () => {
    const linhas = [
      linha({ id: mov(1), seq: 1 }),
      linha({ id: mov(2), seq: 2, numeroDocumento: null, temNotaFiscal: false }),
      linha({ id: mov(3), seq: 3, transferencia: true, centroCusto: { nome: "(Sem centro de custo)" }, temNotaFiscal: false }),
      linha({ id: mov(4), seq: 4, estornado: true }),
    ];
    const r = agregarRastreabilidade(linhas, [{ ano: 2026, mes: 3 }, { ano: 2025, mes: 1 }], "2026-03-01", "2026-04-30");
    expect(r).toEqual({
      totalLancamentos: 3,
      estornados: 1,
      comDocumento: 2,
      semDocumento: 1,
      comNotaFiscal: 1,
      semNotaFiscal: 2,
      semCentroCusto: 1,
      mesesFechados: ["2026-03"],
      mesesAbertos: ["2026-04"],
    });
  });
});
