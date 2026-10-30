-- Casa/Funcionários: consumo interno rastreado, separado de alimentação animal e descarte físico.
CREATE TABLE pecuaria."RetiradaInternaLeite" (
 id text PRIMARY KEY,
 "propriedadeId" integer NOT NULL REFERENCES public."Propriedade"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "entradaId" text NOT NULL REFERENCES pecuaria."EntradaProducaoLeite"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "movimentoId" text NOT NULL UNIQUE REFERENCES public."MovimentoEstoque"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 destino text NOT NULL CHECK(destino IN ('CASA','FUNCIONARIOS')),
 responsavel text NOT NULL CHECK(length(btrim(responsavel)) BETWEEN 2 AND 200),
 data date NOT NULL,
 "quantidadeLitros" numeric(14,3) NOT NULL CHECK("quantidadeLitros">0),
 "saldoOrigemAntes" numeric(14,3) NOT NULL CHECK("saldoOrigemAntes">=0),
 "saldoOrigemDepois" numeric(14,3) NOT NULL CHECK("saldoOrigemDepois">=0),
 motivo text NOT NULL CHECK(length(btrim(motivo)) BETWEEN 5 AND 1000),
 status text NOT NULL DEFAULT 'CONFIRMADO' CHECK(status IN ('CONFIRMADO','ESTORNADO')),
 versao integer NOT NULL DEFAULT 1 CHECK(versao>0),
 "criadoEm" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "criadoPorId" integer,
 "estornadoEm" timestamp(3), "estornadoPorId" integer, "motivoEstorno" text,
 "movimentoEstornoId" text UNIQUE REFERENCES public."MovimentoEstoque"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CHECK("saldoOrigemAntes"-"quantidadeLitros"="saldoOrigemDepois")
);
CREATE INDEX "RetiradaInternaLeite_propriedadeId_data_idx" ON pecuaria."RetiradaInternaLeite"("propriedadeId",data);
CREATE FUNCTION pecuaria.validar_retirada_interna_leite(did text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE d record; m record; e record; inv record; n bigint; q numeric;
BEGIN
  SELECT * INTO d FROM pecuaria."RetiradaInternaLeite" WHERE id=did;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO m FROM public."MovimentoEstoque" WHERE id=d."movimentoId";
  SELECT ep.*,em."produtoId",em.data AS "dataProducao",em."propriedadeId" INTO e FROM pecuaria."EntradaProducaoLeite" ep JOIN public."MovimentoEstoque" em ON em.id=ep."movimentoId" WHERE ep.id=d."entradaId";
  SELECT count(*),sum(quantidade) INTO n,q FROM pecuaria."AlocacaoLeiteEstoque" WHERE "movimentoId"=m.id AND "entradaId"=e.id AND finalidade='CONSUMO';
  IF e."propriedadeId"<>d."propriedadeId" OR m."propriedadeId"<>d."propriedadeId" OR e."produtoId"<>m."produtoId" OR d.data<>m.data OR d.data<e."dataProducao"
    OR m.tipo<>'SAIDA' OR m.origem<>'NUTRICAO' OR m."metodoValorizacao"<>'LEITE_FIFO_V1' OR m."operacaoId" IS NOT NULL OR m."reversaoDeId" IS NOT NULL
    OR m.quantidade<>d."quantidadeLitros" OR n<>1 OR q<>d."quantidadeLitros" OR (SELECT count(*) FROM pecuaria."AlocacaoLeiteEstoque" WHERE "movimentoId"=m.id)<>1
    OR NOT EXISTS (SELECT 1 FROM pecuaria."AlocacaoLeiteEstoque" a JOIN pecuaria."ClassificacaoEntradaLeite" c ON c.id=a."classificacaoId" WHERE a."movimentoId"=m.id AND c.natureza='COMERCIAL')
    OR (d.status='CONFIRMADO' AND (m.status<>'CONFIRMADO' OR e.status<>'CONFIRMADA'))
    OR (d.status='ESTORNADO' AND m.status<>'REVERTIDO') OR d.status NOT IN ('CONFIRMADO','ESTORNADO')
  THEN RAISE EXCEPTION 'Retirada interna exige saída única com origem, sítio, data e litros conciliados, sem venda' USING ERRCODE='23514'; END IF;
  IF d.status='ESTORNADO' THEN
    SELECT * INTO inv FROM public."MovimentoEstoque" WHERE id=d."movimentoEstornoId";
    IF NOT FOUND OR inv."reversaoDeId"<>m.id OR inv.tipo<>'ENTRADA' OR inv.status<>'CONFIRMADO' OR inv.quantidade<>m.quantidade OR inv."propriedadeId"<>d."propriedadeId" OR inv."produtoId"<>m."produtoId" OR inv.origem<>'NUTRICAO' OR inv.observacao IS DISTINCT FROM d."motivoEstorno"
    THEN RAISE EXCEPTION 'Estorno da retirada exige inverso preservado e motivo' USING ERRCODE='23514'; END IF;
  END IF;
END $$;
CREATE FUNCTION pecuaria.proteger_retirada_interna_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Histórico de retirada interna não pode ser apagado' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'CONFIRMADO' OR NEW.versao<>1 OR NEW."movimentoEstornoId" IS NOT NULL OR NEW."estornadoEm" IS NOT NULL OR NEW."estornadoPorId" IS NOT NULL OR NEW."motivoEstorno" IS NOT NULL
    THEN RAISE EXCEPTION 'Retirada interna inicia confirmado na versão um, sem estorno' USING ERRCODE='23514'; END IF;
  ELSE
    IF (to_jsonb(NEW)-ARRAY['status','versao','estornadoEm','estornadoPorId','motivoEstorno','movimentoEstornoId']) IS DISTINCT FROM
       (to_jsonb(OLD)-ARRAY['status','versao','estornadoEm','estornadoPorId','motivoEstorno','movimentoEstornoId'])
      OR OLD.status<>'CONFIRMADO' OR NEW.status<>'ESTORNADO' OR NEW.versao<>OLD.versao+1 OR NEW."movimentoEstornoId" IS NULL OR NEW."estornadoEm" IS NULL OR NEW."motivoEstorno" IS NULL OR length(btrim(NEW."motivoEstorno"))<5
    THEN RAISE EXCEPTION 'Fatos do retirada interna são imutáveis; apenas estorno terminal com versão e motivo' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION pecuaria.conferir_retirada_interna_leite() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE rid text;
BEGIN
 IF TG_TABLE_NAME='RetiradaInternaLeite' THEN PERFORM pecuaria.validar_retirada_interna_leite(NEW.id);
 ELSE FOR rid IN SELECT id FROM pecuaria."RetiradaInternaLeite" WHERE "movimentoId"=NEW."movimentoId" LOOP PERFORM pecuaria.validar_retirada_interna_leite(rid); END LOOP; END IF;
 RETURN NULL;
END $$;
CREATE FUNCTION pecuaria.conferir_movimento_retirada_interna_leite() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE rid text;
BEGIN
 FOR rid IN SELECT id FROM pecuaria."RetiradaInternaLeite" WHERE "movimentoId"=NEW.id OR "movimentoEstornoId"=NEW.id LOOP PERFORM pecuaria.validar_retirada_interna_leite(rid); END LOOP;
 RETURN NULL;
END $$;
CREATE TRIGGER "RetiradaInternaLeite_imutavel" BEFORE INSERT OR UPDATE OR DELETE ON pecuaria."RetiradaInternaLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_retirada_interna_leite();
CREATE CONSTRAINT TRIGGER "RetiradaInternaLeite_conferir" AFTER INSERT OR UPDATE ON pecuaria."RetiradaInternaLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_retirada_interna_leite();
CREATE CONSTRAINT TRIGGER "RetiradaInternaLeite_alocacao" AFTER INSERT ON pecuaria."AlocacaoLeiteEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_retirada_interna_leite();
CREATE CONSTRAINT TRIGGER "RetiradaInternaLeite_movimento" AFTER INSERT OR UPDATE ON public."MovimentoEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_movimento_retirada_interna_leite();
