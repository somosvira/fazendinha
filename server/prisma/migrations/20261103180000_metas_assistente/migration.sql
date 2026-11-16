-- Definições e medições append-only, sem carga de metas referenciais.
CREATE TABLE public."EventoMetaAssistente" (
 "metaId" uuid NOT NULL,
 "revisao" integer NOT NULL CHECK ("revisao" > 0),
 "operacaoId" uuid NOT NULL UNIQUE,
 "hashPedido" text NOT NULL,
 "propriedadeId" integer NOT NULL REFERENCES public."Propriedade"("id") ON DELETE RESTRICT,
 "usuarioId" integer NOT NULL REFERENCES public."Usuario"("id") ON DELETE RESTRICT,
 "dominio" text NOT NULL CHECK ("dominio" IN ('pecuaria','financeiro')),
 "tipo" text NOT NULL CHECK ("tipo" IN ('definicao','medicao')),
 "conteudo" jsonb NOT NULL CHECK (jsonb_typeof("conteudo") = 'object'),
 "criadoEm" timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY ("metaId", "revisao")
);
CREATE INDEX "EventoMetaAssistente_escopo_idx" ON public."EventoMetaAssistente" ("propriedadeId", "dominio", "metaId", "revisao" DESC);
CREATE FUNCTION public."protegerEventoMetaAssistente"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Histórico de metas é imutável'; END; $$;
CREATE TRIGGER "EventoMetaAssistente_imutavel" BEFORE UPDATE OR DELETE ON public."EventoMetaAssistente" FOR EACH ROW EXECUTE FUNCTION public."protegerEventoMetaAssistente"();
-- A sequência e o escopo permanecem estáveis mesmo em escritas SQL externas.
CREATE FUNCTION public."validarSequenciaMetaAssistente"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE anterior public."EventoMetaAssistente"%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW."metaId"::text, 0));
 SELECT * INTO anterior FROM public."EventoMetaAssistente" WHERE "metaId"=NEW."metaId" ORDER BY "revisao" DESC LIMIT 1;
 IF FOUND THEN
  IF NEW."revisao" <> anterior."revisao"+1 OR NEW."propriedadeId" <> anterior."propriedadeId" OR NEW."dominio" <> anterior."dominio" THEN RAISE EXCEPTION 'Sequência ou escopo da meta inválido'; END IF;
 ELSE
  IF NEW."revisao" <> 1 OR NEW."tipo" <> 'definicao' THEN RAISE EXCEPTION 'Meta deve iniciar pela definição'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "EventoMetaAssistente_sequencia" BEFORE INSERT ON public."EventoMetaAssistente" FOR EACH ROW EXECUTE FUNCTION public."validarSequenciaMetaAssistente"();
