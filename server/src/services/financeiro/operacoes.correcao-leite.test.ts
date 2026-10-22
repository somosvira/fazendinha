import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { corrigirVendaLeiteTx } from "./operacoes.js";

vi.mock("../../db.js", () => ({ prisma: {} }));
vi.mock("../propriedade.js", () => ({ propriedadePrincipalId: vi.fn(async () => 7) }));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const contexto = { propriedadeId: 7, usuarioId: 9 };
const input = { operacaoId: id(1), versaoEsperada: 1, chave: id(2), motivo: "Correção documentada do preço definitivo", parceiroId: id(3), valorTotal: 250,
  financeiro: { condicao: "A_PRAZO" as const, parcelas: [{ valor: 250, dataVencimento: new Date("2026-10-30") }] } };
function banco() {
  const retirada = { id: id(4), produtoId: id(5), propriedadeId: 7, quantidade: new Prisma.Decimal(100), data: new Date("2026-10-19"), tipo: "SAIDA", status: "CONFIRMADO", reversaoDeId: null, metodoValorizacao: "LEITE_FIFO_V1", operacaoId: id(1) };
  const operacao = { id: id(1), numero: 42, tipo: "VENDA", status: "CONFIRMADA", propriedadeId: 7, data: new Date("2026-10-19"), descricao: "Venda inicial", parceiroId: id(6), centroCustoId: null,
    itens: [{ id: id(7), produtoId: id(5), quantidade: new Prisma.Decimal(100), unidade: "L", descricao: "Leite produzido", categoriaId: null as string | null, categoriaNome: null as string | null, classificacao: null, centroCustoId: null as string | null, centroCustoNome: null as string | null }],
    transacoes: [] as { status: string; tipo: string }[], compromissos: [] as { liquidacoes: { transacao: { status: string } }[] }[] };
  const vinculo = { id: id(8), operacaoId: id(1), retiradaId: retirada.id, versao: 1, retirada, operacao };
  return { retirada, operacao, vinculo, tx: {
    alocacaoDemonstrativoLeite: { findFirst: vi.fn(async () => null) },
    $executeRaw: vi.fn(), $queryRaw: vi.fn(async () => [{ id: id(1) }]),
    versaoComercialVendaLeite: { findUnique: vi.fn(async () => null), findFirst: vi.fn(async () => vinculo), create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: id(9), ...data })) },
    periodoFinanceiro: { findUnique: vi.fn(async (): Promise<{ status: string } | null> => null) },
    parceiro: { findFirst: vi.fn(async () => ({ id: id(3), tipo: "CLIENTE", papeis: [] })) },
    produto: { findMany: vi.fn(async () => [{ id: id(5), ativo: true, unidade: "L", rastrearPartidas: false, categoriaId: id(90), centrosCusto: [] }]) },
    centroCusto: { findMany: vi.fn(async (): Promise<{ id: string; nome: string }[]> => []) },
    categoria: { findFirst: vi.fn(async () => null) },
    operacao: { findFirst: vi.fn(async () => ({ ...operacao, status: "CANCELADA", versaoComercialLeite: vinculo })), update: vi.fn(),
      create: vi.fn(async ({ data }: { data: { itens: { create: Record<string, unknown>[] } } }) => ({ id: id(10), itens: data.itens.create.map((item, i) => ({ id: id(20 + i), ...item })) })),
      findUniqueOrThrow: vi.fn(async () => ({ id: id(10), status: "CONFIRMADA", movimentosEstoque: [] })) },
    movimentoEstoque: { findFirst: vi.fn(async () => retirada), groupBy: vi.fn(async () => [{ produtoId: id(5) }]), create: vi.fn(), update: vi.fn() },
    compromissoFinanceiro: { create: vi.fn(), updateMany: vi.fn() }, transacaoFinanceira: { create: vi.fn() }, auditoriaFinanceira: { create: vi.fn(), findFirst: vi.fn(async () => null) },
  } };
}
let f: ReturnType<typeof banco>;
beforeEach(() => { f = banco(); });

