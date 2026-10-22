-- CreateTable
CREATE TABLE "pecuaria"."VersaoComercialVendaLeite" (
    "id" TEXT NOT NULL,
    "operacaoId" TEXT NOT NULL,
    "retiradaId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "chave" TEXT,
    "hash" TEXT,
    "motivo" TEXT NOT NULL,
    "criadoPorId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VersaoComercialVendaLeite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VersaoComercialVendaLeite_operacaoId_key" ON "pecuaria"."VersaoComercialVendaLeite"("operacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "VersaoComercialVendaLeite_chave_key" ON "pecuaria"."VersaoComercialVendaLeite"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "VersaoComercialVendaLeite_retiradaId_versao_key" ON "pecuaria"."VersaoComercialVendaLeite"("retiradaId", "versao");

-- AddForeignKey
ALTER TABLE "pecuaria"."VersaoComercialVendaLeite" ADD CONSTRAINT "VersaoComercialVendaLeite_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES "Operacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."VersaoComercialVendaLeite" ADD CONSTRAINT "VersaoComercialVendaLeite_retiradaId_fkey" FOREIGN KEY ("retiradaId") REFERENCES "MovimentoEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE pecuaria."VersaoComercialVendaLeite"
  ADD CONSTRAINT "VersaoVendaLeite_versao_positiva" CHECK (versao > 0),
  ADD CONSTRAINT "VersaoVendaLeite_chave_hash" CHECK ((chave IS NULL) = (hash IS NULL)),
  ADD CONSTRAINT "VersaoVendaLeite_motivo" CHECK (length(trim(motivo)) >= 5);

-- Não inventa uma cadeia nem uma devolução para históricos ambíguos.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM public."MovimentoEstoque" m LEFT JOIN public."Operacao" o ON o.id=m."operacaoId"
    WHERE m."metodoValorizacao"='LEITE_FIFO_V1' AND m."operacaoId" IS NOT NULL AND m.tipo='SAIDA'
      AND (m."reversaoDeId" IS NOT NULL OR m.status<>'CONFIRMADO' OR o.tipo IS DISTINCT FROM 'VENDA'
        OR o.status<>'CONFIRMADA' OR o."corrigeOperacaoId" IS NOT NULL
        OR (SELECT count(*) FROM public."MovimentoEstoque" outro WHERE outro."operacaoId"=o.id)<>1
        OR EXISTS (SELECT 1 FROM public."Operacao" outra WHERE outra."corrigeOperacaoId"=o.id))
  ) THEN RAISE EXCEPTION 'vendas leiteiras anteriores exigem reconciliação manual antes da cadeia comercial'; END IF;
END $$;

INSERT INTO pecuaria."VersaoComercialVendaLeite" (id,"operacaoId","retiradaId",versao,motivo,"criadoPorId","criadoEm")
SELECT md5('venda-leite-v1:'||m.id),m."operacaoId",m.id,1,
  'Vínculo da retirada existente; identidade de reenvio histórica não inferida',o."criadoPorId",o."createdAt"
FROM public."MovimentoEstoque" m JOIN public."Operacao" o ON o.id=m."operacaoId"
WHERE m."metodoValorizacao"='LEITE_FIFO_V1' AND m."operacaoId" IS NOT NULL AND m.tipo='SAIDA';

CREATE FUNCTION pecuaria.exigir_identidade_versao_venda_leite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.chave IS NULL OR NEW.hash IS NULL THEN RAISE EXCEPTION 'nova versão comercial exige identidade de reenvio'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "VersaoVendaLeite_identidade" BEFORE INSERT ON pecuaria."VersaoComercialVendaLeite"
FOR EACH ROW EXECUTE FUNCTION pecuaria.exigir_identidade_versao_venda_leite();

CREATE FUNCTION pecuaria.impedir_mutacao_versao_venda_leite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'versão comercial de leite é imutável; registre substituição explícita'; END $$;
CREATE TRIGGER "VersaoVendaLeite_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."VersaoComercialVendaLeite"
FOR EACH ROW EXECUTE FUNCTION pecuaria.impedir_mutacao_versao_venda_leite();

CREATE FUNCTION pecuaria.conferir_cadeia_venda_leite(rid text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE m public."MovimentoEstoque"%ROWTYPE; v record; i public."ItemOperacao"%ROWTYPE;
  n integer; ultima integer; anterior text;
BEGIN
  SELECT * INTO m FROM public."MovimentoEstoque" WHERE id=rid;
  IF NOT FOUND THEN RAISE EXCEPTION 'retirada da cadeia comercial não encontrada'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('valorizacao-estoque:'||m."produtoId"));
  IF m."metodoValorizacao"<>'LEITE_FIFO_V1' OR m.tipo<>'SAIDA' OR m.origem<>'AJUSTE_INVENTARIO'
    OR m.status<>'CONFIRMADO' OR m."reversaoDeId" IS NOT NULL
    OR EXISTS (SELECT 1 FROM public."MovimentoEstoque" WHERE "reversaoDeId"=rid)
  THEN RAISE EXCEPTION 'correção comercial preserva a retirada física única, sem retorno'; END IF;
  SELECT count(*),max(versao) INTO n,ultima FROM pecuaria."VersaoComercialVendaLeite" WHERE "retiradaId"=rid;
  IF n=0 OR ultima<>n THEN RAISE EXCEPTION 'cadeia comercial deve ser contínua desde a versão um'; END IF;
  FOR v IN SELECT c.*,o.tipo,o.status,o.data,o."propriedadeId",o."corrigeOperacaoId"
      FROM pecuaria."VersaoComercialVendaLeite" c JOIN public."Operacao" o ON o.id=c."operacaoId"
      WHERE c."retiradaId"=rid ORDER BY c.versao LOOP
    IF v.tipo<>'VENDA' OR v.data<>m.data OR v."propriedadeId" IS DISTINCT FROM m."propriedadeId"
      OR (v.versao=1 AND (v."operacaoId"<>m."operacaoId" OR v."corrigeOperacaoId" IS NOT NULL))
      OR (v.versao>1 AND (v."corrigeOperacaoId" IS DISTINCT FROM anterior OR v.chave IS NULL))
    THEN RAISE EXCEPTION 'cadeia comercial diverge da retirada ou da versão anterior'; END IF;
    IF (v.versao=ultima AND v.status<>'CONFIRMADA') OR (v.versao<ultima AND v.status<>'CANCELADA')
    THEN RAISE EXCEPTION 'somente a última versão comercial permanece confirmada'; END IF;
    SELECT * INTO i FROM public."ItemOperacao" WHERE "operacaoId"=v."operacaoId" ORDER BY ordem LIMIT 1;
    IF NOT FOUND OR (SELECT count(*) FROM public."ItemOperacao" WHERE "operacaoId"=v."operacaoId")<>1
      OR i."produtoId" IS DISTINCT FROM m."produtoId" OR i.quantidade<>m.quantidade OR i.unidade<>'L' OR NOT i.estocavel
    THEN RAISE EXCEPTION 'correção comercial conserva produto, litros e unidade da retirada'; END IF;
    IF (SELECT count(*) FROM public."MovimentoEstoque" WHERE "operacaoId"=v."operacaoId")<>CASE WHEN v.versao=1 THEN 1 ELSE 0 END
    THEN RAISE EXCEPTION 'substituta comercial não cria outro movimento de estoque'; END IF;
    IF v.versao<ultima AND (
      EXISTS (SELECT 1 FROM public."TransacaoFinanceira" t WHERE t."operacaoId"=v."operacaoId" AND t.status='CONFIRMADA' AND t.tipo<>'REVERSAO')
      OR EXISTS (SELECT 1 FROM public."CompromissoFinanceiro" c WHERE c."operacaoId"=v."operacaoId" AND c.status<>'CANCELADO')
      OR EXISTS (SELECT 1 FROM public."CompromissoFinanceiro" c JOIN public."Liquidacao" l ON l."compromissoId"=c.id
        JOIN public."TransacaoFinanceira" t ON t.id=l."transacaoId" WHERE c."operacaoId"=v."operacaoId" AND t.status='CONFIRMADA')
    ) THEN RAISE EXCEPTION 'estorne explicitamente recebimentos antes da correção e cancele compromissos substituídos'; END IF;
    IF EXISTS (SELECT 1 FROM public."Operacao" o WHERE o."corrigeOperacaoId"=v."operacaoId"
      AND NOT EXISTS (SELECT 1 FROM pecuaria."VersaoComercialVendaLeite" c WHERE c."operacaoId"=o.id AND c."retiradaId"=rid AND c.versao=v.versao+1))
    THEN RAISE EXCEPTION 'correção de venda leiteira exige vínculo linear com a mesma retirada'; END IF;
    anterior:=v."operacaoId";
  END LOOP;
END $$;

-- A constraint diferida observa toda a substituição atômica, nunca um estado intermediário.
CREATE FUNCTION pecuaria.guard_cadeia_venda_leite() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE rid text; oid text; mid text;
BEGIN
  IF TG_TABLE_NAME='VersaoComercialVendaLeite' THEN
    PERFORM pecuaria.conferir_cadeia_venda_leite(NEW."retiradaId"); RETURN NULL;
  ELSIF TG_TABLE_NAME='Operacao' THEN
    oid:=NEW.id;
    FOR rid IN SELECT DISTINCT "retiradaId" FROM pecuaria."VersaoComercialVendaLeite"
      WHERE "operacaoId"=oid OR "operacaoId"=NEW."corrigeOperacaoId" LOOP
      PERFORM pecuaria.conferir_cadeia_venda_leite(rid);
    END LOOP; RETURN NULL;
  ELSIF TG_TABLE_NAME='MovimentoEstoque' THEN
    mid:=CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END;
    oid:=CASE WHEN TG_OP='DELETE' THEN OLD."operacaoId" ELSE NEW."operacaoId" END;
    FOR rid IN SELECT DISTINCT "retiradaId" FROM pecuaria."VersaoComercialVendaLeite" WHERE "retiradaId"=mid OR "operacaoId"=oid LOOP
      PERFORM pecuaria.conferir_cadeia_venda_leite(rid);
    END LOOP;
    -- Todo novo movimento leiteiro de venda exige a cadeia, inclusive fora dos serviços.
    IF TG_OP<>'DELETE' AND NEW."metodoValorizacao"='LEITE_FIFO_V1' AND NEW.tipo='SAIDA' AND NEW."operacaoId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM pecuaria."VersaoComercialVendaLeite" WHERE "retiradaId"=NEW.id)
    THEN RAISE EXCEPTION 'retirada de venda leiteira exige versão comercial'; END IF;
    RETURN NULL;
  ELSIF TG_TABLE_NAME='Liquidacao' THEN
    SELECT "operacaoId" INTO oid FROM public."CompromissoFinanceiro" WHERE id=NEW."compromissoId";
  ELSE
    oid:=CASE WHEN TG_OP='DELETE' THEN OLD."operacaoId" ELSE NEW."operacaoId" END;
  END IF;
  SELECT "retiradaId" INTO rid FROM pecuaria."VersaoComercialVendaLeite" WHERE "operacaoId"=oid;
  IF rid IS NOT NULL THEN PERFORM pecuaria.conferir_cadeia_venda_leite(rid); END IF;
  -- Reatribuir um fato financeiro/item também precisa validar a cadeia de origem.
  IF TG_OP='UPDATE' AND TG_TABLE_NAME IN ('ItemOperacao','CompromissoFinanceiro','TransacaoFinanceira') THEN
    SELECT "retiradaId" INTO rid FROM pecuaria."VersaoComercialVendaLeite" WHERE "operacaoId"=OLD."operacaoId";
    IF rid IS NOT NULL THEN PERFORM pecuaria.conferir_cadeia_venda_leite(rid); END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "VersaoVendaLeite_cadeia" AFTER INSERT ON pecuaria."VersaoComercialVendaLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_cadeia_venda_leite();
CREATE CONSTRAINT TRIGGER "Operacao_cadeia_leite" AFTER INSERT OR UPDATE ON public."Operacao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_cadeia_venda_leite();
CREATE CONSTRAINT TRIGGER "Item_cadeia_leite" AFTER INSERT OR UPDATE OR DELETE ON public."ItemOperacao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_cadeia_venda_leite();
CREATE CONSTRAINT TRIGGER "Movimento_cadeia_leite" AFTER INSERT OR UPDATE OR DELETE ON public."MovimentoEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_cadeia_venda_leite();
CREATE CONSTRAINT TRIGGER "Compromisso_cadeia_leite" AFTER INSERT OR UPDATE OR DELETE ON public."CompromissoFinanceiro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_cadeia_venda_leite();
CREATE CONSTRAINT TRIGGER "Transacao_cadeia_leite" AFTER INSERT OR UPDATE OR DELETE ON public."TransacaoFinanceira" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_cadeia_venda_leite();
CREATE CONSTRAINT TRIGGER "Liquidacao_cadeia_leite" AFTER INSERT OR UPDATE ON public."Liquidacao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_cadeia_venda_leite();

-- Valida o backfill com as mesmas regras aplicadas às escritas novas.
DO $$ DECLARE rid text; BEGIN
  FOR rid IN SELECT DISTINCT "retiradaId" FROM pecuaria."VersaoComercialVendaLeite" LOOP
    PERFORM pecuaria.conferir_cadeia_venda_leite(rid);
  END LOOP;
END $$;
