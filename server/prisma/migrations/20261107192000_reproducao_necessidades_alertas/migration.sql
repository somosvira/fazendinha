CREATE TABLE pecuaria."PoliticaAtencaoReprodutiva" (
 id text PRIMARY KEY, "propriedadeId" integer NOT NULL REFERENCES public."Propriedade"(id), versao integer NOT NULL CHECK (versao>0), "vigenteDesde" date NOT NULL, parametros jsonb NOT NULL,
 "criadoPorId" integer NOT NULL REFERENCES public."Usuario"(id), "criadoEm" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("propriedadeId",versao), UNIQUE ("propriedadeId","vigenteDesde")
);
CREATE TRIGGER "PoliticaAtencaoReprodutiva_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."PoliticaAtencaoReprodutiva" FOR EACH ROW EXECUTE FUNCTION pecuaria.impedir_edicao_politica_acompanhamento();
CREATE TABLE pecuaria."NecessidadeReprodutiva" (
 id text PRIMARY KEY, chave text NOT NULL UNIQUE, tipo text NOT NULL CHECK (tipo IN ('DISPOSITIVO_SEM_RETIRADA','ETAPA_VENCIDA','TENTATIVA_APOS_PREPARO','AGENDAMENTO_INCOMPLETO','DG_VENCIDO','RECONFIRMACAO_VENCIDA','RETORNO_VENCIDO','APTA_SEM_ENCAMINHAMENTO','AVALIACAO_NECESSARIA','AVALIACAO_DESATUALIZADA')), "origemId" text NOT NULL,
 "animalId" text NOT NULL REFERENCES pecuaria."Animal"(id), "propriedadeId" integer NOT NULL REFERENCES public."Propriedade"(id),
 "tarefaId" text UNIQUE REFERENCES pecuaria."TarefaProtocolo"(id), "demandaId" text UNIQUE REFERENCES pecuaria."DemandaAcompanhamentoReprodutivo"(id),
 "participacaoId" text REFERENCES pecuaria."ParticipacaoProtocolo"(id), "alertaId" text UNIQUE REFERENCES public."Alerta"(id),
 "dataReferencia" date NOT NULL, "previstaPara" date, "regraSnapshot" jsonb NOT NULL,
 situacao text NOT NULL, motivo text NOT NULL, revisao integer NOT NULL DEFAULT 1 CHECK (revisao>0),
 decisao text CHECK (decisao IN ('REAGENDAR','DISPENSAR','RETIRAR','SUSPENDER')), "decisaoMotivo" text, "decisaoDestino" text, "revisaoEm" date,
 "decisaoPorId" integer REFERENCES public."Usuario"(id), "criadoEm" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "atualizadoEm" timestamp(3) NOT NULL,
 CHECK (situacao IN ('PROXIMO','PENDENTE','ATRASADO','PLANEJAMENTO_PENDENTE','ADIADO','SUSPENSO','RESOLVIDO','ENCERRADO','DISPENSADO')),
 CHECK ((decisao IS NULL AND "decisaoMotivo" IS NULL AND "decisaoPorId" IS NULL) OR (decisao IS NOT NULL AND "decisaoMotivo" IS NOT NULL AND length(btrim("decisaoMotivo")) BETWEEN 5 AND 1000 AND "decisaoPorId" IS NOT NULL AND "decisaoPorId">0)),
 CHECK (decisao IS NULL OR decisao NOT IN ('REAGENDAR','SUSPENDER') OR ("revisaoEm" IS NOT NULL AND "decisaoDestino" IS NOT NULL AND length(btrim("decisaoDestino")) BETWEEN 2 AND 500))
);
CREATE INDEX "NecessidadeReprodutiva_animalId_situacao_idx" ON pecuaria."NecessidadeReprodutiva"("animalId",situacao);
CREATE INDEX "NecessidadeReprodutiva_propriedadeId_situacao_previstaPara_idx" ON pecuaria."NecessidadeReprodutiva"("propriedadeId",situacao,"previstaPara");
CREATE OR REPLACE FUNCTION pecuaria.validar_necessidade_reprodutiva() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."tarefaId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pecuaria."TarefaProtocolo" t JOIN pecuaria."ParticipacaoProtocolo" p ON p.id=t."participacaoId" WHERE t.id=NEW."tarefaId" AND p."animalId"=NEW."animalId" AND p.id=NEW."participacaoId") THEN RAISE EXCEPTION 'Tarefa incompatível com necessidade reprodutiva' USING ERRCODE='23514'; END IF;
 IF NEW."demandaId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pecuaria."DemandaAcompanhamentoReprodutivo" d WHERE d.id=NEW."demandaId" AND d."animalId"=NEW."animalId") THEN RAISE EXCEPTION 'Demanda incompatível com animal' USING ERRCODE='23514'; END IF;
 IF NEW."alertaId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."Alerta" a WHERE a.id=NEW."alertaId" AND a.produtor='reproducao' AND a."chaveOcorrencia"=NEW.chave AND a."sujeitoId"=NEW."animalId") THEN RAISE EXCEPTION 'Alerta incompatível com necessidade reprodutiva' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "NecessidadeReprodutiva_validar" BEFORE INSERT OR UPDATE ON pecuaria."NecessidadeReprodutiva" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_necessidade_reprodutiva();
