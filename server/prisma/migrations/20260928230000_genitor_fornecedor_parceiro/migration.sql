ALTER TABLE "pecuaria"."GenitorExterno" ADD COLUMN "fornecedorId" TEXT;

UPDATE "pecuaria"."GenitorExterno" AS g
SET "fornecedorId" = p."id"
FROM "public"."Parceiro" AS p
WHERE g."fornecedor" IS NOT NULL
  AND lower(trim(g."fornecedor")) = lower(trim(p."nome"))
  AND (p."tipo" IN ('FORNECEDOR', 'AMBOS') OR EXISTS (
    SELECT 1 FROM "public"."ParceiroPapel" AS papel
    WHERE papel."parceiroId" = p."id" AND papel."papel" = 'FORNECEDOR'
  ))
  AND NOT EXISTS (
    SELECT 1 FROM "public"."Parceiro" AS outro
    WHERE outro."id" <> p."id" AND lower(trim(outro."nome")) = lower(trim(g."fornecedor"))
  );

CREATE INDEX "GenitorExterno_fornecedorId_idx" ON "pecuaria"."GenitorExterno"("fornecedorId");
ALTER TABLE "pecuaria"."GenitorExterno" ADD CONSTRAINT "GenitorExterno_fornecedorId_fkey"
FOREIGN KEY ("fornecedorId") REFERENCES "public"."Parceiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;
