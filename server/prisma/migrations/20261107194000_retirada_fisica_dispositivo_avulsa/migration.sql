CREATE OR REPLACE FUNCTION pecuaria.conferir_manejo_protocolar() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE insercao RECORD; servico RECORD; atribuicao NUMERIC; participacao RECORD;
BEGIN
 IF TG_OP='UPDATE' AND (NEW."animalId",NEW.tipo,NEW."tarefaId",NEW."criadoPorId",NEW.data,NEW."realizadaEm",NEW."precisaoTemporal",NEW."insercaoAplicacaoId") IS DISTINCT FROM (OLD."animalId",OLD.tipo,OLD."tarefaId",OLD."criadoPorId",OLD.data,OLD."realizadaEm",OLD."precisaoTemporal",OLD."insercaoAplicacaoId") THEN
  RAISE EXCEPTION 'Retifique o manejo criando fato substituto; identidade e realização são imutáveis';
 END IF;
 IF NEW.tipo NOT IN ('PROTOCOLAR','RETIRADA_DISPOSITIVO') THEN RETURN NEW; END IF;
 SELECT p.* INTO participacao FROM pecuaria."TarefaProtocolo" t JOIN pecuaria."ParticipacaoProtocolo" p ON p.id=t."participacaoId" JOIN pecuaria."EtapaProtocolo" e ON e.id=t."etapaId"
 WHERE t.id=NEW."tarefaId" AND p."animalId"=NEW."animalId" AND e.tipo=CASE WHEN NEW.tipo='PROTOCOLAR' THEN 'MANEJO' ELSE 'RETIRADA' END;
 IF participacao.id IS NULL AND (NEW.tipo<>'RETIRADA_DISPOSITIVO' OR NEW."tarefaId" IS NOT NULL) THEN RAISE EXCEPTION 'Manejo incompatível com animal e ação da tarefa'; END IF;
 IF NEW."precisaoTemporal"='HORA' AND (NEW."realizadaEm" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date <> NEW.data THEN RAISE EXCEPTION 'Dia e instante do manejo divergem'; END IF;
 IF NEW.tipo='RETIRADA_DISPOSITIVO' AND (NEW.status='VALIDO' OR NEW."realizacaoMantida") THEN
  SELECT a.*,e.configuracao INTO insercao FROM pecuaria."AplicacaoProduto" a LEFT JOIN pecuaria."TarefaProtocolo" t ON t.id=a."tarefaId" LEFT JOIN pecuaria."EtapaProtocolo" e ON e.id=t."etapaId" WHERE a.id=NEW."insercaoAplicacaoId" AND a."animalId"=NEW."animalId" AND (a.status='VALIDO' OR a."consumoMantido" AND a."administracaoMantida" IS DISTINCT FROM false) AND (e.tipo='APLICACAO' AND e.configuracao->>'subtipo'='INSERCAO_DISPOSITIVO' OR a."insercaoDispositivoSnapshot" IS NOT NULL) FOR UPDATE OF a;
  IF insercao.id IS NULL THEN RAISE EXCEPTION 'Retirada exige inserção válida e explicitamente configurada do mesmo animal'; END IF;
  IF NEW.data<insercao.data OR (NEW.data=insercao.data AND NEW."precisaoTemporal"='HORA' AND insercao."precisaoTemporal"='HORA' AND NEW."realizadaEm"<insercao."aplicadaEm") THEN RAISE EXCEPTION 'Retirada anterior à inserção'; END IF;
 END IF;
 IF NEW."operacaoServicoId" IS NOT NULL THEN
  SELECT * INTO servico FROM public."Operacao" o WHERE o.id=NEW."operacaoServicoId" FOR UPDATE;
  IF servico.tipo IS DISTINCT FROM 'SERVICO' OR servico.status IS DISTINCT FROM 'CONFIRMADA' OR servico."propriedadeId" IS DISTINCT FROM NEW."propriedadeId" OR servico.data>NEW.data THEN RAISE EXCEPTION 'Serviço incompatível com manejo'; END IF;
  IF participacao."operacaoServicoId" IS NOT NULL AND participacao."operacaoServicoId"<>servico.id THEN RAISE EXCEPTION 'Serviço diverge da participação'; END IF;
  IF NEW."valorServicoAtribuido" IS NOT NULL AND participacao."valorServicoAtribuido" IS NOT NULL THEN RAISE EXCEPTION 'Valor já atribuído ao protocolo'; END IF;
  SELECT COALESCE((SELECT sum("valorServicoAtribuido") FROM pecuaria."AplicacaoProduto" WHERE "operacaoServicoId"=servico.id AND (status='VALIDO' OR "consumoMantido")),0)
   +COALESCE((SELECT sum("valorServicoAtribuido") FROM pecuaria."ExameAnimal" WHERE "operacaoServicoId"=servico.id AND status='VALIDO' AND realizacao<>'NAO_REALIZADO'),0)
   +COALESCE((SELECT sum("valorServicoAtribuido") FROM pecuaria."ParticipacaoProtocolo" WHERE "operacaoServicoId"=servico.id),0)
   +COALESCE((SELECT sum("valorServicoAtribuido") FROM pecuaria."TentativaReprodutiva" WHERE "operacaoServicoId"=servico.id AND (status='VALIDO' OR "consumoMantido")),0)
   +COALESCE((SELECT sum("valorServicoAtribuido") FROM pecuaria."ManejoAnimal" WHERE "operacaoServicoId"=servico.id AND id<>NEW.id AND (status='VALIDO' OR "realizacaoMantida")),0)
   INTO atribuicao;
  IF atribuicao+(CASE WHEN NEW.status='VALIDO' OR NEW."realizacaoMantida" THEN COALESCE(NEW."valorServicoAtribuido",0) ELSE 0 END)>servico."valorTotal" THEN RAISE EXCEPTION 'Atribuição excede o Serviço confirmado'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION pecuaria.proteger_insercao_retirada() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM pecuaria."ManejoAnimal" m WHERE m."insercaoAplicacaoId"=NEW.id AND (m.status='VALIDO' OR m."realizacaoMantida") AND (NOT (NEW.status='VALIDO' OR NEW."consumoMantido" AND NEW."administracaoMantida" IS DISTINCT FROM false) OR NEW."animalId"<>m."animalId" OR NEW.data>m.data OR (NEW.data=m.data AND NEW."precisaoTemporal"='HORA' AND m."precisaoTemporal"='HORA' AND NEW."aplicadaEm">m."realizadaEm"))) THEN RAISE EXCEPTION 'Revise a retirada vinculada antes de alterar ou anular a inserção'; END IF;
 RETURN NEW;
END $$;

ALTER TABLE pecuaria."ManejoAnimal" DROP CONSTRAINT "ManejoAnimal_protocolo_check";
ALTER TABLE pecuaria."ManejoAnimal" ADD CONSTRAINT "ManejoAnimal_protocolo_check" CHECK (
 (tipo IN ('DESMAMA','CASTRACAO') AND "tarefaId" IS NULL AND "insercaoAplicacaoId" IS NULL)
 OR (tipo IN ('PROTOCOLAR','RETIRADA_DISPOSITIVO') AND "propriedadeId" IS NOT NULL
  AND (("precisaoTemporal"='DIA' AND "realizadaEm" IS NULL) OR ("precisaoTemporal"='HORA' AND "realizadaEm" IS NOT NULL))
  AND ((tipo='RETIRADA_DISPOSITIVO' AND "insercaoAplicacaoId" IS NOT NULL AND ("tarefaId" IS NOT NULL OR "criadoPorId" IS NOT NULL))
    OR (tipo='PROTOCOLAR' AND "tarefaId" IS NOT NULL AND "insercaoAplicacaoId" IS NULL)))
);
