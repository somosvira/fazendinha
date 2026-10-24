BEGIN;
-- Reconhece a natureza de um fato histórico já existente; não altera o consumo.
ALTER TABLE pecuaria."AplicacaoProduto" ADD COLUMN "insercaoDispositivoSnapshot" JSONB;
ALTER TABLE pecuaria."AplicacaoProduto" ADD CONSTRAINT "AplicacaoProduto_insercao_documentada" CHECK ("insercaoDispositivoSnapshot" IS NULL OR (
 jsonb_typeof("insercaoDispositivoSnapshot")='object' AND "insercaoDispositivoSnapshot"->>'versao'='1'
 AND length(trim("insercaoDispositivoSnapshot"->>'motivo'))>=5 AND length(trim("insercaoDispositivoSnapshot"->>'evidencia'))>=5
 AND "insercaoDispositivoSnapshot" ?& ARRAY['usuarioId','registradoEm']));
CREATE FUNCTION pecuaria.proteger_reconhecimento_insercao() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD."insercaoDispositivoSnapshot" IS NOT NULL AND NEW."insercaoDispositivoSnapshot" IS DISTINCT FROM OLD."insercaoDispositivoSnapshot" THEN RAISE EXCEPTION 'Reconhecimento da inserção é histórico imutável; anule o fato se incorreto'; END IF;
 IF NEW."insercaoDispositivoSnapshot" IS DISTINCT FROM OLD."insercaoDispositivoSnapshot" AND NEW.status<>'VALIDO' THEN RAISE EXCEPTION 'Somente aplicação válida pode ser reconhecida como inserção'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "AplicacaoProduto_insercao_historico" BEFORE UPDATE ON pecuaria."AplicacaoProduto" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_reconhecimento_insercao();
CREATE OR REPLACE FUNCTION pecuaria.conferir_manejo_protocolar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE insercao RECORD; servico RECORD; atribuicao NUMERIC; participacao RECORD;
BEGIN
 IF TG_OP='UPDATE' AND (NEW."animalId",NEW.tipo,NEW."tarefaId",NEW."criadoPorId",NEW.data,NEW."realizadaEm",NEW."precisaoTemporal",NEW."insercaoAplicacaoId") IS DISTINCT FROM (OLD."animalId",OLD.tipo,OLD."tarefaId",OLD."criadoPorId",OLD.data,OLD."realizadaEm",OLD."precisaoTemporal",OLD."insercaoAplicacaoId") THEN
  RAISE EXCEPTION 'Retifique o manejo criando fato substituto; identidade e realização são imutáveis';
 END IF;
 IF NEW.tipo NOT IN ('PROTOCOLAR','RETIRADA_DISPOSITIVO') THEN RETURN NEW; END IF;
 SELECT p.* INTO participacao FROM pecuaria."TarefaProtocolo" t JOIN pecuaria."ParticipacaoProtocolo" p ON p.id=t."participacaoId" JOIN pecuaria."EtapaProtocolo" e ON e.id=t."etapaId"
 WHERE t.id=NEW."tarefaId" AND p."animalId"=NEW."animalId" AND e.tipo=CASE WHEN NEW.tipo='PROTOCOLAR' THEN 'MANEJO' ELSE 'RETIRADA' END;
 IF participacao.id IS NULL THEN RAISE EXCEPTION 'Manejo incompatível com animal e ação da tarefa'; END IF;
 IF NEW."precisaoTemporal"='HORA' AND (NEW."realizadaEm" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date <> NEW.data THEN RAISE EXCEPTION 'Dia e instante do manejo divergem'; END IF;
 IF NEW.tipo='RETIRADA_DISPOSITIVO' AND (NEW.status='VALIDO' OR NEW."realizacaoMantida") THEN
  SELECT a.*,e.configuracao INTO insercao FROM pecuaria."AplicacaoProduto" a LEFT JOIN pecuaria."TarefaProtocolo" t ON t.id=a."tarefaId" LEFT JOIN pecuaria."EtapaProtocolo" e ON e.id=t."etapaId" WHERE a.id=NEW."insercaoAplicacaoId" AND a."animalId"=NEW."animalId" AND a.status='VALIDO' AND (e.tipo='APLICACAO' AND e.configuracao->>'subtipo'='INSERCAO_DISPOSITIVO' OR a."insercaoDispositivoSnapshot" IS NOT NULL) FOR UPDATE OF a;
  IF insercao.id IS NULL THEN RAISE EXCEPTION 'Retirada exige inserção válida e explicitamente configurada do mesmo animal'; END IF;
  IF NEW.data<insercao.data OR (NEW.data=insercao.data AND NEW."precisaoTemporal"='HORA' AND insercao."precisaoTemporal"='HORA' AND NEW."realizadaEm"<insercao."aplicadaEm") THEN RAISE EXCEPTION 'Retirada anterior à inserção'; END IF;
 END IF;
 IF NEW."operacaoServicoId" IS NOT NULL THEN
  SELECT * INTO servico FROM public."Operacao" o WHERE o.id=NEW."operacaoServicoId" FOR UPDATE;
  IF servico.tipo<>'SERVICO' OR servico.status<>'CONFIRMADA' OR servico."propriedadeId"<>NEW."propriedadeId" OR servico.data>NEW.data THEN RAISE EXCEPTION 'Serviço incompatível com manejo'; END IF;
  IF participacao."operacaoServicoId" IS NOT NULL AND participacao."operacaoServicoId"<>servico.id THEN RAISE EXCEPTION 'Serviço diverge da participação'; END IF;
  IF NEW."valorServicoAtribuido" IS NOT NULL AND participacao."valorServicoAtribuido" IS NOT NULL THEN RAISE EXCEPTION 'Valor já atribuído ao protocolo'; END IF;
  SELECT COALESCE((SELECT sum("valorServicoAtribuido") FROM pecuaria."AplicacaoProduto" WHERE "operacaoServicoId"=servico.id AND (status='VALIDO' OR "consumoMantido")),0)
   +COALESCE((SELECT sum("valorServicoAtribuido") FROM pecuaria."ExameAnimal" WHERE "operacaoServicoId"=servico.id AND status='VALIDO'),0)
   +COALESCE((SELECT sum("valorServicoAtribuido") FROM pecuaria."ParticipacaoProtocolo" WHERE "operacaoServicoId"=servico.id),0)
   +COALESCE((SELECT sum("valorServicoAtribuido") FROM pecuaria."TentativaReprodutiva" WHERE "operacaoServicoId"=servico.id AND (status='VALIDO' OR "consumoMantido")),0)
   +COALESCE((SELECT sum("valorServicoAtribuido") FROM pecuaria."ManejoAnimal" WHERE "operacaoServicoId"=servico.id AND id<>NEW.id AND (status='VALIDO' OR "realizacaoMantida")),0)
   INTO atribuicao;
  IF atribuicao+(CASE WHEN NEW.status='VALIDO' OR NEW."realizacaoMantida" THEN COALESCE(NEW."valorServicoAtribuido",0) ELSE 0 END)>servico."valorTotal" THEN RAISE EXCEPTION 'Atribuição excede o Serviço confirmado'; END IF;
 END IF;
 RETURN NEW;
END $$;
COMMIT;
