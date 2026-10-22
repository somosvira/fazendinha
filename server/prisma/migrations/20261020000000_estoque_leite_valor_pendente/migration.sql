-- AlterTable
ALTER TABLE "MovimentoEstoque" ALTER COLUMN "custoUnitario" DROP NOT NULL,
ALTER COLUMN "valorTotal" DROP NOT NULL;

-- CreateTable
CREATE TABLE "pecuaria"."EntradaProducaoLeite" (
    "id" TEXT NOT NULL,
    "sessaoId" TEXT NOT NULL,
    "versaoSessao" INTEGER NOT NULL,
    "movimentoId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMADA',
    "chave" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "EntradaProducaoLeite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."AlocacaoLeiteEstoque" (
    "id" TEXT NOT NULL,
    "entradaId" TEXT NOT NULL,
    "movimentoId" TEXT NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "valorTotal" DECIMAL(14,2),

    CONSTRAINT "AlocacaoLeiteEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ApuracaoValorLeite" (
    "id" TEXT NOT NULL,
    "entradaId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "valorTotal" DECIMAL(14,2) NOT NULL,
    "referencia" TEXT NOT NULL,
    "evidencia" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "ApuracaoValorLeite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ApropriacaoValorLeite" (
    "id" TEXT NOT NULL,
    "apuracaoId" TEXT NOT NULL,
    "alocacaoId" TEXT NOT NULL,
    "valorTotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "ApropriacaoValorLeite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EntradaProducaoLeite_movimentoId_key" ON "pecuaria"."EntradaProducaoLeite"("movimentoId");

-- CreateIndex
CREATE UNIQUE INDEX "EntradaProducaoLeite_chave_key" ON "pecuaria"."EntradaProducaoLeite"("chave");

-- CreateIndex
CREATE INDEX "EntradaProducaoLeite_sessaoId_idx" ON "pecuaria"."EntradaProducaoLeite"("sessaoId");

-- CreateIndex
CREATE INDEX "AlocacaoLeiteEstoque_movimentoId_idx" ON "pecuaria"."AlocacaoLeiteEstoque"("movimentoId");

-- CreateIndex
CREATE UNIQUE INDEX "AlocacaoLeiteEstoque_entradaId_movimentoId_key" ON "pecuaria"."AlocacaoLeiteEstoque"("entradaId", "movimentoId");

-- CreateIndex
CREATE UNIQUE INDEX "ApuracaoValorLeite_chave_key" ON "pecuaria"."ApuracaoValorLeite"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "ApuracaoValorLeite_entradaId_versao_key" ON "pecuaria"."ApuracaoValorLeite"("entradaId", "versao");

-- CreateIndex
CREATE INDEX "ApropriacaoValorLeite_alocacaoId_idx" ON "pecuaria"."ApropriacaoValorLeite"("alocacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "ApropriacaoValorLeite_apuracaoId_alocacaoId_key" ON "pecuaria"."ApropriacaoValorLeite"("apuracaoId", "alocacaoId");

-- AddForeignKey
ALTER TABLE "pecuaria"."EntradaProducaoLeite" ADD CONSTRAINT "EntradaProducaoLeite_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "pecuaria"."SessaoOrdenha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."EntradaProducaoLeite" ADD CONSTRAINT "EntradaProducaoLeite_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES "MovimentoEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AlocacaoLeiteEstoque" ADD CONSTRAINT "AlocacaoLeiteEstoque_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES "pecuaria"."EntradaProducaoLeite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AlocacaoLeiteEstoque" ADD CONSTRAINT "AlocacaoLeiteEstoque_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES "MovimentoEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ApuracaoValorLeite" ADD CONSTRAINT "ApuracaoValorLeite_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES "pecuaria"."EntradaProducaoLeite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ApropriacaoValorLeite" ADD CONSTRAINT "ApropriacaoValorLeite_apuracaoId_fkey" FOREIGN KEY ("apuracaoId") REFERENCES "pecuaria"."ApuracaoValorLeite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ApropriacaoValorLeite" ADD CONSTRAINT "ApropriacaoValorLeite_alocacaoId_fkey" FOREIGN KEY ("alocacaoId") REFERENCES "pecuaria"."AlocacaoLeiteEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Métodos existentes continuam exigindo valores conhecidos. Não há backfill.
ALTER TABLE public."MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_valor_pendente_leite" CHECK (
  ("metodoValorizacao"='LEITE_FIFO_V1' AND (("custoUnitario" IS NULL AND "valorTotal" IS NULL) OR ("custoUnitario" IS NOT NULL AND "valorTotal" IS NOT NULL)))
  OR ("metodoValorizacao"<>'LEITE_FIFO_V1' AND "custoUnitario" IS NOT NULL AND "valorTotal" IS NOT NULL)
);
ALTER TABLE pecuaria."EntradaProducaoLeite" ADD CONSTRAINT "EntradaLeite_estado" CHECK ("status" IN ('CONFIRMADA','ANULADA') AND "versaoSessao">0 AND length("hash")=64);
CREATE UNIQUE INDEX "EntradaLeite_sessao_confirmada" ON pecuaria."EntradaProducaoLeite"("sessaoId") WHERE status='CONFIRMADA';
ALTER TABLE pecuaria."AlocacaoLeiteEstoque" ADD CONSTRAINT "AlocacaoLeite_quantidade_valor" CHECK (quantidade>0 AND ("valorTotal" IS NULL OR "valorTotal">=0));
ALTER TABLE pecuaria."ApuracaoValorLeite" ADD CONSTRAINT "ApuracaoLeite_documentada" CHECK (versao>0 AND "valorTotal">=0 AND length(trim(referencia))>=2 AND length(trim(evidencia))>=5 AND length(trim(motivo))>=5 AND length(hash)=64);
ALTER TABLE pecuaria."ApropriacaoValorLeite" ADD CONSTRAINT "ApropriacaoLeite_valor" CHECK ("valorTotal">=0);

CREATE FUNCTION pecuaria.conferir_movimento_leite(mid TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE m RECORD; origem RECORD; entrada RECORD; q NUMERIC; v NUMERIC; n INTEGER;
BEGIN
  SELECT * INTO m FROM public."MovimentoEstoque" WHERE id=mid;
  IF NOT FOUND OR m."metodoValorizacao"<>'LEITE_FIFO_V1' THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('valorizacao-estoque:'||m."produtoId"));
  IF m."propriedadeId" IS NULL OR m.quantidade<=0 OR NOT EXISTS (
    SELECT 1 FROM public."Produto" p WHERE p.id=m."produtoId" AND p.unidade='L' AND NOT p."rastrearPartidas"
  ) THEN RAISE EXCEPTION 'movimento leiteiro exige sítio e produto em litros sem partida' USING ERRCODE='23514'; END IF;
  IF m."reversaoDeId" IS NOT NULL THEN
    SELECT * INTO origem FROM public."MovimentoEstoque" WHERE id=m."reversaoDeId";
    IF origem."metodoValorizacao"<>'LEITE_FIFO_V1' OR origem.status<>'REVERTIDO' OR origem."produtoId"<>m."produtoId"
      OR origem."propriedadeId"<>m."propriedadeId" OR origem.quantidade<>m.quantidade
      OR origem."valorTotal" IS DISTINCT FROM m."valorTotal" OR origem."custoUnitario" IS DISTINCT FROM m."custoUnitario"
      OR NOT ((origem.tipo='ENTRADA' AND m.tipo='SAIDA') OR (origem.tipo='SAIDA' AND m.tipo='ENTRADA'))
    THEN RAISE EXCEPTION 'inverso leiteiro incompatível com original' USING ERRCODE='23514'; END IF;
    RETURN;
  END IF;
  IF m.status='REVERTIDO' AND NOT EXISTS (SELECT 1 FROM public."MovimentoEstoque" inv WHERE inv."reversaoDeId"=m.id)
    THEN RAISE EXCEPTION 'movimento leiteiro revertido exige inverso preservado' USING ERRCODE='23514'; END IF;
  IF m.tipo='ENTRADA' THEN
    SELECT e.*,s.versao AS "versaoAtual",d."propriedadeId",d."dataOperacional" INTO entrada
      FROM pecuaria."EntradaProducaoLeite" e JOIN pecuaria."SessaoOrdenha" s ON s.id=e."sessaoId"
      JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId" WHERE e."movimentoId"=mid;
    IF NOT FOUND OR m.origem<>'PRODUCAO' OR entrada."propriedadeId"<>m."propriedadeId" OR entrada."dataOperacional"<>m.data
      OR m."valorTotal" IS NOT NULL OR m."custoUnitario" IS NOT NULL
      OR (m.status='CONFIRMADO' AND (entrada.status<>'CONFIRMADA' OR entrada."versaoSessao"<>entrada."versaoAtual"))
      OR (m.status='REVERTIDO' AND entrada.status<>'ANULADA')
    THEN RAISE EXCEPTION 'entrada leiteira exige confirmação única da ordenha' USING ERRCODE='23514'; END IF;
    IF m.status='CONFIRMADO' THEN
      SELECT COALESCE(sum(md.litros),0) INTO q FROM pecuaria."MedicaoLeite" md
        JOIN pecuaria."ParticipanteProducaoLeite" p ON p.id=md."participanteId"
        WHERE md."sessaoId"=entrada."sessaoId" AND p."excluidoEm" IS NULL AND md.estado='MEDIDO';
      IF q<>m.quantidade THEN RAISE EXCEPTION 'litros da entrada divergem das medições confirmadas' USING ERRCODE='23514'; END IF;
    END IF;
  ELSIF m.tipo='SAIDA' THEN
    SELECT sum(a.quantidade),CASE WHEN bool_or(a."valorTotal" IS NULL) THEN NULL ELSE sum(a."valorTotal") END INTO q,v
      FROM pecuaria."AlocacaoLeiteEstoque" a WHERE a."movimentoId"=mid;
    IF q IS NULL OR q<>m.quantidade OR v IS DISTINCT FROM m."valorTotal" THEN
      RAISE EXCEPTION 'saída leiteira exige alocação exata de quantidade e custo conhecido ou pendente' USING ERRCODE='23514'; END IF;
    IF EXISTS (SELECT 1 FROM pecuaria."AlocacaoLeiteEstoque" a JOIN pecuaria."EntradaProducaoLeite" e ON e.id=a."entradaId"
      JOIN public."MovimentoEstoque" em ON em.id=e."movimentoId" WHERE a."movimentoId"=mid AND
      (em."produtoId"<>m."produtoId" OR em."propriedadeId"<>m."propriedadeId" OR em.data>m.data OR (m.status='CONFIRMADO' AND (e.status<>'CONFIRMADA' OR em.status<>'CONFIRMADO'))))
      THEN RAISE EXCEPTION 'origem de leite incompatível com consumidor' USING ERRCODE='23514'; END IF;
  ELSE RAISE EXCEPTION 'leite não aceita ajuste sem regularização das origens' USING ERRCODE='23514';
  END IF;
  FOR entrada IN SELECT e.*,em.quantidade FROM pecuaria."EntradaProducaoLeite" e JOIN public."MovimentoEstoque" em ON em.id=e."movimentoId"
    WHERE e."movimentoId"=mid OR e.id IN (SELECT a."entradaId" FROM pecuaria."AlocacaoLeiteEstoque" a WHERE a."movimentoId"=mid)
  LOOP
    SELECT COALESCE(sum(a.quantidade),0) INTO q FROM pecuaria."AlocacaoLeiteEstoque" a
      JOIN public."MovimentoEstoque" sm ON sm.id=a."movimentoId" WHERE a."entradaId"=entrada.id AND sm.status='CONFIRMADO' AND sm."reversaoDeId" IS NULL;
    IF q>entrada.quantidade OR (entrada.status='ANULADA' AND q<>0) THEN
      RAISE EXCEPTION 'consumidores superam produção ou impedem anulação do lastro' USING ERRCODE='23514'; END IF;
    PERFORM pecuaria.conferir_valor_entrada_leite(entrada.id);
  END LOOP;
END $$;

CREATE FUNCTION pecuaria.conferir_vinculo_leite() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE mid TEXT;
BEGIN
  IF TG_TABLE_NAME='EntradaProducaoLeite' OR TG_TABLE_NAME='AlocacaoLeiteEstoque' THEN
    IF TG_OP='DELETE' THEN mid:=OLD."movimentoId"; ELSE mid:=NEW."movimentoId"; END IF;
    PERFORM pecuaria.conferir_movimento_leite(mid);
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "EntradaLeite_conferir" AFTER INSERT OR UPDATE OR DELETE ON pecuaria."EntradaProducaoLeite"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_leite();
CREATE CONSTRAINT TRIGGER "AlocacaoLeite_conferir" AFTER INSERT OR UPDATE OR DELETE ON pecuaria."AlocacaoLeiteEstoque"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_vinculo_leite();

CREATE FUNCTION pecuaria.conferir_valor_entrada_leite(eid TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE aid TEXT; ap RECORD; q NUMERIC; v NUMERIC; produzida NUMERIC; pendentes INTEGER;
BEGIN
  SELECT * INTO ap FROM pecuaria."ApuracaoValorLeite" WHERE "entradaId"=eid ORDER BY versao DESC LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  aid:=ap.id;
  SELECT m.quantidade INTO produzida FROM pecuaria."EntradaProducaoLeite" e JOIN public."MovimentoEstoque" m ON m.id=e."movimentoId" WHERE e.id=ap."entradaId";
  IF EXISTS (SELECT 1 FROM pecuaria."ApropriacaoValorLeite" p JOIN pecuaria."AlocacaoLeiteEstoque" a ON a.id=p."alocacaoId" WHERE p."apuracaoId"=aid AND a."entradaId"<>ap."entradaId")
    THEN RAISE EXCEPTION 'apropriação pertence a outra produção' USING ERRCODE='23514'; END IF;
  SELECT sum(a.quantidade),sum(COALESCE(p."valorTotal",a."valorTotal")),count(*) FILTER (WHERE COALESCE(p."valorTotal",a."valorTotal") IS NULL) INTO q,v,pendentes
    FROM pecuaria."AlocacaoLeiteEstoque" a JOIN public."MovimentoEstoque" sm ON sm.id=a."movimentoId"
    LEFT JOIN pecuaria."ApropriacaoValorLeite" p ON p."alocacaoId"=a.id AND p."apuracaoId"=aid
    WHERE a."entradaId"=ap."entradaId" AND sm.status='CONFIRMADO' AND sm."reversaoDeId" IS NULL;
  IF pendentes>0 OR COALESCE(q,0)>produzida OR COALESCE(v,0)>ap."valorTotal" OR (q=produzida AND v<>ap."valorTotal")
    THEN RAISE EXCEPTION 'apuração não conserva valor dos consumidores e saldo' USING ERRCODE='23514'; END IF;
END $$;
CREATE FUNCTION pecuaria.conferir_apuracao_leite() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE eid TEXT;
BEGIN
  IF TG_TABLE_NAME='ApuracaoValorLeite' THEN eid:=NEW."entradaId";
  ELSE SELECT "entradaId" INTO eid FROM pecuaria."ApuracaoValorLeite" WHERE id=NEW."apuracaoId"; END IF;
  PERFORM pecuaria.conferir_valor_entrada_leite(eid);
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "ApuracaoLeite_conferir" AFTER INSERT ON pecuaria."ApuracaoValorLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_apuracao_leite();
CREATE CONSTRAINT TRIGGER "ApropriacaoLeite_conferir" AFTER INSERT ON pecuaria."ApropriacaoValorLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_apuracao_leite();

CREATE TRIGGER "AlocacaoLeite_imutavel" BEFORE UPDATE ON pecuaria."AlocacaoLeiteEstoque" FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_valorizacao_estoque();
CREATE TRIGGER "ApuracaoLeite_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."ApuracaoValorLeite" FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_valorizacao_estoque();
CREATE TRIGGER "ApropriacaoLeite_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."ApropriacaoValorLeite" FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_valorizacao_estoque();

CREATE FUNCTION pecuaria.proteger_entrada_leite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW."sessaoId" IS DISTINCT FROM OLD."sessaoId" OR NEW."versaoSessao" IS DISTINCT FROM OLD."versaoSessao"
    OR NEW."movimentoId" IS DISTINCT FROM OLD."movimentoId" OR NEW.chave IS DISTINCT FROM OLD.chave OR NEW.hash IS DISTINCT FROM OLD.hash
    OR NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW."criadoEm" IS DISTINCT FROM OLD."criadoEm" OR NEW."criadoPorId" IS DISTINCT FROM OLD."criadoPorId"
    OR (NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status='CONFIRMADA' AND NEW.status='ANULADA'))
    THEN RAISE EXCEPTION 'identidade da produção confirmada é imutável; regularize a origem' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "EntradaLeite_imutavel" BEFORE UPDATE ON pecuaria."EntradaProducaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_entrada_leite();

CREATE FUNCTION pecuaria.proteger_medicao_leite_confirmada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sid TEXT;
BEGIN
  IF TG_OP='DELETE' THEN sid:=OLD."sessaoId"; ELSE sid:=NEW."sessaoId"; END IF;
  IF EXISTS (SELECT 1 FROM pecuaria."EntradaProducaoLeite" e WHERE e."sessaoId"=sid AND e.status='CONFIRMADA')
    THEN RAISE EXCEPTION 'ordenha confirmada exige regularização antes de editar medições' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND OLD."sessaoId" IS DISTINCT FROM NEW."sessaoId" AND EXISTS
    (SELECT 1 FROM pecuaria."EntradaProducaoLeite" e WHERE e."sessaoId"=OLD."sessaoId" AND e.status='CONFIRMADA')
    THEN RAISE EXCEPTION 'medição de ordenha confirmada não pode mudar de sessão' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "MedicaoLeite_proteger_estoque" BEFORE INSERT OR UPDATE OR DELETE ON pecuaria."MedicaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_medicao_leite_confirmada();

CREATE FUNCTION pecuaria.proteger_populacao_leite_confirmada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE did TEXT;
BEGIN
  IF TG_OP='DELETE' THEN did:=OLD."diaId"; ELSE did:=NEW."diaId"; END IF;
  IF EXISTS (SELECT 1 FROM pecuaria."EntradaProducaoLeite" e JOIN pecuaria."SessaoOrdenha" s ON s.id=e."sessaoId" WHERE s."diaId"=did AND e.status='CONFIRMADA')
    THEN RAISE EXCEPTION 'população com ordenha confirmada exige regularização antes de alterar identidade ou exclusão' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND OLD."diaId" IS DISTINCT FROM NEW."diaId" AND EXISTS (
    SELECT 1 FROM pecuaria."EntradaProducaoLeite" e JOIN pecuaria."SessaoOrdenha" s ON s.id=e."sessaoId" WHERE s."diaId"=OLD."diaId" AND e.status='CONFIRMADA')
    THEN RAISE EXCEPTION 'participante de ordenha confirmada não pode mudar de dia' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ParticipanteLeite_proteger_estoque" BEFORE INSERT OR UPDATE OR DELETE ON pecuaria."ParticipanteProducaoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_populacao_leite_confirmada();

CREATE FUNCTION pecuaria.proteger_sessao_leite_confirmada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pecuaria."EntradaProducaoLeite" e WHERE e."sessaoId"=OLD.id AND e.status='CONFIRMADA')
    THEN RAISE EXCEPTION 'sessão com estoque confirmado conserva identidade e versão' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "SessaoLeite_proteger_estoque" BEFORE UPDATE OR DELETE ON pecuaria."SessaoOrdenha" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_sessao_leite_confirmada();

-- Preserva integralmente as garantias V1; apenas despacha o método leiteiro.
CREATE OR REPLACE FUNCTION public.conferir_valorizacao_estoque() RETURNS trigger LANGUAGE plpgsql AS $$
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
  IF m."metodoValorizacao"='LEITE_FIFO_V1' THEN PERFORM pecuaria.conferir_movimento_leite(mid); RETURN NULL; END IF;
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
