-- "Saída" vira "baixa" (termo do IDEAGRI: TIPOBAIXA/MOTIVOBAIXA) e o motivo deixa de pertencer a um
-- tipo: passa a ter uma classe (descarte voluntário, descarte involuntário, morte). Tudo por RENAME
-- para preservar os dados; os nomes de constraints/índices seguem o padrão do Prisma.

-- 1. Tabelas
ALTER TABLE "pecuaria"."SaidaAnimal" RENAME TO "BaixaAnimal";
ALTER TABLE "pecuaria"."MotivoSaida" RENAME TO "MotivoBaixa";

ALTER TABLE "pecuaria"."BaixaAnimal" RENAME CONSTRAINT "SaidaAnimal_pkey" TO "BaixaAnimal_pkey";
ALTER TABLE "pecuaria"."BaixaAnimal" RENAME CONSTRAINT "SaidaAnimal_animalId_fkey" TO "BaixaAnimal_animalId_fkey";
ALTER TABLE "pecuaria"."BaixaAnimal" RENAME CONSTRAINT "SaidaAnimal_motivoId_fkey" TO "BaixaAnimal_motivoId_fkey";
ALTER TABLE "pecuaria"."BaixaAnimal" RENAME CONSTRAINT "SaidaAnimal_criadoPorId_fkey" TO "BaixaAnimal_criadoPorId_fkey";
ALTER TABLE "pecuaria"."BaixaAnimal" RENAME CONSTRAINT "SaidaAnimal_localizacaoFechadaId_fkey" TO "BaixaAnimal_localizacaoFechadaId_fkey";
ALTER TABLE "pecuaria"."BaixaAnimal" RENAME CONSTRAINT "SaidaAnimal_destinoFechadoId_fkey" TO "BaixaAnimal_destinoFechadoId_fkey";
ALTER INDEX "pecuaria"."SaidaAnimal_ideagriId_key" RENAME TO "BaixaAnimal_ideagriId_key";
ALTER INDEX "pecuaria"."SaidaAnimal_animalId_idx" RENAME TO "BaixaAnimal_animalId_idx";
ALTER INDEX "pecuaria"."SaidaAnimal_data_idx" RENAME TO "BaixaAnimal_data_idx";
ALTER INDEX "pecuaria"."SaidaAnimal_localizacaoFechadaId_idx" RENAME TO "BaixaAnimal_localizacaoFechadaId_idx";
ALTER INDEX "pecuaria"."SaidaAnimal_destinoFechadoId_idx" RENAME TO "BaixaAnimal_destinoFechadoId_idx";
-- índice único parcial (só no SQL): no máximo uma baixa não estornada por animal
ALTER INDEX "pecuaria"."SaidaAnimal_animalId_ativa_key" RENAME TO "BaixaAnimal_animalId_ativa_key";

ALTER TABLE "pecuaria"."MotivoBaixa" RENAME CONSTRAINT "MotivoSaida_pkey" TO "MotivoBaixa_pkey";
ALTER TABLE "pecuaria"."MotivoBaixa" RENAME CONSTRAINT "MotivoSaida_criadoPorId_fkey" TO "MotivoBaixa_criadoPorId_fkey";
ALTER INDEX "pecuaria"."MotivoSaida_ideagriId_key" RENAME TO "MotivoBaixa_ideagriId_key";

-- 2. Classe do motivo (a partir do tipo antigo; os motivos de descarte de venda/abate/doação
--    entram como voluntários — o usuário reclassifica na tela)
CREATE TYPE "pecuaria"."ClasseMotivoBaixa" AS ENUM ('DESCARTE_VOLUNTARIO', 'DESCARTE_INVOLUNTARIO', 'MORTE');
ALTER TABLE "pecuaria"."MotivoBaixa" ADD COLUMN "classe" "pecuaria"."ClasseMotivoBaixa";
UPDATE "pecuaria"."MotivoBaixa"
SET "classe" = CASE WHEN "tipo" IN ('MORTE', 'OUTRO') THEN 'MORTE'::"pecuaria"."ClasseMotivoBaixa"
                    ELSE 'DESCARTE_VOLUNTARIO'::"pecuaria"."ClasseMotivoBaixa" END;

-- 3. Motivos que só repetiam o tipo (Venda, Abate, Doação, Cadastro indevido) deixam de existir:
--    o tipo já diz isso. As baixas que os usavam ficam sem motivo.
UPDATE "pecuaria"."BaixaAnimal" b SET "motivoId" = NULL
FROM "pecuaria"."MotivoBaixa" m
WHERE b."motivoId" = m."id"
  AND lower(m."nome") IN ('venda', 'abate', 'doação', 'doacao', 'cadastro indevido');
DELETE FROM "pecuaria"."MotivoBaixa"
WHERE lower("nome") IN ('venda', 'abate', 'doação', 'doacao', 'cadastro indevido');

-- baixa com motivo que o tipo não aceita (ex.: causa de morte numa venda) perde o motivo
UPDATE "pecuaria"."BaixaAnimal" b SET "motivoId" = NULL
FROM "pecuaria"."MotivoBaixa" m
WHERE b."motivoId" = m."id"
  AND NOT (
    (b."tipo" IN ('VENDA', 'ABATE', 'DOACAO') AND m."classe" IN ('DESCARTE_VOLUNTARIO', 'DESCARTE_INVOLUNTARIO'))
    OR (b."tipo" IN ('MORTE', 'OUTRO') AND m."classe" = 'MORTE')
  );

ALTER TABLE "pecuaria"."MotivoBaixa" ALTER COLUMN "classe" SET NOT NULL;
ALTER TABLE "pecuaria"."MotivoBaixa" DROP COLUMN "tipo";

-- 4. Tipo: sai OUTRO (só a carga gerava, para "Desconhecida/Indefinida" = causa de morte), entra EXTRAVIO
CREATE TYPE "pecuaria"."TipoBaixa" AS ENUM ('VENDA', 'ABATE', 'MORTE', 'DOACAO', 'EXTRAVIO', 'CADASTRO_INDEVIDO');
ALTER TABLE "pecuaria"."BaixaAnimal"
  ALTER COLUMN "tipo" TYPE "pecuaria"."TipoBaixa"
  USING (CASE WHEN "tipo"::text = 'OUTRO' THEN 'MORTE' ELSE "tipo"::text END)::"pecuaria"."TipoBaixa";
DROP TYPE "pecuaria"."TipoSaidaAnimal";

-- 5. Trilha de auditoria acompanha os nomes novos
UPDATE "pecuaria"."AuditoriaPecuaria" SET "entidade" = 'BaixaAnimal' WHERE "entidade" = 'SaidaAnimal';
UPDATE "pecuaria"."AuditoriaPecuaria" SET "entidade" = 'MotivoBaixa' WHERE "entidade" = 'MotivoSaida';
UPDATE "pecuaria"."AuditoriaPecuaria" SET "acao" = 'BAIXA' WHERE "entidade" = 'BaixaAnimal' AND "acao" = 'SAIDA';
