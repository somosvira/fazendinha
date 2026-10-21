import crypto from "node:crypto";
import { Client } from "pg";
import { describe, expect, it } from "vitest";
import { env } from "../../../env.js";

const suite = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;

suite("compatibilidade SQL da finalidade durante publicação", () => {
  it("permite DML legado com RETURNING, preservando unicidade, FKs e os mesmos dados", async () => {
    const url = new URL(env.DATABASE_URL);
    if (process.env.CI !== "true") {
      expect(["localhost", "127.0.0.1", "[::1]"]).toContain(url.hostname);
      expect(url.pathname).toBe("/fazendinha_seedatev3");
    }
    const db = new Client({ connectionString: url.toString() });
    const animalId = crypto.randomUUID();
    const finalidadeId = crypto.randomUUID();
    await db.connect();
    try {
      // Toda a fixture é privada desta transação, inclusive em caso de falha.
      await db.query("BEGIN");
      expect((await db.query(`SELECT is_updatable FROM information_schema.views
        WHERE table_schema='pecuaria' AND table_name='DestinoAnimal'`)).rows).toEqual([{ is_updatable: "YES" }]);
      await db.query(`INSERT INTO pecuaria."Animal" (id,brinco,sexo,"dataNascimento",origem,"dataEntrada","atualizadoEm")
        VALUES ($1,$1,'F','2020-01-01','COMPRADO','2026-01-01',CURRENT_TIMESTAMP)`, [animalId]);
      const criada = await db.query(`INSERT INTO pecuaria."DestinoAnimal" (id,"animalId",aptidao,desde,"atualizadoEm")
        VALUES ($1,$2,'LEITE','2026-01-01',CURRENT_TIMESTAMP) RETURNING id, aptidao`, [finalidadeId, animalId]);
      expect(criada.rows).toEqual([{ id: finalidadeId, aptidao: "LEITE" }]);
      expect((await db.query(`SELECT id, aptidao FROM pecuaria."FinalidadeAnimal" WHERE id=$1`, [finalidadeId])).rows).toEqual(criada.rows);
      await db.query("SAVEPOINT duplicada");
      await expect(db.query(`INSERT INTO pecuaria."DestinoAnimal" (id,"animalId",aptidao,desde,"atualizadoEm")
        VALUES ($1,$2,'CORTE','2026-02-01',CURRENT_TIMESTAMP)`, [crypto.randomUUID(), animalId])).rejects.toMatchObject({ code: "23505" });
      await db.query("ROLLBACK TO SAVEPOINT duplicada");
      await db.query("SAVEPOINT fk");
      await expect(db.query(`DELETE FROM pecuaria."Animal" WHERE id=$1`, [animalId])).rejects.toMatchObject({ code: "23503" });
      await db.query("ROLLBACK TO SAVEPOINT fk");
      expect((await db.query(`UPDATE pecuaria."DestinoAnimal" SET aptidao='REPRODUCAO' WHERE id=$1 RETURNING aptidao`, [finalidadeId])).rows).toEqual([{ aptidao: "REPRODUCAO" }]);
      expect((await db.query(`SELECT aptidao FROM pecuaria."FinalidadeAnimal" WHERE id=$1`, [finalidadeId])).rows).toEqual([{ aptidao: "REPRODUCAO" }]);
      expect((await db.query(`DELETE FROM pecuaria."DestinoAnimal" WHERE id=$1 RETURNING id`, [finalidadeId])).rows).toEqual([{ id: finalidadeId }]);
      expect((await db.query(`SELECT id FROM pecuaria."FinalidadeAnimal" WHERE id=$1`, [finalidadeId])).rows).toEqual([]);
    } finally {
      await db.query("ROLLBACK");
      await db.end();
    }
  });
});
