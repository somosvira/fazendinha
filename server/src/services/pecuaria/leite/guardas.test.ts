import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { conferirLactacaoComProducaoTx } from "./guardas.js";
const findMany = vi.fn(), lactacoes = vi.fn(), gerais = vi.fn();
const tx = { $queryRaw: gerais, participanteProducaoLeite: { findMany }, lactacaoAnimal: { findMany: lactacoes } } as unknown as Prisma.TransactionClient;
const dia = (data: string) => new Date(`${data}T00:00:00Z`);
beforeEach(() => { gerais.mockResolvedValue([]); findMany.mockResolvedValue([]); lactacoes.mockResolvedValue([]); });
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

describe("lactação identificada na produção geral", () => {
  const origem = (data: string, evidencia?: { lactacaoId: string | null }) => ({
    animalId: "animal", propriedadeId: 1, data: dia(data), entradaId: evidencia ? "entrada" : null,
    evidencia: evidencia ? { animalId: "animal", finalidadeId: "leite", localizacaoId: "local", ...evidencia } : null,
  });
  it("recusa secagem retroativa sobre origem geral sem medições individuais", async () => {
    gerais.mockResolvedValue([origem("2026-10-20")]);
    lactacoes.mockResolvedValue([{ id: "lactacao", inicio: dia("2026-01-01"), encerradaEm: null }]);
    await expect(conferirLactacaoComProducaoTx(tx, "animal", "lactacao", dia("2026-01-01"), dia("2026-10-19"))).rejects.toMatchObject({ code: "CONFLITO", campo: "encerradaEm" });
  });
  it("recusa deslocar o início que comprovava a origem e preserva vínculo confirmado", async () => {
    gerais.mockResolvedValue([origem("2026-10-20", { lactacaoId: "lactacao" })]);
    lactacoes.mockResolvedValue([{ id: "lactacao", inicio: dia("2026-01-01"), encerradaEm: null }]);
    await expect(conferirLactacaoComProducaoTx(tx, "animal", "lactacao", dia("2026-10-21"), null)).rejects.toMatchObject({ code: "CONFLITO" });
  });
  it("permite lactação posterior comprovada e não inventa lactação para origem desconhecida", async () => {
    gerais.mockResolvedValue([origem("2026-10-20")]);
    lactacoes.mockResolvedValue([{ id: "posterior", inicio: dia("2026-09-01"), encerradaEm: null }]);
    await expect(conferirLactacaoComProducaoTx(tx, "animal", "antiga", dia("2026-01-01"), dia("2026-08-01"))).resolves.toBeUndefined();
    lactacoes.mockResolvedValue([]);
    await expect(conferirLactacaoComProducaoTx(tx, "animal", "futura", dia("2026-10-21"), null)).resolves.toBeUndefined();
  });
});
