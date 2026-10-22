-- CreateTable
CREATE TABLE "pecuaria"."ConferenciaSaldoLeite" (
    "id" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "produtoId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "litrosObservados" DECIMAL(14,3) NOT NULL,
    "referencia" TEXT NOT NULL,
    "responsavel" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "motivoCorrecao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "ConferenciaSaldoLeite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConferenciaSaldoLeite_propriedadeId_data_idx" ON "pecuaria"."ConferenciaSaldoLeite"("propriedadeId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "ConferenciaSaldoLeite_propriedadeId_produtoId_data_versao_key" ON "pecuaria"."ConferenciaSaldoLeite"("propriedadeId", "produtoId", "data", "versao");

-- AddForeignKey
ALTER TABLE "pecuaria"."ConferenciaSaldoLeite" ADD CONSTRAINT "ConferenciaSaldoLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ConferenciaSaldoLeite" ADD CONSTRAINT "ConferenciaSaldoLeite_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE pecuaria."ConferenciaSaldoLeite" ADD CONSTRAINT "ConferenciaSaldoLeite_dados" CHECK ("litrosObservados">=0 AND versao>0 AND length(btrim(referencia))>=3 AND length(btrim(responsavel))>=2 AND (versao=1 OR ("motivoCorrecao" IS NOT NULL AND length(btrim("motivoCorrecao"))>=5)));
CREATE FUNCTION pecuaria.proteger_conferencia_saldo_leite() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE anterior integer;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Conferência física é histórica; registre nova versão com motivo' USING ERRCODE='23514'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('leite-conferencia:'||NEW."propriedadeId"||':'||NEW."produtoId"||':'||NEW.data));
  SELECT max(versao) INTO anterior FROM pecuaria."ConferenciaSaldoLeite" WHERE "propriedadeId"=NEW."propriedadeId" AND "produtoId"=NEW."produtoId" AND data=NEW.data;
  IF NEW.versao<>COALESCE(anterior,0)+1 THEN RAISE EXCEPTION 'Conferência física exige versão sequencial do mesmo produto/sítio/data' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public."Produto" WHERE id=NEW."produtoId" AND unidade='L' AND NOT "rastrearPartidas") THEN RAISE EXCEPTION 'Conferência leiteira exige produto em litros com origem por ordenha' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ConferenciaSaldoLeite_imutavel" BEFORE INSERT OR UPDATE OR DELETE ON pecuaria."ConferenciaSaldoLeite" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_conferencia_saldo_leite();
