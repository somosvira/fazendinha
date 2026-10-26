import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { criarVendaLeiteTx } from "./operacoes.js";
import { operacaoSchema } from "./schemas.js";
import { planejarBaixaLeite } from "../estoque/leite.calc.js";

vi.mock("../../db.js", () => ({ prisma: {} }));
vi.mock("../propriedade.js", () => ({ propriedadePrincipalId: vi.fn(async () => 7) }));

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("VENDA conhecida com custo do leite pendente", () => {
  it("gera uma saída de 100 L e um recebível de R$225 sem dinheiro ou custo fictício", async () => {
    const produtoId = id(1);
    const tx = {
      $executeRaw: vi.fn(),
      periodoFinanceiro: { findUnique: vi.fn(async () => null) },
      parceiro: { findFirst: vi.fn(async () => ({ id: id(2), tipo: "CLIENTE", papeis: [] })) },
      produto: { findMany: vi.fn(async () => [{ id: produtoId, unidade: "L", ativo: true, rastrearPartidas: false, categoriaId: null, centrosCusto: [] }]) },
      centroCusto: { findMany: vi.fn(async () => []) },
      movimentoEstoque: { groupBy: vi.fn(async () => [{ produtoId }]), create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: id(3), ...data })) },
      operacao: { create: vi.fn(async ({ data }: { data: { itens: { create: Record<string, unknown>[] } } }) => ({ id: id(4), itens: data.itens.create.map((item, i) => ({ id: id(10 + i), ...item })) })),
        findUniqueOrThrow: vi.fn(async () => ({ id: id(4), status: "CONFIRMADA", movimentosEstoque: [{ id: id(3), tipo: "SAIDA", metodoValorizacao: "LEITE_FIFO_V1", reversaoDeId: null }] })) },
      versaoComercialVendaLeite: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: id(30), ...data })) },
      alocacaoLeiteEstoque: { createMany: vi.fn() }, compromissoFinanceiro: { create: vi.fn() },
      transacaoFinanceira: { create: vi.fn() }, auditoriaFinanceira: { create: vi.fn(), findFirst: vi.fn(async () => null) },
    };
    const input = { ...operacaoSchema.parse({ chave: id(12), tipo: "VENDA", data: "2026-10-19", descricao: "Coleta definitiva", parceiroId: id(2),
      itens: [{ produtoId, descricao: "Leite produzido", quantidade: 100, unidade: "L", valorTotal: 225 }],
      financeiro: { condicao: "A_PRAZO", parcelas: [{ valor: 225, dataVencimento: "2026-10-30" }] } }), propriedadeId: 7, usuarioId: 9 };
    const calculado = planejarBaixaLeite({ quantidade: 100, bases: [{ entradaId: id(5), data: "2026-10-19", ordem: 1, quantidade: 150, valor: null }] });
    const plano = { ...calculado, finalidade: "VENDA" as const, parcelas: calculado.parcelas.map(p => ({ ...p, classificacaoId: id(6) })) };
    await criarVendaLeiteTx(tx as unknown as Prisma.TransactionClient, input, plano);
    expect(tx.operacao.create).toHaveBeenCalledTimes(1);
    expect(tx.movimentoEstoque.create).toHaveBeenCalledTimes(1);
    const saida = tx.movimentoEstoque.create.mock.calls[0][0].data;
    expect(saida).toMatchObject({ tipo: "SAIDA", produtoId, propriedadeId: 7, operacaoId: id(4), itemOperacaoId: id(10), valorTotal: null, custoUnitario: null, metodoValorizacao: "LEITE_FIFO_V1" });
    expect(String(saida.quantidade)).toBe("100");
    expect(tx.compromissoFinanceiro.create).toHaveBeenCalledTimes(1);
    expect(tx.compromissoFinanceiro.create.mock.calls[0][0]).toMatchObject({ data: { tipo: "RECEBER", valorOriginal: new Prisma.Decimal(225), operacaoId: id(4) } });
    expect(tx.transacaoFinanceira.create).not.toHaveBeenCalled();
    expect(tx.alocacaoLeiteEstoque.createMany).toHaveBeenCalledWith({ data: [{ entradaId: id(5), movimentoId: id(3), quantidade: new Prisma.Decimal(100), valorTotal: null, finalidade: "VENDA", classificacaoId: id(6) }] });
    // Uma nova retirada exige produto ativo, mesmo após existir venda histórica.
    tx.produto.findMany.mockResolvedValueOnce([]);
    await expect(criarVendaLeiteTx(tx as unknown as Prisma.TransactionClient, { ...input, chave: id(13) }, plano)).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(tx.produto.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: { in: [produtoId] }, ativo: true } }));
    expect(tx.movimentoEstoque.create).toHaveBeenCalledTimes(1);

  });
});
