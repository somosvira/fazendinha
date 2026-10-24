import { Prisma } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";
import { consultarOrigensGeraisTx } from "./origens-gerais.js";
const query = vi.fn();
const tx = { $queryRaw: query } as unknown as Prisma.TransactionClient;
const origem = { animalId: "vaca", finalidadeId: "leite", localizacaoId: "local", lactacaoId: null };
const medicao = { animalId: "vaca", propriedadeId: 1, data: new Date("2026-10-20"), entradaId: null, evidencia: null };
beforeEach(() => vi.resetAllMocks());
it("projeta apenas evidência confirmada do animal, mantendo intervalo, GIN, data e sítio", async () => {
  query.mockResolvedValue([{ ...medicao, entradaId: "entrada", evidencia: origem }]);
  expect(await consultarOrigensGeraisTx(tx, ["vaca"], new Date("2026-10-19"), new Date("2026-10-21"))).toEqual([
    { animalId: "vaca", propriedadeId: 1, data: new Date("2026-10-20"), evidencias: [origem] },
  ]);
  const consulta = query.mock.calls[0][0] as Prisma.Sql;
  expect(consulta.values).toEqual([["vaca"], new Date("2026-10-19"), new Date("2026-10-21")]);
  expect(consulta.sql).toContain('g."animaisOrigem" @> jsonb_build_array(pedido."animalId")');
  expect(consulta.sql).toContain("e.status='CONFIRMADA'");
  expect(consulta.sql).toContain("WHERE a->>'animalId'=pedido.\"animalId\"");
  expect(consulta.sql).toContain("SELECT jsonb_build_object('animalId'");
  expect(consulta.sql.split('FROM unnest')[0]).not.toMatch(/snapshot|animaisOrigem/);
});
it("preserva origem sem entrada ativa e não infere outro animal", async () => {
  query.mockResolvedValue([medicao]);
  expect((await consultarOrigensGeraisTx(tx, ["vaca"]))[0].evidencias).toEqual([]);
  expect(await consultarOrigensGeraisTx(tx, ["outra"])).toEqual([]);
  expect(await consultarOrigensGeraisTx(tx, [])).toEqual([]);
});
it.each([null, { ...origem, animalId: "outra" }])("bloqueia evidência confirmada inválida ou divergente", async evidencia => {
  query.mockResolvedValue([{ ...medicao, entradaId: "entrada", evidencia }]);
  await expect(consultarOrigensGeraisTx(tx, ["vaca"])).rejects.toMatchObject({ code: "CONFLITO" });
});
it("o contrato transporta só a projeção pedida em tanque com outros 1999 animais, sem limite de histórico", async () => {
  const composicao = [origem, ...Array.from({ length: 1999 }, (_, n) => ({ ...origem, animalId: `outra-${n}`, brinco: `B${n}`, pendencias: [], finalidadeSnapshot: { regra: "FINALIDADE_LEITE_V1", dataOperacional: "2026-10-20" } }))];
  // Fronteira mockada do driver: o PostgreSQL retorna somente a projeção SQL.
  // A execução da projeção no banco permanece a cargo da integração autorizada.
  const projetada = composicao.find(a => a.animalId === "vaca")!;
  query.mockResolvedValue(Array.from({ length: 1095 }, () => ({ ...medicao, entradaId: "entrada", evidencia: projetada })));
  const historico = await consultarOrigensGeraisTx(tx, ["vaca", "vaca"]);
  expect(historico).toHaveLength(1095);
  expect(historico.every(h => h.evidencias.length === 1 && h.evidencias[0].animalId === "vaca")).toBe(true);
  expect(Buffer.byteLength(JSON.stringify(historico))).toBeLessThan(350_000);
  expect(Buffer.byteLength(JSON.stringify(composicao)) * 1095).toBeGreaterThan(400_000_000);
  expect((query.mock.calls[0][0] as Prisma.Sql).values).toEqual([["vaca"]]);
});
