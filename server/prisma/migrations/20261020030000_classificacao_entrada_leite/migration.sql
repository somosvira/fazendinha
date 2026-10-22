-- Não presume natureza comercial para saídas V5 já existentes. Esta cadeia
-- ainda não foi aplicada na entrega; dados prévios exigem reconciliação própria.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pecuaria."AlocacaoLeiteEstoque") THEN
    RAISE EXCEPTION 'há saídas de leite anteriores à classificação; reconcilie snapshots antes desta migration';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "pecuaria"."AlocacaoLeiteEstoque" ADD COLUMN     "classificacaoId" TEXT NOT NULL,
ADD COLUMN     "finalidade" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "pecuaria"."ClassificacaoEntradaLeite" (
    "id" TEXT NOT NULL,
    "entradaId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "natureza" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "ClassificacaoEntradaLeite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClassificacaoEntradaLeite_entradaId_versao_key" ON "pecuaria"."ClassificacaoEntradaLeite"("entradaId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "ClassificacaoEntradaLeite_id_entradaId_key" ON "pecuaria"."ClassificacaoEntradaLeite"("id", "entradaId");

-- AddForeignKey
ALTER TABLE "pecuaria"."AlocacaoLeiteEstoque" ADD CONSTRAINT "AlocacaoLeiteEstoque_classificacaoId_entradaId_fkey" FOREIGN KEY ("classificacaoId", "entradaId") REFERENCES "pecuaria"."ClassificacaoEntradaLeite"("id", "entradaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ClassificacaoEntradaLeite" ADD CONSTRAINT "ClassificacaoEntradaLeite_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES "pecuaria"."EntradaProducaoLeite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Origem anterior sem consumidores permanece explicitamente não informada.
INSERT INTO pecuaria."ClassificacaoEntradaLeite" (id,"entradaId",versao,natureza,motivo,"criadoPorId")
  SELECT gen_random_uuid()::text,e.id,1,'NAO_INFORMADA','Classificação inicial pendente; nenhuma elegibilidade comercial foi presumida',NULL
  FROM pecuaria."EntradaProducaoLeite" e;

ALTER TABLE pecuaria."ClassificacaoEntradaLeite" ADD CONSTRAINT "ClassificacaoLeite_natureza" CHECK (
  versao>0 AND natureza IN ('NAO_INFORMADA','COMERCIAL','COLOSTRO','NAO_COMERCIAL') AND length(trim(motivo))>=5
);
ALTER TABLE pecuaria."AlocacaoLeiteEstoque" ADD CONSTRAINT "AlocacaoLeite_finalidade" CHECK (finalidade IN ('VENDA','CONSUMO','DESCARTE'));

CREATE FUNCTION pecuaria.proteger_natureza_entrada_leite() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE produto TEXT; anterior RECORD;
BEGIN
  SELECT m."produtoId" INTO produto FROM pecuaria."EntradaProducaoLeite" e JOIN public."MovimentoEstoque" m ON m.id=e."movimentoId"
    WHERE e.id=NEW."entradaId" AND e.status='CONFIRMADA';
  IF NOT FOUND THEN RAISE EXCEPTION 'declaração exige origem leiteira confirmada' USING ERRCODE='23514'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('valorizacao-estoque:'||produto));
  SELECT * INTO anterior FROM pecuaria."ClassificacaoEntradaLeite" WHERE "entradaId"=NEW."entradaId" ORDER BY versao DESC LIMIT 1;
  IF NOT FOUND THEN
    IF NEW.versao<>1 OR NEW.natureza<>'NAO_INFORMADA' THEN
      RAISE EXCEPTION 'natureza inicial é não informada; comercial exige declaração posterior explícita' USING ERRCODE='23514'; END IF;
  ELSE
    IF anterior.natureza IN ('COLOSTRO','NAO_COMERCIAL') OR NEW.natureza='NAO_INFORMADA' OR NEW.natureza=anterior.natureza OR NEW.versao<>anterior.versao+1 THEN
      RAISE EXCEPTION 'classificação restrita é terminal; preserve versões sem desbloquear ou duplicar' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ClassificacaoLeite_validar" BEFORE INSERT ON pecuaria."ClassificacaoEntradaLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_natureza_entrada_leite();
CREATE TRIGGER "ClassificacaoLeite_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."ClassificacaoEntradaLeite" FOR EACH ROW EXECUTE FUNCTION public.impedir_edicao_valorizacao_estoque();

CREATE FUNCTION pecuaria.conferir_classificacao_inicial_leite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pecuaria."ClassificacaoEntradaLeite" c WHERE c."entradaId"=NEW.id AND c.versao=1 AND c.natureza='NAO_INFORMADA') THEN
    RAISE EXCEPTION 'produção confirmada exige classificação inicial não informada' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "EntradaLeite_classificacao_inicial" AFTER INSERT ON pecuaria."EntradaProducaoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_classificacao_inicial_leite();

