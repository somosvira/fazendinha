ALTER TABLE "public"."Produto"
  ADD COLUMN "usoAgricola" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "usoGenetico" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "usoSanitario" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "usoNutricional" BOOLEAN NOT NULL DEFAULT false;

UPDATE "public"."Produto" p SET
  "usoAgricola" = c."usoAgricola",
  "usoGenetico" = c."usoGenetico",
  "usoSanitario" = c."usoSanitario",
  "usoNutricional" = c."usoNutricional"
FROM "public"."Categoria" c WHERE c.id = p."categoriaId";

UPDATE "public"."Produto" p SET "usoAgricola" = true
WHERE EXISTS (SELECT 1 FROM "public"."OperacaoAgricola" a WHERE a."produtoId" = p.id);
UPDATE "public"."Produto" p SET "usoGenetico" = true
WHERE EXISTS (SELECT 1 FROM "pecuaria"."MaterialGenetico" m WHERE m."produtoId" = p.id);
UPDATE "public"."Produto" p SET "usoSanitario" = true
WHERE EXISTS (SELECT 1 FROM "pecuaria"."PerfilSanitarioProduto" s WHERE s."produtoId" = p.id)
   OR EXISTS (SELECT 1 FROM "pecuaria"."AplicacaoProduto" a WHERE a."produtoId" = p.id)
   OR EXISTS (SELECT 1 FROM "pecuaria"."EtapaProtocoloSanitario" e WHERE e."produtoId" = p.id);
UPDATE "public"."Produto" p SET "usoNutricional" = true
WHERE EXISTS (SELECT 1 FROM "pecuaria"."PerfilNutricionalProduto" n WHERE n."produtoId" = p.id)
   OR EXISTS (SELECT 1 FROM "pecuaria"."ItemDieta" i WHERE i."produtoId" = p.id)
   OR EXISTS (SELECT 1 FROM "pecuaria"."ItemFechamentoConsumo" i WHERE i."produtoId" = p.id);

INSERT INTO "public"."Categoria" (id, nome, classificacao, ativo, ordem)
VALUES ('81939a31-d31b-4e1c-885e-681468621bc1', 'Sanidade', 'CUSTEIO', true, 0),
       ('81939a31-d31b-4e1c-885e-681468621bc2', 'Nutrição', 'CUSTEIO', true, 0)
ON CONFLICT (nome) DO NOTHING;
