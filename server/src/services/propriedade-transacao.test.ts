import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { propriedadePrincipalId } from "./propriedade.js";
import { obterSaldo } from "./pecuaria/consumo.js";
vi.mock("../db.js", () => ({ prisma: { propriedade: { findFirst: vi.fn(async () => { throw new Error("Consulta fora da transação"); }) } } }));

describe("resolução do sítio principal na transação", () => {
  it.each([true, false])("enxerga cadastro transacional, principal explícita: %s", async principal => {
    const findFirst = vi.fn().mockResolvedValueOnce(principal ? { id: 7 } : null).mockResolvedValueOnce({ id: 7 });
    const tx = { propriedade: { findFirst } } as unknown as Prisma.TransactionClient;
    await expect(propriedadePrincipalId(tx)).resolves.toBe(7);
    expect(findFirst).toHaveBeenCalledTimes(principal ? 1 : 2);
  });
  it.each([7, 8])("saldo do sítio %s consulta o mesmo snapshot, incluindo legado só na principal", async propriedadeId => {
    const movimentos = vi.fn().mockResolvedValue([]), alocacoes = vi.fn().mockResolvedValue([]);
    const tx = {
      propriedade: { findFirst: vi.fn().mockResolvedValue({ id: 7 }) },
      movimentoEstoque: { findMany: movimentos },
      alocacaoPartidaEstoque: { findMany: alocacoes },
      partidaProduto: { findFirst: vi.fn().mockResolvedValue({ id: "lote", lotePrincipalId: null }), findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as Prisma.TransactionClient;
    const escopo = propriedadeId === 7 ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : { propriedadeId };
    expect((await obterSaldo(tx, "produto", propriedadeId)).toString()).toBe("0");
    expect(movimentos).toHaveBeenCalledWith({ where: expect.objectContaining(escopo) });
    expect((await obterSaldo(tx, "produto", propriedadeId, "lote")).toString()).toBe("0");
    expect(alocacoes).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ movimentoEstoque: expect.objectContaining(escopo) }) }));
  });
});
