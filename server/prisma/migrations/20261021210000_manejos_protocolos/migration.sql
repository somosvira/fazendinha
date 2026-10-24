BEGIN;
ALTER TABLE pecuaria."ManejoAnimal"
 ADD COLUMN "tarefaId" TEXT REFERENCES pecuaria."TarefaProtocolo"(id) ON DELETE RESTRICT,
 ADD COLUMN "realizadaEm" TIMESTAMP(3),
 ADD COLUMN "precisaoTemporal" pecuaria."PrecisaoCalendarioProtocolo" NOT NULL DEFAULT 'DIA',
 ADD COLUMN "criadoPorId" INTEGER REFERENCES public."Usuario"(id) ON DELETE RESTRICT,
 ADD COLUMN "insercaoAplicacaoId" TEXT REFERENCES pecuaria."AplicacaoProduto"(id) ON DELETE RESTRICT,
 ADD COLUMN "operacaoServicoId" TEXT REFERENCES public."Operacao"(id) ON DELETE RESTRICT,
 ADD COLUMN "valorServicoAtribuido" NUMERIC(14,2),
 ADD COLUMN "realizacaoMantida" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pecuaria."ManejoAnimal" DROP CONSTRAINT "ManejoAnimal_tipo_check";
ALTER TABLE pecuaria."ManejoAnimal" ADD CONSTRAINT "ManejoAnimal_tipo_check" CHECK (tipo IN ('DESMAMA','CASTRACAO','PROTOCOLAR','RETIRADA_DISPOSITIVO'));
ALTER TABLE pecuaria."ManejoAnimal" ADD CONSTRAINT "ManejoAnimal_protocolo_check" CHECK (
 (tipo IN ('DESMAMA','CASTRACAO') AND "tarefaId" IS NULL AND "insercaoAplicacaoId" IS NULL)
 OR (tipo IN ('PROTOCOLAR','RETIRADA_DISPOSITIVO') AND "tarefaId" IS NOT NULL AND "propriedadeId" IS NOT NULL
  AND (("precisaoTemporal"='DIA' AND "realizadaEm" IS NULL) OR ("precisaoTemporal"='HORA' AND "realizadaEm" IS NOT NULL))
  AND ((tipo='RETIRADA_DISPOSITIVO' AND "insercaoAplicacaoId" IS NOT NULL) OR (tipo='PROTOCOLAR' AND "insercaoAplicacaoId" IS NULL))));
ALTER TABLE pecuaria."ManejoAnimal" ADD CONSTRAINT "ManejoAnimal_servico_valor_check" CHECK (
 "valorServicoAtribuido" IS NULL OR ("valorServicoAtribuido">=0 AND "operacaoServicoId" IS NOT NULL));
ALTER TABLE pecuaria."ManejoAnimal" ADD CONSTRAINT "ManejoAnimal_realizacao_mantida_check" CHECK (NOT "realizacaoMantida" OR status='ANULADO');
DROP INDEX pecuaria."ManejoAnimal_unico_valido";
CREATE UNIQUE INDEX "ManejoAnimal_unico_valido" ON pecuaria."ManejoAnimal"("animalId",tipo) WHERE status='VALIDO' AND tipo IN ('DESMAMA','CASTRACAO');
CREATE UNIQUE INDEX "ManejoAnimal_tarefa_valida" ON pecuaria."ManejoAnimal"("tarefaId") WHERE status='VALIDO' OR "realizacaoMantida";
CREATE UNIQUE INDEX "ManejoAnimal_retirada_unica" ON pecuaria."ManejoAnimal"("insercaoAplicacaoId") WHERE status='VALIDO' OR "realizacaoMantida";
ALTER TABLE pecuaria."VinculoTarefaProtocolo" ADD COLUMN "manejoId" TEXT UNIQUE REFERENCES pecuaria."ManejoAnimal"(id) ON DELETE RESTRICT;
ALTER TABLE pecuaria."VinculoTarefaProtocolo" DROP CONSTRAINT "VinculoTarefaProtocolo_check";
ALTER TABLE pecuaria."VinculoTarefaProtocolo" ADD CONSTRAINT "VinculoTarefaProtocolo_check" CHECK (num_nonnulls("aplicacaoId","exameId","tentativaId","manejoId")=1);
ALTER TABLE pecuaria."ClassificacaoCustoPecuaria" ADD COLUMN "manejoId" TEXT UNIQUE REFERENCES pecuaria."ManejoAnimal"(id) ON DELETE RESTRICT;
ALTER TABLE pecuaria."ClassificacaoCustoPecuaria" DROP CONSTRAINT "ClassificacaoCusto_um_fato";
ALTER TABLE pecuaria."ClassificacaoCustoPecuaria" ADD CONSTRAINT "ClassificacaoCusto_um_fato" CHECK (num_nonnulls("tentativaId","aplicacaoId","exameId","participacaoId","participacaoConsumoId","manejoId")=1);

