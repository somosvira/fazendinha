-- Limpa o modelo de Raça: separa raça pura (com codigo + especie) do grau de sangue (texto livre).
-- Estratégia: 1) adiciona colunas, 2) semeia raças puras, 3) backfill grauSangue + reaponta animais,
-- 4) remove raças "sujas" sem animal vinculado, 5) cria unique em codigo.

-- CreateEnum
CREATE TYPE "EspecieAnimal" AS ENUM ('BOVINO', 'CAPRINO');

-- AlterTable
ALTER TABLE "Raca" ADD COLUMN "codigo" TEXT;
ALTER TABLE "Raca" ADD COLUMN "especie" "EspecieAnimal" NOT NULL DEFAULT 'BOVINO';

-- Semeia raças puras. Se nome já existir (ex.: "Holandês" do seed antigo), preenche codigo+especie.
INSERT INTO "Raca" ("nome", "codigo", "especie") VALUES
  ('Holandês',           'HO', 'BOVINO'),
  ('Gir Leiteiro',       'GO', 'BOVINO'),
  ('Girolando',          'GL', 'BOVINO'),
  ('Jersey',             'JE', 'BOVINO'),
  ('Pardo Suíço',        'PS', 'BOVINO'),
  ('Sindi',              'SI', 'BOVINO'),
  ('Guzerá',             'GU', 'BOVINO'),
  ('Nelore',             'NE', 'BOVINO'),
  ('Angus',              'AN', 'BOVINO'),
  ('Brahman',            'BH', 'BOVINO'),
  ('Senepol',            'SN', 'BOVINO'),
  ('Tabapuã',            'TB', 'BOVINO'),
  ('Brangus',            'BG', 'BOVINO'),
  ('Caracu',             'CR', 'BOVINO'),
  ('Saanen',             'SA', 'CAPRINO'),
  ('Parda Alpina',       'PA', 'CAPRINO'),
  ('Anglo-Nubiana',      'AB', 'CAPRINO'),
  ('Toggenburg',         'TG', 'CAPRINO'),
  ('Boer',               'BO', 'CAPRINO'),
  ('Murciana-Granadina', 'MG', 'CAPRINO'),
  ('Canindé',            'CN', 'CAPRINO'),
  ('Moxotó',             'MX', 'CAPRINO'),
  ('Repartida',          'RP', 'CAPRINO'),
  ('Marota',             'MR', 'CAPRINO')
ON CONFLICT ("nome") DO UPDATE SET "codigo" = EXCLUDED."codigo", "especie" = EXCLUDED."especie";

-- Backfill grauSangue: pra animais cuja raça atual é "suja" (sem codigo após o upsert),
-- copia o texto da raça pro grauSangue (se ainda estava em branco).
UPDATE "Animal" a
SET "grauSangue" = r."nome"
FROM "Raca" r
WHERE a."racaId" = r."id"
  AND r."codigo" IS NULL
  AND (a."grauSangue" IS NULL OR a."grauSangue" = '');

-- Reaponta racaId pra raça pura primária extraída da string suja.
-- Padrões cobertos:
--   "Girolando 5/8" / "Girolando 1/2"   → Girolando
--   "5/8 GL, HO" / "1/2 GL, 1/4 HO, GO" → primeira sigla 2-letras após a fração
--   "Holandês" / "Gir Leiteiro" / etc.  → já têm codigo, ignorados pelo WHERE
UPDATE "Animal" a
SET "racaId" = (
  SELECT pr."id" FROM "Raca" pr WHERE pr."codigo" = (
    CASE
      WHEN r."nome" ~ '^\d+/\d+ ([A-Z]{2})' THEN substring(r."nome" from '^\d+/\d+ ([A-Z]{2})')
      WHEN r."nome" ILIKE 'Girolando%'   THEN 'GL'
      WHEN r."nome" ILIKE 'Holandês%'    THEN 'HO'
      WHEN r."nome" ILIKE 'Holandes%'    THEN 'HO'
      WHEN r."nome" ILIKE 'Gir Leiteiro%' THEN 'GO'
      WHEN r."nome" ILIKE 'Gir %'        THEN 'GO'
      WHEN r."nome" ILIKE 'Nelore%'      THEN 'NE'
      WHEN r."nome" ILIKE 'Jersey%'      THEN 'JE'
      ELSE NULL
    END
  )
)
FROM "Raca" r
WHERE a."racaId" = r."id" AND r."codigo" IS NULL;

-- Remove raças sujas que ficaram órfãs (sem nenhum animal apontando).
DELETE FROM "Raca"
WHERE "codigo" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "Animal" WHERE "racaId" = "Raca"."id");

-- CreateIndex
CREATE UNIQUE INDEX "Raca_codigo_key" ON "Raca"("codigo");
