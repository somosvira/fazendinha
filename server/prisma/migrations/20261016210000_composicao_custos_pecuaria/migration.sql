-- Metadados gerenciais; nenhum movimento de estoque, operação ou preço histórico é regravado.
CREATE TABLE pecuaria."ClassificacaoCustoPecuaria" (
 "id" TEXT PRIMARY KEY,
 "tentativaId" TEXT UNIQUE REFERENCES pecuaria."TentativaReprodutiva"("id") ON DELETE RESTRICT,
 "aplicacaoId" TEXT UNIQUE REFERENCES pecuaria."AplicacaoProduto"("id") ON DELETE RESTRICT,
 "exameId" TEXT UNIQUE REFERENCES pecuaria."ExameAnimal"("id") ON DELETE RESTRICT,
 "participacaoId" TEXT UNIQUE REFERENCES pecuaria."ParticipacaoProtocolo"("id") ON DELETE RESTRICT,
 "participacaoConsumoId" TEXT UNIQUE REFERENCES pecuaria."ParticipacaoConsumoAnimal"("id") ON DELETE RESTRICT,
 "finalidade" TEXT, "materialNaoAplicavel" BOOLEAN NOT NULL DEFAULT false,
 "servicoNaoAplicavel" BOOLEAN NOT NULL DEFAULT false, "coberturaServico" TEXT NOT NULL DEFAULT 'PROCEDIMENTO',
 "valorMaterialDocumentado" NUMERIC(14,2), "documentoMaterial" JSONB,
 "versao" INTEGER NOT NULL DEFAULT 1, "atualizadoPorId" INTEGER, "atualizadoEm" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ClassificacaoCusto_um_fato" CHECK (num_nonnulls("tentativaId","aplicacaoId","exameId","participacaoId","participacaoConsumoId")=1),
 CONSTRAINT "ClassificacaoCusto_finalidade" CHECK ("finalidade" IN ('REPRODUCAO','SANIDADE','ROTINA')),
 CONSTRAINT "ClassificacaoCusto_cobertura" CHECK ("coberturaServico" IN ('PROCEDIMENTO','MATERIAL','AMBOS')),
 CONSTRAINT "ClassificacaoCusto_documento" CHECK (("valorMaterialDocumentado" IS NULL AND "documentoMaterial" IS NULL) OR ("valorMaterialDocumentado" IS NOT NULL AND "valorMaterialDocumentado">=0 AND "documentoMaterial" IS NOT NULL AND "documentoMaterial" ?& ARRAY['referencia','evidencia'])),
 CONSTRAINT "ClassificacaoCusto_versao" CHECK ("versao">0)
);
CREATE TABLE pecuaria."VinculoPreparoTentativa" (
 "id" TEXT PRIMARY KEY, "tentativaId" TEXT NOT NULL REFERENCES pecuaria."TentativaReprodutiva"("id") ON DELETE RESTRICT,
 "aplicacaoId" TEXT REFERENCES pecuaria."AplicacaoProduto"("id") ON DELETE RESTRICT,
 "exameId" TEXT REFERENCES pecuaria."ExameAnimal"("id") ON DELETE RESTRICT,
 "participacaoId" TEXT REFERENCES pecuaria."ParticipacaoProtocolo"("id") ON DELETE RESTRICT,
 "modo" TEXT NOT NULL, "valorMaterial" NUMERIC(14,2), "valorServico" NUMERIC(14,2), "motivo" TEXT NOT NULL,
 "criadoPorId" INTEGER, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "encerradoEm" TIMESTAMP(3), "motivoEncerramento" TEXT,
 CONSTRAINT "Preparo_um_fato" CHECK (num_nonnulls("aplicacaoId","exameId","participacaoId")=1),
 CONSTRAINT "Preparo_modo" CHECK (("modo"='INTEGRAL' AND "valorMaterial" IS NULL AND "valorServico" IS NULL) OR ("modo"='PARCELA' AND num_nonnulls("valorMaterial","valorServico")>0)),
 CONSTRAINT "Preparo_valores" CHECK (("valorMaterial" IS NULL OR "valorMaterial">=0) AND ("valorServico" IS NULL OR "valorServico">=0)),
 CONSTRAINT "Preparo_motivos" CHECK (length(trim("motivo"))>=5 AND ("encerradoEm" IS NULL OR ("motivoEncerramento" IS NOT NULL AND length(trim("motivoEncerramento"))>=5)))
);
CREATE INDEX "VinculoPreparoTentativa_tentativaId_idx" ON pecuaria."VinculoPreparoTentativa"("tentativaId");
CREATE INDEX "VinculoPreparoTentativa_aplicacaoId_idx" ON pecuaria."VinculoPreparoTentativa"("aplicacaoId");
CREATE INDEX "VinculoPreparoTentativa_exameId_idx" ON pecuaria."VinculoPreparoTentativa"("exameId");
CREATE INDEX "VinculoPreparoTentativa_participacaoId_idx" ON pecuaria."VinculoPreparoTentativa"("participacaoId");
CREATE UNIQUE INDEX "Preparo_aplicacao_atual" ON pecuaria."VinculoPreparoTentativa"("tentativaId","aplicacaoId") WHERE "encerradoEm" IS NULL;
CREATE UNIQUE INDEX "Preparo_exame_atual" ON pecuaria."VinculoPreparoTentativa"("tentativaId","exameId") WHERE "encerradoEm" IS NULL;
CREATE UNIQUE INDEX "Preparo_participacao_atual" ON pecuaria."VinculoPreparoTentativa"("tentativaId","participacaoId") WHERE "encerradoEm" IS NULL;
CREATE FUNCTION pecuaria.conferir_vinculo_preparo() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE fonte RECORD; alvo RECORD; material NUMERIC; servico NUMERIC; qtd INTEGER; integrais INTEGER; soma_material NUMERIC; soma_servico NUMERIC;
BEGIN
 IF NEW."encerradoEm" IS NOT NULL THEN RETURN NEW; END IF;
 SELECT * INTO alvo FROM pecuaria."TentativaReprodutiva" WHERE id=NEW."tentativaId";
 IF NEW."aplicacaoId" IS NOT NULL THEN
  SELECT a."animalId",a."propriedadeId",a.data,a."valorProdutoAtribuido",a."valorServicoAtribuido" INTO fonte FROM pecuaria."AplicacaoProduto" a WHERE a.id=NEW."aplicacaoId" FOR UPDATE;
 ELSIF NEW."exameId" IS NOT NULL THEN
  SELECT e."animalId",e."propriedadeId",e.data,NULL::NUMERIC AS "valorProdutoAtribuido",e."valorServicoAtribuido" INTO fonte FROM pecuaria."ExameAnimal" e WHERE e.id=NEW."exameId" FOR UPDATE;
 ELSE
  SELECT p."animalId",p."propriedadeId",p."inicioReferencia" AS data,NULL::NUMERIC AS "valorProdutoAtribuido",p."valorServicoAtribuido" INTO fonte FROM pecuaria."ParticipacaoProtocolo" p WHERE p.id=NEW."participacaoId" FOR UPDATE;
 END IF;
 IF fonte."propriedadeId" IS NULL OR alvo."propriedadeId" IS NULL OR fonte."animalId" IS DISTINCT FROM alvo."animalId" OR fonte."propriedadeId" IS DISTINCT FROM alvo."propriedadeId" OR fonte.data::date>alvo.data THEN RAISE EXCEPTION 'preparatório incompatível com animal/sítio/data da tentativa' USING ERRCODE='23514'; END IF;
 material:=fonte."valorProdutoAtribuido"; servico:=fonte."valorServicoAtribuido";
 IF material IS NULL THEN SELECT c."valorMaterialDocumentado" INTO material FROM pecuaria."ClassificacaoCustoPecuaria" c WHERE c."aplicacaoId"=NEW."aplicacaoId"; END IF;
 SELECT count(*), count(*) FILTER (WHERE modo='INTEGRAL'), COALESCE(sum("valorMaterial"),0), COALESCE(sum("valorServico"),0)
 INTO qtd,integrais,soma_material,soma_servico FROM pecuaria."VinculoPreparoTentativa" v
 WHERE v.id<>NEW.id AND v."encerradoEm" IS NULL AND (v."aplicacaoId"=NEW."aplicacaoId" OR v."exameId"=NEW."exameId" OR v."participacaoId"=NEW."participacaoId");
 IF (NEW.modo='INTEGRAL' AND qtd>0) OR integrais>0 THEN RAISE EXCEPTION 'preparatório integral não pode ser replicado' USING ERRCODE='23514'; END IF;
 IF NEW.modo='PARCELA' AND ((NEW."valorMaterial" IS NOT NULL AND (material IS NULL OR soma_material+NEW."valorMaterial">material)) OR (NEW."valorServico" IS NOT NULL AND (servico IS NULL OR soma_servico+NEW."valorServico">servico))) THEN RAISE EXCEPTION 'parcelas ultrapassam o valor da origem' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Preparo_conferir" BEFORE INSERT OR UPDATE ON pecuaria."VinculoPreparoTentativa" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_preparo();
