import { randomUUID } from "node:crypto";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { env } from "../../env.js";

const comBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;

comBanco("baseline de agrupamentos por validade", () => {
  it("protege raízes, aliases, códigos históricos e validade desconhecida", async () => {
    const url = new URL(env.DATABASE_URL);
    if (process.env.CI !== "true") {
      expect(["localhost", "127.0.0.1", "[::1]"]).toContain(url.hostname);
      expect(url.pathname).toBe("/fazendinha_seedatev3");
    }
    const banco = new pg.Client({ connectionString: url.toString() });
    const produto = randomUUID(), outroProduto = randomUUID();
    const a = randomUUID(), b = randomUUID(), c = randomUUID(), d = randomUUID(), e = randomUUID(), f = randomUUID();
    await banco.connect();
    try {
      // Só fixtures próprias; a estrutura é sempre a baseline já aplicada.
      await banco.query("BEGIN");
      await banco.query('INSERT INTO public."Produto" (id,nome,"updatedAt") VALUES ($1,$2,now()),($3,$4,now())', [produto, `Vacina SQL ${produto}`, outroProduto, `Ração SQL ${outroProduto}`]);
      await banco.query(`INSERT INTO public."PartidaProduto" (id,"produtoId",codigo,nome,validade,"lotePrincipalId") VALUES
        ($1,$7,'Fornecedor A','Vacina — 17/09/2027','2027-09-17',null),
        ($2,$7,'Fornecedor B',null,'2027-09-17',$1),
        ($3,$7,'Outra validade',null,'2027-12-05',null),
        ($4,$7,'LEGADO_NAO_IDENTIFICADO','Vacina — validade não informada',null,null),
        ($5,$7,'Sem data',null,null,$4),
        ($6,$8,'Fornecedor A',null,'2027-09-17',null)`, [a, b, c, d, e, f, produto, outroProduto]);
      const antes = (await banco.query('SELECT id,codigo,nome,validade,"lotePrincipalId" FROM public."PartidaProduto" WHERE "produtoId"=ANY($1::text[]) ORDER BY id', [[produto, outroProduto]])).rows;
      expect(antes.find(p => p.id === b)).toMatchObject({ codigo: "Fornecedor B", lotePrincipalId: a });
      expect(antes.find(p => p.id === e)).toMatchObject({ codigo: "Sem data", lotePrincipalId: d });

      async function recusar(sql: string, parametros: unknown[]) {
        await banco.query("SAVEPOINT invalido");
        try { await expect(banco.query(sql, parametros)).rejects.toThrow(); }
        finally { await banco.query("ROLLBACK TO SAVEPOINT invalido; RELEASE SAVEPOINT invalido"); }
      }
      await recusar(`INSERT INTO public."PartidaProduto" (id,"produtoId",codigo,validade) VALUES ($1,$2,'Duplicado','2027-09-17')`, [randomUUID(), produto]);
      await recusar(`INSERT INTO public."PartidaProduto" (id,"produtoId",codigo,validade) VALUES ($1,$2,'Outro sem data',null)`, [randomUUID(), produto]);
      for (const raiz of [f, c]) await recusar('UPDATE public."PartidaProduto" SET "lotePrincipalId"=$1 WHERE id=$2', [raiz, b]);
      await recusar('UPDATE public."PartidaProduto" SET "lotePrincipalId"=$1 WHERE id=$2', [b, a]);
      await recusar(`UPDATE public."PartidaProduto" SET validade='2028-01-01' WHERE id=$1`, [a]);
      expect((await banco.query('SELECT id,codigo,nome,validade,"lotePrincipalId" FROM public."PartidaProduto" WHERE "produtoId"=ANY($1::text[]) ORDER BY id', [[produto, outroProduto]])).rows).toEqual(antes);
    } finally {
      await banco.query("ROLLBACK");
      try { expect((await banco.query('SELECT id FROM public."Produto" WHERE id=ANY($1::text[])', [[produto, outroProduto]])).rows).toEqual([]); }
      finally { await banco.end(); }
    }
  }, 20_000);
});
