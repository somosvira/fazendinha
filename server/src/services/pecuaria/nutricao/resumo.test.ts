import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { apresentarResumoCusto, consultarResumo } from "./resumo.js";
vi.mock("../../../db.js", () => ({ prisma: { $transaction: vi.fn(), $queryRaw: vi.fn(), lote: { findMany: vi.fn() }, vigenciaDietaLote: { findMany: vi.fn() } } }));
const agregado = { loteId: "lote", fechamentos: 2n, animalDias: 4n, custoConhecido: new Prisma.Decimal("3.33"), coberturaCustoCompleta: false };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(async fn => (fn as unknown as (tx: typeof prisma) => Promise<unknown>)(prisma));
  vi.mocked(prisma.lote.findMany).mockResolvedValue([{ id: "lote" }] as Awaited<ReturnType<typeof prisma.lote.findMany>>);
  vi.mocked(prisma.vigenciaDietaLote.findMany).mockResolvedValue([]);
  vi.mocked(prisma.$queryRaw).mockResolvedValue([agregado]);
});
describe("resumo nutricional autorizado", () => {
  it("conserva zero sem histórico, custo desconhecido, cobertura parcial e média arredondada", () => {
    expect(apresentarResumoCusto(undefined, true)).toMatchObject({ custoConhecido: "0.00", custoPorAnimalDia: null, coberturaCustoCompleta: true });
    expect(apresentarResumoCusto({ ...agregado, custoConhecido: null }, true).custoConhecido).toBeNull();
    expect(apresentarResumoCusto(agregado, true)).toMatchObject({ custoConhecido: "3.33", custoPorAnimalDia: "0.83", coberturaCustoCompleta: false });
    expect(apresentarResumoCusto(agregado, false)).toMatchObject({ custoConhecido: null, custoPorAnimalDia: null });
  });
  it("consulta somente lotes autorizados e agrega no SQL sem devolver histórico ou valores mascarados", async () => {
    const r = await consultarResumo(undefined, 7, false);
    expect(prisma.lote.findMany).toHaveBeenCalledWith({ where: { ativo: true, propriedadeId: 7 }, select: { id: true } });
    const sql = vi.mocked(prisma.$queryRaw).mock.calls[0][0] as Prisma.Sql;
    expect(sql.values).toEqual(["lote", 7]);
    expect(sql.sql).toContain('f."propriedadeId" = ?');
    expect(sql.sql).toContain("f.status = 'CONFIRMADO'");
    expect(sql.sql).toContain('ROUND(SUM(');
    expect(r.lotes[0].custos.custoConhecido).toBeNull();
    expect(r.lotes[0]).not.toHaveProperty("participacoes");
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
  });
  it("recusa lote fora do escopo e não consulta agregados quando não há lotes", async () => {
    vi.mocked(prisma.lote.findMany).mockResolvedValue([]);
    await expect(consultarResumo("externo", 7, true)).rejects.toThrow("neste sítio");
    expect(await consultarResumo(undefined, 7, true)).toEqual({ lotes: [], verValores: true });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