CREATE FUNCTION pecuaria.proteger_vinculo_preparo() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (NEW."id",NEW."tentativaId",NEW."aplicacaoId",NEW."exameId",NEW."participacaoId",NEW."modo",NEW."valorMaterial",NEW."valorServico",NEW."criadoPorId",NEW."criadoEm",NEW."motivo") IS DISTINCT FROM (OLD."id",OLD."tentativaId",OLD."aplicacaoId",OLD."exameId",OLD."participacaoId",OLD."modo",OLD."valorMaterial",OLD."valorServico",OLD."criadoPorId",OLD."criadoEm",OLD."motivo") OR OLD."encerradoEm" IS NOT NULL THEN RAISE EXCEPTION 'vínculo confirmado imutável; encerre com motivo e crie outro' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Preparo_imutavel" BEFORE UPDATE ON pecuaria."VinculoPreparoTentativa" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_vinculo_preparo();

-- Correções de atribuição/classificação não podem deixar parcelas acima da fonte.
CREATE FUNCTION pecuaria.conferir_capacidade_preparo(tipo TEXT, fonte_id TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE material NUMERIC; servico NUMERIC; soma_material NUMERIC; soma_servico NUMERIC; qtd INTEGER; integrais INTEGER;
BEGIN
 IF tipo='APLICACAO' THEN
  SELECT COALESCE(a."valorProdutoAtribuido", c."valorMaterialDocumentado"),a."valorServicoAtribuido" INTO material,servico FROM pecuaria."AplicacaoProduto" a LEFT JOIN pecuaria."ClassificacaoCustoPecuaria" c ON c."aplicacaoId"=a.id WHERE a.id=fonte_id;
 ELSIF tipo='EXAME' THEN SELECT NULL::NUMERIC,e."valorServicoAtribuido" INTO material,servico FROM pecuaria."ExameAnimal" e WHERE e.id=fonte_id;
 ELSE SELECT NULL::NUMERIC,p."valorServicoAtribuido" INTO material,servico FROM pecuaria."ParticipacaoProtocolo" p WHERE p.id=fonte_id;
 END IF;
 SELECT count(*),count(*) FILTER(WHERE modo='INTEGRAL'),sum("valorMaterial"),sum("valorServico") INTO qtd,integrais,soma_material,soma_servico FROM pecuaria."VinculoPreparoTentativa" v
 WHERE v."encerradoEm" IS NULL AND ((tipo='APLICACAO' AND v."aplicacaoId"=fonte_id) OR (tipo='EXAME' AND v."exameId"=fonte_id) OR (tipo='PARTICIPACAO' AND v."participacaoId"=fonte_id));
 IF (integrais>0 AND qtd>1) OR (soma_material IS NOT NULL AND (material IS NULL OR soma_material>material)) OR (soma_servico IS NOT NULL AND (servico IS NULL OR soma_servico>servico)) THEN RAISE EXCEPTION 'correção excede capacidade dos preparatórios atribuídos' USING ERRCODE='23514'; END IF;
END $$;
CREATE FUNCTION pecuaria.conferir_alteracao_fonte_custo() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_TABLE_NAME='AplicacaoProduto' THEN
  IF EXISTS (SELECT 1 FROM pecuaria."ClassificacaoCustoPecuaria" c WHERE c."aplicacaoId"=NEW.id AND ((c."coberturaServico"<>'PROCEDIMENTO' AND (NEW."operacaoServicoId" IS NULL OR NEW."valorProdutoAtribuido" IS NOT NULL OR NEW."movimentoEstoqueId" IS NOT NULL)) OR (c."materialNaoAplicavel" AND NEW."valorProdutoAtribuido" IS NOT NULL) OR (c."servicoNaoAplicavel" AND NEW."operacaoServicoId" IS NOT NULL) OR (c."valorMaterialDocumentado" IS NOT NULL AND (NEW."valorProdutoAtribuido" IS NOT NULL OR NEW."movimentoEstoqueId" IS NOT NULL OR NEW."origemInsumo"<>'SEM_ORIGEM_JUSTIFICADA')))) THEN RAISE EXCEPTION 'correção incompatível com classificação de custo' USING ERRCODE='23514'; END IF;
  PERFORM pecuaria.conferir_capacidade_preparo('APLICACAO',NEW.id);
 ELSIF TG_TABLE_NAME='TentativaReprodutiva' THEN
  IF EXISTS (SELECT 1 FROM pecuaria."ClassificacaoCustoPecuaria" c WHERE c."tentativaId"=NEW.id AND ((c."coberturaServico"<>'PROCEDIMENTO' AND (NEW."operacaoServicoId" IS NULL OR NEW."valorProdutoAtribuido" IS NOT NULL OR NEW."movimentoEstoqueId" IS NOT NULL)) OR (c."materialNaoAplicavel" AND (NEW."valorProdutoAtribuido" IS NOT NULL OR NEW."movimentoEstoqueId" IS NOT NULL)) OR (c."servicoNaoAplicavel" AND NEW."operacaoServicoId" IS NOT NULL) OR (c."valorMaterialDocumentado" IS NOT NULL AND (NEW."valorProdutoAtribuido" IS NOT NULL OR NEW."movimentoEstoqueId" IS NOT NULL OR NEW."origemMaterial"<>'DOCUMENTADA')))) THEN RAISE EXCEPTION 'correção incompatível com classificação de custo da tentativa' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='ExameAnimal' THEN
  IF EXISTS (SELECT 1 FROM pecuaria."ClassificacaoCustoPecuaria" c WHERE c."exameId"=NEW.id AND ((c."servicoNaoAplicavel" AND NEW."operacaoServicoId" IS NOT NULL) OR (c."coberturaServico"<>'PROCEDIMENTO' AND NEW."operacaoServicoId" IS NULL))) THEN RAISE EXCEPTION 'correção incompatível com classificação de custo' USING ERRCODE='23514'; END IF;
  PERFORM pecuaria.conferir_capacidade_preparo('EXAME',NEW.id);
 ELSE
  IF EXISTS (SELECT 1 FROM pecuaria."ClassificacaoCustoPecuaria" c WHERE c."participacaoId"=NEW.id AND ((c."servicoNaoAplicavel" AND NEW."operacaoServicoId" IS NOT NULL) OR (c."coberturaServico"<>'PROCEDIMENTO' AND NEW."operacaoServicoId" IS NULL))) THEN RAISE EXCEPTION 'correção incompatível com classificação de custo' USING ERRCODE='23514'; END IF;
  PERFORM pecuaria.conferir_capacidade_preparo('PARTICIPACAO',NEW.id);
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "Preparo_limite_aplicacao" AFTER UPDATE ON pecuaria."AplicacaoProduto" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_alteracao_fonte_custo();
CREATE CONSTRAINT TRIGGER "Preparo_limite_exame" AFTER UPDATE ON pecuaria."ExameAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_alteracao_fonte_custo();
CREATE CONSTRAINT TRIGGER "Preparo_limite_participacao" AFTER UPDATE ON pecuaria."ParticipacaoProtocolo" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_alteracao_fonte_custo();
CREATE CONSTRAINT TRIGGER "Custo_limite_tentativa" AFTER UPDATE ON pecuaria."TentativaReprodutiva" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_alteracao_fonte_custo();
CREATE FUNCTION pecuaria.validar_classificacao_custo() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE origem TEXT; material NUMERIC; servico_id TEXT; movimento TEXT;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF (NEW."tentativaId",NEW."aplicacaoId",NEW."exameId",NEW."participacaoId",NEW."participacaoConsumoId") IS DISTINCT FROM (OLD."tentativaId",OLD."aplicacaoId",OLD."exameId",OLD."participacaoId",OLD."participacaoConsumoId") OR NEW.versao<>OLD.versao+1 THEN RAISE EXCEPTION 'correção exige mesma fonte e próxima versão' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW."tentativaId" IS NOT NULL THEN SELECT t."origemMaterial",t."valorProdutoAtribuido",t."operacaoServicoId",t."movimentoEstoqueId" INTO origem,material,servico_id,movimento FROM pecuaria."TentativaReprodutiva" t WHERE t.id=NEW."tentativaId";
 ELSIF NEW."aplicacaoId" IS NOT NULL THEN SELECT CASE WHEN a."origemInsumo"='SEM_ORIGEM_JUSTIFICADA' THEN 'DOCUMENTADA' ELSE a."origemInsumo"::TEXT END,a."valorProdutoAtribuido",a."operacaoServicoId",a."movimentoEstoqueId" INTO origem,material,servico_id,movimento FROM pecuaria."AplicacaoProduto" a WHERE a.id=NEW."aplicacaoId";
 ELSIF NEW."exameId" IS NOT NULL THEN SELECT e."operacaoServicoId" INTO servico_id FROM pecuaria."ExameAnimal" e WHERE e.id=NEW."exameId";
 ELSIF NEW."participacaoId" IS NOT NULL THEN SELECT p."operacaoServicoId" INTO servico_id FROM pecuaria."ParticipacaoProtocolo" p WHERE p.id=NEW."participacaoId";
 END IF;
 IF NEW."participacaoConsumoId" IS NOT NULL AND (NEW."valorMaterialDocumentado" IS NOT NULL OR NEW."coberturaServico"<>'PROCEDIMENTO' OR NEW."materialNaoAplicavel" OR NEW."servicoNaoAplicavel") THEN RAISE EXCEPTION 'nutrição permite apenas classificação de finalidade' USING ERRCODE='23514'; END IF;
 IF NEW."valorMaterialDocumentado" IS NOT NULL AND (origem IS DISTINCT FROM 'DOCUMENTADA' OR material IS NOT NULL OR movimento IS NOT NULL) THEN RAISE EXCEPTION 'prova documental não substitui material congelado' USING ERRCODE='23514'; END IF;
 IF NEW."materialNaoAplicavel" AND (material IS NOT NULL OR movimento IS NOT NULL OR NEW."valorMaterialDocumentado" IS NOT NULL) THEN RAISE EXCEPTION 'material realizado não é não aplicável' USING ERRCODE='23514'; END IF;
 IF NEW."servicoNaoAplicavel" AND servico_id IS NOT NULL THEN RAISE EXCEPTION 'serviço atribuído não é não aplicável' USING ERRCODE='23514'; END IF;
 IF NEW."coberturaServico"<>'PROCEDIMENTO' AND (servico_id IS NULL OR material IS NOT NULL OR movimento IS NOT NULL OR NEW."valorMaterialDocumentado" IS NOT NULL) THEN RAISE EXCEPTION 'pacote sem fonte ou com material sobreposto' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "ClassificacaoCusto_validar" BEFORE INSERT OR UPDATE ON pecuaria."ClassificacaoCustoPecuaria" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_classificacao_custo();
CREATE FUNCTION pecuaria.conferir_limite_classificacao() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."aplicacaoId" IS NOT NULL THEN PERFORM pecuaria.conferir_capacidade_preparo('APLICACAO',NEW."aplicacaoId");
 ELSIF NEW."exameId" IS NOT NULL THEN PERFORM pecuaria.conferir_capacidade_preparo('EXAME',NEW."exameId");
 ELSIF NEW."participacaoId" IS NOT NULL THEN PERFORM pecuaria.conferir_capacidade_preparo('PARTICIPACAO',NEW."participacaoId");
 END IF; RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "ClassificacaoCusto_limite" AFTER INSERT OR UPDATE ON pecuaria."ClassificacaoCustoPecuaria" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_limite_classificacao();
