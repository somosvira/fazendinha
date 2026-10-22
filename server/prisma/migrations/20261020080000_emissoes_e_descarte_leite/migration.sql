-- CreateTable
CREATE TABLE "pecuaria"."DescarteLeite" (
    "id" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "entradaId" TEXT NOT NULL,
    "movimentoId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "quantidadeLitros" DECIMAL(14,3) NOT NULL,
    "saldoOrigemAntes" DECIMAL(14,3) NOT NULL,
    "saldoOrigemDepois" DECIMAL(14,3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMADO',
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "estornadoEm" TIMESTAMP(3),
    "estornadoPorId" INTEGER,
    "motivoEstorno" TEXT,
    "movimentoEstornoId" TEXT,

    CONSTRAINT "DescarteLeite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."EmissaoRelatorioLeite" (
    "id" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,
    "corteEm" TIMESTAMP(3) NOT NULL,
    "versaoCalculo" TEXT NOT NULL,
    "filtros" JSONB NOT NULL,
    "snapshot" JSONB NOT NULL,
    "valoresIncluidos" BOOLEAN NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "EmissaoRelatorioLeite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DescarteLeite_movimentoId_key" ON "pecuaria"."DescarteLeite"("movimentoId");

-- CreateIndex
CREATE UNIQUE INDEX "DescarteLeite_movimentoEstornoId_key" ON "pecuaria"."DescarteLeite"("movimentoEstornoId");

-- CreateIndex
CREATE INDEX "DescarteLeite_propriedadeId_data_idx" ON "pecuaria"."DescarteLeite"("propriedadeId", "data");

-- CreateIndex
CREATE INDEX "EmissaoRelatorioLeite_propriedadeId_criadoEm_idx" ON "pecuaria"."EmissaoRelatorioLeite"("propriedadeId", "criadoEm");

-- AddForeignKey
ALTER TABLE "pecuaria"."DescarteLeite" ADD CONSTRAINT "DescarteLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."DescarteLeite" ADD CONSTRAINT "DescarteLeite_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES "pecuaria"."EntradaProducaoLeite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."DescarteLeite" ADD CONSTRAINT "DescarteLeite_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES "MovimentoEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."DescarteLeite" ADD CONSTRAINT "DescarteLeite_movimentoEstornoId_fkey" FOREIGN KEY ("movimentoEstornoId") REFERENCES "MovimentoEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."EmissaoRelatorioLeite" ADD CONSTRAINT "EmissaoRelatorioLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE pecuaria."EmissaoRelatorioLeite" ADD CONSTRAINT "EmissaoLeite_periodo" CHECK (inicio<=fim AND fim-inicio<366 AND length("versaoCalculo")>0 AND jsonb_typeof(snapshot)='object');
ALTER TABLE pecuaria."DescarteLeite" ADD CONSTRAINT "DescarteLeite_quantidades" CHECK ("quantidadeLitros">0 AND "saldoOrigemAntes">="quantidadeLitros" AND "saldoOrigemDepois"="saldoOrigemAntes"-"quantidadeLitros" AND length(btrim(motivo))>=5);
CREATE FUNCTION pecuaria.proteger_emissao_leite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Emissão de leite é histórica; gere outra emissão sem reescrever o corte' USING ERRCODE='23514'; END $$;
CREATE TRIGGER "EmissaoLeite_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."EmissaoRelatorioLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_emissao_leite();

CREATE FUNCTION pecuaria.proteger_descarte_leite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Histórico de descarte não pode ser apagado' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'CONFIRMADO' OR NEW.versao<>1 OR NEW."movimentoEstornoId" IS NOT NULL OR NEW."estornadoEm" IS NOT NULL OR NEW."estornadoPorId" IS NOT NULL OR NEW."motivoEstorno" IS NOT NULL
    THEN RAISE EXCEPTION 'Descarte inicia confirmado na versão um, sem estorno' USING ERRCODE='23514'; END IF;
  ELSE
    IF (to_jsonb(NEW)-ARRAY['status','versao','estornadoEm','estornadoPorId','motivoEstorno','movimentoEstornoId']) IS DISTINCT FROM
       (to_jsonb(OLD)-ARRAY['status','versao','estornadoEm','estornadoPorId','motivoEstorno','movimentoEstornoId'])
      OR OLD.status<>'CONFIRMADO' OR NEW.status<>'ESTORNADO' OR NEW.versao<>OLD.versao+1 OR NEW."movimentoEstornoId" IS NULL OR NEW."estornadoEm" IS NULL OR NEW."motivoEstorno" IS NULL OR length(btrim(NEW."motivoEstorno"))<5
    THEN RAISE EXCEPTION 'Fatos do descarte são imutáveis; apenas estorno terminal com versão e motivo' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "DescarteLeite_imutavel" BEFORE INSERT OR UPDATE OR DELETE ON pecuaria."DescarteLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_descarte_leite();

CREATE FUNCTION pecuaria.validar_descarte_leite(did text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE d record; m record; e record; inv record; n bigint; q numeric;
BEGIN
  SELECT * INTO d FROM pecuaria."DescarteLeite" WHERE id=did;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO m FROM public."MovimentoEstoque" WHERE id=d."movimentoId";
  SELECT ep.*,em."produtoId",em.data AS "dataProducao",em."propriedadeId" INTO e FROM pecuaria."EntradaProducaoLeite" ep JOIN public."MovimentoEstoque" em ON em.id=ep."movimentoId" WHERE ep.id=d."entradaId";
  SELECT count(*),sum(quantidade) INTO n,q FROM pecuaria."AlocacaoLeiteEstoque" WHERE "movimentoId"=m.id AND "entradaId"=e.id AND finalidade='DESCARTE';
  IF e."propriedadeId"<>d."propriedadeId" OR m."propriedadeId"<>d."propriedadeId" OR e."produtoId"<>m."produtoId" OR d.data<>m.data OR d.data<e."dataProducao"
    OR m.tipo<>'SAIDA' OR m.origem<>'PERDA' OR m."metodoValorizacao"<>'LEITE_FIFO_V1' OR m."operacaoId" IS NOT NULL OR m."reversaoDeId" IS NOT NULL
    OR m.quantidade<>d."quantidadeLitros" OR n<>1 OR q<>d."quantidadeLitros" OR (SELECT count(*) FROM pecuaria."AlocacaoLeiteEstoque" WHERE "movimentoId"=m.id)<>1
    OR (d.status='CONFIRMADO' AND (m.status<>'CONFIRMADO' OR e.status<>'CONFIRMADA'))
    OR (d.status='ESTORNADO' AND m.status<>'REVERTIDO') OR d.status NOT IN ('CONFIRMADO','ESTORNADO')
  THEN RAISE EXCEPTION 'Descarte exige saída única com origem, sítio, data e litros conciliados, sem venda ou destinatário' USING ERRCODE='23514'; END IF;
  IF d.status='ESTORNADO' THEN
    SELECT * INTO inv FROM public."MovimentoEstoque" WHERE id=d."movimentoEstornoId";
    IF NOT FOUND OR inv."reversaoDeId"<>m.id OR inv.tipo<>'ENTRADA' OR inv.status<>'CONFIRMADO' OR inv.quantidade<>m.quantidade OR inv."propriedadeId"<>d."propriedadeId" OR inv."produtoId"<>m."produtoId" OR inv.origem<>'PERDA' OR inv.observacao IS DISTINCT FROM d."motivoEstorno"
    THEN RAISE EXCEPTION 'Estorno de descarte exige inverso preservado e motivo' USING ERRCODE='23514'; END IF;
  END IF;
END $$;
CREATE FUNCTION pecuaria.conferir_descarte_leite() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE did text;
BEGIN
  IF TG_TABLE_NAME='DescarteLeite' THEN
    PERFORM pecuaria.validar_descarte_leite(NEW.id);
  ELSIF TG_TABLE_NAME='AlocacaoLeiteEstoque' THEN
    FOR did IN SELECT id FROM pecuaria."DescarteLeite" WHERE "movimentoId"=NEW."movimentoId" LOOP PERFORM pecuaria.validar_descarte_leite(did); END LOOP;
  ELSE
    IF NEW."metodoValorizacao"='LEITE_FIFO_V1' AND NEW.origem='PERDA' AND NEW."reversaoDeId" IS NULL AND NOT EXISTS (SELECT 1 FROM pecuaria."DescarteLeite" WHERE "movimentoId"=NEW.id)
    THEN RAISE EXCEPTION 'Perda leiteira exige fato de descarte rastreado' USING ERRCODE='23514'; END IF;
    FOR did IN SELECT id FROM pecuaria."DescarteLeite" WHERE "movimentoId"=NEW.id OR "movimentoEstornoId"=NEW.id LOOP PERFORM pecuaria.validar_descarte_leite(did); END LOOP;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "DescarteLeite_conferir" AFTER INSERT OR UPDATE ON pecuaria."DescarteLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_descarte_leite();
CREATE CONSTRAINT TRIGGER "DescarteLeite_movimento" AFTER INSERT OR UPDATE ON public."MovimentoEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_descarte_leite();
CREATE CONSTRAINT TRIGGER "DescarteLeite_alocacao" AFTER INSERT ON pecuaria."AlocacaoLeiteEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_descarte_leite();
