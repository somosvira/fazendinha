import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { exigirBancoIntegracaoPecuaria } from "../../../lib/banco-pecuaria-integration.fixture.js";
import { prisma } from "../../../db.js";
import { consultarPlannerTx, previaGrupoPlannerTx } from "./planner.js";
import { consultaPlannerSchema, previaGrupoPlannerSchema } from "./planner.schemas.js";
import { criarSelecaoTx } from "./selecoes.js";
import { criteriosSelecaoSchema } from "./selecoes.schemas.js";

const suite = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const data = "2026-10-14";

/** Fixtures locais são criadas e verificadas numa única transação revertida. */
async function comRollback(executar: (tx: Prisma.TransactionClient) => Promise<void>) {
  exigirBancoIntegracaoPecuaria();
  const rollback = new Error("ROLLBACK_FIXTURES_COMPATIBILIDADE_SELECAO");
  try {
    await prisma.$transaction(async tx => {
      await executar(tx);
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      throw rollback;
    }, { timeout: 60000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (erro) {
    if (erro !== rollback) throw erro;
  }
}

suite("compatibilidade de critérios V2 entre origens — fixtures próprias em rollback", () => {
  it("avalia peso e data igualmente em LIVRE, EXTRA, SELECAO e na consulta do planner", async () => comRollback(async tx => {
    const propriedade = await tx.propriedade.create({ data: { nome: `Compatibilidade seleção ${randomUUID()}` } });
    const animais: Array<{ id: string }> = [];
    for (let i = 0; i < 3; i++) animais.push(await tx.animal.create({ data: {
      brinco: `CS-${i}-${randomUUID()}`, sexo: "F", origem: "COMPRADO", dataNascimento: new Date("2020-01-01"), dataEntrada: new Date("2024-01-01"),
      localizacoes: { create: { propriedadeId: propriedade.id, desde: new Date("2024-01-01") } },
    } }));
    await tx.pesagem.create({ data: { animalId: animais[0].id, data: new Date("2026-10-01"), pesoKg: "500.00", tipo: "ROTINA" } });
    await tx.pesagem.create({ data: { animalId: animais[0].id, data: new Date("2026-10-20"), pesoKg: "800.00", tipo: "ROTINA" } });
    await tx.pesagem.create({ data: { animalId: animais[1].id, data: new Date("2026-10-01"), pesoKg: "400.00", tipo: "ROTINA" } });

    const criterios = criteriosSelecaoSchema.parse({ versao: 2,
      todas: [{ tipo: "FAIXA", campo: "PESO_KG", min: 450, max: 550 }], qualquer: [],
      ordenacao: [{ campo: "BRINCO", direcao: "ASC" }], politicaDesconhecidos: "EXCLUIR" });
    const selecao = await criarSelecaoTx(tx, { propriedadeId: propriedade.id, nome: "Peso na data", criterios }, null);
    const grupos = [
      { origem: "LIVRE" as const, nome: "Livre", tipo: "APLICACAO_SANITARIA" as const, criterios, incluidosManualmente: [] },
      { origem: "EXTRA" as const, nome: "Extra", tipo: "APLICACAO_SANITARIA" as const, criterios, contexto: {} },
      { origem: "SELECAO" as const, selecaoVersaoId: selecao.versaoAtual.id },
    ];
    const ids: string[][] = [];
    for (const grupo of grupos) {
      const previa = await previaGrupoPlannerTx(tx, previaGrupoPlannerSchema.parse({ propriedadeId: propriedade.id, data, grupo }));
      ids.push(previa.animais.map(animal => animal.animalId));
      expect(previa.animais.find(animal => animal.animalId === animais[0].id)).toMatchObject({ pesoKg: 500, pesagemData: "2026-10-01", diasPesagem: 13 });
    }
    expect(ids).toEqual([[animais[0].id], [animais[0].id], [animais[0].id]]);

    const planner = await consultarPlannerTx(tx, consultaPlannerSchema.parse({ propriedadeId: propriedade.id, data }));
    expect(planner.totalGrupos).toBe(1);
    expect(planner.grupos[0]).toMatchObject({ grupo: grupos[2], criterios, totalAnimais: 1 });
    expect((await tx.versaoSelecaoVisita.findUniqueOrThrow({ where: { id: selecao.versaoAtual.id } })).criterios).toEqual(criterios);
  }));
});
