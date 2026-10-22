-- CreateTable
CREATE TABLE "pecuaria"."VinculoMedicaoEntradaLeite" (
    "id" TEXT NOT NULL,
    "entradaId" TEXT NOT NULL,
    "medicaoId" TEXT NOT NULL,
    "quantidade" DECIMAL(14,3) NOT NULL,
    "versaoMedicao" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VinculoMedicaoEntradaLeite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VinculoMedicaoEntradaLeite_medicaoId_idx" ON "pecuaria"."VinculoMedicaoEntradaLeite"("medicaoId");

-- CreateIndex
CREATE UNIQUE INDEX "VinculoMedicaoEntradaLeite_entradaId_medicaoId_key" ON "pecuaria"."VinculoMedicaoEntradaLeite"("entradaId", "medicaoId");

-- AddForeignKey
ALTER TABLE "pecuaria"."VinculoMedicaoEntradaLeite" ADD CONSTRAINT "VinculoMedicaoEntradaLeite_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES "pecuaria"."EntradaProducaoLeite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."VinculoMedicaoEntradaLeite" ADD CONSTRAINT "VinculoMedicaoEntradaLeite_medicaoId_fkey" FOREIGN KEY ("medicaoId") REFERENCES "pecuaria"."MedicaoLeite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A unicidade física passa da sessão inteira à medição inteira em qualquer produto.
DROP INDEX pecuaria."EntradaLeite_sessao_confirmada";
ALTER TABLE pecuaria."VinculoMedicaoEntradaLeite" ADD CONSTRAINT "VinculoMedicaoEntrada_quantidade_versao" CHECK (quantidade > 0 AND "versaoMedicao" > 0);
CREATE UNIQUE INDEX "VinculoMedicaoEntrada_medicao_ativa" ON pecuaria."VinculoMedicaoEntradaLeite"("medicaoId") WHERE ativo;

-- Histórico da confirmação anterior só é migrado com prova explícita do snapshot.
-- Inconsistência de identidade, soma ou versão aborta, sem inventar medições.
INSERT INTO pecuaria."VinculoMedicaoEntradaLeite" (id,"entradaId","medicaoId",quantidade,"versaoMedicao",ativo,"criadoEm")
SELECT gen_random_uuid()::text,e.id,j->>'id',(j->>'litros')::numeric,(j->>'versao')::integer,e.status='CONFIRMADA',e."criadoEm"
FROM pecuaria."EntradaProducaoLeite" e CROSS JOIN LATERAL jsonb_array_elements(e.snapshot->'medicoes') j
WHERE j->>'estado'='MEDIDO' AND (j->>'litros')::numeric > 0;

CREATE FUNCTION pecuaria.conferir_medicoes_entrada_leite(eid text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE e record; quantidade_total numeric; n bigint;
BEGIN
  SELECT ep.*,m.quantidade INTO e FROM pecuaria."EntradaProducaoLeite" ep
    JOIN public."MovimentoEstoque" m ON m.id=ep."movimentoId" WHERE ep.id=eid;
  IF NOT FOUND THEN RETURN; END IF;
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

-- Preserva as garantias monetárias, saídas, inversos e consumo do núcleo T4.
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
      OR (m.status='CONFIRMADO' AND (entrada.status<>'CONFIRMADA' OR entrada."versaoSessao"<>entrada."versaoAtual"))
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

CREATE FUNCTION pecuaria.proteger_vinculo_medicao_entrada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e record; md record;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'vínculo de medição é histórico; anule a entrada' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'ativo') IS DISTINCT FROM (to_jsonb(OLD)-'ativo') THEN
    RAISE EXCEPTION 'identidade, quantidade e versão da medição confirmada são imutáveis' USING ERRCODE='23514'; END IF;
  SELECT * INTO e FROM pecuaria."EntradaProducaoLeite" WHERE id=NEW."entradaId";
  PERFORM id FROM pecuaria."SessaoOrdenha" WHERE id=e."sessaoId" FOR NO KEY UPDATE;
  IF TG_OP='INSERT' THEN
    SELECT md0.*,p."excluidoEm" INTO md FROM pecuaria."MedicaoLeite" md0
      JOIN pecuaria."ParticipanteProducaoLeite" p ON p.id=md0."participanteId" WHERE md0.id=NEW."medicaoId";
    IF NOT FOUND OR e.status<>'CONFIRMADA' OR NOT NEW.ativo OR md."sessaoId"<>e."sessaoId"
      OR md.estado<>'MEDIDO' OR md.litros IS DISTINCT FROM NEW.quantidade OR md.versao<>NEW."versaoMedicao" OR md."excluidoEm" IS NOT NULL
    THEN RAISE EXCEPTION 'confirmação exige medição inteira positiva e vigente da mesma sessão' USING ERRCODE='23514'; END IF;
  ELSIF NEW.ativo IS DISTINCT FROM OLD.ativo AND (NOT OLD.ativo OR NEW.ativo OR e.status<>'ANULADA') THEN
    RAISE EXCEPTION 'somente anulação da entrada libera sua medição, sem apagar vínculo' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "VinculoMedicaoEntrada_imutavel" BEFORE INSERT OR UPDATE OR DELETE ON pecuaria."VinculoMedicaoEntradaLeite"
FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_vinculo_medicao_entrada();
CREATE FUNCTION pecuaria.guard_vinculo_medicao_entrada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pecuaria.conferir_medicoes_entrada_leite(NEW."entradaId");
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "VinculoMedicaoEntrada_conferir" AFTER INSERT OR UPDATE ON pecuaria."VinculoMedicaoEntradaLeite"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.guard_vinculo_medicao_entrada();

CREATE FUNCTION pecuaria.proteger_identidade_medicao_com_origem() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.id,NEW."sessaoId",NEW."diaId",NEW."participanteId") IS DISTINCT FROM ROW(OLD.id,OLD."sessaoId",OLD."diaId",OLD."participanteId")
    AND EXISTS (SELECT 1 FROM pecuaria."VinculoMedicaoEntradaLeite" WHERE "medicaoId"=OLD.id)
  THEN RAISE EXCEPTION 'identidade da medição com origem física preservada é imutável' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "MedicaoLeite_identidade_origem" BEFORE UPDATE ON pecuaria."MedicaoLeite"
FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_identidade_medicao_com_origem();

DO $$ DECLARE eid text; BEGIN
  FOR eid IN SELECT id FROM pecuaria."EntradaProducaoLeite" LOOP
    PERFORM pecuaria.conferir_medicoes_entrada_leite(eid);
  END LOOP;
END $$;

-- Em READ COMMITTED a consulta posterior à trava vê a confirmação concluída.
-- Serviços usam Serializable; snapshots RepeatableRead manuais não são um percurso de escrita suportado.
CREATE OR REPLACE FUNCTION pecuaria.proteger_medicao_leite_confirmada() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sid TEXT; sessoes TEXT[];
BEGIN
  IF TG_OP='UPDATE' THEN sessoes:=ARRAY[OLD."sessaoId",NEW."sessaoId"];
  ELSIF TG_OP='DELETE' THEN sessoes:=ARRAY[OLD."sessaoId"];
  ELSE sessoes:=ARRAY[NEW."sessaoId"]; END IF;
  -- Mesma barreira da confirmação, antes de observar entradas concorrentes.
  PERFORM id FROM pecuaria."SessaoOrdenha" WHERE id=ANY(sessoes) ORDER BY id FOR NO KEY UPDATE;
  IF TG_OP='DELETE' THEN sid:=OLD."sessaoId"; ELSE sid:=NEW."sessaoId"; END IF;
  IF EXISTS (SELECT 1 FROM pecuaria."EntradaProducaoLeite" e WHERE e."sessaoId"=sid AND e.status='CONFIRMADA')
    THEN RAISE EXCEPTION 'ordenha confirmada exige regularização antes de editar medições' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND OLD."sessaoId" IS DISTINCT FROM NEW."sessaoId" AND EXISTS
    (SELECT 1 FROM pecuaria."EntradaProducaoLeite" e WHERE e."sessaoId"=OLD."sessaoId" AND e.status='CONFIRMADA')
    THEN RAISE EXCEPTION 'medição de ordenha confirmada não pode mudar de sessão' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
