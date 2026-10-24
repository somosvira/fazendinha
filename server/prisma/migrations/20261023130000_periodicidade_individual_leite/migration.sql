-- Gerada somente por diff de schemas; não aplicada no banco.
-- AlterTable
ALTER TABLE "pecuaria"."ConfiguracaoOrdenha" ADD COLUMN     "fonteProducao" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
ADD COLUMN     "intervaloIndividualQuantidade" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "intervaloIndividualUnidade" TEXT NOT NULL DEFAULT 'MESES';

-- AlterTable
ALTER TABLE "pecuaria"."EntradaProducaoLeite" ADD COLUMN     "medicaoGeralId" TEXT;

-- CreateTable
CREATE TABLE "pecuaria"."TanqueLeite" (
    "id" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "identidadeId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "fabricante" TEXT,
    "modelo" TEXT,
    "numeroSerie" TEXT,
    "capacidadeLitros" DECIMAL(14,3) NOT NULL,
    "vigenteDesde" DATE NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "tabelaConversao" JSONB NOT NULL,
    "referenciaTabela" TEXT,
    "criadoPorId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TanqueLeite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."MedicaoGeralLeite" (
    "id" TEXT NOT NULL,
    "sessaoId" TEXT NOT NULL,
    "tanqueId" TEXT NOT NULL,
    "litros" DECIMAL(14,3) NOT NULL,
    "reguaMm" DECIMAL(10,3),
    "origemLitros" TEXT NOT NULL,
    "natureza" TEXT NOT NULL,
    "animaisOrigem" JSONB NOT NULL,
    "responsavel" TEXT NOT NULL,
    "observacao" TEXT,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criadoPorId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicaoGeralLeite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TanqueLeite_propriedadeId_vigenteDesde_idx" ON "pecuaria"."TanqueLeite"("propriedadeId", "vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "TanqueLeite_propriedadeId_identidadeId_versao_key" ON "pecuaria"."TanqueLeite"("propriedadeId", "identidadeId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "TanqueLeite_propriedadeId_identidadeId_vigenteDesde_key" ON "pecuaria"."TanqueLeite"("propriedadeId", "identidadeId", "vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "MedicaoGeralLeite_sessaoId_tanqueId_key" ON "pecuaria"."MedicaoGeralLeite"("sessaoId", "tanqueId");

-- AddForeignKey
ALTER TABLE "pecuaria"."EntradaProducaoLeite" ADD CONSTRAINT "EntradaProducaoLeite_medicaoGeralId_fkey" FOREIGN KEY ("medicaoGeralId") REFERENCES "pecuaria"."MedicaoGeralLeite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."TanqueLeite" ADD CONSTRAINT "TanqueLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MedicaoGeralLeite" ADD CONSTRAINT "MedicaoGeralLeite_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "pecuaria"."SessaoOrdenha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MedicaoGeralLeite" ADD CONSTRAINT "MedicaoGeralLeite_tanqueId_fkey" FOREIGN KEY ("tanqueId") REFERENCES "pecuaria"."TanqueLeite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE pecuaria."ConfiguracaoOrdenha" ADD CONSTRAINT "ConfiguracaoOrdenha_intervalo_individual"
 CHECK ("intervaloIndividualQuantidade" BETWEEN 1 AND 365 AND "intervaloIndividualUnidade" IN ('DIAS','MESES') AND "fonteProducao" IN ('GERAL','INDIVIDUAL'));
ALTER TABLE pecuaria."TanqueLeite" ADD CONSTRAINT "TanqueLeite_especificacoes" CHECK ("versao">0 AND "capacidadeLitros">0 AND length(trim(nome))>0 AND jsonb_typeof("tabelaConversao")='array');
ALTER TABLE pecuaria."MedicaoGeralLeite" ADD CONSTRAINT "MedicaoGeralLeite_valores" CHECK (litros>=0 AND ("reguaMm" IS NULL OR "reguaMm">=0) AND versao>0 AND natureza IN ('COMERCIAL','NAO_COMERCIAL','COLOSTRO') AND "origemLitros" IN ('LITROS_INFORMADOS','TABELA_TANQUE') AND length(trim(responsavel))>0 AND jsonb_typeof("animaisOrigem")='array');
CREATE UNIQUE INDEX "EntradaLeite_medicao_geral_confirmada" ON pecuaria."EntradaProducaoLeite"("medicaoGeralId") WHERE status='CONFIRMADA' AND "medicaoGeralId" IS NOT NULL;
CREATE TRIGGER "TanqueLeite_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."TanqueLeite" FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_valorizacao_estoque();
CREATE FUNCTION pecuaria.conferir_medicao_geral_leite() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tanque record; sessao record;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'aferição é histórica; corrija com motivo e versão' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (ROW(NEW.id,NEW."sessaoId",NEW."tanqueId",NEW."criadoEm",NEW."criadoPorId") IS DISTINCT FROM ROW(OLD.id,OLD."sessaoId",OLD."tanqueId",OLD."criadoEm",OLD."criadoPorId") OR NEW.versao<>OLD.versao+1) THEN RAISE EXCEPTION 'identidade histórica ou versão da aferição inválida' USING ERRCODE='23514'; END IF;
 PERFORM id FROM pecuaria."SessaoOrdenha" WHERE id=NEW."sessaoId" FOR NO KEY UPDATE;
 IF EXISTS (SELECT 1 FROM pecuaria."EntradaProducaoLeite" WHERE "medicaoGeralId"=NEW.id AND status='CONFIRMADA') THEN RAISE EXCEPTION 'regularize a entrada antes de corrigir a aferição' USING ERRCODE='23514'; END IF;
 SELECT d."propriedadeId",d."dataOperacional",c."fonteProducao" INTO sessao FROM pecuaria."SessaoOrdenha" s JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId" JOIN pecuaria."ConfiguracaoOrdenha" c ON c.id=d."configuracaoId" WHERE s.id=NEW."sessaoId";
 SELECT * INTO tanque FROM pecuaria."TanqueLeite" WHERE id=NEW."tanqueId";
 IF sessao."fonteProducao"<>'GERAL' OR tanque."propriedadeId"<>sessao."propriedadeId" OR NOT tanque.ativo OR tanque."vigenteDesde">sessao."dataOperacional" OR NEW.litros>tanque."capacidadeLitros" OR EXISTS (SELECT 1 FROM pecuaria."TanqueLeite" t WHERE t."propriedadeId"=tanque."propriedadeId" AND t."identidadeId"=tanque."identidadeId" AND t.versao>tanque.versao AND t."vigenteDesde"<=sessao."dataOperacional") THEN RAISE EXCEPTION 'aferição incompatível com tanque, sítio, data ou fonte da produção' USING ERRCODE='23514'; END IF;
 IF (NEW."reguaMm" IS NULL AND NEW."origemLitros"<>'LITROS_INFORMADOS') OR (NEW."reguaMm" IS NOT NULL AND (NEW."origemLitros"<>'TABELA_TANQUE' OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(tanque."tabelaConversao") p WHERE (p->>'mm')::numeric=NEW."reguaMm" AND (p->>'litros')::numeric=NEW.litros))) THEN RAISE EXCEPTION 'conversão deve corresponder ao ponto documentado do tanque' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "MedicaoGeralLeite_conferir" BEFORE INSERT OR UPDATE OR DELETE ON pecuaria."MedicaoGeralLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_medicao_geral_leite();

CREATE OR REPLACE FUNCTION pecuaria.conferir_medicoes_entrada_leite(eid text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE e record; quantidade_total numeric; n bigint;
BEGIN
  SELECT ep.*,m.quantidade INTO e FROM pecuaria."EntradaProducaoLeite" ep
    JOIN public."MovimentoEstoque" m ON m.id=ep."movimentoId" WHERE ep.id=eid;
  IF NOT FOUND THEN RETURN; END IF;
  IF e."medicaoGeralId" IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pecuaria."VinculoMedicaoEntradaLeite" WHERE "entradaId"=eid) OR NOT EXISTS (
      SELECT 1 FROM pecuaria."MedicaoGeralLeite" g JOIN pecuaria."SessaoOrdenha" s ON s.id=g."sessaoId" JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId" JOIN pecuaria."ConfiguracaoOrdenha" c ON c.id=d."configuracaoId"
      WHERE g.id=e."medicaoGeralId" AND g."sessaoId"=e."sessaoId" AND c."fonteProducao"='GERAL'
      AND e.snapshot->>'fonte'='GERAL' AND e.snapshot->>'medicaoGeralId'=g.id
      AND (e.snapshot->>'litros')::numeric=e.quantidade
      AND (e.status<>'CONFIRMADA' OR (g.litros=e.quantidade AND g.versao=(e.snapshot->>'versaoMedicaoGeral')::integer))
    ) THEN RAISE EXCEPTION 'entrada geral exige aferição inteira da mesma sessão e versão' USING ERRCODE='23514'; END IF;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM pecuaria."SessaoOrdenha" s JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId" JOIN pecuaria."ConfiguracaoOrdenha" c ON c.id=d."configuracaoId" WHERE s.id=e."sessaoId" AND c."fonteProducao"='GERAL') THEN RAISE EXCEPTION 'controle individual não confirma estoque em data de produção geral' USING ERRCODE='23514'; END IF;
  SELECT sum(quantidade),count(*) INTO quantidade_total,n FROM pecuaria."VinculoMedicaoEntradaLeite" WHERE "entradaId"=eid;
  IF n=0 OR quantidade_total IS DISTINCT FROM e.quantidade OR EXISTS (
    SELECT 1 FROM pecuaria."VinculoMedicaoEntradaLeite" v JOIN pecuaria."MedicaoLeite" md ON md.id=v."medicaoId"
    JOIN pecuaria."ParticipanteProducaoLeite" p ON p.id=md."participanteId"
    WHERE v."entradaId"=eid AND (
      md."sessaoId"<>e."sessaoId" OR v.ativo<>(e.status='CONFIRMADA')
      OR (v.ativo AND (md.estado<>'MEDIDO' OR md.litros IS DISTINCT FROM v.quantidade OR md.versao<>v."versaoMedicao" OR p."excluidoEm" IS NOT NULL))
      OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(e.snapshot->'medicoes') j
        WHERE j->>'id'=v."medicaoId" AND j->>'animalId'=p."animalId" AND j->>'estado'='MEDIDO'
          AND (j->>'litros')::numeric=v.quantidade AND (j->>'versao')::integer=v."versaoMedicao")
    )) THEN RAISE EXCEPTION 'origem exige medições inteiras, únicas, da mesma sessão, versão e snapshot conciliados' USING ERRCODE='23514'; END IF;
