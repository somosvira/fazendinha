import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  movimentos: vi.fn(), groupBy: vi.fn(), compromissos: vi.fn(), contas: vi.fn(), periodos: vi.fn(), propriedade: vi.fn(), centros: vi.fn(),
}));

vi.mock("../db.js", () => ({ prisma: {
  movimentoConta: { findMany: mocks.movimentos, groupBy: mocks.groupBy },
  compromissoFinanceiro: { findMany: mocks.compromissos },
  contaFinanceira: { findMany: mocks.contas },
  periodoFinanceiro: { findMany: mocks.periodos },
  propriedade: { findUnique: mocks.propriedade },
  centroCusto: { findMany: mocks.centros },
} }));

import { gerarRelatorioGerencial } from "./relatorio-gerencial.js";

const d = (v: string) => new Prisma.Decimal(v);
const semFiltro = { tipos: [], status: [], centroCustoIds: [], categoriaIds: [], classificacoes: [] };

// Pagamento integral de uma compra mista (ração + mourões) e um pagamento avulso.
const compraMista = {
  id: 1, tipo: "COMPRA_ESTOQUE", status: "CONFIRMADA", descricao: "Compra mista", valorTotal: d("1300"), centroCustoId: 1,
  categoriaNome: null, classificacao: null, parceiro: null, documentos: [], centroCusto: { nome: "Pecuária" }, compromissos: [],
  itens: [
    { id: 1, valorTotal: d("800"), categoriaId: 3, categoriaNome: "Nutrição", classificacao: "CUSTEIO" },
    { id: 2, valorTotal: d("500"), categoriaId: 4, categoriaNome: "Benfeitorias", classificacao: "INVESTIMENTO" },
  ],
  transacoes: [{ id: 10, tipo: "PAGAMENTO", valorTotal: d("1300"), reversaoDeId: null, status: "CONFIRMADA" }],
};
const movimento = (id: number, transacao: object, valor: string) => ({ id, contaId: 1, direcao: "SAIDA", valor: d(valor), transacao: { status: "CONFIRMADA", data: new Date("2026-09-05T00:00:00Z"), descricao: null, reversaoDe: null, parceiro: null, documentos: [], ...transacao } });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.movimentos.mockResolvedValue([
    movimento(100, { id: 10, tipo: "PAGAMENTO", operacao: compraMista }, "1300"),
    movimento(101, { id: 11, tipo: "PAGAMENTO", descricao: "Frete avulso", operacao: null }, "200"),
  ]);
  mocks.groupBy.mockResolvedValue([]);
  mocks.compromissos.mockResolvedValue([]);
  mocks.contas.mockResolvedValue([{ id: 1, nome: "Banco", instituicao: null, saldoAbertura: d("5000") }]);
  mocks.periodos.mockResolvedValue([]);
  mocks.propriedade.mockResolvedValue({ id: 7, nome: "Fazenda Rio Novo" });
  mocks.centros.mockResolvedValue([{ id: 1, nome: "Pecuária" }, { id: 2, nome: "Agronomia" }]);
});

const query = { inicio: "2026-09-01", fim: "2026-09-30", regime: "realizado" as const };

