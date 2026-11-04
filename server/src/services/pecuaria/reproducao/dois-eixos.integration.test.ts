import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { exigirBancoIntegracaoPecuaria } from "../../../lib/banco-pecuaria-integration.fixture.js";
import { registrarToqueAptidaoTx } from "./toque-aptidao.js";
import { criarAvaliacaoTx } from "./registros.js";
import { conferirAptidaoParaAcaoTx, obterElegibilidadesNaDataTx } from "./elegibilidade.js";
const suite = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
suite("dois eixos no PostgreSQL", () => {
  it("novilha usa uma aptidão geral e tratamento exige novo exame, que pode conter DG", async () => {
    exigirBancoIntegracaoPecuaria();
    const rollback = new Error("ROLLBACK_DOIS_EIXOS");
    try { await prisma.$transaction(async tx => {
      const sitio = await tx.propriedade.create({ data: { nome: `Dois eixos ${crypto.randomUUID()}` } });
      const animal = await tx.animal.create({ data: { brinco: `EIXOS-${crypto.randomUUID()}`, sexo: "F", origem: "COMPRADO", dataNascimento: dia("2025-01-01"), dataEntrada: dia("2026-01-01"), localizacoes: { create: { propriedadeId: sitio.id, desde: dia("2026-01-01") } } } });
      const base = { animalId: animal.id, propriedadeId: sitio.id, responsavel: "Veterinária do teste" };
      const consultar = async (data: string) => (await obterElegibilidadesNaDataTx(tx, [animal.id], sitio.id, dia(data))).get(animal.id)!;
      expect((await consultar("2026-10-01")).aptidao.estado).toBe("PENDENTE");
      await registrarToqueAptidaoTx(tx, { ...base, data: "2026-10-01", resultado: "APTO" }, null);
      expect(await consultar("2026-10-01")).toMatchObject({ situacaoReprodutiva: "DESCONHECIDA", aptidao: { estado: "APTA" } });
      for (const acao of ["PROTOCOLO", "IA", "TE", "COBERTURA"] as const) await conferirAptidaoParaAcaoTx(tx, animal.id, sitio.id, dia("2026-10-01"), acao);
      const restricao = await tx.restricaoReprodutiva.create({ data: { animalId: animal.id, propriedadeId: sitio.id, data: dia("2026-10-05"), tipo: "TEMPORARIA", acoes: ["IA", "TE", "COBERTURA", "IATF"], motivo: "Tratamento fictício em curso" } });
      expect((await consultar("2026-10-06")).aptidao.estado).toBe("NAO_APTA");
      await tx.restricaoReprodutiva.update({ where: { id: restricao.id }, data: { ate: dia("2026-10-10") } });
      expect((await consultar("2026-10-11")).aptidao.estado).toBe("PENDENTE");
      const avaliacao = await criarAvaliacaoTx(tx, { ...base, chave: crypto.randomUUID(), data: "2026-10-11", resultado: "NEGATIVO", resultadoAptidao: "APTO", decisaoIatf: "NAO_INDICAR" }, null);
      const interpretacao = await tx.interpretacaoReprodutiva.findUniqueOrThrow({ where: { id: avaliacao.id }, include: { exame: true } });
      expect(interpretacao).toMatchObject({ resultadoAptidao: "APTO", decisaoIatf: "NAO_INDICAR", exame: { finalidades: expect.arrayContaining(["DIAGNOSTICO", "APTIDAO_REPRODUTIVA"]) } });
      expect(await consultar("2026-10-11")).toMatchObject({ situacaoReprodutiva: "VAZIA", aptidao: { estado: "APTA" } });
      expect(await tx.decisaoElegibilidadeCiclo.count({ where: { vinculoCiclo: { animalId: animal.id } } })).toBe(0);
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      throw rollback;
    }, { timeout: 60000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
    catch (e) { if (e !== rollback) throw e; }
  }, 70000);
});