END $$;

CREATE OR REPLACE FUNCTION pecuaria.conferir_movimento_leite(mid TEXT) RETURNS void LANGUAGE plpgsql AS $$
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
      OR (m.status='CONFIRMADO' AND (entrada.status<>'CONFIRMADA' OR (entrada."medicaoGeralId" IS NULL AND entrada."versaoSessao"<>entrada."versaoAtual")))
      OR (m.status='REVERTIDO' AND entrada.status<>'ANULADA')
    THEN RAISE EXCEPTION 'entrada leiteira exige origem confirmada da ordenha' USING ERRCODE='23514'; END IF;
    PERFORM pecuaria.conferir_medicoes_entrada_leite(entrada.id);
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

CREATE OR REPLACE FUNCTION pecuaria.proteger_entrada_leite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."medicaoGeralId" IS DISTINCT FROM OLD."medicaoGeralId" OR NEW.id IS DISTINCT FROM OLD.id OR NEW."sessaoId" IS DISTINCT FROM OLD."sessaoId" OR NEW."versaoSessao" IS DISTINCT FROM OLD."versaoSessao"
    OR NEW."movimentoId" IS DISTINCT FROM OLD."movimentoId" OR NEW.chave IS DISTINCT FROM OLD.chave OR NEW.hash IS DISTINCT FROM OLD.hash
    OR NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW."criadoEm" IS DISTINCT FROM OLD."criadoEm" OR NEW."criadoPorId" IS DISTINCT FROM OLD."criadoPorId"
    OR (NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status='CONFIRMADA' AND NEW.status='ANULADA'))
    THEN RAISE EXCEPTION 'identidade da produção confirmada é imutável; regularize a origem' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION pecuaria.proteger_medicao_leite_confirmada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sid TEXT; sessoes TEXT[];
