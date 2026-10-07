-- O vínculo continua no fato anulado para preservar a origem de cada tentativa.
DROP INDEX "pecuaria"."AplicacaoProduto_tarefaId_key";
DROP INDEX "pecuaria"."ExameAnimal_tarefaId_key";

CREATE UNIQUE INDEX "AplicacaoProduto_tarefaId_valida_key"
ON "pecuaria"."AplicacaoProduto" ("tarefaId")
WHERE "status" = 'VALIDO' AND "tarefaId" IS NOT NULL;

CREATE UNIQUE INDEX "ExameAnimal_tarefaId_valido_key"
ON "pecuaria"."ExameAnimal" ("tarefaId")
WHERE "status" = 'VALIDO' AND "tarefaId" IS NOT NULL;

CREATE INDEX "AplicacaoProduto_tarefaId_idx" ON "pecuaria"."AplicacaoProduto" ("tarefaId");
CREATE INDEX "ExameAnimal_tarefaId_idx" ON "pecuaria"."ExameAnimal" ("tarefaId");
