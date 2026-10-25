import { randomInt, randomUUID } from "node:crypto";
import { Client } from "pg";
import { describe, expect, it } from "vitest";
import { env } from "../../../env.js";

const suite = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;

// Preparado para ambiente autorizado com migrations já aplicadas. Não aplica migrations,
// não usa dados do seed e sempre desfaz integralmente suas próprias fixtures.
suite("SQL real do histórico de origens gerais", () => {
  it("rejeita finalidade, sítio, sexo e lactação incompatíveis e permite regularização explícita", async () => {
    const url = new URL(env.DATABASE_URL);
    if (process.env.CI !== "true") {
      expect(["localhost", "127.0.0.1", "[::1]"]).toContain(url.hostname);
      expect(url.pathname).toBe("/fazendinha_seedatev3");
    }
    const db = new Client({ connectionString: url.toString() });
    const ids = Array.from({ length: 11 }, () => randomUUID());
    const [animal, local, finalidade, lactacao, config, posicao, posicaoRegistro, dia, sessao, tanque, geral] = ids;
    const sitio = -randomInt(1, 2_000_000_000);
    await db.connect();
    try {
      await db.query("BEGIN");
      await db.query('INSERT INTO public."Propriedade" (id,nome,"updatedAt") VALUES ($1,$2,now())', [sitio, `Teste privado ${animal}`]);
      await db.query(`INSERT INTO pecuaria."Animal" (id,brinco,sexo,"dataNascimento",origem,"dataEntrada","atualizadoEm") VALUES ($1,$1,'F','2020-01-01','COMPRADO','2026-01-01',now())`, [animal]);
      await db.query(`INSERT INTO pecuaria."LocalizacaoAnimal" (id,"animalId","propriedadeId",desde,"atualizadoEm") VALUES ($1,$2,$3,'2026-01-01',now())`, [local, animal, sitio]);
      await db.query(`INSERT INTO pecuaria."FinalidadeAnimal" (id,"animalId",aptidao,desde,"atualizadoEm") VALUES ($1,$2,'LEITE','2026-01-01',now())`, [finalidade, animal]);
      await db.query(`INSERT INTO pecuaria."LactacaoAnimal" (id,"animalId","propriedadeId",inicio) VALUES ($1,$2,$3,'2026-01-01')`, [lactacao, animal, sitio]);
      await db.query(`INSERT INTO pecuaria."ConfiguracaoOrdenha" (id,"propriedadeId","vigenteDesde","fonteProducao") VALUES ($1,$2,'2026-01-01','GERAL')`, [config, sitio]);
      await db.query(`INSERT INTO pecuaria."PosicaoOrdenha" (id,"configuracaoId","posicaoId",nome,ordem) VALUES ($1,$2,$3,'Manhã',1)`, [posicaoRegistro, config, posicao]);
      await db.query(`INSERT INTO pecuaria."DiaProducaoLeite" (id,"propriedadeId","dataOperacional","configuracaoId","atualizadoEm") VALUES ($1,$2,'2026-10-20',$3,now())`, [dia, sitio, config]);
      await db.query(`INSERT INTO pecuaria."SessaoOrdenha" (id,"diaId","posicaoId",nome,ordem) VALUES ($1,$2,$3,'Manhã',1)`, [sessao, dia, posicao]);
      await db.query(`INSERT INTO pecuaria."TanqueLeite" (id,"propriedadeId","identidadeId",versao,nome,"capacidadeLitros","vigenteDesde","tabelaConversao") VALUES ($1,$2,$1,1,'Tanque privado',1000,'2026-01-01','[]')`, [tanque, sitio]);
      await db.query(`INSERT INTO pecuaria."MedicaoGeralLeite" (id,"sessaoId","tanqueId",litros,"origemLitros",natureza,"animaisOrigem","criterioColostroSnapshot",responsavel,"atualizadoEm") VALUES ($1,$2,$3,20,'LITROS_INFORMADOS','COMERCIAL',$4::jsonb,$5::jsonb,'Fixture privada',now())`, [geral, sessao, tanque, JSON.stringify([animal]), JSON.stringify({ configuracaoId: config, criterio: null, partos: [], primeiraOrdenhaColostro: null })]);
      await db.query("SET CONSTRAINTS ALL IMMEDIATE");
      await db.query("SET CONSTRAINTS ALL DEFERRED");

      const rejeitar = async (sql: string, parametros: unknown[]) => {
        await db.query("SAVEPOINT tentativa");
        await db.query(sql, parametros);
        await expect(db.query("SET CONSTRAINTS ALL IMMEDIATE")).rejects.toMatchObject({ code: "23514" });
        await db.query("ROLLBACK TO SAVEPOINT tentativa");
      };
      await rejeitar(`UPDATE pecuaria."FinalidadeAnimal" SET ate='2026-10-19' WHERE id=$1`, [finalidade]);
      await rejeitar(`UPDATE pecuaria."Animal" SET sexo='M' WHERE id=$1`, [animal]);
      await rejeitar(`DELETE FROM pecuaria."LocalizacaoAnimal" WHERE id=$1`, [local]);
      await rejeitar(`UPDATE pecuaria."LactacaoAnimal" SET "encerradaEm"='2026-10-19' WHERE id=$1`, [lactacao]);
      expect((await db.query('SELECT aptidao,ate FROM pecuaria."FinalidadeAnimal" WHERE id=$1', [finalidade])).rows).toEqual([{ aptidao: "LEITE", ate: null }]);
      expect((await db.query('SELECT count(*)::integer n FROM pecuaria."ParticipanteProducaoLeite" WHERE "animalId"=$1', [animal])).rows).toEqual([{ n: 0 }]);

      // O intervalo futuro não atinge a aferição em 20/10.
      await db.query("SAVEPOINT futuro");
      await db.query(`UPDATE pecuaria."FinalidadeAnimal" SET ate='2026-10-21' WHERE id=$1`, [finalidade]);
      await db.query(`INSERT INTO pecuaria."FinalidadeAnimal" (id,"animalId",aptidao,desde,"atualizadoEm") VALUES ($1,$2,'CORTE','2026-10-21',now())`, [randomUUID(), animal]);
      await db.query("SET CONSTRAINTS ALL IMMEDIATE");
      await db.query("ROLLBACK TO SAVEPOINT futuro");

      // Corrigir explicitamente a origem livre libera a alteração retroativa.
      await db.query(`UPDATE pecuaria."MedicaoGeralLeite" SET "animaisOrigem"='[]',versao=versao+1 WHERE id=$1`, [geral]);
      await db.query(`UPDATE pecuaria."FinalidadeAnimal" SET ate='2026-10-19' WHERE id=$1`, [finalidade]);
      await db.query("SET CONSTRAINTS ALL IMMEDIATE");
    } finally {
      await db.query("ROLLBACK");
      await db.end();
    }
  }, 20_000);
});