BEGIN
  IF TG_OP='UPDATE' THEN sessoes:=ARRAY[OLD."sessaoId",NEW."sessaoId"];
  ELSIF TG_OP='DELETE' THEN sessoes:=ARRAY[OLD."sessaoId"];
  ELSE sessoes:=ARRAY[NEW."sessaoId"]; END IF;
  -- Mesma barreira da confirmação, antes de observar entradas concorrentes.
  PERFORM id FROM pecuaria."SessaoOrdenha" WHERE id=ANY(sessoes) ORDER BY id FOR NO KEY UPDATE;
  IF TG_OP='DELETE' THEN sid:=OLD."sessaoId"; ELSE sid:=NEW."sessaoId"; END IF;
  IF EXISTS (SELECT 1 FROM pecuaria."EntradaProducaoLeite" e WHERE e."sessaoId"=sid AND e.status='CONFIRMADA' AND e."medicaoGeralId" IS NULL)
    THEN RAISE EXCEPTION 'ordenha confirmada exige regularização antes de editar medições' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND OLD."sessaoId" IS DISTINCT FROM NEW."sessaoId" AND EXISTS
    (SELECT 1 FROM pecuaria."EntradaProducaoLeite" e WHERE e."sessaoId"=OLD."sessaoId" AND e.status='CONFIRMADA' AND e."medicaoGeralId" IS NULL)
    THEN RAISE EXCEPTION 'medição de ordenha confirmada não pode mudar de sessão' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION pecuaria.proteger_populacao_leite_confirmada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE did TEXT;
