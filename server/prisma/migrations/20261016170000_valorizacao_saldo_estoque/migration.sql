-- Sem backfill de preços ou alteração dos movimentos legados.
ALTER TABLE public."MovimentoEstoque" ADD COLUMN "metodoValorizacao" TEXT NOT NULL DEFAULT 'LEGADO', ADD COLUMN "evidenciaValor" JSONB;
CREATE TABLE public."BaseValorizacaoEstoque" (
  "id" TEXT PRIMARY KEY, "produtoId" TEXT NOT NULL REFERENCES public."Produto"("id") ON DELETE RESTRICT,
  "propriedadeId" INTEGER NOT NULL REFERENCES public."Propriedade"("id") ON DELETE RESTRICT,
  "partidaId" TEXT REFERENCES public."PartidaProduto"("id") ON DELETE RESTRICT,
  "baseOrigemId" TEXT REFERENCES public."BaseValorizacaoEstoque"("id") ON DELETE RESTRICT,
  "origemMovimentoId" TEXT REFERENCES public."MovimentoEstoque"("id") ON DELETE RESTRICT,
  "metodo" TEXT NOT NULL, "disponivelDesde" DATE NOT NULL, "corteAbertura" DATE, "ordem" SERIAL NOT NULL,
  "quantidadeAbertura" NUMERIC(12,3) NOT NULL DEFAULT 0, "valorAbertura" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "aberturaDocumentada" JSONB, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BaseValorizacao_metodo" CHECK (("metodo" = 'MEDIA_SALDO_V1' AND "partidaId" IS NOT NULL) OR ("metodo" = 'FIFO_AQUISICAO_V1' AND "partidaId" IS NULL)),
  CONSTRAINT "BaseValorizacao_abertura" CHECK ("quantidadeAbertura" >= 0 AND "valorAbertura" >= 0 AND ("quantidadeAbertura" > 0 OR "valorAbertura" = 0) AND (("quantidadeAbertura" = 0 AND "valorAbertura" = 0) OR "aberturaDocumentada" IS NOT NULL))
);
CREATE UNIQUE INDEX "BaseValorizacao_grupo_sitio" ON public."BaseValorizacaoEstoque"("produtoId", "propriedadeId", "partidaId") WHERE "metodo" = 'MEDIA_SALDO_V1';
CREATE INDEX "BaseValorizacaoEstoque_produtoId_propriedadeId_idx" ON public."BaseValorizacaoEstoque"("produtoId", "propriedadeId");
CREATE INDEX "BaseValorizacaoEstoque_origemMovimentoId_idx" ON public."BaseValorizacaoEstoque"("origemMovimentoId");
CREATE TABLE public."ParcelaValorizacaoEstoque" (
  "id" TEXT PRIMARY KEY, "movimentoEstoqueId" TEXT NOT NULL REFERENCES public."MovimentoEstoque"("id") ON DELETE RESTRICT,
  "baseId" TEXT NOT NULL REFERENCES public."BaseValorizacaoEstoque"("id") ON DELETE RESTRICT,
  "ordem" INTEGER NOT NULL, "quantidade" NUMERIC(12,3) NOT NULL, "valorTotal" NUMERIC(14,2) NOT NULL,
  CONSTRAINT "ParcelaValorizacao_sinal" CHECK ("quantidade" <> 0 AND ("quantidade" > 0 AND "valorTotal" >= 0 OR "quantidade" < 0 AND "valorTotal" <= 0))
);
CREATE UNIQUE INDEX "ParcelaValorizacaoEstoque_movimentoEstoqueId_ordem_key" ON public."ParcelaValorizacaoEstoque"("movimentoEstoqueId", "ordem");
CREATE UNIQUE INDEX "ParcelaValorizacaoEstoque_movimentoEstoqueId_baseId_key" ON public."ParcelaValorizacaoEstoque"("movimentoEstoqueId", "baseId");
CREATE INDEX "ParcelaValorizacaoEstoque_baseId_idx" ON public."ParcelaValorizacaoEstoque"("baseId");
CREATE FUNCTION public.conferir_valorizacao_estoque() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE mid TEXT; m RECORD; base_registro RECORD; q NUMERIC; v NUMERIC; sinal INTEGER;
BEGIN
  -- Cada tabela tem um formato de registro próprio. Um CASE na mesma expressão
  -- resolve também os campos do ramo não escolhido e falha para MovimentoEstoque.
  IF TG_TABLE_NAME = 'MovimentoEstoque' THEN
    mid := NEW."id";
  ELSIF TG_OP = 'DELETE' THEN
    mid := OLD."movimentoEstoqueId";
  ELSE
    mid := NEW."movimentoEstoqueId";
  END IF;
  SELECT * INTO m FROM public."MovimentoEstoque" WHERE "id"=mid;
  IF NOT FOUND OR m."metodoValorizacao"='LEGADO' THEN RETURN NULL; END IF;
  IF m."propriedadeId" IS NULL THEN RAISE EXCEPTION 'movimento valorizado exige sítio' USING ERRCODE='23514'; END IF;
  IF m."metodoValorizacao" NOT IN ('MEDIA_SALDO_V1','FIFO_AQUISICAO_V1') THEN RAISE EXCEPTION 'método de valorização inválido'; END IF;
  sinal := CASE WHEN m."tipo"='SAIDA' THEN -1 ELSE 1 END;
  SELECT COALESCE(sum("quantidade"),0),COALESCE(sum("valorTotal"),0) INTO q,v FROM public."ParcelaValorizacaoEstoque" WHERE "movimentoEstoqueId"=mid;
  IF q<>sinal*m."quantidade" OR v<>sinal*m."valorTotal" THEN RAISE EXCEPTION 'parcelas não conciliam quantidade/valor do movimento %', mid USING ERRCODE='23514'; END IF;
  FOR base_registro IN SELECT DISTINCT base.* FROM public."BaseValorizacaoEstoque" base JOIN public."ParcelaValorizacaoEstoque" p ON p."baseId"=base."id" WHERE p."movimentoEstoqueId"=mid LOOP
    IF base_registro."produtoId"<>m."produtoId" OR base_registro."propriedadeId" IS DISTINCT FROM m."propriedadeId" OR base_registro."metodo"<>m."metodoValorizacao" OR base_registro."disponivelDesde">m."data" OR base_registro."corteAbertura">m."data" THEN RAISE EXCEPTION 'base incompatível com movimento %',mid USING ERRCODE='23514'; END IF;
    SELECT base_registro."quantidadeAbertura"+COALESCE(sum("quantidade"),0),base_registro."valorAbertura"+COALESCE(sum("valorTotal"),0) INTO q,v FROM public."ParcelaValorizacaoEstoque" WHERE "baseId"=base_registro."id";
    IF q<0 OR v<0 OR (q=0 AND v<>0) THEN RAISE EXCEPTION 'saldo residual de quantidade/valor inválido' USING ERRCODE='23514'; END IF;
    IF base_registro."partidaId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."PartidaProduto" pp WHERE pp."id"=base_registro."partidaId" AND pp."produtoId"=base_registro."produtoId" AND pp."lotePrincipalId" IS NULL) THEN RAISE EXCEPTION 'base exige grupo raiz do produto' USING ERRCODE='23514'; END IF;
  END LOOP;
  IF m."metodoValorizacao"='MEDIA_SALDO_V1' AND EXISTS (
    SELECT 1 FROM public."ParcelaValorizacaoEstoque" p JOIN public."BaseValorizacaoEstoque" b ON b."id"=p."baseId"
    WHERE p."movimentoEstoqueId"=mid AND p."quantidade" <> sinal*COALESCE((SELECT sum(a."quantidade") FROM public."AlocacaoPartidaEstoque" a JOIN public."PartidaProduto" pp ON pp."id"=a."partidaId" WHERE a."movimentoEstoqueId"=mid AND COALESCE(pp."lotePrincipalId",pp."id")=b."partidaId"),0)
  ) THEN RAISE EXCEPTION 'parcelas monetárias divergem dos grupos físicos' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "MovimentoEstoque_conciliar_valor" AFTER INSERT OR UPDATE ON public."MovimentoEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.conferir_valorizacao_estoque();
