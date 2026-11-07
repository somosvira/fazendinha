CREATE FUNCTION pecuaria.proteger_prazo_visita() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW."politicaId", NEW."previstaPara", NEW."regraSnapshot") IS DISTINCT FROM (OLD."politicaId", OLD."previstaPara", OLD."regraSnapshot") AND EXISTS (
  SELECT 1 FROM pecuaria."ParticipanteVisita" p
  JOIN pecuaria."AtividadeVisita" a ON a.id=p."atividadeId"
  JOIN pecuaria."VisitaVeterinaria" v ON v.id=a."visitaId"
  WHERE p."animalId"=OLD."animalId" AND p.status='PENDENTE' AND p.snapshot->'acompanhamento'->>'id'=OLD.id
    AND v."propriedadeId"=OLD."propriedadeOrigemId" AND v."encerradaEm" IS NULL
 ) THEN RAISE EXCEPTION 'prazo de demanda agendada em visita deve ser preservado' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "DemandaAcompanhamento_preservar_visita" BEFORE UPDATE OF "politicaId", "previstaPara", "regraSnapshot" ON pecuaria."DemandaAcompanhamentoReprodutivo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_prazo_visita();
