import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { apresentarResumoCusto, apresentarResumoReferenciaLeite, consultarResumo } from "./resumo.js";
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


describe("compatibilidade do resumo da main com o leite V5", () => {
  const referencia = { loteId: "lote", litros: new Prisma.Decimal("60"), valor: new Prisma.Decimal("150"), fornecimentos: 2n, conhecidos: 1n, provisorios: 1n };
  it("preserva referência parcial e provisória sem somá-la ao custo produtivo", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ ...agregado, custoConhecido: new Prisma.Decimal("84") }]).mockResolvedValueOnce([referencia]);
    const r = await consultarResumo(undefined, 7, true, true);
    expect(r.lotes[0].custos.custoConhecido).toBe("84.00");
    expect(r.lotes[0].referenciaLeite).toEqual({ quantidadeLitros: "60.000", valorConhecido: "150.00", coberturaCompleta: false, pendentes: 1, provisorios: 1 });
    const sql = vi.mocked(prisma.$queryRaw).mock.calls[1][0] as Prisma.Sql;
    expect(sql.values).toEqual(["lote", 7]);
    expect(sql.sql).toContain("fl.status = 'CONFIRMADO'");
    expect(sql.sql).toContain('ORDER BY versao DESC LIMIT 1');
    expect(sql.sql).toContain('fl."propriedadeId" = f."propriedadeId"');
  });
  it("não consulta nem entrega referências comerciais para leitor sem essa permissão", async () => {
    const r = await consultarResumo(undefined, 7, true, false);
    expect(r.lotes[0].custos.custoConhecido).toBe("3.33");
    expect(r.lotes[0].referenciaLeite).toBeNull();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(apresentarResumoReferenciaLeite(referencia, false)).toBeNull();
    expect(apresentarResumoReferenciaLeite({ ...referencia, valor: null, conhecidos: 0n }, true)).toMatchObject({ valorConhecido: null, pendentes: 2, coberturaCompleta: false });
  });
  it("usa apuração vigente das origens leiteiras e conserva custo pendente na agregação", async () => {
    await consultarResumo(undefined, 7, true);
    const sql = (vi.mocked(prisma.$queryRaw).mock.calls[0][0] as Prisma.Sql).sql;
    expect(sql).toContain('WHEN c."fornecimentoId" IS NOT NULL THEN leite.custo');
    expect(sql).toContain('ORDER BY al.versao DESC LIMIT 1');
    expect(sql).toContain('COALESCE(ap.valor, a."valorTotal")');
    expect(sql).toContain('BOOL_AND(mov.custo IS NOT NULL)');
    expect(sql).not.toContain('ReferenciaGerencialLeite');
  });
});