CREATE CONSTRAINT TRIGGER "ParcelaValorizacao_conciliar_valor" AFTER INSERT OR UPDATE OR DELETE ON public."ParcelaValorizacaoEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.conferir_valorizacao_estoque();
CREATE FUNCTION public.impedir_edicao_valorizacao_estoque() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'valorização confirmada é imutável; use inverso ou abertura documentada' USING ERRCODE='23514'; END $$;
CREATE TRIGGER "BaseValorizacao_imutavel" BEFORE UPDATE ON public."BaseValorizacaoEstoque" FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_valorizacao_estoque();
CREATE TRIGGER "ParcelaValorizacao_imutavel" BEFORE UPDATE ON public."ParcelaValorizacaoEstoque" FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_valorizacao_estoque();

CREATE UNIQUE INDEX "BaseValorizacao_fifo_origem" ON public."BaseValorizacaoEstoque"("origemMovimentoId") WHERE "metodo"='FIFO_AQUISICAO_V1' AND "origemMovimentoId" IS NOT NULL AND "baseOrigemId" IS NULL;
CREATE UNIQUE INDEX "BaseValorizacao_fifo_derivada" ON public."BaseValorizacaoEstoque"("origemMovimentoId", "baseOrigemId") WHERE "metodo"='FIFO_AQUISICAO_V1' AND "origemMovimentoId" IS NOT NULL AND "baseOrigemId" IS NOT NULL;
CREATE FUNCTION public.proteger_identidade_valorizada() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF OLD."metodoValorizacao" <> 'LEGADO' AND (NEW."metodoValorizacao" IS DISTINCT FROM OLD."metodoValorizacao" OR NEW."produtoId" IS DISTINCT FROM OLD."produtoId" OR NEW."propriedadeId" IS DISTINCT FROM OLD."propriedadeId" OR NEW."quantidade" IS DISTINCT FROM OLD."quantidade" OR NEW."valorTotal" IS DISTINCT FROM OLD."valorTotal" OR NEW."data" IS DISTINCT FROM OLD."data" OR NEW."tipo" IS DISTINCT FROM OLD."tipo" OR NEW."custoUnitario" IS DISTINCT FROM OLD."custoUnitario" OR NEW."evidenciaValor" IS DISTINCT FROM OLD."evidenciaValor" OR NEW."origem" IS DISTINCT FROM OLD."origem" OR NEW."reversaoDeId" IS DISTINCT FROM OLD."reversaoDeId") THEN RAISE EXCEPTION 'identidade e valores congelados; use inverso' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "MovimentoEstoque_valor_imutavel" BEFORE UPDATE ON public."MovimentoEstoque" FOR EACH ROW EXECUTE FUNCTION public.proteger_identidade_valorizada();
CREATE FUNCTION public.conferir_base_valorizacao() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF (NEW."metodo"='MEDIA_SALDO_V1') IS DISTINCT FROM (SELECT p."rastrearPartidas" FROM public."Produto" p WHERE p."id"=NEW."produtoId") THEN RAISE EXCEPTION 'método incompatível com produto' USING ERRCODE='23514'; END IF;
  IF NEW."partidaId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."PartidaProduto" pp WHERE pp."id"=NEW."partidaId" AND pp."produtoId"=NEW."produtoId" AND pp."lotePrincipalId" IS NULL) THEN RAISE EXCEPTION 'grupo raiz incompatível' USING ERRCODE='23514'; END IF;
  IF NEW."baseOrigemId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."BaseValorizacaoEstoque" b WHERE b."id"=NEW."baseOrigemId" AND b."produtoId"=NEW."produtoId") THEN RAISE EXCEPTION 'base origem incompatível' USING ERRCODE='23514'; END IF;
  IF NEW."origemMovimentoId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."MovimentoEstoque" m WHERE m."id"=NEW."origemMovimentoId" AND m."produtoId"=NEW."produtoId" AND m."propriedadeId" IS NOT DISTINCT FROM NEW."propriedadeId" AND (m."tipo"='ENTRADA' OR (m."tipo"='AJUSTE' AND m."quantidade">0))) THEN RAISE EXCEPTION 'origem incompatível' USING ERRCODE='23514'; END IF;
  IF NEW."aberturaDocumentada" IS NOT NULL AND (NEW."corteAbertura" IS NULL OR NEW."disponivelDesde">NEW."corteAbertura" OR NOT (NEW."aberturaDocumentada" ?& ARRAY['chave','corte','referencia','motivo','evidencia','usuarioId','revisao'])) THEN RAISE EXCEPTION 'abertura exige corte e evidência' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "BaseValorizacao_validar" BEFORE INSERT ON public."BaseValorizacaoEstoque" FOR EACH ROW EXECUTE FUNCTION public.conferir_base_valorizacao();

ALTER TABLE public."Operacao" ADD COLUMN "composicaoComercial" JSONB;
