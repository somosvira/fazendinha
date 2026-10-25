import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { describe, expect, it } from "vitest";
import { env } from "../../env.js";

const suite = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;

suite("compatibilidade do estado final da baseline", () => {
  it("mantém as views IATF/exames somente leitura e DestinoAnimal sobre a identidade canônica", async () => {
    const url = new URL(env.DATABASE_URL);
    if (process.env.CI !== "true") {
      expect(["localhost", "127.0.0.1", "[::1]"]).toContain(url.hostname);
      expect(url.pathname).toBe("/fazendinha_seedatev3");
    }
    const banco = new Client({ connectionString: url.toString() });
    const animal = randomUUID(), finalidade = randomUUID();
    await banco.connect();
    try {
      await banco.query("BEGIN");
      await banco.query(`INSERT INTO pecuaria."Animal" (id,brinco,sexo,"dataNascimento",origem,"dataEntrada","atualizadoEm") VALUES ($1,$2,'F','2020-01-01','COMPRADO','2026-01-01',now())`, [animal, `BASE-${animal}`]);
      await banco.query(`INSERT INTO pecuaria."DestinoAnimal" (id,"animalId",aptidao,desde,"atualizadoEm") VALUES ($1,$2,'LEITE','2026-01-01',now()) RETURNING id`, [finalidade, animal]);
      expect((await banco.query('SELECT id,"animalId",aptidao FROM pecuaria."FinalidadeAnimal" WHERE id=$1', [finalidade])).rows).toEqual([{ id: finalidade, animalId: animal, aptidao: "LEITE" }]);
      await banco.query(`UPDATE pecuaria."DestinoAnimal" SET aptidao='REPRODUCAO' WHERE id=$1`, [finalidade]);
      expect((await banco.query('SELECT aptidao FROM pecuaria."FinalidadeAnimal" WHERE id=$1', [finalidade])).rows).toEqual([{ aptidao: "REPRODUCAO" }]);
      const views = (await banco.query(`SELECT table_name,is_updatable FROM information_schema.views WHERE table_schema='pecuaria'`)).rows;
      for (const tabela of ["AvaliacaoReprodutiva", "ProtocoloIatf", "ProgramacaoIatf", "ParticipanteIatf", "TarefaIatf"]) {
        expect(views.find(v => v.table_name === tabela)).toMatchObject({ is_updatable: "NO" });
        await banco.query("SAVEPOINT escrita_view");
        try { await expect(banco.query(`UPDATE pecuaria."${tabela}" SET id=id WHERE false`)).rejects.toThrow(/cannot update view/); }
        finally { await banco.query("ROLLBACK TO SAVEPOINT escrita_view; RELEASE SAVEPOINT escrita_view"); }
      }
      await banco.query("SET CONSTRAINTS ALL IMMEDIATE");
      expect((await banco.query(`SELECT confrelid::regclass::text AS destino FROM pg_constraint WHERE conrelid='pecuaria."BaixaAnimal"'::regclass AND conname='BaixaAnimal_destinoFechadoId_fkey'`)).rows).toEqual([{ destino: 'pecuaria."FinalidadeAnimal"' }]);
      expect((await banco.query(`SELECT indpred IS NOT NULL AS parcial FROM pg_index WHERE indexrelid='pecuaria."FinalidadeAnimal_animalId_aberto_key"'::regclass`)).rows).toEqual([{ parcial: true }]);
    } finally {
      await banco.query("ROLLBACK");
      try { expect((await banco.query('SELECT id FROM pecuaria."Animal" WHERE id=$1', [animal])).rows).toEqual([]); }
      finally { await banco.end(); }
    }
  }, 20_000);
});
