-- CreateTable
CREATE TABLE "pecuaria"."EntregaLeite" (
    "id" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "parceiroId" TEXT NOT NULL,
    "retiradaId" TEXT NOT NULL,
    "pontoColeta" TEXT,
    "horarioColeta" TEXT,
    "referencia" TEXT NOT NULL,
    "criadoPorId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntregaLeite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ConferenciaEntregaLeite" (
    "id" TEXT NOT NULL,
    "entregaId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "volumeAceito" DECIMAL(12,3),
    "situacao" TEXT NOT NULL,
    "destinacaoInformada" TEXT,
    "motivo" TEXT NOT NULL,
    "criadoPorId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConferenciaEntregaLeite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."DemonstrativoLeite" (
    "id" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "parceiroId" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,
    "referencia" TEXT NOT NULL,
    "precoBase" DECIMAL(14,4) NOT NULL,
    "volumeReconhecido" DECIMAL(12,3) NOT NULL,
    "valorComercial" DECIMAL(14,2) NOT NULL,
    "valorPagamentoInformado" DECIMAL(14,2),
    "componentes" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VALIDO',
    "versao" INTEGER NOT NULL DEFAULT 1,
    "motivoAnulacao" TEXT,
    "anuladoEm" TIMESTAMP(3),
    "criadoPorId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemonstrativoLeite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."AlocacaoDemonstrativoLeite" (
    "id" TEXT NOT NULL,
    "demonstrativoId" TEXT NOT NULL,
    "entregaId" TEXT NOT NULL,
    "versaoVendaId" TEXT NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "motivoAceitePendente" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AlocacaoDemonstrativoLeite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ComprovanteEntregaLeite" (
    "id" TEXT NOT NULL,
    "entregaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "storageKey" TEXT NOT NULL,
    "criadoPorId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComprovanteEntregaLeite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EntregaLeite_retiradaId_key" ON "pecuaria"."EntregaLeite"("retiradaId");

-- CreateIndex
CREATE INDEX "EntregaLeite_propriedadeId_criadoEm_idx" ON "pecuaria"."EntregaLeite"("propriedadeId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "ConferenciaEntregaLeite_entregaId_versao_key" ON "pecuaria"."ConferenciaEntregaLeite"("entregaId", "versao");

-- CreateIndex
CREATE INDEX "DemonstrativoLeite_propriedadeId_inicio_fim_idx" ON "pecuaria"."DemonstrativoLeite"("propriedadeId", "inicio", "fim");

-- CreateIndex
CREATE INDEX "AlocacaoDemonstrativoLeite_entregaId_ativo_idx" ON "pecuaria"."AlocacaoDemonstrativoLeite"("entregaId", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "AlocacaoDemonstrativoLeite_demonstrativoId_entregaId_key" ON "pecuaria"."AlocacaoDemonstrativoLeite"("demonstrativoId", "entregaId");

-- CreateIndex
CREATE UNIQUE INDEX "ComprovanteEntregaLeite_storageKey_key" ON "pecuaria"."ComprovanteEntregaLeite"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "ComprovanteEntregaLeite_entregaId_sha256_key" ON "pecuaria"."ComprovanteEntregaLeite"("entregaId", "sha256");

-- AddForeignKey
ALTER TABLE "pecuaria"."EntregaLeite" ADD CONSTRAINT "EntregaLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."EntregaLeite" ADD CONSTRAINT "EntregaLeite_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES "Parceiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."EntregaLeite" ADD CONSTRAINT "EntregaLeite_retiradaId_fkey" FOREIGN KEY ("retiradaId") REFERENCES "MovimentoEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ConferenciaEntregaLeite" ADD CONSTRAINT "ConferenciaEntregaLeite_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "pecuaria"."EntregaLeite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."DemonstrativoLeite" ADD CONSTRAINT "DemonstrativoLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."DemonstrativoLeite" ADD CONSTRAINT "DemonstrativoLeite_parceiroId_fkey" FOREIGN KEY ("parceiroId") REFERENCES "Parceiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AlocacaoDemonstrativoLeite" ADD CONSTRAINT "AlocacaoDemonstrativoLeite_demonstrativoId_fkey" FOREIGN KEY ("demonstrativoId") REFERENCES "pecuaria"."DemonstrativoLeite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AlocacaoDemonstrativoLeite" ADD CONSTRAINT "AlocacaoDemonstrativoLeite_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "pecuaria"."EntregaLeite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AlocacaoDemonstrativoLeite" ADD CONSTRAINT "AlocacaoDemonstrativoLeite_versaoVendaId_fkey" FOREIGN KEY ("versaoVendaId") REFERENCES "pecuaria"."VersaoComercialVendaLeite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ComprovanteEntregaLeite" ADD CONSTRAINT "ComprovanteEntregaLeite_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "pecuaria"."EntregaLeite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE pecuaria."ConferenciaEntregaLeite" ADD CONSTRAINT "ConferenciaEntrega_contrato" CHECK (
 versao>0 AND ("volumeAceito" IS NULL OR "volumeAceito">=0) AND length(trim(motivo))>=5
 AND situacao IN ('PENDENTE','ACEITE_INFORMADO','DIVERGENCIA','REJEITADA','DESTINACAO_POSTERIOR')
 AND (situacao<>'PENDENTE' OR "volumeAceito" IS NULL)
 AND (situacao NOT IN ('ACEITE_INFORMADO','REJEITADA') OR "volumeAceito" IS NOT NULL)
 AND (situacao<>'REJEITADA' OR "volumeAceito"=0)
 AND (situacao<>'DESTINACAO_POSTERIOR' OR COALESCE(length(trim("destinacaoInformada")),0)>=5));
ALTER TABLE pecuaria."DemonstrativoLeite" ADD CONSTRAINT "DemonstrativoLeite_contrato" CHECK (
 inicio<=fim AND "precoBase">=0 AND "volumeReconhecido">0 AND "valorComercial">0
 AND ("valorPagamentoInformado" IS NULL OR "valorPagamentoInformado">=0)
 AND status IN ('VALIDO','ANULADO') AND jsonb_typeof(componentes)='array'
 AND ((status='VALIDO' AND versao=1 AND "anuladoEm" IS NULL AND "motivoAnulacao" IS NULL)
 OR (status='ANULADO' AND versao=2 AND "anuladoEm" IS NOT NULL AND length(trim("motivoAnulacao"))>=5)));
ALTER TABLE pecuaria."AlocacaoDemonstrativoLeite" ADD CONSTRAINT "AlocacaoDemonstrativoLeite_positiva" CHECK (quantidade>0 AND valor>0);
ALTER TABLE pecuaria."EntregaLeite" ADD CONSTRAINT "EntregaLeite_horario" CHECK ("horarioColeta" IS NULL OR "horarioColeta" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

CREATE FUNCTION pecuaria.imutavel_comercial_leite() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 RAISE EXCEPTION 'fato comercial leiteiro é imutável; registre conferência ou anulação explícita'; END $$;
CREATE TRIGGER "EntregaLeite_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."EntregaLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.imutavel_comercial_leite();
CREATE TRIGGER "ConferenciaEntregaLeite_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."ConferenciaEntregaLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.imutavel_comercial_leite();
CREATE TRIGGER "ComprovanteEntregaLeite_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."ComprovanteEntregaLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.imutavel_comercial_leite();
CREATE FUNCTION pecuaria.anular_comercial_leite() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'histórico comercial não pode ser apagado'; END IF;
 IF TG_TABLE_NAME='DemonstrativoLeite' THEN
  IF OLD.status<>'VALIDO' OR NEW.status<>'ANULADO' OR NEW.versao<>OLD.versao+1
   OR (to_jsonb(OLD)-ARRAY['status','versao','motivoAnulacao','anuladoEm'])<>(to_jsonb(NEW)-ARRAY['status','versao','motivoAnulacao','anuladoEm'])
  THEN RAISE EXCEPTION 'demonstrativo permite somente anulação identificada'; END IF;
 ELSE
  IF NOT OLD.ativo OR NEW.ativo OR (to_jsonb(OLD)-'ativo')<>(to_jsonb(NEW)-'ativo')
  THEN RAISE EXCEPTION 'parcela comercial permite somente desativação pela anulação do demonstrativo'; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER "DemonstrativoLeite_anular" BEFORE UPDATE OR DELETE ON pecuaria."DemonstrativoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.anular_comercial_leite();
CREATE TRIGGER "AlocacaoDemonstrativoLeite_anular" BEFORE UPDATE OR DELETE ON pecuaria."AlocacaoDemonstrativoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.anular_comercial_leite();

CREATE FUNCTION pecuaria.conferir_entrega_leite(eid text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE e pecuaria."EntregaLeite"%ROWTYPE; m public."MovimentoEstoque"%ROWTYPE;
 c pecuaria."ConferenciaEntregaLeite"%ROWTYPE; v record; q numeric; val numeric; maximo numeric;
BEGIN
 SELECT * INTO e FROM pecuaria."EntregaLeite" WHERE id=eid; IF NOT FOUND THEN RETURN; END IF;
 SELECT * INTO m FROM public."MovimentoEstoque" WHERE id=e."retiradaId";
 PERFORM pg_advisory_xact_lock(hashtext('valorizacao-estoque:'||m."produtoId"));
 SELECT cv.*,o.status AS estado,o."valorTotal",o."parceiroId" FROM pecuaria."VersaoComercialVendaLeite" cv JOIN public."Operacao" o ON o.id=cv."operacaoId" WHERE cv."retiradaId"=m.id ORDER BY cv.versao DESC LIMIT 1 INTO v;
 IF NOT FOUND OR m.status<>'CONFIRMADO' OR m."metodoValorizacao"<>'LEITE_FIFO_V1' OR m.tipo<>'SAIDA' OR m."reversaoDeId" IS NOT NULL OR m."propriedadeId" IS DISTINCT FROM e."propriedadeId" OR v.estado<>'CONFIRMADA'
 THEN RAISE EXCEPTION 'entrega exige retirada leiteira única comprovada e venda vigente no sítio'; END IF;
 SELECT * INTO c FROM pecuaria."ConferenciaEntregaLeite" WHERE "entregaId"=eid ORDER BY versao DESC LIMIT 1;
 IF NOT FOUND OR c.versao<>(SELECT count(*) FROM pecuaria."ConferenciaEntregaLeite" WHERE "entregaId"=eid)
 THEN RAISE EXCEPTION 'conferência deve ser contínua'; END IF;
 SELECT COALESCE(sum(quantidade),0),COALESCE(sum(valor),0) INTO q,val FROM pecuaria."AlocacaoDemonstrativoLeite" WHERE "entregaId"=eid AND ativo;
 maximo:=LEAST(m.quantidade,COALESCE(c."volumeAceito",m.quantidade));
 IF q>maximo OR val>v."valorTotal" OR (q=maximo)<>(val=v."valorTotal") AND q>0
 THEN RAISE EXCEPTION 'faturamento parcial supera saldo comercial ou encerra somente litros/valor'; END IF;
 IF EXISTS (SELECT 1 FROM pecuaria."AlocacaoDemonstrativoLeite" a JOIN pecuaria."DemonstrativoLeite" d ON d.id=a."demonstrativoId"
  WHERE a."entregaId"=eid AND (a.ativo<>(d.status='VALIDO') OR (a.ativo AND (a."versaoVendaId"<>v.id OR d."propriedadeId"<>e."propriedadeId" OR d."parceiroId" IS DISTINCT FROM v."parceiroId" OR m.data<d.inicio OR m.data>d.fim OR (c."volumeAceito" IS NULL AND COALESCE(length(trim(a."motivoAceitePendente")),0)<5)))))
 THEN RAISE EXCEPTION 'parcela exige venda vigente, escopo/período/comprador e aceite conhecido ou pendência explícita'; END IF;
END $$;
CREATE FUNCTION pecuaria.conferir_demonstrativo_leite(did text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE d pecuaria."DemonstrativoLeite"%ROWTYPE; q numeric; v numeric; comp jsonb;
BEGIN
 SELECT * INTO d FROM pecuaria."DemonstrativoLeite" WHERE id=did; IF NOT FOUND THEN RETURN; END IF;
 SELECT COALESCE(sum(quantidade),0),COALESCE(sum(valor),0) INTO q,v FROM pecuaria."AlocacaoDemonstrativoLeite" WHERE "demonstrativoId"=did;
 IF q<>d."volumeReconhecido" OR v<>d."valorComercial" THEN RAISE EXCEPTION 'parcelas não conciliam totais declarados do demonstrativo'; END IF;
 IF EXISTS (SELECT 1 FROM pecuaria."AlocacaoDemonstrativoLeite" WHERE "demonstrativoId"=did AND ativo<>(d.status='VALIDO')) THEN RAISE EXCEPTION 'anulação deve desativar todas as parcelas, sem apagar histórico'; END IF;
 FOR comp IN SELECT value FROM jsonb_array_elements(d.componentes) LOOP
  IF COALESCE(comp->>'natureza','') NOT IN ('BONUS','DESCONTO','RETENCAO','ADIANTAMENTO') OR COALESCE(length(trim(comp->>'referencia')),0)<5 OR jsonb_typeof(comp->'valor') IS DISTINCT FROM 'number' OR COALESCE((comp->>'valor')::numeric,0)<=0
  THEN RAISE EXCEPTION 'componente documental exige natureza, valor positivo e referência'; END IF;
 END LOOP;
END $$;
CREATE FUNCTION pecuaria.guard_comercial_leite() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE eid text; did text; rid text;
BEGIN
 IF TG_TABLE_NAME='Operacao' THEN
  FOR eid IN SELECT e.id FROM pecuaria."EntregaLeite" e JOIN pecuaria."VersaoComercialVendaLeite" v ON v."retiradaId"=e."retiradaId" WHERE v."operacaoId"=NEW.id OR v."operacaoId"=NEW."corrigeOperacaoId" LOOP PERFORM pecuaria.conferir_entrega_leite(eid); END LOOP; RETURN NULL;
 ELSIF TG_TABLE_NAME='EntregaLeite' THEN
  eid:=NEW.id;
  IF NOT EXISTS (SELECT 1 FROM pecuaria."VersaoComercialVendaLeite" v JOIN public."Operacao" o ON o.id=v."operacaoId"
    WHERE v."retiradaId"=NEW."retiradaId" AND o.status='CONFIRMADA' AND o."parceiroId"=NEW."parceiroId" AND o."propriedadeId"=NEW."propriedadeId")
  THEN RAISE EXCEPTION 'comprador original da entrega deve conferir com a venda vigente no registro'; END IF;
 ELSIF TG_TABLE_NAME='ConferenciaEntregaLeite' THEN eid:=NEW."entregaId";
 ELSIF TG_TABLE_NAME='DemonstrativoLeite' THEN
  did:=NEW.id; FOR eid IN SELECT "entregaId" FROM pecuaria."AlocacaoDemonstrativoLeite" WHERE "demonstrativoId"=did LOOP PERFORM pecuaria.conferir_entrega_leite(eid); END LOOP;
 ELSE eid:=NEW."entregaId"; did:=NEW."demonstrativoId";
 END IF;
 IF eid IS NOT NULL THEN PERFORM pecuaria.conferir_entrega_leite(eid); END IF;
 IF did IS NOT NULL THEN PERFORM pecuaria.conferir_demonstrativo_leite(did); END IF; RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "EntregaLeite_guard" AFTER INSERT ON pecuaria."EntregaLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_comercial_leite();
CREATE CONSTRAINT TRIGGER "ConferenciaEntregaLeite_guard" AFTER INSERT ON pecuaria."ConferenciaEntregaLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_comercial_leite();
CREATE CONSTRAINT TRIGGER "DemonstrativoLeite_guard" AFTER INSERT OR UPDATE ON pecuaria."DemonstrativoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_comercial_leite();
CREATE CONSTRAINT TRIGGER "AlocacaoDemonstrativoLeite_guard" AFTER INSERT OR UPDATE ON pecuaria."AlocacaoDemonstrativoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_comercial_leite();
CREATE CONSTRAINT TRIGGER "Operacao_demonstrativo_leite_guard" AFTER INSERT OR UPDATE ON public."Operacao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_comercial_leite();

CREATE FUNCTION pecuaria.travar_conferencia_entrega_leite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM pecuaria."AlocacaoDemonstrativoLeite" WHERE "entregaId"=NEW."entregaId" AND ativo)
 THEN RAISE EXCEPTION 'anule demonstrativos ativos antes de alterar a conferência da entrega'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "ConferenciaEntregaLeite_documentos" BEFORE INSERT ON pecuaria."ConferenciaEntregaLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_conferencia_entrega_leite();
