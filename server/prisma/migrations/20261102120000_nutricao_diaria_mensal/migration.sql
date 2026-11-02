BEGIN;

-- CreateTable
CREATE TABLE "pecuaria"."ConfiguracaoNutricao" (
    "id" TEXT NOT NULL,
    "escopo" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "loteId" TEXT,
    "desde" DATE NOT NULL,
    "modelo" TEXT NOT NULL,
    "diaConferencia" INTEGER NOT NULL,
    "autorizaValidade" BOOLEAN NOT NULL DEFAULT false,
    "usuarioId" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfiguracaoNutricao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."MesNutricao" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "competencia" DATE NOT NULL,
    "inicio" DATE NOT NULL,
    "configuracaoId" TEXT NOT NULL,
    "revisao" INTEGER NOT NULL DEFAULT 1,
    "revisadoEm" TIMESTAMP(3),
    "revisadoPorId" INTEGER,

    CONSTRAINT "MesNutricao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ConsumoDiario" (
    "id" TEXT NOT NULL,
    "mesId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "dietaId" TEXT,
    "dietaNome" TEXT,
    "centroCustoId" TEXT,
    "baseHash" TEXT NOT NULL,
    "situacao" TEXT NOT NULL DEFAULT 'PREVISTO',
    "pendencia" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsumoDiario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ParticipacaoConsumoDiario" (
    "id" TEXT NOT NULL,
    "diaId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,

    CONSTRAINT "ParticipacaoConsumoDiario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ItemConsumoDiario" (
    "id" TEXT NOT NULL,
    "diaId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "prevista" DECIMAL(12,3) NOT NULL,
    "confirmada" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "custoLiquido" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "origemQuantidade" TEXT NOT NULL DEFAULT 'CALCULADA',

    CONSTRAINT "ItemConsumoDiario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."MovimentoConsumoDiario" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "movimentoId" TEXT NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "motivo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentoConsumoDiario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConfiguracaoNutricao_propriedadeId_desde_idx" ON "pecuaria"."ConfiguracaoNutricao"("propriedadeId", "desde");

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracaoNutricao_escopo_desde_key" ON "pecuaria"."ConfiguracaoNutricao"("escopo", "desde");

-- CreateIndex
CREATE INDEX "MesNutricao_propriedadeId_competencia_idx" ON "pecuaria"."MesNutricao"("propriedadeId", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "MesNutricao_loteId_competencia_key" ON "pecuaria"."MesNutricao"("loteId", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumoDiario_mesId_data_key" ON "pecuaria"."ConsumoDiario"("mesId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipacaoConsumoDiario_diaId_animalId_key" ON "pecuaria"."ParticipacaoConsumoDiario"("diaId", "animalId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemConsumoDiario_diaId_produtoId_key" ON "pecuaria"."ItemConsumoDiario"("diaId", "produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "MovimentoConsumoDiario_movimentoId_key" ON "pecuaria"."MovimentoConsumoDiario"("movimentoId");

-- CreateIndex
CREATE INDEX "MovimentoConsumoDiario_itemId_idx" ON "pecuaria"."MovimentoConsumoDiario"("itemId");

-- AddForeignKey
ALTER TABLE "pecuaria"."ConfiguracaoNutricao" ADD CONSTRAINT "ConfiguracaoNutricao_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ConfiguracaoNutricao" ADD CONSTRAINT "ConfiguracaoNutricao_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "pecuaria"."Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MesNutricao" ADD CONSTRAINT "MesNutricao_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "pecuaria"."Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MesNutricao" ADD CONSTRAINT "MesNutricao_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MesNutricao" ADD CONSTRAINT "MesNutricao_configuracaoId_fkey" FOREIGN KEY ("configuracaoId") REFERENCES "pecuaria"."ConfiguracaoNutricao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ConsumoDiario" ADD CONSTRAINT "ConsumoDiario_mesId_fkey" FOREIGN KEY ("mesId") REFERENCES "pecuaria"."MesNutricao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ParticipacaoConsumoDiario" ADD CONSTRAINT "ParticipacaoConsumoDiario_diaId_fkey" FOREIGN KEY ("diaId") REFERENCES "pecuaria"."ConsumoDiario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ParticipacaoConsumoDiario" ADD CONSTRAINT "ParticipacaoConsumoDiario_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ItemConsumoDiario" ADD CONSTRAINT "ItemConsumoDiario_diaId_fkey" FOREIGN KEY ("diaId") REFERENCES "pecuaria"."ConsumoDiario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ItemConsumoDiario" ADD CONSTRAINT "ItemConsumoDiario_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MovimentoConsumoDiario" ADD CONSTRAINT "MovimentoConsumoDiario_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "pecuaria"."ItemConsumoDiario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MovimentoConsumoDiario" ADD CONSTRAINT "MovimentoConsumoDiario_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES "MovimentoEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE pecuaria."ConfiguracaoNutricao" ADD CONSTRAINT "ConfiguracaoNutricao_regras" CHECK (
  "modelo" IN ('AUTOMATICO','MANUAL','PROVISORIO') AND "diaConferencia" BETWEEN 1 AND 31
  AND "escopo" = CASE WHEN "loteId" IS NULL THEN 'sitio:' || "propriedadeId"::text ELSE 'lote:' || "loteId" END
);
ALTER TABLE pecuaria."MesNutricao" ADD CONSTRAINT "MesNutricao_mes" CHECK (extract(day from competencia)=1 AND inicio >= competencia AND inicio < competencia + interval '1 month');
ALTER TABLE pecuaria."ItemConsumoDiario" ADD CONSTRAINT "ItemConsumoDiario_quantidades" CHECK (prevista >= 0 AND confirmada >= 0 AND "custoLiquido" >= 0);
ALTER TABLE pecuaria."ConsumoDiario" ADD CONSTRAINT "ConsumoDiario_situacao" CHECK (situacao IN ('PREVISTO','PENDENTE','EFETIVADO'));
ALTER TABLE pecuaria."MovimentoConsumoDiario" ADD CONSTRAINT "MovimentoConsumoDiario_sinais" CHECK (quantidade <> 0 AND (quantidade > 0 AND valor >= 0 OR quantidade < 0 AND valor <= 0));

ALTER TABLE pecuaria."ClassificacaoCustoPecuaria" ADD COLUMN "participacaoDiariaId" TEXT UNIQUE REFERENCES pecuaria."ParticipacaoConsumoDiario"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE pecuaria."ClassificacaoCustoPecuaria" DROP CONSTRAINT "ClassificacaoCusto_um_fato";
ALTER TABLE pecuaria."ClassificacaoCustoPecuaria" ADD CONSTRAINT "ClassificacaoCusto_um_fato" CHECK (num_nonnulls("tentativaId","aplicacaoId","exameId","participacaoId","participacaoConsumoId","manejoId","participacaoDiariaId")=1);
CREATE FUNCTION pecuaria.validar_classificacao_diaria() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='UPDATE' AND NEW."participacaoDiariaId" IS DISTINCT FROM OLD."participacaoDiariaId" THEN RAISE EXCEPTION 'fonte diária imutável' USING ERRCODE='23514'; END IF;
 IF NEW."participacaoDiariaId" IS NOT NULL AND (NEW."valorMaterialDocumentado" IS NOT NULL OR NEW."coberturaServico"<>'PROCEDIMENTO' OR NEW."materialNaoAplicavel" OR NEW."servicoNaoAplicavel") THEN RAISE EXCEPTION 'nutrição permite apenas classificação de finalidade' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "Classificacao_diaria_validar" BEFORE INSERT OR UPDATE ON pecuaria."ClassificacaoCustoPecuaria" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_classificacao_diaria();

CREATE FUNCTION pecuaria.validar_configuracao_nutricional() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('nutricao-config:'||NEW."propriedadeId"));
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'configuração versionada é imutável' USING ERRCODE='23514'; END IF;
 IF NEW."loteId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."Lote" l WHERE l.id=NEW."loteId" AND l."propriedadeId"=NEW."propriedadeId") THEN RAISE EXCEPTION 'configuração fora do sítio' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM pecuaria."FechamentoConsumo" f WHERE f."propriedadeId"=NEW."propriedadeId" AND (NEW."loteId" IS NULL OR f."loteId"=NEW."loteId") AND f.status='CONFIRMADO' AND f.fim>=NEW.desde) THEN RAISE EXCEPTION 'ativação sobrepõe histórico confirmado' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "ConfiguracaoNutricao_validar" BEFORE INSERT OR UPDATE ON pecuaria."ConfiguracaoNutricao" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_configuracao_nutricional();
CREATE FUNCTION pecuaria.impedir_consumo_legado_sobreposto() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('nutricao-config:'||NEW."propriedadeId"));
 IF NEW.status='CONFIRMADO' AND EXISTS(SELECT 1 FROM pecuaria."ConfiguracaoNutricao" c WHERE c."propriedadeId"=NEW."propriedadeId" AND (c."loteId" IS NULL OR c."loteId"=NEW."loteId") AND c.desde<=NEW.fim) THEN RAISE EXCEPTION 'período utiliza nutrição mensal' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "FechamentoConsumo_modelo" BEFORE INSERT OR UPDATE ON pecuaria."FechamentoConsumo" FOR EACH ROW EXECUTE FUNCTION pecuaria.impedir_consumo_legado_sobreposto();

CREATE FUNCTION pecuaria.validar_mes_nutricional() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pecuaria."ConfiguracaoNutricao" c JOIN pecuaria."Lote" l ON l.id=NEW."loteId" WHERE c.id=NEW."configuracaoId" AND c."propriedadeId"=NEW."propriedadeId" AND l."propriedadeId"=NEW."propriedadeId" AND (c."loteId" IS NULL OR c."loteId"=l.id) AND c.desde<=NEW.inicio) THEN RAISE EXCEPTION 'mês fora do escopo da configuração' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (NEW."loteId",NEW."propriedadeId",NEW.competencia,NEW.inicio,NEW."configuracaoId") IS DISTINCT FROM (OLD."loteId",OLD."propriedadeId",OLD.competencia,OLD.inicio,OLD."configuracaoId") THEN RAISE EXCEPTION 'identidade do mês é imutável' USING ERRCODE='23514'; END IF;
 IF NEW."revisadoEm" IS NOT NULL AND (EXISTS(SELECT 1 FROM pecuaria."ConsumoDiario" d WHERE d."mesId"=NEW.id AND (d.situacao<>'EFETIVADO' OR d.pendencia IS NOT NULL)) OR (SELECT COUNT(*) FROM pecuaria."ConsumoDiario" d WHERE d."mesId"=NEW.id)<>((NEW.competencia+INTERVAL '1 month')::date-NEW.inicio)) THEN RAISE EXCEPTION 'mês incompleto não pode ser revisado' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "MesNutricao_validar" BEFORE INSERT OR UPDATE ON pecuaria."MesNutricao" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_mes_nutricional();
CREATE FUNCTION pecuaria.validar_dia_nutricional() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pecuaria."MesNutricao" m WHERE m.id=NEW."mesId" AND NEW.data>=m.inicio AND NEW.data<(m.competencia+INTERVAL '1 month')::date AND m."revisadoEm" IS NULL) THEN RAISE EXCEPTION 'dia fora do mês aberto' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (NEW."mesId",NEW.data) IS DISTINCT FROM (OLD."mesId",OLD.data) THEN RAISE EXCEPTION 'identidade do dia é imutável' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "ConsumoDiario_validar" BEFORE INSERT OR UPDATE ON pecuaria."ConsumoDiario" FOR EACH ROW EXECUTE FUNCTION pecuaria.validar_dia_nutricional();

