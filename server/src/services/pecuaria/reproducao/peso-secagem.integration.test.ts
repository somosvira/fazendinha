import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { revogarPesoSecagemTx, vincularPesoSecagemTx } from "./peso-secagem.js";

// Cada caso possui somente fixtures privadas e sempre reverte a transação,
// inclusive quando passa. Nunca executa seed, limpeza global ou DELETE de histórico.
const comBanco = describe.runIf(process.env.PECUARIA_DB_INTEGRATION === "1");
const rollback = new Error("ROLLBACK_FIXTURES_PESO_SECAGEM");
async function fixture(tx: Prisma.TransactionClient) {
  const token = randomUUID();
  const autor = await tx.usuario.create({ data: { nome: `Secagem ${token}`, email: `secagem-${token}@example.test`, papel: "DONO", status: "ATIVO" } });
  const sitio = await tx.propriedade.create({ data: { nome: `Secagem ${token}` } });
  const animal = await tx.animal.create({ data: { brinco: token, sexo: "F", dataNascimento: new Date("2020-01-01"), dataEntrada: new Date("2024-01-01"), origem: "COMPRADO" } });
  const local = await tx.localizacaoAnimal.create({ data: { animalId: animal.id, propriedadeId: sitio.id, desde: new Date("2024-01-01") } });
  const lactacao = await tx.lactacaoAnimal.create({ data: { animalId: animal.id, propriedadeId: sitio.id, inicio: new Date("2024-01-01"), encerradaEm: new Date("2024-10-20"), motivoEncerramento: "Secagem comprovada", criadoPorId: autor.id } });
  // Legado conserva precisão/localização não informadas; a prova vem da localização.
  const peso = await tx.pesagem.create({ data: { animalId: animal.id, data: new Date("2024-10-20"), pesoKg: 500, tipo: "ROTINA", origem: "MANUAL", criadoPorId: autor.id } });
  const vincular = () => vincularPesoSecagemTx(tx, { lactacaoId: lactacao.id, pesagemId: peso.id, propriedadeId: sitio.id }, autor.id);
  return { autor, sitio, animal, local, lactacao, peso, vincular };
}
async function comRollback(fn: (tx: Prisma.TransactionClient) => Promise<void>) {
  try {
    await prisma.$transaction(async tx => {
      await fn(tx);
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      throw rollback;
    }, { timeout: 30000 });
  } catch (erro) { if (erro !== rollback) throw erro; }
}