describe("correção comercial preserva a retirada de leite", () => {
  it("substitui R$225 por R$250 com mesmos 100 litros e sem nova saída, caixa ou categoria herdada do produto atual", async () => {
    const resultado = await corrigirVendaLeiteTx(f.tx as unknown as Prisma.TransactionClient, input, contexto);
    expect(resultado.id).toBe(id(10));
    expect(f.tx.compromissoFinanceiro.updateMany).toHaveBeenCalledWith({ where: { operacaoId: id(1), status: { not: "CANCELADO" } }, data: { status: "CANCELADO" } });
    expect(f.tx.compromissoFinanceiro.create).toHaveBeenCalledWith({ data: expect.objectContaining({ operacaoId: id(10), tipo: "RECEBER", valorOriginal: new Prisma.Decimal(250) }) });
    expect(f.tx.operacao.update).toHaveBeenCalledWith({ where: { id: id(1) }, data: { status: "CANCELADA" } });
    expect(f.tx.movimentoEstoque.create).not.toHaveBeenCalled();
    expect(f.tx.movimentoEstoque.update).not.toHaveBeenCalled();
    expect(f.tx.transacaoFinanceira.create).not.toHaveBeenCalled();
    expect(f.tx.operacao.create.mock.calls[0][0].data.itens.create[0]).toMatchObject({ quantidade: new Prisma.Decimal(100), produtoId: id(5), categoriaId: null });
    expect(f.tx.versaoComercialVendaLeite.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ operacaoId: id(10), retiradaId: id(4), versao: 2, motivo: input.motivo }) }));
  });

  it("corrige preço de produto histórico inativo e preserva categoria/centro históricos sem reativar cadastros", async () => {
    f.operacao.itens[0].categoriaId = id(70); f.operacao.itens[0].categoriaNome = "Categoria histórica";
    f.operacao.itens[0].centroCustoId = id(71); f.operacao.itens[0].centroCustoNome = "Centro histórico";
    f.tx.produto.findMany.mockResolvedValueOnce([{ id: id(5), ativo: false, unidade: "L", rastrearPartidas: false, categoriaId: id(90), centrosCusto: [] }]);
    f.tx.centroCusto.findMany.mockResolvedValueOnce([{ id: id(71), nome: "Centro atual inativo" }]);
    await corrigirVendaLeiteTx(f.tx as unknown as Prisma.TransactionClient, input, contexto);
    expect(f.tx.produto.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [id(5)] } } }));
    expect(f.tx.categoria.findFirst).not.toHaveBeenCalled();
    expect(f.tx.operacao.create.mock.calls[0][0].data.itens.create[0]).toMatchObject({ quantidade: new Prisma.Decimal(100), categoriaId: id(70), categoriaNome: "Categoria histórica", centroCustoId: id(71), centroCustoNome: "Centro histórico" });
    expect(f.tx.centroCusto.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [id(71)] }, OR: [{ ativo: true }, { id: { in: [id(71)] } }] } }));
    expect(f.tx.movimentoEstoque.create).not.toHaveBeenCalled();
  });

  it("categoria e centro novos continuam exigindo cadastro ativo", async () => {
    await expect(corrigirVendaLeiteTx(f.tx as unknown as Prisma.TransactionClient, { ...input, categoriaId: id(75) }, contexto)).rejects.toMatchObject({ code: "VALIDACAO", campo: "categoriaId" });
    await expect(corrigirVendaLeiteTx(f.tx as unknown as Prisma.TransactionClient, { ...input, centroCustoId: id(76) }, contexto)).rejects.toMatchObject({ code: "VALIDACAO", campo: "centroCustoId" });
    expect(f.tx.operacao.create).not.toHaveBeenCalled();
    expect(f.tx.movimentoEstoque.create).not.toHaveBeenCalled();
  });

  it("liquidação confirmada bloqueia mesmo sem recebimento listado na operação", async () => {
    f.operacao.compromissos.push({ liquidacoes: [{ transacao: { status: "CONFIRMADA" } }] });
    await expect(corrigirVendaLeiteTx(f.tx as unknown as Prisma.TransactionClient, input, contexto)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(f.tx.operacao.update).not.toHaveBeenCalled();
    expect(f.tx.operacao.create).not.toHaveBeenCalled();
  });

  it("alocação documental ativa bloqueia correção antes de cancelar compromissos", async () => {
    f.tx.alocacaoDemonstrativoLeite.findFirst.mockResolvedValueOnce({ id: id(99) } as never);
    await expect(corrigirVendaLeiteTx(f.tx as unknown as Prisma.TransactionClient, input, contexto)).rejects.toThrow(/demonstrativos ativos/);
    expect(f.tx.operacao.update).not.toHaveBeenCalled();
    expect(f.tx.compromissoFinanceiro.updateMany).not.toHaveBeenCalled();
  });

  it("recebimento confirmado exige estorno financeiro explícito e bloqueia antes de escrever", async () => {
    f.operacao.transacoes.push({ tipo: "RECEBIMENTO", status: "CONFIRMADA" });
    await expect(corrigirVendaLeiteTx(f.tx as unknown as Prisma.TransactionClient, input, contexto)).rejects.toThrow(/estorno financeiro/);
    expect(f.tx.operacao.update).not.toHaveBeenCalled();
    expect(f.tx.operacao.create).not.toHaveBeenCalled();
    expect(f.tx.transacaoFinanceira.create).not.toHaveBeenCalled();
  });

  it("recebimento já estornado não provoca novo estorno de dinheiro ao corrigir", async () => {
    f.operacao.transacoes.push({ tipo: "RECEBIMENTO", status: "REVERTIDA" }, { tipo: "REVERSAO", status: "CONFIRMADA" });
    await corrigirVendaLeiteTx(f.tx as unknown as Prisma.TransactionClient, input, contexto);
    expect(f.tx.operacao.create).toHaveBeenCalledTimes(1);
    expect(f.tx.transacaoFinanceira.create).not.toHaveBeenCalled();
  });

  it("versão vencida ou período fechado bloqueiam a alteração inteira", async () => {
    f.vinculo.versao = 2;
    await expect(corrigirVendaLeiteTx(f.tx as unknown as Prisma.TransactionClient, input, contexto)).rejects.toMatchObject({ code: "CONFLITO" });
    f.vinculo.versao = 1;
    f.tx.periodoFinanceiro.findUnique.mockResolvedValueOnce({ status: "FECHADO" });
    await expect(corrigirVendaLeiteTx(f.tx as unknown as Prisma.TransactionClient, input, contexto)).rejects.toMatchObject({ code: "PERIODO_FECHADO" });
    expect(f.tx.operacao.update).not.toHaveBeenCalled();
    expect(f.tx.operacao.create).not.toHaveBeenCalled();
  });

  it("reenvio idêntico conserva a substituta e chave divergente não duplica efeitos", async () => {
    await corrigirVendaLeiteTx(f.tx as unknown as Prisma.TransactionClient, input, contexto);
    const gravado = f.tx.versaoComercialVendaLeite.create.mock.calls[0][0].data;
    f.tx.versaoComercialVendaLeite.findUnique.mockResolvedValue({ ...gravado, criadoPorId: 9 } as never);
    expect((await corrigirVendaLeiteTx(f.tx as unknown as Prisma.TransactionClient, input, contexto)).id).toBe(id(10));
    await expect(corrigirVendaLeiteTx(f.tx as unknown as Prisma.TransactionClient, { ...input, valorTotal: 300 }, contexto)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(f.tx.operacao.create).toHaveBeenCalledTimes(1);
    expect(f.tx.compromissoFinanceiro.create).toHaveBeenCalledTimes(1);
  });
});