CREATE OR REPLACE FUNCTION pecuaria.conferir_vinculo_tarefa() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE dono TEXT; tarefa_fato TEXT; tipo_fato TEXT; situacao TEXT;
BEGIN
 IF TG_OP='UPDATE' AND (NEW."tarefaId",NEW.ordem,NEW."aplicacaoId",NEW."exameId",NEW."tentativaId",NEW."manejoId") IS DISTINCT FROM (OLD."tarefaId",OLD.ordem,OLD."aplicacaoId",OLD."exameId",OLD."tentativaId",OLD."manejoId")
 THEN RAISE EXCEPTION 'Vínculo conserva a execução original; registre outro vínculo'; END IF;
 IF NEW.estado<>'ATUAL' THEN RETURN NEW; END IF;
 IF NEW."aplicacaoId" IS NOT NULL THEN SELECT "animalId","tarefaId",status::text INTO dono,tarefa_fato,situacao FROM pecuaria."AplicacaoProduto" WHERE id=NEW."aplicacaoId"; tipo_fato:='APLICACAO';
 ELSIF NEW."exameId" IS NOT NULL THEN SELECT "animalId","tarefaId",status::text INTO dono,tarefa_fato,situacao FROM pecuaria."ExameAnimal" WHERE id=NEW."exameId"; tipo_fato:='EXAME';
 ELSIF NEW."manejoId" IS NOT NULL THEN SELECT "animalId","tarefaId",status::text,CASE WHEN tipo='RETIRADA_DISPOSITIVO' THEN 'RETIRADA' ELSE 'MANEJO' END INTO dono,tarefa_fato,situacao,tipo_fato FROM pecuaria."ManejoAnimal" WHERE id=NEW."manejoId";
 ELSE SELECT "animalId","tarefaId",status::text INTO dono,tarefa_fato,situacao FROM pecuaria."TentativaReprodutiva" WHERE id=NEW."tentativaId"; tipo_fato:='TENTATIVA'; END IF;
 IF tarefa_fato IS DISTINCT FROM NEW."tarefaId" OR situacao<>'VALIDO' OR NOT EXISTS(SELECT 1 FROM pecuaria."TarefaProtocolo" t JOIN pecuaria."ParticipacaoProtocolo" p ON p.id=t."participacaoId" JOIN pecuaria."EtapaProtocolo" e ON e.id=t."etapaId" WHERE t.id=NEW."tarefaId" AND p."animalId"=dono AND e.tipo=tipo_fato)
 THEN RAISE EXCEPTION 'Fato, animal e ação incompatíveis com a tarefa'; END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION pecuaria.conferir_manejo_protocolar() RETURNS trigger LANGUAGE plpgsql AS $$
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
  SELECT a.*,e.configuracao INTO insercao FROM pecuaria."AplicacaoProduto" a JOIN pecuaria."TarefaProtocolo" t ON t.id=a."tarefaId" JOIN pecuaria."EtapaProtocolo" e ON e.id=t."etapaId" WHERE a.id=NEW."insercaoAplicacaoId" AND a."animalId"=NEW."animalId" AND a.status='VALIDO' AND e.tipo='APLICACAO' AND e.configuracao->>'subtipo'='INSERCAO_DISPOSITIVO' FOR UPDATE OF a;
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
CREATE TRIGGER "ManejoAnimal_protocolo_validar" BEFORE INSERT OR UPDATE ON pecuaria."ManejoAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_manejo_protocolar();
CREATE FUNCTION pecuaria.proteger_insercao_retirada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM pecuaria."ManejoAnimal" m WHERE m."insercaoAplicacaoId"=NEW.id AND (m.status='VALIDO' OR m."realizacaoMantida") AND (NEW.status<>'VALIDO' OR NEW."animalId"<>m."animalId" OR NEW.data>m.data OR (NEW.data=m.data AND NEW."precisaoTemporal"='HORA' AND m."precisaoTemporal"='HORA' AND NEW."aplicadaEm">m."realizadaEm"))) THEN RAISE EXCEPTION 'Revise a retirada vinculada antes de alterar ou anular a inserção'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "AplicacaoProduto_retirada_validar" BEFORE UPDATE ON pecuaria."AplicacaoProduto" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_insercao_retirada();
CREATE FUNCTION pecuaria.conferir_classificacao_manejo() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE manejo RECORD;
BEGIN
 IF TG_OP='UPDATE' AND NEW."manejoId" IS DISTINCT FROM OLD."manejoId" THEN RAISE EXCEPTION 'Classificação conserva a fonte do manejo'; END IF;
 IF NEW."manejoId" IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO manejo FROM pecuaria."ManejoAnimal" WHERE id=NEW."manejoId";
 IF NEW."valorMaterialDocumentado" IS NOT NULL OR NOT NEW."materialNaoAplicavel" OR NEW."coberturaServico"<>'PROCEDIMENTO' OR (NEW."servicoNaoAplicavel" AND manejo."operacaoServicoId" IS NOT NULL) THEN RAISE EXCEPTION 'Manejo não admite material ou pacote duplicado'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "ClassificacaoCusto_manejo_validar" BEFORE INSERT OR UPDATE ON pecuaria."ClassificacaoCustoPecuaria" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_classificacao_manejo();
COMMIT;