-- Conferência diferida: estoque, vínculo e agregado precisam fechar no mesmo commit.
CREATE FUNCTION pecuaria.conferir_ledger_nutricional() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE alvo TEXT; item RECORD; qtd NUMERIC; custo NUMERIC;
BEGIN
 IF TG_TABLE_NAME='ItemConsumoDiario' THEN alvo:=COALESCE(NEW.id,OLD.id); ELSE alvo:=COALESCE(NEW."itemId",OLD."itemId"); END IF;
 SELECT i.*,m."propriedadeId",m."revisadoEm" INTO item FROM pecuaria."ItemConsumoDiario" i JOIN pecuaria."ConsumoDiario" d ON d.id=i."diaId" JOIN pecuaria."MesNutricao" m ON m.id=d."mesId" WHERE i.id=alvo;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT COALESCE(SUM(v.quantidade),0),COALESCE(SUM(v.valor),0) INTO qtd,custo FROM pecuaria."MovimentoConsumoDiario" v WHERE v."itemId"=alvo;
 IF qtd<>item.confirmada OR custo<>item."custoLiquido" THEN RAISE EXCEPTION 'consumo diverge do ledger' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM pecuaria."MovimentoConsumoDiario" v JOIN public."MovimentoEstoque" e ON e.id=v."movimentoId" WHERE v."itemId"=alvo AND (e."produtoId"<>item."produtoId" OR e."propriedadeId" IS DISTINCT FROM item."propriedadeId" OR e.origem<>'NUTRICAO' OR e.status<>'CONFIRMADO' OR e.quantidade<>abs(v.quantidade) OR e."valorTotal"<>abs(v.valor) OR (v.quantidade>0 AND e.tipo<>'SAIDA') OR (v.quantidade<0 AND e.tipo<>'ENTRADA'))) THEN RAISE EXCEPTION 'vínculo nutricional incompatível com estoque' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "ItemConsumoDiario_ledger" AFTER INSERT OR UPDATE ON pecuaria."ItemConsumoDiario" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_ledger_nutricional();
