ALTER TYPE public."OrigemMovimentoEstoque" ADD VALUE 'RETIRADA_LEITE';

-- Expansão sem conversão de vendas anteriores: nenhuma obrigação é refaturada.
CREATE TABLE pecuaria."OperacaoComercialLeite" (
 id TEXT PRIMARY KEY, "propriedadeId" INTEGER NOT NULL REFERENCES public."Propriedade"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "parceiroId" TEXT NOT NULL REFERENCES public."Parceiro"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 inicio DATE NOT NULL, fim DATE NOT NULL, referencia TEXT NOT NULL, versao INTEGER NOT NULL DEFAULT 1,
 status TEXT NOT NULL DEFAULT 'ABERTA', "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "criadoPorId" INTEGER,
 CONSTRAINT "OperacaoComercialLeite_estado" CHECK (inicio<=fim AND versao>0 AND status IN ('ABERTA','FECHADA') AND length(trim(referencia))>=5)
);
CREATE UNIQUE INDEX "OperacaoComercialLeite_propriedadeId_parceiroId_inicio_fim_key" ON pecuaria."OperacaoComercialLeite"("propriedadeId","parceiroId",inicio,fim);
CREATE INDEX "OperacaoComercialLeite_propriedadeId_inicio_fim_idx" ON pecuaria."OperacaoComercialLeite"("propriedadeId",inicio,fim);
CREATE TABLE pecuaria."RetiradaOperacaoLeite" (
 id TEXT PRIMARY KEY, "comercialId" TEXT NOT NULL REFERENCES pecuaria."OperacaoComercialLeite"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "movimentoId" TEXT NOT NULL REFERENCES public."MovimentoEstoque"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 referencia TEXT NOT NULL, "pontoColeta" TEXT, "horarioColeta" TEXT, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "criadoPorId" INTEGER,
 CONSTRAINT "RetiradaOperacaoLeite_documentada" CHECK(length(trim(referencia))>=5 AND ("horarioColeta" IS NULL OR "horarioColeta" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'))
);
CREATE UNIQUE INDEX "RetiradaOperacaoLeite_movimentoId_key" ON pecuaria."RetiradaOperacaoLeite"("movimentoId");
CREATE INDEX "RetiradaOperacaoLeite_comercialId_idx" ON pecuaria."RetiradaOperacaoLeite"("comercialId");
CREATE TABLE pecuaria."FechamentoOperacaoLeite" (
 id TEXT PRIMARY KEY, "comercialId" TEXT NOT NULL REFERENCES pecuaria."OperacaoComercialLeite"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "operacaoId" TEXT NOT NULL REFERENCES public."Operacao"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 versao INTEGER NOT NULL, "precoUnitario" DECIMAL(14,4) NOT NULL, "volumeReconhecido" DECIMAL(12,3) NOT NULL,
 ajuste DECIMAL(14,2) NOT NULL DEFAULT 0, "motivoAjuste" TEXT, motivo TEXT NOT NULL,
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "criadoPorId" INTEGER,
 CONSTRAINT "FechamentoOperacaoLeite_documentado" CHECK (versao>0 AND "precoUnitario">0 AND "volumeReconhecido">0 AND length(trim(motivo))>=5 AND (ajuste=0 OR COALESCE(length(trim("motivoAjuste")),0)>=5))
);
CREATE UNIQUE INDEX "FechamentoOperacaoLeite_operacaoId_key" ON pecuaria."FechamentoOperacaoLeite"("operacaoId");
CREATE UNIQUE INDEX "FechamentoOperacaoLeite_comercialId_versao_key" ON pecuaria."FechamentoOperacaoLeite"("comercialId",versao);
CREATE TABLE pecuaria."DetalheFechamentoLeite" (
 id TEXT PRIMARY KEY, "fechamentoId" TEXT NOT NULL REFERENCES pecuaria."FechamentoOperacaoLeite"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "retiradaId" TEXT NOT NULL REFERENCES pecuaria."RetiradaOperacaoLeite"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "quantidadeReconhecida" DECIMAL(12,3) NOT NULL CHECK("quantidadeReconhecida">=0), "motivoDiferenca" TEXT
);
CREATE UNIQUE INDEX "DetalheFechamentoLeite_fechamentoId_retiradaId_key" ON pecuaria."DetalheFechamentoLeite"("fechamentoId","retiradaId");
CREATE TABLE pecuaria."ComprovanteRetiradaOperacaoLeite" (
 id TEXT PRIMARY KEY, "retiradaId" TEXT NOT NULL REFERENCES pecuaria."RetiradaOperacaoLeite"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 nome TEXT NOT NULL, "mimeType" TEXT NOT NULL, "tamanhoBytes" INTEGER NOT NULL CHECK("tamanhoBytes">0 AND "tamanhoBytes"<=10485760),
 sha256 TEXT NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'), "storageKey" TEXT NOT NULL, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "criadoPorId" INTEGER
);
CREATE UNIQUE INDEX "ComprovanteRetiradaOperacaoLeite_retiradaId_sha256_key" ON pecuaria."ComprovanteRetiradaOperacaoLeite"("retiradaId",sha256);

CREATE FUNCTION pecuaria.imutavel_comercial_leite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'histórico comercial leiteiro não pode ser reescrito ou apagado' USING ERRCODE='23514'; END $$;
CREATE TRIGGER "RetiradaOperacaoLeite_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."RetiradaOperacaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.imutavel_comercial_leite();
CREATE TRIGGER "FechamentoOperacaoLeite_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."FechamentoOperacaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.imutavel_comercial_leite();
CREATE TRIGGER "DetalheFechamentoLeite_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."DetalheFechamentoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.imutavel_comercial_leite();
CREATE TRIGGER "ComprovanteRetiradaOperacaoLeite_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."ComprovanteRetiradaOperacaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.imutavel_comercial_leite();
CREATE FUNCTION pecuaria.guardar_identidade_comercial_leite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'identidade comercial não pode ser apagada' USING ERRCODE='23514'; END IF;
 IF (to_jsonb(OLD)-'status'-'versao') IS DISTINCT FROM (to_jsonb(NEW)-'status'-'versao') OR NEW.versao<>OLD.versao+1 OR (OLD.status='FECHADA' AND NEW.status<>'FECHADA')
 THEN RAISE EXCEPTION 'identidade comercial imutável; altere somente versão e estado válidos' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "OperacaoComercialLeite_identidade" BEFORE UPDATE OR DELETE ON pecuaria."OperacaoComercialLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.guardar_identidade_comercial_leite();
-- Também protege escrita SQL direta concorrente de novas retiradas e fechamento.
CREATE FUNCTION pecuaria.travar_retirada_comercial_leite() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE estado text;
BEGIN
 SELECT status INTO estado FROM pecuaria."OperacaoComercialLeite" WHERE id=NEW."comercialId" FOR NO KEY UPDATE;
 IF estado<>'ABERTA' THEN RAISE EXCEPTION 'operação fechada não admite nova retirada' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "RetiradaOperacaoLeite_aberta" BEFORE INSERT ON pecuaria."RetiradaOperacaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_retirada_comercial_leite();

CREATE FUNCTION pecuaria.travar_fechamento_comercial_leite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM id FROM pecuaria."OperacaoComercialLeite" WHERE id=NEW."comercialId" FOR NO KEY UPDATE;
 RETURN NEW;
END $$;
CREATE TRIGGER "FechamentoOperacaoLeite_travar" BEFORE INSERT ON pecuaria."FechamentoOperacaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_fechamento_comercial_leite();

CREATE FUNCTION pecuaria.conferir_operacao_comercial_leite(cid text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE c record; f record; n bigint; nf bigint; q numeric; anterior text; ultima integer;
BEGIN
 SELECT * INTO c FROM pecuaria."OperacaoComercialLeite" WHERE id=cid;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT count(*) INTO n FROM pecuaria."RetiradaOperacaoLeite" WHERE "comercialId"=cid;
 SELECT count(*),max(versao) INTO nf,ultima FROM pecuaria."FechamentoOperacaoLeite" WHERE "comercialId"=cid;
 IF c.versao<>1+n+nf OR (nf=0 AND c.status<>'ABERTA') OR (nf>0 AND (c.status<>'FECHADA' OR nf<>ultima))
 THEN RAISE EXCEPTION 'versão e estado comercial divergem dos fatos registrados' USING ERRCODE='23514'; END IF;
 IF EXISTS (SELECT 1 FROM pecuaria."RetiradaOperacaoLeite" r JOIN public."MovimentoEstoque" m ON m.id=r."movimentoId" WHERE r."comercialId"=cid AND
   (m."propriedadeId" IS DISTINCT FROM c."propriedadeId" OR m.origem::text<>'RETIRADA_LEITE' OR m.tipo<>'SAIDA' OR m.status<>'CONFIRMADO' OR m."reversaoDeId" IS NOT NULL OR m."operacaoId" IS NOT NULL OR m."metodoValorizacao"<>'LEITE_FIFO_V1' OR m.data<c.inicio OR m.data>c.fim OR m.data>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
     OR EXISTS (SELECT 1 FROM pecuaria."EntregaLeite" e WHERE e."retiradaId"=m.id) OR EXISTS (SELECT 1 FROM pecuaria."VersaoComercialVendaLeite" v WHERE v."retiradaId"=m.id)))
 THEN RAISE EXCEPTION 'retirada exige lastro leiteiro único no sítio e período, sem vínculo financeiro anterior' USING ERRCODE='23514'; END IF;
 FOR f IN SELECT fl.*,o.status AS "statusFinanceiro",o.tipo,o."propriedadeId",o."parceiroId",o."valorTotal",o.data,o."corrigeOperacaoId",o."centroCustoId" FROM pecuaria."FechamentoOperacaoLeite" fl JOIN public."Operacao" o ON o.id=fl."operacaoId" WHERE fl."comercialId"=cid ORDER BY fl.versao LOOP
   SELECT sum(d."quantidadeReconhecida") INTO q FROM pecuaria."DetalheFechamentoLeite" d WHERE d."fechamentoId"=f.id;
   IF n=0 OR f.tipo<>'VENDA' OR f."propriedadeId"<>c."propriedadeId" OR f."parceiroId" IS DISTINCT FROM c."parceiroId" OR f.data<c.fim OR f.data>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date OR f."centroCustoId" IS NULL OR f."valorTotal"<>round(f."volumeReconhecido"*f."precoUnitario",2)+f.ajuste
     OR q IS DISTINCT FROM f."volumeReconhecido" OR (SELECT count(*) FROM pecuaria."DetalheFechamentoLeite" WHERE "fechamentoId"=f.id)<>n
     OR EXISTS (SELECT 1 FROM pecuaria."DetalheFechamentoLeite" d JOIN pecuaria."RetiradaOperacaoLeite" r ON r.id=d."retiradaId" JOIN public."MovimentoEstoque" m ON m.id=r."movimentoId"
       WHERE d."fechamentoId"=f.id AND (r."comercialId"<>cid OR (d."quantidadeReconhecida"<>m.quantidade AND COALESCE(length(trim(d."motivoDiferenca")),0)<5)))
     OR (f.versao=ultima AND f."statusFinanceiro"<>'CONFIRMADA') OR (f.versao<ultima AND f."statusFinanceiro"<>'CANCELADA') OR f."corrigeOperacaoId" IS DISTINCT FROM anterior
     OR EXISTS (SELECT 1 FROM public."MovimentoEstoque" WHERE "operacaoId"=f."operacaoId")
     OR (SELECT count(*) FROM public."ItemOperacao" WHERE "operacaoId"=f."operacaoId")<>1
     OR EXISTS (SELECT 1 FROM public."ItemOperacao" i WHERE i."operacaoId"=f."operacaoId" AND (i."produtoId" IS NOT NULL OR i.estocavel OR i.quantidade<>f."volumeReconhecido" OR i."valorTotal"<>f."valorTotal" OR i.unidade<>'L'))
     OR EXISTS (SELECT 1 FROM public."Operacao" cor WHERE cor."corrigeOperacaoId"=f."operacaoId" AND NOT EXISTS (SELECT 1 FROM pecuaria."FechamentoOperacaoLeite" proximo WHERE proximo."comercialId"=cid AND proximo.versao=f.versao+1 AND proximo."operacaoId"=cor.id))
   THEN RAISE EXCEPTION 'fechamento exige todas as retiradas, valores conciliados, versão e operação financeira única sem nova baixa' USING ERRCODE='23514'; END IF;
   IF f.versao<ultima AND (EXISTS (SELECT 1 FROM public."CompromissoFinanceiro" co WHERE co."operacaoId"=f."operacaoId" AND co.status<>'CANCELADO') OR EXISTS (SELECT 1 FROM public."TransacaoFinanceira" t WHERE t."operacaoId"=f."operacaoId" AND t.status='CONFIRMADA' AND t.tipo<>'REVERSAO')
     OR EXISTS (SELECT 1 FROM public."CompromissoFinanceiro" co JOIN public."Liquidacao" li ON li."compromissoId"=co.id JOIN public."TransacaoFinanceira" t ON t.id=li."transacaoId" WHERE co."operacaoId"=f."operacaoId" AND t.status='CONFIRMADA'))
   THEN RAISE EXCEPTION 'recebimentos ativos impedem substituição do fechamento' USING ERRCODE='23514'; END IF;
   anterior:=f."operacaoId";
 END LOOP;
END $$;
CREATE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cid text; oid text;
BEGIN
 IF TG_TABLE_NAME='OperacaoComercialLeite' THEN cid:=NEW.id;
 ELSIF TG_TABLE_NAME IN ('RetiradaOperacaoLeite','FechamentoOperacaoLeite') THEN cid:=NEW."comercialId";
 ELSIF TG_TABLE_NAME='DetalheFechamentoLeite' THEN SELECT "comercialId" INTO cid FROM pecuaria."FechamentoOperacaoLeite" WHERE id=NEW."fechamentoId";
 ELSIF TG_TABLE_NAME='Operacao' THEN SELECT "comercialId" INTO cid FROM pecuaria."FechamentoOperacaoLeite" WHERE "operacaoId"=NEW.id OR "operacaoId"=NEW."corrigeOperacaoId" ORDER BY versao DESC LIMIT 1;
 ELSIF TG_TABLE_NAME IN ('ItemOperacao','TransacaoFinanceira','CompromissoFinanceiro') THEN
   SELECT "comercialId" INTO cid FROM pecuaria."FechamentoOperacaoLeite" WHERE "operacaoId"=NEW."operacaoId";
 ELSIF TG_TABLE_NAME='Liquidacao' THEN
   SELECT "operacaoId" INTO oid FROM public."CompromissoFinanceiro" WHERE id=NEW."compromissoId";
   SELECT "comercialId" INTO cid FROM pecuaria."FechamentoOperacaoLeite" WHERE "operacaoId"=oid;
 ELSIF TG_TABLE_NAME='MovimentoEstoque' THEN
   SELECT r."comercialId" INTO cid FROM pecuaria."RetiradaOperacaoLeite" r WHERE r."movimentoId"=NEW.id;
   IF cid IS NULL AND NEW."operacaoId" IS NOT NULL THEN SELECT "comercialId" INTO cid FROM pecuaria."FechamentoOperacaoLeite" WHERE "operacaoId"=NEW."operacaoId"; END IF;
 END IF;
 IF cid IS NOT NULL THEN PERFORM pecuaria.conferir_operacao_comercial_leite(cid); END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "OperacaoComercialLeite_conferir" AFTER INSERT OR UPDATE ON pecuaria."OperacaoComercialLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();
CREATE CONSTRAINT TRIGGER "RetiradaOperacaoLeite_conferir" AFTER INSERT ON pecuaria."RetiradaOperacaoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();
CREATE CONSTRAINT TRIGGER "FechamentoOperacaoLeite_conferir" AFTER INSERT ON pecuaria."FechamentoOperacaoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();
CREATE CONSTRAINT TRIGGER "DetalheFechamentoLeite_conferir" AFTER INSERT ON pecuaria."DetalheFechamentoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();
CREATE CONSTRAINT TRIGGER "Operacao_fechamentoLeite_conferir" AFTER INSERT OR UPDATE ON public."Operacao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();
CREATE CONSTRAINT TRIGGER "Movimento_retiradaComercialLeite_conferir" AFTER INSERT OR UPDATE ON public."MovimentoEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();

CREATE CONSTRAINT TRIGGER "ItemOperacao_fechamentoLeite_conferir" AFTER INSERT OR UPDATE ON public."ItemOperacao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();
CREATE CONSTRAINT TRIGGER "Transacao_fechamentoLeite_conferir" AFTER INSERT OR UPDATE ON public."TransacaoFinanceira" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();
CREATE CONSTRAINT TRIGGER "Compromisso_fechamentoLeite_conferir" AFTER INSERT OR UPDATE ON public."CompromissoFinanceiro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();
CREATE CONSTRAINT TRIGGER "Liquidacao_fechamentoLeite_conferir" AFTER INSERT OR UPDATE ON public."Liquidacao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_operacao_comercial_leite();

-- Preserva o caminho anterior e expande VENDA física apenas com vínculo pendente comprovado.
CREATE OR REPLACE FUNCTION pecuaria.conferir_elegibilidade_saida_leite() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE m RECORD; c RECORD; atual TEXT; operacao_tipo TEXT;
BEGIN
 SELECT * INTO m FROM public."MovimentoEstoque" WHERE id=NEW."movimentoId";
 SELECT * INTO c FROM pecuaria."ClassificacaoEntradaLeite" WHERE id=NEW."classificacaoId" AND "entradaId"=NEW."entradaId";
 IF NOT FOUND THEN RAISE EXCEPTION 'classificação da saída pertence a outra entrada' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('valorizacao-estoque:'||m."produtoId"));
 SELECT id INTO atual FROM pecuaria."ClassificacaoEntradaLeite" WHERE "entradaId"=NEW."entradaId" ORDER BY versao DESC LIMIT 1;
 IF c.id<>atual THEN RAISE EXCEPTION 'saída exige snapshot da classificação vigente sob trava' USING ERRCODE='23514'; END IF;
 IF m."operacaoId" IS NOT NULL THEN SELECT tipo::text INTO operacao_tipo FROM public."Operacao" WHERE id=m."operacaoId"; END IF;
 IF NEW.finalidade='VENDA' THEN
   IF c.natureza<>'COMERCIAL' OR (operacao_tipo IS DISTINCT FROM 'VENDA' AND NOT (
     m."operacaoId" IS NULL AND m.origem::text='RETIRADA_LEITE' AND EXISTS (
       SELECT 1 FROM pecuaria."RetiradaOperacaoLeite" r JOIN pecuaria."OperacaoComercialLeite" o ON o.id=r."comercialId"
       WHERE r."movimentoId"=m.id AND o."propriedadeId"=m."propriedadeId" AND m.data BETWEEN o.inicio AND o.fim)))
   THEN RAISE EXCEPTION 'venda exige entrada comercial e operação financeira ou retirada pendente comprovada' USING ERRCODE='23514'; END IF;
 ELSE
   IF m."operacaoId" IS NOT NULL OR (NEW.finalidade='CONSUMO' AND m.origem<>'NUTRICAO') OR (NEW.finalidade='DESCARTE' AND m.origem<>'PERDA') THEN
     RAISE EXCEPTION 'finalidade interna não pode contornar venda ou sua restrição comercial' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;
