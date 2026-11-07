import { beforeEach, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
const m = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn() }));
vi.mock("../../../db.js", () => ({ prisma: { $transaction: m.transaction } }));
import { etapasDoDiaSchema, listarEtapasDoDia } from "./etapas-do-dia.js";
beforeEach(() => {
  vi.resetAllMocks();
  m.transaction.mockImplementation((fn) => fn({ $queryRaw: m.query }));
});
const etapa = {
  contextoId: "programacao",
  modo: "COLETIVO",
  nome: "Programação",
  modelo: "Modelo",
  etapaId: "etapa",
  etapa: "D0",
  totalAnimais: 6n,
  atendidos: 4n,
  pendentes: 2n,
  encerrados: 0n,
};
it("preserva o universo de seis animais antes e depois do último atendimento", async () => {
  m.query.mockResolvedValueOnce([{ total: 1n }]).mockResolvedValueOnce([etapa]);
  const parcial = await listarEtapasDoDia(7, { data: "2026-11-07" });
  expect(parcial.itens).toEqual([
    { ...etapa, totalAnimais: 6, atendidos: 4, pendentes: 2, encerrados: 0 },
  ]);
  m.query
    .mockResolvedValueOnce([{ total: 1n }])
    .mockResolvedValueOnce([{ ...etapa, atendidos: 6n, pendentes: 0n }]);
  expect(await listarEtapasDoDia(7, { data: "2026-11-07" })).toMatchObject({
    total: 1,
    itens: [{ totalAnimais: 6, atendidos: 6, pendentes: 0 }],
  });
  const sql: Prisma.Sql = m.query.mock.calls[0][0];
  expect(sql.text).toContain("FROM universo GROUP BY");
  expect(sql.text).toContain('count(DISTINCT "animalId")');
  expect(sql.text).not.toMatch(/WHERE\s+.*realizadaEm.*IS NULL/);
  expect(sql.text).not.toMatch(/pg\.status\s*=/);
  expect(sql.text).toContain("America/Sao_Paulo");
  expect(sql.text).toContain('"previsaoPendente"');
  expect(sql.values).toContain(7);
  expect(sql.values).toContain("2026-11-07");
  expect(m.transaction).toHaveBeenCalledWith(expect.any(Function), {
    isolationLevel: "RepeatableRead",
  });
});
it("pagina as etapas completas e recupera a última página válida, sem carregar fatos/custos", async () => {
  m.query
    .mockResolvedValueOnce([{ total: 11n }])
    .mockResolvedValueOnce([etapa]);
  const r = await listarEtapasDoDia(7, { data: "2026-11-07", pagina: 99 });
  expect(r).toMatchObject({ total: 11, pagina: 2, porPagina: 10 });
  const sql: Prisma.Sql = m.query.mock.calls[1][0];
  expect(sql.text).toMatch(/ORDER BY nome,"contextoId",ordem,"etapaId"/);
  expect(sql.values.slice(-2)).toEqual([10, 10]);
  expect(JSON.stringify(r)).not.toMatch(/custo|valor|parametros/);
  expect(
    etapasDoDiaSchema.safeParse({ data: "2026-11-07", porPagina: 11 }).success,
  ).toBe(false);
  expect(etapasDoDiaSchema.safeParse({ data: "não é data" }).success).toBe(
    false,
  );
});