BEGIN
  IF TG_OP='DELETE' THEN did:=OLD."diaId"; ELSE did:=NEW."diaId"; END IF;
  IF EXISTS (SELECT 1 FROM pecuaria."EntradaProducaoLeite" e JOIN pecuaria."SessaoOrdenha" s ON s.id=e."sessaoId" WHERE s."diaId"=did AND e.status='CONFIRMADA' AND e."medicaoGeralId" IS NULL)
    THEN RAISE EXCEPTION 'população com ordenha confirmada exige regularização antes de alterar identidade ou exclusão' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND OLD."diaId" IS DISTINCT FROM NEW."diaId" AND EXISTS (
    SELECT 1 FROM pecuaria."EntradaProducaoLeite" e JOIN pecuaria."SessaoOrdenha" s ON s.id=e."sessaoId" WHERE s."diaId"=OLD."diaId" AND e.status='CONFIRMADA' AND e."medicaoGeralId" IS NULL)
    THEN RAISE EXCEPTION 'participante de ordenha confirmada não pode mudar de dia' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION pecuaria.proteger_sessao_leite_confirmada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pecuaria."EntradaProducaoLeite" e WHERE e."sessaoId"=OLD.id AND e.status='CONFIRMADA' AND e."medicaoGeralId" IS NULL)
    THEN RAISE EXCEPTION 'sessão com estoque confirmado conserva identidade e versão' USING ERRCODE='23514'; END IF;
  IF EXISTS (SELECT 1 FROM pecuaria."MedicaoGeralLeite" WHERE "sessaoId"=OLD.id) THEN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'sessão com aferição geral deve ser preservada' USING ERRCODE='23514'; END IF;
    IF (to_jsonb(NEW)-'versao') IS DISTINCT FROM (to_jsonb(OLD)-'versao') THEN RAISE EXCEPTION 'identidade da ordenha aferida é imutável' USING ERRCODE='23514'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
