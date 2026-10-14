BEGIN;
LOCK TABLE pecuaria."DestinoAnimal", pecuaria."PeriodoReprodutivoAnimal" IN ACCESS EXCLUSIVE MODE;

ALTER TABLE pecuaria."PeriodoReprodutivoAnimal"
  ADD COLUMN "destinoOrigemId" TEXT,
  ADD COLUMN "encerradoPorDestinoId" TEXT,
  ADD COLUMN "fimAntesDaMudanca" DATE,
  ADD COLUMN "proveniencia" JSONB,
  ADD COLUMN "revogadoEm" TIMESTAMP(3),
  ADD COLUMN "motivoRevogacao" TEXT;
ALTER TABLE pecuaria."PeriodoReprodutivoAnimal" DROP CONSTRAINT "PeriodoReprodutivoAnimal_tipo_check";
ALTER TABLE pecuaria."PeriodoReprodutivoAnimal" ADD CONSTRAINT "PeriodoReprodutivoAnimal_tipo_check" CHECK ("tipo" IN ('NENHUM','DOADORA','RECEPTORA'));
CREATE UNIQUE INDEX "PeriodoReprodutivoAnimal_destinoOrigemId_key" ON pecuaria."PeriodoReprodutivoAnimal"("destinoOrigemId");

-- Mantém cada evidência e seus limites; sobreposições divergentes são expostas para conciliação,
-- nunca resolvidas pela ordem de escrita. A chave original continua disponível no mapa de origem.
INSERT INTO pecuaria."PeriodoReprodutivoAnimal"
  (id, "animalId", tipo, inicio, fim, origem, "criadoEm", "criadoPorId", "destinoOrigemId", proveniencia)
SELECT CASE WHEN EXISTS (SELECT 1 FROM pecuaria."PeriodoReprodutivoAnimal" p WHERE p.id = d.id)
         THEN 'destino-legado:' || d.id ELSE d.id END,
       d."animalId", d."papelReprodutivo"::text, d.desde, d.ate, 'DESTINO_LEGADO', d."criadoEm", d."criadoPorId", d.id,
       jsonb_build_object('entidade', 'DestinoAnimal', 'registro', to_jsonb(d))
FROM pecuaria."DestinoAnimal" d;

DO $$ BEGIN
  IF (SELECT count(*) FROM pecuaria."DestinoAnimal") <>
     (SELECT count(*) FROM pecuaria."PeriodoReprodutivoAnimal" WHERE "destinoOrigemId" IS NOT NULL)
  THEN RAISE EXCEPTION 'Migração de papéis incompleta; nenhum campo será retirado'; END IF;
END $$;
-- Os valores originais estão nas evidências com proveniência; aptidão conserva seu próprio histórico.
ALTER TABLE pecuaria."DestinoAnimal" DROP COLUMN "papelReprodutivo";
COMMIT;
