CREATE TABLE pecuaria."DecisaoOperacionalAcompanhamento" (
 id text PRIMARY KEY, "versaoAnterior" integer NOT NULL CHECK("versaoAnterior">0),
 "demandaId" text NOT NULL REFERENCES pecuaria."DemandaAcompanhamentoReprodutivo"(id) ON DELETE RESTRICT,
 "necessidadeId" text NOT NULL REFERENCES pecuaria."NecessidadeReprodutiva"(id) ON DELETE RESTRICT,
 chave text NOT NULL, tipo text NOT NULL CHECK(tipo IN ('REAGENDAR','SUSPENDER','DISPENSAR')),
 data date, destino text, motivo text NOT NULL CHECK(length(btrim(motivo)) BETWEEN 5 AND 1000),
 "usuarioId" integer NOT NULL REFERENCES public."Usuario"(id), "criadoEm" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE("demandaId",chave),
 CHECK((tipo='DISPENSAR' AND data IS NULL AND destino IS NULL) OR (tipo IN ('REAGENDAR','SUSPENDER') AND data IS NOT NULL AND destino IS NOT NULL AND length(btrim(destino)) BETWEEN 2 AND 500))
);
ALTER TABLE pecuaria."DemandaAcompanhamentoReprodutivo" ADD COLUMN "decisaoOperacionalId" text UNIQUE REFERENCES pecuaria."DecisaoOperacionalAcompanhamento"(id) ON DELETE RESTRICT;
CREATE TRIGGER "DecisaoOperacionalAcompanhamento_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."DecisaoOperacionalAcompanhamento" FOR EACH ROW EXECUTE FUNCTION pecuaria.impedir_edicao_politica_acompanhamento();
CREATE FUNCTION pecuaria.validar_decisao_operacional_acompanhamento() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='DecisaoOperacionalAcompanhamento' THEN
  IF NOT EXISTS(SELECT 1 FROM pecuaria."NecessidadeReprodutiva" n JOIN pecuaria."DemandaAcompanhamentoReprodutivo" d ON d.id=n."demandaId"
   WHERE n.id=NEW."necessidadeId" AND d.id=NEW."demandaId" AND d.estado='PENDENTE' AND d.versao=NEW."versaoAnterior" AND n."convergidaParaId" IS NULL
   AND NOT EXISTS(SELECT 1 FROM pecuaria."DecisaoOperacionalAcompanhamento" anterior WHERE anterior.id=d."decisaoOperacionalId" AND anterior.tipo='DISPENSAR'))
  THEN RAISE EXCEPTION 'decisão exige cuidado atual e demanda factual pendente' USING ERRCODE='23514'; END IF;
 ELSE
  IF TG_OP='UPDATE' AND OLD."decisaoOperacionalId" IS NOT NULL AND NEW."decisaoOperacionalId" IS NULL
   THEN RAISE EXCEPTION 'decisão operacional não pode desaparecer' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND NEW."decisaoOperacionalId" IS DISTINCT FROM OLD."decisaoOperacionalId" AND NOT EXISTS (
   SELECT 1 FROM pecuaria."DecisaoOperacionalAcompanhamento" o WHERE o.id=NEW."decisaoOperacionalId" AND o."demandaId"=NEW.id AND o."versaoAnterior"=OLD.versao AND NEW.versao=OLD.versao+1
  ) THEN RAISE EXCEPTION 'troca de decisão exige nova versão operacional explícita' USING ERRCODE='23514'; END IF;
  IF NEW."decisaoOperacionalId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."DecisaoOperacionalAcompanhamento" o WHERE o.id=NEW."decisaoOperacionalId" AND o."demandaId"=NEW.id)
   THEN RAISE EXCEPTION 'decisão operacional pertence a outra demanda' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "DecisaoOperacionalAcompanhamento_validar" BEFORE INSERT ON pecuaria."DecisaoOperacionalAcompanhamento" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_decisao_operacional_acompanhamento();
CREATE TRIGGER "DemandaAcompanhamento_decisao_operacional" BEFORE INSERT OR UPDATE ON pecuaria."DemandaAcompanhamentoReprodutivo" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_decisao_operacional_acompanhamento();
