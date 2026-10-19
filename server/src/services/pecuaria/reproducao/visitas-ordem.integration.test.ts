import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { prisma } from "../../../db.js";
import { exigirBancoIntegracaoPecuaria } from "../../../lib/banco-pecuaria-integration.fixture.js";
import { incluirGrupoPlannerTx, previaGrupoPlannerTx } from "./planner.js";
import { incluirGrupoPlannerSchema, previaGrupoPlannerSchema } from "./planner.schemas.js";
import { imprimirVisita } from "./visitas.js";

const harness = vi.hoisted(() => ({ tx: null as Prisma.TransactionClient | null }));
// O executor real de impressão participa da transação externa, revertida no fim.
vi.mock("../transacao.js", () => ({
  transacaoPecuaria: async <T>(executar: (tx: Prisma.TransactionClient) => Promise<T>) => {
    if (!harness.tx) throw new Error("Fixture transacional não inicializada");
    return executar(harness.tx);
  },
}));

const suite = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
suite("ordem da seleção livre até a folha de campo", () => {
  it("preserva ordem natural decrescente, exclusão e emissão após mudar o cadastro", async () => {
    exigirBancoIntegracaoPecuaria();
    const rollback = new Error("ROLLBACK_ORDEM_VISITA");
    try {
      await prisma.$transaction(async tx => {
        harness.tx = tx;
        const token = randomUUID();
        const sitio = await tx.propriedade.create({ data: { nome: `Ordem visita ${token}` } });
        const animais = [];
        for (const numero of [2, 10, 1]) {
          animais.push(await tx.animal.create({ data: {
            brinco: `OR-${token}-${numero}`, sexo: "F", origem: "COMPRADO",
            dataNascimento: new Date("2020-01-01"), dataEntrada: new Date("2024-01-01"),
            localizacoes: { create: { propriedadeId: sitio.id, desde: new Date("2024-01-01") } },
          } }));
        }
        const visita = await tx.visitaVeterinaria.create({ data: {
          propriedadeId: sitio.id, data: new Date("2026-10-14"), nome: "Conferência da ordem",
        } });
        const input = previaGrupoPlannerSchema.parse({ propriedadeId: sitio.id, data: "2026-10-14", grupo: {
          origem: "LIVRE", nome: "Manejo decrescente", tipo: "APLICACAO_SANITARIA", incluidosManualmente: [],
          criterios: { versao: 2, todas: [], qualquer: [], politicaDesconhecidos: "EXCLUIR", ordenacao: [{ campo: "BRINCO", direcao: "DESC" }] },
        } });
        const previa = await previaGrupoPlannerTx(tx, input);
        expect(previa.animais.map(a => a.animalId)).toEqual([animais[1].id, animais[0].id, animais[2].id]);
        const preparada = await incluirGrupoPlannerTx(tx, visita.id, incluirGrupoPlannerSchema.parse({
          propriedadeId: sitio.id, chave: randomUUID(), grupo: input.grupo,
          fingerprint: previa.fingerprint, excluidos: [animais[2].id],
        }), null);
        expect(preparada.atividades[0].participantes.map(a => a.animalId)).toEqual([animais[1].id, animais[0].id]);
        const impressao = await imprimirVisita(visita.id, sitio.id, null);
        expect(impressao.snapshot).toMatchObject({ atividades: [{
          contexto: { selecaoCriterios: { ordenacao: [{ campo: "BRINCO", direcao: "DESC" }] } },
          participantes: [{ animalId: animais[1].id }, { animalId: animais[0].id }],
        }] });
        await tx.animal.update({ where: { id: animais[1].id }, data: { brinco: `Alterado-${token}` } });
        const reimpressao = await tx.impressaoVisita.findUniqueOrThrow({ where: { id: impressao.id } });
        expect(reimpressao.snapshot).toEqual(impressao.snapshot);
        expect(await tx.aplicacaoProduto.count({ where: { animalId: { in: animais.map(a => a.id) } } })).toBe(0);
        await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
        throw rollback;
      }, { timeout: 30000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (erro) {
      if (erro !== rollback) throw erro;
    } finally {
      harness.tx = null;
    }
  });
});
