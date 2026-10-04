import { readFile } from "node:fs/promises";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { env } from "../../env.js";

const comBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const migration = new URL("../../../prisma/migrations/20261003180000_lotes_produto_validade/migration.sql", import.meta.url);

comBanco("migration de agrupamentos por validade", () => {
  it("preserva referências e valores e protege raízes, aliases e validade desconhecida", async () => {
    const banco = new pg.Client({ connectionString: env.DATABASE_URL });
    await banco.connect();
    try {
      // Schema isolado e rollback testam também funções/triggers, sem tocar os dados locais.
      await banco.query(`BEGIN; CREATE SCHEMA teste_migration_lotes_validade;
        SET LOCAL search_path TO teste_migration_lotes_validade;
        CREATE TABLE "Produto" (id text PRIMARY KEY, nome text NOT NULL);
        CREATE TABLE "PartidaProduto" (
          id text PRIMARY KEY, "produtoId" text NOT NULL REFERENCES "Produto"(id),
          codigo text NOT NULL, validade date, fabricante text,
          "origemRastreio" text NOT NULL DEFAULT 'INFORMADA', "criadoEm" timestamp NOT NULL,
          UNIQUE ("produtoId", codigo)
        );
        CREATE TABLE "MovimentoTeste" (id text PRIMARY KEY, quantidade numeric(12,3), valor numeric(14,2));
        CREATE TABLE "AlocacaoTeste" (id text PRIMARY KEY, "partidaId" text REFERENCES "PartidaProduto"(id), quantidade numeric(12,3));
        CREATE TABLE "SnapshotTeste" (id text PRIMARY KEY, dados jsonb);
        INSERT INTO "Produto" VALUES ('vacina', 'Vacina X'), ('racao', 'Ração X');
        INSERT INTO "PartidaProduto" (id,"produtoId",codigo,validade,"criadoEm") VALUES
          ('a','vacina','Fornecedor A','2027-09-17','2026-09-01'),
          ('b','vacina','Fornecedor B','2027-09-17','2026-09-02'),
          ('c','vacina','Outra validade','2027-12-05','2026-09-01'),
          ('d','vacina','LEGADO_NAO_IDENTIFICADO',null,'2026-09-01'),
          ('e','vacina','Sem data',null,'2026-09-01'),
          ('f','racao','Fornecedor A','2027-09-17','2026-09-01');
        INSERT INTO "MovimentoTeste" VALUES ('entrada-a',50,100),('entrada-b',30,90),('saida',-10,-20);
        INSERT INTO "AlocacaoTeste" VALUES ('aloc-a','a',50),('aloc-b','b',30),('aloc-saida','b',-10);
        INSERT INTO "SnapshotTeste" VALUES ('aplicacao','{"partidaId":"b","codigo":"Fornecedor B","validade":"2027-09-17"}');`);
      const antes = await banco.query('SELECT * FROM "SnapshotTeste" ORDER BY id');
      const valoresAntes = await banco.query('SELECT sum(quantidade)::text AS quantidade,sum(valor)::text AS valor FROM "MovimentoTeste"');
      const alocacoesAntes = await banco.query('SELECT * FROM "AlocacaoTeste" ORDER BY id');

      await banco.query(await readFile(migration, "utf8"));
      const lotes = await banco.query('SELECT id,codigo,"lotePrincipalId",nome FROM "PartidaProduto" ORDER BY id');
      expect(lotes.rows.map((l) => [l.id, l.lotePrincipalId])).toEqual([
        ["a", null], ["b", "a"], ["c", null], ["d", null], ["e", "d"], ["f", null],
      ]);
      expect(lotes.rows.find((l) => l.id === "a")?.nome).toBe("Vacina X — validade 17/09/2027");
      expect(lotes.rows.find((l) => l.id === "d")?.nome).toBe("Vacina X — validade não informada");
      expect(lotes.rows.find((l) => l.id === "b")?.codigo).toBe("Fornecedor B");
      expect((await banco.query('SELECT * FROM "SnapshotTeste" ORDER BY id')).rows).toEqual(antes.rows);
      expect((await banco.query('SELECT * FROM "AlocacaoTeste" ORDER BY id')).rows).toEqual(alocacoesAntes.rows);
      expect((await banco.query('SELECT sum(quantidade)::text AS quantidade,sum(valor)::text AS valor FROM "MovimentoTeste"')).rows).toEqual(valoresAntes.rows);
      expect((await banco.query(`SELECT sum(a.quantidade)::text AS saldo FROM "AlocacaoTeste" a
        JOIN "PartidaProduto" p ON p.id=a."partidaId" WHERE coalesce(p."lotePrincipalId",p.id)='a'`)).rows[0].saldo).toBe("70.000");

      async function recusar(sql: string) {
        await banco.query("SAVEPOINT invalido");
        await expect(banco.query(sql)).rejects.toThrow();
        await banco.query("ROLLBACK TO SAVEPOINT invalido; RELEASE SAVEPOINT invalido");
      }
      await recusar(`INSERT INTO "PartidaProduto" (id,"produtoId",codigo,validade,"criadoEm") VALUES ('duplicado','vacina','Novo nome','2027-09-17',now())`);
      await recusar(`INSERT INTO "PartidaProduto" (id,"produtoId",codigo,validade,"criadoEm") VALUES ('null-duplicado','vacina','Outro sem data',null,now())`);
      await recusar(`UPDATE "PartidaProduto" SET "lotePrincipalId"='f' WHERE id='b'`);
      await recusar(`UPDATE "PartidaProduto" SET "lotePrincipalId"='c' WHERE id='b'`);
      await recusar(`UPDATE "PartidaProduto" SET "lotePrincipalId"='b' WHERE id='a'`);
      await recusar(`UPDATE "PartidaProduto" SET validade='2028-01-01' WHERE id='a'`);
    } finally {
      await banco.query("ROLLBACK");
      await banco.end();
    }
  }, 20_000);
});