CREATE FUNCTION pecuaria.conferir_elegibilidade_saida_leite() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE m RECORD; c RECORD; atual TEXT; operacao_tipo TEXT;
BEGIN
  SELECT * INTO m FROM public."MovimentoEstoque" WHERE id=NEW."movimentoId";
  SELECT * INTO c FROM pecuaria."ClassificacaoEntradaLeite" WHERE id=NEW."classificacaoId" AND "entradaId"=NEW."entradaId";
  IF NOT FOUND THEN RAISE EXCEPTION 'classificação da saída pertence a outra entrada' USING ERRCODE='23514'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('valorizacao-estoque:'||m."produtoId"));
  SELECT id INTO atual FROM pecuaria."ClassificacaoEntradaLeite" WHERE "entradaId"=NEW."entradaId" ORDER BY versao DESC LIMIT 1;
  IF c.id<>atual THEN RAISE EXCEPTION 'saída exige snapshot da classificação vigente sob trava' USING ERRCODE='23514'; END IF;
  IF m."operacaoId" IS NOT NULL THEN SELECT tipo::text INTO operacao_tipo FROM public."Operacao" WHERE id=m."operacaoId"; END IF;
  IF NEW.finalidade='VENDA' THEN
    IF operacao_tipo IS DISTINCT FROM 'VENDA' OR c.natureza<>'COMERCIAL' THEN
      RAISE EXCEPTION 'venda exige operação única e entrada explicitamente comercial' USING ERRCODE='23514'; END IF;
  ELSE
    IF m."operacaoId" IS NOT NULL OR (NEW.finalidade='CONSUMO' AND m.origem<>'NUTRICAO') OR (NEW.finalidade='DESCARTE' AND m.origem<>'PERDA') THEN
      RAISE EXCEPTION 'finalidade interna não pode contornar venda ou sua restrição comercial' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "AlocacaoLeite_elegibilidade" AFTER INSERT ON pecuaria."AlocacaoLeiteEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_elegibilidade_saida_leite();

CREATE FUNCTION pecuaria.conferir_natureza_destino_leite() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE destino RECORD; mid TEXT;
BEGIN
  mid:=NEW."movimentoId";
  SELECT * INTO destino FROM pecuaria."DestinoInternoLeite" WHERE "movimentoId"=mid;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM pecuaria."AlocacaoLeiteEstoque" a
    JOIN pecuaria."ClassificacaoEntradaLeite" c ON c.id=a."classificacaoId" AND c."entradaId"=a."entradaId"
    WHERE a."movimentoId"=mid AND (
      (destino.natureza='COLOSTRO' AND c.natureza<>'COLOSTRO') OR
      (destino.natureza='LEITE_NAO_COMERCIAL' AND c.natureza<>'NAO_COMERCIAL') OR
      (destino.natureza='LEITE_COMUM' AND c.natureza='COLOSTRO')
    )) THEN RAISE EXCEPTION 'natureza do destino contradiz a classificação preservada da entrada inteira' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "DestinoLeite_natureza_origem" AFTER INSERT OR UPDATE ON pecuaria."DestinoInternoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_natureza_destino_leite();
CREATE CONSTRAINT TRIGGER "AlocacaoLeite_natureza_destino" AFTER INSERT ON pecuaria."AlocacaoLeiteEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_natureza_destino_leite();
