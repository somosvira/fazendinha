import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { conferirLactacaoComProducaoTx } from "./guardas.js";
const findMany = vi.fn(), lactacoes = vi.fn();
const tx = { participanteProducaoLeite: { findMany }, lactacaoAnimal: { findMany: lactacoes } } as unknown as Prisma.TransactionClient;
const dia = (data: string) => new Date(`${data}T00:00:00Z`);
beforeEach(() => { findMany.mockResolvedValue([]); lactacoes.mockResolvedValue([]); });
describe("lactação com produção medida", () => {
  it("recusa fim no mesmo dia de uma medição preservada e não apaga a origem", async () => {
    findMany.mockResolvedValue([{ lactacaoId: "lactacao", dia: { dataOperacional: dia("2026-10-01") } }]);
    await expect(conferirLactacaoComProducaoTx(tx, "animal", "lactacao", dia("2026-01-01"), dia("2026-10-01"))).rejects.toMatchObject({ code: "CONFLITO", campo: "encerradaEm" });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      animalId: "animal", excluidoEm: null, medicoes: { some: { estado: "MEDIDO" } },
      OR: expect.arrayContaining([{ lactacaoId: "lactacao", dia: { OR: [{ dataOperacional: { lt: dia("2026-01-01") } }, { dataOperacional: { gte: dia("2026-10-01") } }] } }]),
    }) }));
  });
  it("permite intervalo que conserva as medições e reabertura sem fim", async () => {
    await expect(conferirLactacaoComProducaoTx(tx, "animal", "lactacao", dia("2026-01-01"), null)).resolves.toBeUndefined();
    expect(findMany.mock.lastCall?.[0].where.OR).toHaveLength(1);
  });
  it("não confunde produção de lactação posterior com a lactação encerrada", async () => {
    findMany.mockResolvedValue([{ lactacaoId: null, dia: { dataOperacional: dia("2026-10-01") } }]);
    lactacoes.mockResolvedValue([{ inicio: dia("2026-09-01"), encerradaEm: null }]);
    await expect(conferirLactacaoComProducaoTx(tx, "animal", "lactacao", dia("2026-01-01"), dia("2026-08-01"))).resolves.toBeUndefined();
    lactacoes.mockResolvedValue([]);
    await expect(conferirLactacaoComProducaoTx(tx, "animal", "lactacao", dia("2026-01-01"), dia("2026-08-01"))).rejects.toMatchObject({ code: "CONFLITO" });
  });
});