describe("relatório gerencial com filtro de composição", () => {
  it("sem filtro rateia a compra mista por categoria do item", async () => {
    const dto = await gerarRelatorioGerencial(query, 7, semFiltro);
    expect(dto.categorias?.itens).toEqual([
      { categoria: "Nutrição", total: 800, pct: 53.33 },
      { categoria: "Benfeitorias", total: 500, pct: 33.33 },
      { categoria: "Sem categoria", total: 200, pct: 13.33 },
    ]);
    expect(dto.resultado).toMatchObject({ custeio: 1000, investimento: 500 });
  });

  it("filtro de categoria mantém só a fatia pedida, mas não altera o saldo das contas", async () => {
    const completo = await gerarRelatorioGerencial(query, 7);
    const dto = await gerarRelatorioGerencial(query, 7, { ...semFiltro, categoriaIds: [4] });
    expect(dto.categorias?.itens).toEqual([{ categoria: "Benfeitorias", total: 500, pct: 100 }]);
    expect(dto.resumo.saidas).toBe(500);
    expect(dto.saldoContas).toEqual(completo.saldoContas);
    expect(dto.rastreabilidade.totalLancamentos).toBe(1);
    expect(completo.rastreabilidade.totalLancamentos).toBe(2);
  });

  it("filtro de tipo exclui lançamento sem operação; 'sem centro' o inclui", async () => {
    const porTipo = await gerarRelatorioGerencial(query, 7, { ...semFiltro, tipos: ["COMPRA_ESTOQUE"] });
    expect(porTipo.categorias?.itens.map((c) => c.categoria)).toEqual(["Nutrição", "Benfeitorias"]);
    const semCentro = await gerarRelatorioGerencial(query, 7, { ...semFiltro, centroCustoIds: [0] });
    expect(semCentro.categorias?.itens).toEqual([{ categoria: "Sem categoria", total: 200, pct: 100 }]);
  });

  it("centro do item prevalece sobre o da operação; item sem centro herda o da operação", async () => {
    const mistaPorCentro = {
      ...compraMista,
      itens: [
        { id: 1, valorTotal: d("800"), categoriaId: 3, categoriaNome: "Nutrição", classificacao: "CUSTEIO", centroCustoId: 2, centroCustoNome: "Agronomia" },
        { id: 2, valorTotal: d("500"), categoriaId: 4, categoriaNome: "Benfeitorias", classificacao: "INVESTIMENTO", centroCustoId: null, centroCustoNome: null },
      ],
    };
    mocks.movimentos.mockResolvedValue([movimento(100, { id: 10, tipo: "PAGAMENTO", operacao: mistaPorCentro }, "1300")]);
    const tudo = await gerarRelatorioGerencial(query, 7, semFiltro);
    expect(tudo.categorias?.centros.map((c) => [c.centro, c.total])).toEqual([["Agronomia", 800], ["Pecuária", 500]]);
    const agronomia = await gerarRelatorioGerencial(query, 7, { ...semFiltro, centroCustoIds: [2] });
    expect(agronomia.categorias?.itens).toEqual([{ categoria: "Nutrição", total: 800, pct: 100 }]);
    const pecuaria = await gerarRelatorioGerencial(query, 7, { ...semFiltro, centroCustoIds: [1] });
    expect(pecuaria.categorias?.itens).toEqual([{ categoria: "Benfeitorias", total: 500, pct: 100 }]);
    expect((await gerarRelatorioGerencial(query, 7, { ...semFiltro, centroCustoIds: [0] })).categorias?.itens).toEqual([]);
  });

  it("centro renomeado depois do snapshot do item não duplica a linha em 'por centro'", async () => {
    // O item guarda o snapshot antigo "Pecuária" (id 1); o cadastro vivo foi
    // renomeado para "Bovinocultura" — deve agrupar por id, com o nome vivo.
    mocks.centros.mockResolvedValue([{ id: 1, nome: "Bovinocultura" }, { id: 2, nome: "Agronomia" }]);
    const dto = await gerarRelatorioGerencial(query, 7, semFiltro);
    // Uma única linha para o centro renomeado (não duas: "Pecuária" e
    // "Bovinocultura"), com o nome vivo; o avulso some centro fica à parte.
    expect(dto.categorias?.centros).toEqual([
      { centro: "Bovinocultura", total: 1300, pct: 86.67 },
      { centro: "(Sem centro de custo)", total: 200, pct: 13.33 },
    ]);
  });

  it("situação da operação não recorta o caixa: avulso e pagamento de operação cancelada seguem no realizado", async () => {
    mocks.movimentos.mockResolvedValue([
      movimento(100, { id: 10, tipo: "PAGAMENTO", status: "REVERTIDA", operacao: { ...compraMista, status: "CANCELADA" } }, "1300"),
      movimento(101, { id: 11, tipo: "PAGAMENTO", descricao: "Frete avulso", operacao: null }, "200"),
    ]);
    const dto = await gerarRelatorioGerencial(query, 7, { ...semFiltro, status: ["CONFIRMADA"] });
    expect(dto.resumo.saidas).toBe(1500);
    expect(dto.resumo.saidas).toBe(dto.saldoContas!.total.saidas);
  });

  it("filtro por classificação separa investimento", async () => {
    const dto = await gerarRelatorioGerencial(query, 7, { ...semFiltro, classificacoes: ["INVESTIMENTO"] });
    expect(dto.resultado).toMatchObject({ custeio: 0, investimento: 500 });
  });
});
