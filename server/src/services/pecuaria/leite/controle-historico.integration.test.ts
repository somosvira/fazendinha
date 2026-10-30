import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { registrarControleHistoricoLeiteTx } from "./controle-historico.js";

const comBanco = describe.runIf(process.env.PECUARIA_DB_INTEGRATION === "1");
const rollback = new Error("ROLLBACK_CONTROLE_DOCUMENTAL_LEITE");

// Fixtures privadas; inclusive um caso aprovado termina em rollback obrigatório.
comBanco("controle documental — reenvio com JSONB PostgreSQL", () => {
  it("reutiliza proveniência reordenada pelo banco e rejeita alteração real sem efeitos operacionais", async () => {
    try {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const token = randomUUID();
        const autor = await tx.usuario.create({ data: { nome: `Documento ${token}`, email: `doc-${token}@example.test`, papel: "DONO", status: "ATIVO" } });
        const sitio = await tx.propriedade.create({ data: { nome: `Documento ${token}` } });
        const fonte = {
          bancoOrigem: `TESTE-${token}`, chaveOrigem: "LEITE:1",
          registro: {
            tipo: "AGREGADO_MENSAL" as const, inicio: "2024-10-01", fim: "2024-10-31",
            contexto: "INTERNO" as const, propriedadeId: sitio.id, animalId: null, lactacaoId: null,
            origemColetiva: "Tanque documentado", total: 12.5, unidade: "KG" as const,
            referenciaUnidade: "Documento original informa quilogramas", parcelas: [],
            evidencia: "Agregado mensal original conferido", snapshotOrigem: { z: { valor: 1, origem: "documento" }, a: ["primeiro", "segundo"] },
          },
        };
        const primeiro = await registrarControleHistoricoLeiteTx(tx, fonte, autor.id);
        expect(await registrarControleHistoricoLeiteTx(tx, fonte, autor.id)).toEqual(primeiro);
        await expect(registrarControleHistoricoLeiteTx(tx, { ...fonte, registro: { ...fonte.registro, total: 13 } }, autor.id)).rejects.toMatchObject({ code: "CONFLITO" });
        expect(await tx.controleHistoricoLeite.count({ where: { propriedadeId: sitio.id } })).toBe(1);
        expect(await tx.auditoriaPecuaria.count({ where: { entidade: "ControleHistoricoLeite", entidadeId: primeiro.id } })).toBe(1);
        expect((await tx.controleHistoricoLeite.findUniqueOrThrow({ where: { id: primeiro.id } })).total?.toString()).toBe("12.5");
        expect(await tx.diaProducaoLeite.count({ where: { propriedadeId: sitio.id } })).toBe(0);
        expect(await tx.movimentoEstoque.count({ where: { propriedadeId: sitio.id } })).toBe(0);
        expect(await tx.operacao.count({ where: { propriedadeId: sitio.id } })).toBe(0);
        await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
        throw rollback;
      }, { timeout: 30000 });
    } catch (erro) { if (erro !== rollback) throw erro; }
  }, 35000);
});
