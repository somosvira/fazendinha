ALTER TABLE "PartidaProduto" ADD COLUMN "nome" TEXT;
ALTER TABLE "PartidaProduto" ADD COLUMN "lotePrincipalId" TEXT;

-- Agrupa sem mover referências: as alocações, snapshots e auditorias continuam intactos.
WITH grupos AS (
  SELECT "id", first_value("id") OVER (
    PARTITION BY "produtoId", "validade" ORDER BY "criadoEm", "id"
  ) AS raiz FROM "PartidaProduto"
)
UPDATE "PartidaProduto" p SET "lotePrincipalId" = g.raiz
FROM grupos g WHERE p."id" = g."id" AND p."id" <> g.raiz;

UPDATE "PartidaProduto" p SET "nome" = produto."nome" || ' — ' ||
  CASE WHEN p."validade" IS NULL THEN 'validade não informada'
       ELSE 'validade ' || to_char(p."validade", 'DD/MM/YYYY') END
FROM "Produto" produto WHERE produto."id" = p."produtoId";

ALTER TABLE "PartidaProduto" ADD CONSTRAINT "PartidaProduto_lotePrincipalId_fkey"
  FOREIGN KEY ("lotePrincipalId") REFERENCES "PartidaProduto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "PartidaProduto_lotePrincipalId_idx" ON "PartidaProduto"("lotePrincipalId");
CREATE UNIQUE INDEX "PartidaProduto_raiz_produto_validade_key"
  ON "PartidaProduto"("produtoId", "validade") WHERE "lotePrincipalId" IS NULL AND "validade" IS NOT NULL;
CREATE UNIQUE INDEX "PartidaProduto_raiz_produto_sem_validade_key"
  ON "PartidaProduto"("produtoId") WHERE "lotePrincipalId" IS NULL AND "validade" IS NULL;

CREATE FUNCTION "conferir_grupo_validade_produto"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."lotePrincipalId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "PartidaProduto" raiz WHERE raiz."id" = NEW."lotePrincipalId"
      AND raiz."id" <> NEW."id" AND raiz."lotePrincipalId" IS NULL
      AND raiz."produtoId" = NEW."produtoId"
      AND raiz."validade" IS NOT DISTINCT FROM NEW."validade"
  ) THEN
    RAISE EXCEPTION 'grupo de validade deve apontar para raiz do mesmo produto e validade' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM "PartidaProduto" alias WHERE alias."lotePrincipalId" = NEW."id"
    AND (NEW."lotePrincipalId" IS NOT NULL OR alias."produtoId" <> NEW."produtoId"
      OR alias."validade" IS DISTINCT FROM NEW."validade")) THEN
    RAISE EXCEPTION 'raiz não pode invalidar referências históricas do grupo' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "PartidaProduto_grupo_validade" BEFORE INSERT OR UPDATE ON "PartidaProduto"
  FOR EACH ROW EXECUTE FUNCTION "conferir_grupo_validade_produto"();
