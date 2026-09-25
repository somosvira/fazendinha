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

import { agregarPrevisto, type LinhaLancamento } from "./relatorio-gerencial.calc.js";
import { gerarRelatorioGerencial } from "./relatorio-gerencial.js";
import { uid } from "../lib/uid.fixture.js";

// Regra: no mesmo vencimento, o compromisso de maior `seq` (registrado por
// último) vem primeiro. Os uuids são escolhidos para que nenhuma ordenação por
// id (crescente: seq 2,1,3; decrescente: seq 3,1,2) coincida com a esperada
// (seq 3,2,1) — ordenar pelo uuid em vez de `seq` quebra estes testes.
const UUID_POR_SEQ: Record<number, string> = { 1: uid(20), 2: uid(10), 3: uid(30) };
const chave = (seq: number) => UUID_POR_SEQ[seq];

const base: LinhaLancamento = {
  id: chave(1),
  seq: 1,
  natureza: "DEBITO",
  valor: 100,
  situacao: "ABERTO",
  estornado: false,
  dataLiquidacao: null,
  dataVencimento: "2026-03-10",
  descricao: "Compromisso",
  numeroDocumento: null,
  categoria: { nome: "Ração", classificacao: null },
  centroCusto: { nome: "Atv. Leiteira" },
  contaBancariaId: null,
  fornecedor: "Coop",
  temNotaFiscal: false,
};
const linha = (p: Partial<LinhaLancamento>): LinhaLancamento => ({ ...base, ...p });
const mesmoDia = (seqs: number[]) => seqs.map((seq) => linha({ id: chave(seq), seq, valor: seq * 10, dataVencimento: "2026-03-15" }));

describe("agregarPrevisto: desempate de mesmo vencimento", () => {
  it("compromissos embaralhados saem na mesma ordem: data, depois seq decrescente", () => {
    const ordenado = agregarPrevisto(mesmoDia([3, 2, 1]), "2026-03-01");
    const embaralhado = agregarPrevisto(mesmoDia([1, 3, 2]), "2026-03-01");
    expect(embaralhado.aPagar.itens.map((i) => i.id)).toEqual(ordenado.aPagar.itens.map((i) => i.id));
    expect(ordenado.aPagar.itens.map((i) => i.id)).toEqual([chave(3), chave(2), chave(1)]);
  });

  it("vencimentos diferentes continuam ordenados por data, qualquer que seja o seq", () => {
    const r = agregarPrevisto([
      linha({ id: chave(1), seq: 1, dataVencimento: "2026-03-20" }),
      linha({ id: chave(2), seq: 2, dataVencimento: "2026-03-05" }),
      linha({ id: chave(3), seq: 3, dataVencimento: "2026-03-10" }),
    ], "2026-03-01");
    expect(r.aPagar.itens.map((i) => i.id)).toEqual([chave(2), chave(3), chave(1)]);
  });
});

describe("relatório gerencial: ordem dos compromissos como montados pelo serviço", () => {
  const d = (v: string) => new Prisma.Decimal(v);
  const servico = {
    id: uid(1), numero: 1, tipo: "SERVICO", status: "CONFIRMADA", descricao: "Manutenção", valorTotal: d("60"),
    categoriaId: uid(301), categoriaNome: "Manutenção", classificacao: "CUSTEIO", centroCustoId: null, centroCusto: null,
    parceiro: null, documentos: [], itens: [], transacoes: [],
    compromissos: [1, 2, 3].map((seq) => ({ id: UUID_POR_SEQ[seq], seq, status: "PENDENTE", valorOriginal: d("20"), liquidacoes: [] })),
  };
  const compromisso = (seq: number) => ({
    id: UUID_POR_SEQ[seq], seq, tipo: "PAGAR", status: "PENDENTE", valorOriginal: d("20"), dataVencimento: new Date("2026-09-15T00:00:00Z"),
    numeroParcela: seq, totalParcelas: 3, parceiro: null, documentos: [], liquidacoes: [], operacao: servico,
  });
  const query = { inicio: "2026-09-01", fim: "2026-09-30", regime: "previsto" as const };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.periodos.mockResolvedValue([]);
    mocks.propriedade.mockResolvedValue({ id: 7, nome: "Fazenda Rio Novo" });
    mocks.centros.mockResolvedValue([]);
  });

  const itens = async (seqs: number[]) => {
    mocks.compromissos.mockResolvedValue(seqs.map(compromisso));
    const dto = await gerarRelatorioGerencial(query, 7);
    return dto.compromissos!.aPagar.itens.map((i) => [i.id, i.descricao]);
  };

  it("mesmo vencimento: seq decrescente, independente da ordem em que o banco devolve", async () => {
    const esperado = [[chave(3), "(3/3) Manutenção"], [chave(2), "(2/3) Manutenção"], [chave(1), "(1/3) Manutenção"]];
    expect(await itens([1, 2, 3])).toEqual(esperado);
    expect(await itens([2, 3, 1])).toEqual(esperado);
    expect(mocks.compromissos).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { seq: "asc" } }));
  });
});