comBanco("peso na secagem — invariantes PostgreSQL com rollback próprio", () => {
  it("reutiliza legado uma vez e reabertura revoga sem apagar o peso", async () => {
    await comRollback(async tx => {
      const f = await fixture(tx), primeiro = await f.vincular();
      expect((await f.vincular()).id).toBe(primeiro.id);
      expect(await tx.pesagem.count({ where: { animalId: f.animal.id } })).toBe(1);
      expect(await tx.auditoriaPecuaria.count({ where: { entidade: "VinculoPesagemSecagem", entidadeId: primeiro.id } })).toBe(1);
      expect(await tx.pesagem.findUniqueOrThrow({ where: { id: f.peso.id } })).toMatchObject({ tipo: "ROTINA", precisao: "NAO_INFORMADO", propriedadeId: null, contextoHistorico: "NAO_INFORMADO" });
      await revogarPesoSecagemTx(tx, f.lactacao, primeiro.id, f.sitio.id, "Reabertura documentada da lactação", f.autor.id);
      await tx.lactacaoAnimal.update({ where: { id: f.lactacao.id }, data: { encerradaEm: null, motivoEncerramento: null } });
      expect(await tx.pesagem.findUnique({ where: { id: f.peso.id } })).not.toBeNull();
      expect((await tx.vinculoPesagemSecagem.findUniqueOrThrow({ where: { id: primeiro.id } })).revogadoEm).not.toBeNull();
    });
  }, 35000);

  it("permite corrigir data e revalidar na mesma transação, preservando ambos vínculos", async () => {
    await comRollback(async tx => {
      const f = await fixture(tx), anterior = await f.vincular();
      await revogarPesoSecagemTx(tx, f.lactacao, anterior.id, f.sitio.id, "Data de encerramento corrigida por documento", f.autor.id);
      await tx.lactacaoAnimal.update({ where: { id: f.lactacao.id }, data: { encerradaEm: new Date("2024-10-21") } });
      await tx.pesagem.update({ where: { id: f.peso.id }, data: { data: new Date("2024-10-21") } });
      const atual = await f.vincular();
      expect(atual.id).not.toBe(anterior.id);
      expect(atual.pesagemId).toBe(f.peso.id);
      expect(await tx.vinculoPesagemSecagem.count({ where: { lactacaoId: f.lactacao.id } })).toBe(2);
      expect(await tx.vinculoPesagemSecagem.count({ where: { lactacaoId: f.lactacao.id, revogadoEm: null } })).toBe(1);
    });
  }, 35000);

  it.each(["peso", "reabertura", "localizacao"] as const)("SQL rejeita alteração incompatível de %s por caminho externo", async caso => {
    await expect(comRollback(async tx => {
      const f = await fixture(tx); await f.vincular();
      if (caso === "peso") await tx.pesagem.update({ where: { id: f.peso.id }, data: { data: new Date("2024-10-21") } });
      if (caso === "reabertura") await tx.lactacaoAnimal.update({ where: { id: f.lactacao.id }, data: { encerradaEm: null } });
      if (caso === "localizacao") await tx.localizacaoAnimal.update({ where: { id: f.local.id }, data: { ate: new Date("2024-10-19") } });
    })).rejects.toThrow(/Vínculo de secagem exige/);
  }, 35000);

  it("SQL impede dois pesos ativos na mesma lactação", async () => {
    await expect(comRollback(async tx => {
      const f = await fixture(tx), v = await f.vincular();
      const outro = await tx.pesagem.create({ data: { animalId: f.animal.id, data: f.peso.data, pesoKg: 501, tipo: "ROTINA" } });
      await tx.vinculoPesagemSecagem.create({ data: { lactacaoId: f.lactacao.id, pesagemId: outro.id, propriedadeId: f.sitio.id, evidenciaSnapshot: v.evidenciaSnapshot as Prisma.InputJsonValue, criadoPorId: f.autor.id } });
    })).rejects.toMatchObject({ code: "P2002" });
  }, 35000);

  it("SQL impede o mesmo peso ativo em duas lactações", async () => {
    await expect(comRollback(async tx => {
      const f = await fixture(tx), v = await f.vincular();
      const outra = await tx.lactacaoAnimal.create({ data: { animalId: f.animal.id, propriedadeId: f.sitio.id, inicio: f.peso.data, encerradaEm: f.peso.data, motivoEncerramento: "Encerramento documentado" } });
      await tx.vinculoPesagemSecagem.create({ data: { lactacaoId: outra.id, pesagemId: f.peso.id, propriedadeId: f.sitio.id, evidenciaSnapshot: v.evidenciaSnapshot as Prisma.InputJsonValue, criadoPorId: f.autor.id } });
    })).rejects.toMatchObject({ code: "P2002" });
  }, 35000);

  it.each(["vinculo", "pesagem"] as const)("SQL impede exclusão física de %s associado", async caso => {
    await expect(comRollback(async tx => {
      const f = await fixture(tx), v = await f.vincular();
      if (caso === "vinculo") await tx.vinculoPesagemSecagem.delete({ where: { id: v.id } });
      else await tx.pesagem.delete({ where: { id: f.peso.id } });
    })).rejects.toThrow(caso === "vinculo" ? /preserva histórico/ : /Foreign key constraint|foreign key constraint/);
  }, 35000);

  it("SQL exige autoria mesmo quando inserção contorna o serviço", async () => {
    await expect(comRollback(async tx => {
      const f = await fixture(tx);
      await tx.$executeRaw`INSERT INTO pecuaria."VinculoPesagemSecagem" (id,"lactacaoId","pesagemId","propriedadeId","evidenciaSnapshot","criadoPorId") VALUES (${randomUUID()},${f.lactacao.id},${f.peso.id},${f.sitio.id},'{}'::jsonb,NULL)`;
    })).rejects.toThrow(/null value|not-null constraint/);
  }, 35000);
});