CREATE CONSTRAINT TRIGGER "MovimentoConsumoDiario_ledger" AFTER INSERT OR UPDATE OR DELETE ON pecuaria."MovimentoConsumoDiario" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_ledger_nutricional();
CREATE FUNCTION pecuaria.proteger_movimento_nutricional() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM pecuaria."MovimentoConsumoDiario" v WHERE v."movimentoId"=OLD.id) AND (TG_OP='DELETE' OR NEW IS DISTINCT FROM OLD) THEN RAISE EXCEPTION 'corrija o consumo pelo fechamento mensal' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER "MovimentoEstoque_nutricao_diaria" BEFORE UPDATE OR DELETE ON public."MovimentoEstoque" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_movimento_nutricional();

CREATE FUNCTION pecuaria.proteger_historico_nutricao_mensal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE m RECORD; antigo BOOLEAN; novo BOOLEAN; inicio_antigo DATE; inicio_novo DATE; fim_antigo DATE; fim_novo DATE; lote_antigo TEXT; lote_novo TEXT;
BEGIN
 IF TG_OP<>'INSERT' THEN inicio_antigo:=OLD.desde; fim_antigo:=OLD.ate; lote_antigo:=OLD."loteId"; END IF;
 IF TG_OP<>'DELETE' THEN inicio_novo:=NEW.desde; fim_novo:=NEW.ate; lote_novo:=NEW."loteId"; END IF;
 FOR m IN SELECT d.data,c."loteId",c.id FROM pecuaria."MesNutricao" c JOIN pecuaria."ConsumoDiario" d ON d."mesId"=c.id WHERE c."revisadoEm" IS NOT NULL AND c."loteId" IN (lote_antigo,lote_novo) LOOP
   antigo:=COALESCE(lote_antigo=m."loteId" AND inicio_antigo<=m.data AND (fim_antigo IS NULL OR fim_antigo>m.data),false);
   novo:=COALESCE(lote_novo=m."loteId" AND inicio_novo<=m.data AND (fim_novo IS NULL OR fim_novo>m.data),false);
   IF antigo IS DISTINCT FROM novo THEN RAISE EXCEPTION 'reabra o mês nutricional % antes de alterar a história',m.id USING ERRCODE='23514'; END IF;
   IF TG_TABLE_NAME='VigenciaDietaLote' AND antigo AND novo AND TG_OP='UPDATE' THEN
     IF NEW."dietaId"<>OLD."dietaId" THEN RAISE EXCEPTION 'dieta de mês revisado é imutável' USING ERRCODE='23514'; END IF;
   END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER "LocalizacaoAnimal_nutricao_mensal" BEFORE INSERT OR UPDATE OR DELETE ON pecuaria."LocalizacaoAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_historico_nutricao_mensal();
CREATE TRIGGER "VigenciaDietaLote_nutricao_mensal" BEFORE INSERT OR UPDATE OR DELETE ON pecuaria."VigenciaDietaLote" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_historico_nutricao_mensal();

CREATE FUNCTION pecuaria.proteger_item_mensal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM pecuaria."ConsumoDiario" d JOIN pecuaria."MesNutricao" m ON m.id=d."mesId" WHERE d.id=NEW."diaId" AND m."revisadoEm" IS NOT NULL) THEN RAISE EXCEPTION 'reabra o mês antes de alterar seus consumos' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "ItemConsumoDiario_mes_aberto" BEFORE INSERT OR UPDATE ON pecuaria."ItemConsumoDiario" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_item_mensal();
CREATE TRIGGER "ParticipacaoConsumoDiario_mes_aberto" BEFORE INSERT OR UPDATE ON pecuaria."ParticipacaoConsumoDiario" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_item_mensal();

CREATE FUNCTION pecuaria.proteger_vinculo_consumo_diario() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'vínculo de consumo é imutável; registre compensação' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "MovimentoConsumoDiario_imutavel" BEFORE UPDATE ON pecuaria."MovimentoConsumoDiario" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_vinculo_consumo_diario();

COMMIT;
