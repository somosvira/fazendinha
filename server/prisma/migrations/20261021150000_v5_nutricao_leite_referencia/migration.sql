-- Expansão aditiva: não converte consumos antigos nem presume custo/preço desconhecido.
CREATE TABLE pecuaria."FornecimentoNutricionalLeite" (
 "id" TEXT PRIMARY KEY, "itemId" TEXT NOT NULL UNIQUE REFERENCES pecuaria."ItemFechamentoConsumo"("id") ON DELETE RESTRICT,
 "propriedadeId" INTEGER NOT NULL REFERENCES public."Propriedade"("id") ON DELETE RESTRICT,
 "data" DATE NOT NULL, "quantidadeLitros" NUMERIC(12,3) NOT NULL CHECK ("quantidadeLitros">0),
 "status" TEXT NOT NULL DEFAULT 'CONFIRMADO' CHECK ("status" IN ('CONFIRMADO','ESTORNADO')),
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "criadoPorId" INTEGER REFERENCES public."Usuario"("id") ON DELETE RESTRICT
);
CREATE INDEX "FornecimentoNutricionalLeite_propriedadeId_data_idx" ON pecuaria."FornecimentoNutricionalLeite"("propriedadeId","data");
CREATE TABLE pecuaria."MovimentoFornecimentoNutricionalLeite" (
 "id" TEXT PRIMARY KEY, "fornecimentoId" TEXT NOT NULL REFERENCES pecuaria."FornecimentoNutricionalLeite"("id") ON DELETE RESTRICT,
 "movimentoId" TEXT NOT NULL UNIQUE REFERENCES public."MovimentoEstoque"("id") ON DELETE RESTRICT,
 "entradaId" TEXT NOT NULL REFERENCES pecuaria."EntradaProducaoLeite"("id") ON DELETE RESTRICT,
 "natureza" TEXT NOT NULL CHECK ("natureza" IN ('COMERCIAL','NAO_COMERCIAL')),
 "quantidadeLitros" NUMERIC(12,3) NOT NULL CHECK ("quantidadeLitros">0)
);
CREATE TABLE pecuaria."ParcelaFornecimentoNutricionalLeite" (
 "id" TEXT PRIMARY KEY, "fornecimentoId" TEXT NOT NULL REFERENCES pecuaria."FornecimentoNutricionalLeite"("id") ON DELETE RESTRICT,
 "animalId" TEXT NOT NULL REFERENCES pecuaria."Animal"("id") ON DELETE RESTRICT, "dias" INTEGER NOT NULL CHECK ("dias">0),
 "baseQuantidade" TEXT NOT NULL DEFAULT 'ATRIBUIDA' CHECK ("baseQuantidade"='ATRIBUIDA'), "quantidadeLitros" NUMERIC(12,3) NOT NULL CHECK ("quantidadeLitros">=0),
 UNIQUE ("fornecimentoId","animalId")
);
CREATE TABLE pecuaria."ReferenciaGerencialLeite" (
 "id" TEXT PRIMARY KEY, "fornecimentoId" TEXT NOT NULL REFERENCES pecuaria."FornecimentoNutricionalLeite"("id") ON DELETE RESTRICT,
 "fechamentoId" TEXT NOT NULL REFERENCES pecuaria."FechamentoOperacaoLeite"("id") ON DELETE RESTRICT,
 "versao" INTEGER NOT NULL CHECK ("versao">0), "periodoInicio" DATE NOT NULL, "periodoFim" DATE NOT NULL CHECK ("periodoFim">="periodoInicio"),
 "parceiroId" TEXT NOT NULL REFERENCES public."Parceiro"("id") ON DELETE RESTRICT,
 "precoUnitario" NUMERIC(14,4) NOT NULL CHECK ("precoUnitario">=0), "valorTotal" NUMERIC(14,2) NOT NULL CHECK ("valorTotal">=0),
 "provisoria" BOOLEAN NOT NULL, "motivo" TEXT NOT NULL CHECK (length(trim("motivo"))>=5),
 "criadoPorId" INTEGER REFERENCES public."Usuario"("id") ON DELETE RESTRICT, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("fornecimentoId","versao"), UNIQUE ("fornecimentoId","fechamentoId")
);
CREATE FUNCTION pecuaria.validar_fornecimento_nutricional_leite(identidade TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE f pecuaria."FornecimentoNutricionalLeite"; item pecuaria."ItemFechamentoConsumo"; c pecuaria."FechamentoConsumo";
BEGIN
 SELECT * INTO STRICT f FROM pecuaria."FornecimentoNutricionalLeite" WHERE "id"=identidade;
 SELECT * INTO STRICT item FROM pecuaria."ItemFechamentoConsumo" WHERE "id"=f."itemId";
 SELECT * INTO STRICT c FROM pecuaria."FechamentoConsumo" WHERE "id"=item."fechamentoId";
 IF NOT EXISTS (SELECT 1 FROM pecuaria."EntradaProducaoLeite" e JOIN public."MovimentoEstoque" m ON m."id"=e."movimentoId" WHERE m."produtoId"=item."produtoId" AND m."propriedadeId"=f."propriedadeId") THEN
  RAISE EXCEPTION 'Ingrediente leiteiro exige produção V5 histórica comprovada no sítio';
 END IF;
 IF c."status"<>f."status" OR c."propriedadeId"<>f."propriedadeId" OR c."fim"<>f."data" OR item."unidade"<>'L' OR item."quantidadeConfirmada"<>f."quantidadeLitros" OR item."movimentoEstoqueId" IS NOT NULL OR item."modoEstoque"<>'BAIXA_ESTOQUE' THEN
  RAISE EXCEPTION 'Fornecimento deve corresponder ao item/dieta, sítio e data sem segunda baixa genérica';
 END IF;
 IF (SELECT COALESCE(SUM("quantidadeLitros"),0) FROM pecuaria."MovimentoFornecimentoNutricionalLeite" WHERE "fornecimentoId"=f."id")<>f."quantidadeLitros" OR
    (SELECT COALESCE(SUM("quantidadeLitros"),0) FROM pecuaria."ParcelaFornecimentoNutricionalLeite" WHERE "fornecimentoId"=f."id")<>f."quantidadeLitros" THEN
  RAISE EXCEPTION 'Origens e destinatários devem conservar os litros do fornecimento';
 END IF;
 IF EXISTS (SELECT 1 FROM pecuaria."MovimentoFornecimentoNutricionalLeite" o JOIN public."MovimentoEstoque" m ON m."id"=o."movimentoId"
  WHERE o."fornecimentoId"=f."id" AND (m."status"::text<>CASE WHEN f."status"='CONFIRMADO' THEN 'CONFIRMADO' ELSE 'REVERTIDO' END OR m."propriedadeId"<>f."propriedadeId" OR m."data"<>f."data" OR m."origem"<>'NUTRICAO' OR m."tipo"<>'SAIDA' OR m."quantidade"<>o."quantidadeLitros" OR
   NOT EXISTS (SELECT 1 FROM pecuaria."AlocacaoLeiteEstoque" a JOIN pecuaria."ClassificacaoEntradaLeite" n ON n."id"=a."classificacaoId" WHERE a."movimentoId"=m."id" AND a."entradaId"=o."entradaId" AND a."quantidade"=o."quantidadeLitros" AND a."finalidade"='CONSUMO' AND n."natureza"=o."natureza"))) THEN
  RAISE EXCEPTION 'Origem nutricional divergente da baixa leiteira comprovada';
 END IF;
 IF (SELECT COUNT(*) FROM pecuaria."ParcelaFornecimentoNutricionalLeite" WHERE "fornecimentoId"=f."id")<>(SELECT COUNT(*) FROM pecuaria."ParticipacaoConsumoAnimal" WHERE "fechamentoId"=c."id") THEN
  RAISE EXCEPTION 'Todos os participantes do fechamento devem ter parcela de leite';
 END IF;
 IF EXISTS (SELECT 1 FROM pecuaria."ParcelaFornecimentoNutricionalLeite" p WHERE p."fornecimentoId"=f."id" AND NOT EXISTS (
  SELECT 1 FROM pecuaria."ParticipacaoConsumoAnimal" a WHERE a."fechamentoId"=c."id" AND a."animalId"=p."animalId" AND a."dias"=p."dias")) THEN
  RAISE EXCEPTION 'Destinatário deve participar do fechamento da dieta';
 END IF;
 RETURN;
END $$;
CREATE FUNCTION pecuaria.conferir_fornecimento_nutricional_leite() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='FornecimentoNutricionalLeite' THEN
  PERFORM pecuaria.validar_fornecimento_nutricional_leite(NEW."id");
 ELSE
  PERFORM pecuaria.validar_fornecimento_nutricional_leite(NEW."fornecimentoId");
 END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "FornecimentoNutricionalLeite_conservacao" AFTER INSERT OR UPDATE ON pecuaria."FornecimentoNutricionalLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_fornecimento_nutricional_leite();
CREATE CONSTRAINT TRIGGER "MovimentoFornecimentoNutricionalLeite_conservacao" AFTER INSERT OR UPDATE ON pecuaria."MovimentoFornecimentoNutricionalLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_fornecimento_nutricional_leite();
CREATE CONSTRAINT TRIGGER "ParcelaFornecimentoNutricionalLeite_conservacao" AFTER INSERT OR UPDATE ON pecuaria."ParcelaFornecimentoNutricionalLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_fornecimento_nutricional_leite();
CREATE FUNCTION pecuaria.conferir_referencia_gerencial_leite() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE f pecuaria."FornecimentoNutricionalLeite"; r RECORD; anterior INTEGER;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Referências são snapshots imutáveis; registre nova versão'; END IF;
 SELECT * INTO STRICT f FROM pecuaria."FornecimentoNutricionalLeite" WHERE "id"=NEW."fornecimentoId" FOR UPDATE;
 SELECT x.*,c."propriedadeId",c."parceiroId",c."inicio",c."fim",o."status" INTO STRICT r FROM pecuaria."FechamentoOperacaoLeite" x JOIN pecuaria."OperacaoComercialLeite" c ON c."id"=x."comercialId" JOIN public."Operacao" o ON o."id"=x."operacaoId" WHERE x."id"=NEW."fechamentoId";
 SELECT COALESCE(MAX("versao"),0) INTO anterior FROM pecuaria."ReferenciaGerencialLeite" WHERE "fornecimentoId"=f."id";
 IF f."status"<>'CONFIRMADO' OR r."status"<>'CONFIRMADA' OR r."propriedadeId"<>f."propriedadeId" OR r."parceiroId"<>NEW."parceiroId" OR r."precoUnitario"<>NEW."precoUnitario" OR r."inicio"<>NEW."periodoInicio" OR r."fim"<>NEW."periodoFim" OR NEW."versao"<>anterior+1 OR ROUND(f."quantidadeLitros"*NEW."precoUnitario",2)<>NEW."valorTotal" OR
  date_trunc('month',r."inicio")<>date_trunc('month',r."fim") OR
  date_trunc('month',r."inicio")<>date_trunc('month',f."data")-CASE WHEN NEW."provisoria" THEN interval '1 month' ELSE interval '0 month' END OR
  EXISTS (SELECT 1 FROM pecuaria."FechamentoOperacaoLeite" x WHERE x."comercialId"=r."comercialId" AND x."versao">r."versao") THEN
  RAISE EXCEPTION 'Referência exige fechamento vigente comprovado do sítio e mês, valor e versão compatíveis';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "ReferenciaGerencialLeite_comprovacao" BEFORE INSERT OR UPDATE OR DELETE ON pecuaria."ReferenciaGerencialLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_referencia_gerencial_leite();

CREATE FUNCTION pecuaria.preservar_fato_nutricional_leite() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='FornecimentoNutricionalLeite' THEN
  IF TG_OP='UPDATE' THEN
   IF OLD."status"='CONFIRMADO' AND NEW."status"='ESTORNADO' AND (to_jsonb(NEW)-'status')=(to_jsonb(OLD)-'status') THEN RETURN NEW; END IF;
  END IF;
 END IF;
 RAISE EXCEPTION 'Fatos nutricionais leiteiros são imutáveis; use estorno do fechamento';
END $$;
CREATE TRIGGER "FornecimentoNutricionalLeite_historico" BEFORE UPDATE OR DELETE ON pecuaria."FornecimentoNutricionalLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_fato_nutricional_leite();
CREATE TRIGGER "MovimentoFornecimentoNutricionalLeite_historico" BEFORE UPDATE OR DELETE ON pecuaria."MovimentoFornecimentoNutricionalLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_fato_nutricional_leite();
CREATE TRIGGER "ParcelaFornecimentoNutricionalLeite_historico" BEFORE UPDATE OR DELETE ON pecuaria."ParcelaFornecimentoNutricionalLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_fato_nutricional_leite();

-- As tabelas de origem também observam a conservação. Estornar estoque isoladamente
-- ou editar quantidade/status do fechamento não contorna o vínculo nutricional.
CREATE FUNCTION pecuaria.observar_origem_fornecimento_nutricional_leite() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE identidade TEXT;
BEGIN
 IF TG_TABLE_NAME='ItemFechamentoConsumo' THEN
  FOR identidade IN SELECT "id" FROM pecuaria."FornecimentoNutricionalLeite" WHERE "itemId"=NEW."id" LOOP
   PERFORM pecuaria.validar_fornecimento_nutricional_leite(identidade);
  END LOOP;
 ELSIF TG_TABLE_NAME='ParticipacaoConsumoAnimal' THEN
  IF TG_OP='DELETE' THEN
   FOR identidade IN SELECT f."id" FROM pecuaria."FornecimentoNutricionalLeite" f JOIN pecuaria."ItemFechamentoConsumo" i ON i."id"=f."itemId" WHERE i."fechamentoId"=OLD."fechamentoId" LOOP
    PERFORM pecuaria.validar_fornecimento_nutricional_leite(identidade);
   END LOOP;
  ELSE
   FOR identidade IN SELECT f."id" FROM pecuaria."FornecimentoNutricionalLeite" f JOIN pecuaria."ItemFechamentoConsumo" i ON i."id"=f."itemId" WHERE i."fechamentoId"=NEW."fechamentoId" LOOP
    PERFORM pecuaria.validar_fornecimento_nutricional_leite(identidade);
   END LOOP;
  END IF;
 ELSIF TG_TABLE_NAME='FechamentoConsumo' THEN
  FOR identidade IN SELECT f."id" FROM pecuaria."FornecimentoNutricionalLeite" f JOIN pecuaria."ItemFechamentoConsumo" i ON i."id"=f."itemId" WHERE i."fechamentoId"=NEW."id" LOOP
   PERFORM pecuaria.validar_fornecimento_nutricional_leite(identidade);
  END LOOP;
 ELSE
  FOR identidade IN SELECT "fornecimentoId" FROM pecuaria."MovimentoFornecimentoNutricionalLeite" WHERE "movimentoId"=NEW."id" OR "movimentoId"=NEW."reversaoDeId" LOOP
   PERFORM pecuaria.validar_fornecimento_nutricional_leite(identidade);
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "ItemFechamentoConsumo_fornecimento_leite" AFTER UPDATE ON pecuaria."ItemFechamentoConsumo" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_origem_fornecimento_nutricional_leite();
CREATE CONSTRAINT TRIGGER "FechamentoConsumo_fornecimento_leite" AFTER UPDATE ON pecuaria."FechamentoConsumo" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_origem_fornecimento_nutricional_leite();
CREATE CONSTRAINT TRIGGER "MovimentoEstoque_fornecimento_leite" AFTER INSERT OR UPDATE ON public."MovimentoEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_origem_fornecimento_nutricional_leite();
CREATE CONSTRAINT TRIGGER "ParticipacaoConsumoAnimal_fornecimento_leite" AFTER INSERT OR UPDATE OR DELETE ON pecuaria."ParticipacaoConsumoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_origem_fornecimento_nutricional_leite();
