import { expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
vi.mock("../propriedade.js", () => ({ propriedadePrincipalId: vi.fn().mockResolvedValue(1) }));
import { coberturaSaldoTx } from "./valorizacao.js";
const D = (v: string) => new Prisma.Decimal(v);
const movimento = (partidaId: string, qtd: string) => ({ tipo: "ENTRADA", quantidade: D(qtd), alocacaoPartidaEstoques: [{ partidaId, quantidade: D(qtd), partida: { lotePrincipalId: null } }] });
it("confere os grupos, inclusive quando os totais físico e valorizado coincidem", async () => {
  const tx = { produto: { findUniqueOrThrow: vi.fn().mockResolvedValue({ rastrearPartidas: true }) },
    movimentoEstoque: { findMany: vi.fn().mockResolvedValue([movimento("a", "1"), movimento("b", "2")]) },
    baseValorizacaoEstoque: { findMany: vi.fn().mockResolvedValue([{ partidaId: "a", quantidadeAbertura: D("2"), valorAbertura: D("4"), parcelas: [] }, { partidaId: "b", quantidadeAbertura: D("1"), valorAbertura: D("3"), parcelas: [] }]) },
  } as unknown as Prisma.TransactionClient;
  expect(await coberturaSaldoTx(tx, "produto", 1, new Date("2026-01-01"))).toMatchObject({ fisico: D("3"), quantidade: D("3"), completa: false });
});
