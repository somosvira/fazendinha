-- Duas projeções que passam a representar o mesmo cuidado conservam seus IDs e alertas.
ALTER TABLE pecuaria."NecessidadeReprodutiva"
 ADD COLUMN "convergidaParaId" text REFERENCES pecuaria."NecessidadeReprodutiva"(id) ON DELETE RESTRICT,
 ADD COLUMN "convergenciaSnapshot" jsonb,
 ADD CONSTRAINT "NecessidadeReprodutiva_convergencia_formato" CHECK (
  ("convergidaParaId" IS NULL AND "convergenciaSnapshot" IS NULL) OR
  ("convergidaParaId" IS NOT NULL AND "convergidaParaId"<>id AND situacao='ENCERRADO'
   AND "tarefaId" IS NULL AND "demandaId" IS NULL AND "convergenciaSnapshot" IS NOT NULL
   AND jsonb_typeof("convergenciaSnapshot")='object'
   AND coalesce("convergenciaSnapshot"->>'versao'='1',false)
   AND coalesce("convergenciaSnapshot"->'origem'->>'id'=id,false)
   AND coalesce("convergenciaSnapshot"->'destino'->>'id'="convergidaParaId",false))
 );
CREATE INDEX "NecessidadeReprodutiva_convergidaParaId_idx" ON pecuaria."NecessidadeReprodutiva"("convergidaParaId");
CREATE FUNCTION pecuaria.proteger_convergencia_necessidade() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND OLD."convergidaParaId" IS NOT NULL THEN
  RAISE EXCEPTION 'identidade convergida preserva seu histórico' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' AND OLD."convergidaParaId" IS NOT NULL AND NOT (
  OLD."alertaId" IS NULL AND NEW."alertaId" IS NOT NULL
  AND (to_jsonb(NEW)-'alertaId'-'atualizadoEm')=(to_jsonb(OLD)-'alertaId'-'atualizadoEm')
 ) AND NEW IS DISTINCT FROM OLD THEN
  RAISE EXCEPTION 'convergência registrada é imutável' USING ERRCODE='23514';
 END IF;
 IF TG_OP<>'DELETE' AND NEW."convergidaParaId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM pecuaria."NecessidadeReprodutiva" n WHERE n.id=NEW."convergidaParaId"
   AND n."animalId"=NEW."animalId" AND n."convergidaParaId" IS NULL
 ) THEN RAISE EXCEPTION 'convergência exige identidade atual do mesmo animal' USING ERRCODE='23514'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER "NecessidadeReprodutiva_convergencia_protegida" BEFORE INSERT OR UPDATE OR DELETE ON pecuaria."NecessidadeReprodutiva" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_convergencia_necessidade();
