import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { regularizarBaixaHistoricaTx, revisarClassificacaoBaixaTx } from "./baixas-historicas.js";

// Fixtures inteiramente dentro da transação: inclusive um teste que passe
// indevidamente provoca rollback, sem commit, reset ou limpeza global.
const comBanco = describe.runIf(process.env.PECUARIA_DB_INTEGRATION === "1");
const rollback = new Error("ROLLBACK_FIXTURES_BAIXA_HISTORICA");
async function fixture(tx: Prisma.TransactionClient) {
  const token = randomUUID();
  const usuario = await tx.usuario.create({ data: { nome: `Baixa histórica ${token}`, email: `bh-${token}@example.test`, papel: "DONO", status: "ATIVO" } });
  const sitio = await tx.propriedade.create({ data: { nome: `BH-${token}` } });
  const animal = await tx.animal.create({ data: { brinco: token, sexo: "F", dataNascimento: new Date("2020-01-01"), dataEntrada: new Date("2024-01-01"), origem: "COMPRADO" } });
  const local = await tx.localizacaoAnimal.create({ data: { animalId: animal.id, propriedadeId: sitio.id, desde: new Date("2024-01-01") } });
  const finalidade = await tx.finalidadeAnimal.create({ data: { animalId: animal.id, aptidao: "LEITE", desde: new Date("2024-01-01") } });
  return { usuario, sitio, animal, local, finalidade, token };
}

comBanco("baixa histórica — PostgreSQL com rollback próprio", () => {
  it("preserva identidade, fechamento e auditoria ao reclassificar e reenviar", async () => {
    try {
      await prisma.$transaction(async tx => {
        const { usuario, sitio, animal, local, finalidade, token } = await fixture(tx);
        const origem = { data: "2024-08-12", bancoOrigem: `TESTE-${token}`, chaveOrigem: "BAIXA:1", evidencia: "Documento de saída confirmado", motivo: "Tipo não determinado na origem", cienciaSanitaria: true, justificativaSanitaria: "Regularização histórica documentada" };
        const primeira = await regularizarBaixaHistoricaTx(tx, animal.id, origem, usuario.id, sitio.id);
        expect((await regularizarBaixaHistoricaTx(tx, animal.id, origem, usuario.id, sitio.id)).id).toBe(primeira.id);
        expect(await tx.baixaAnimal.count({ where: { animalId: animal.id, estornadaEm: null } })).toBe(1);
        expect((await tx.localizacaoAnimal.findUniqueOrThrow({ where: { id: local.id } })).ate).toEqual(new Date(origem.data));
        expect((await tx.finalidadeAnimal.findUniqueOrThrow({ where: { id: finalidade.id } })).ate).toEqual(new Date(origem.data));
        const revisao = { chave: randomUUID(), tipo: "VENDA" as const, evidencia: "Documento de venda comprovado", motivo: "Documento de origem localizado", cienciaSanitaria: true, justificativaSanitaria: "Carências históricas conferidas" };
        await revisarClassificacaoBaixaTx(tx, animal.id, primeira.id, revisao, usuario.id, sitio.id);
        await revisarClassificacaoBaixaTx(tx, animal.id, primeira.id, revisao, usuario.id, sitio.id);
        const final = await tx.baixaAnimal.findUniqueOrThrow({ where: { id: primeira.id } });
        expect(final).toMatchObject({ animalId: animal.id, data: new Date(origem.data), tipo: "VENDA", localizacaoFechadaId: local.id, destinoFechadoId: finalidade.id });
        expect(await tx.baixaAnimal.count({ where: { animalId: animal.id } })).toBe(1);
        expect(await tx.auditoriaPecuaria.count({ where: { entidade: "BaixaAnimal", entidadeId: primeira.id } })).toBe(2);
        await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
        throw rollback;
      }, { timeout: 30000 });
    } catch (e) {
      if (e !== rollback) throw e;
    }
  }, 35000);

  it("SQL recusa tipo desconhecido sem proveniência mesmo fora do serviço", async () => {
    let falha: unknown;
    try {
      await prisma.$transaction(async tx => {
        const { animal } = await fixture(tx);
        await tx.baixaAnimal.create({ data: { animalId: animal.id, data: new Date("2024-08-12"), tipo: "NAO_DETERMINADO" } });
        throw rollback;
      }, { timeout: 30000 });
    } catch (e) { falha = e; }
    expect(falha).not.toBe(rollback);
    expect(String(falha)).toMatch(/BaixaAnimal_regularizacao_historica_check/);
  }, 35000);
});
