-- CreateTable
CREATE TABLE "pecuaria"."ConfiguracaoOrdenha" (
    "id" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "vigenteDesde" DATE NOT NULL,
    "inicial" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "ConfiguracaoOrdenha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."PosicaoOrdenha" (
    "id" TEXT NOT NULL,
    "configuracaoId" TEXT NOT NULL,
    "posicaoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "horario" TEXT,

    CONSTRAINT "PosicaoOrdenha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."DiaProducaoLeite" (
    "id" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "dataOperacional" DATE NOT NULL,
    "configuracaoId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiaProducaoLeite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."SessaoOrdenha" (
    "id" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "diaId" TEXT NOT NULL,
    "posicaoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "horario" TEXT,

    CONSTRAINT "SessaoOrdenha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ParticipanteProducaoLeite" (
    "id" TEXT NOT NULL,
    "diaId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "localizacaoId" TEXT NOT NULL,
    "lactacaoId" TEXT,
    "brinco" TEXT NOT NULL,
    "nome" TEXT,
    "pendencias" JSONB NOT NULL,
    "excluidoEm" TIMESTAMP(3),
    "motivoExclusao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "ParticipanteProducaoLeite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."MedicaoLeite" (
    "id" TEXT NOT NULL,
    "diaId" TEXT NOT NULL,
    "sessaoId" TEXT NOT NULL,
    "participanteId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDENTE',
    "litros" DECIMAL(14,3),
    "motivo" TEXT,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "atualizadoPorId" INTEGER,

    CONSTRAINT "MedicaoLeite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracaoOrdenha_propriedadeId_vigenteDesde_key" ON "pecuaria"."ConfiguracaoOrdenha"("propriedadeId", "vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracaoOrdenha_id_propriedadeId_key" ON "pecuaria"."ConfiguracaoOrdenha"("id", "propriedadeId");

-- CreateIndex
CREATE UNIQUE INDEX "PosicaoOrdenha_configuracaoId_posicaoId_key" ON "pecuaria"."PosicaoOrdenha"("configuracaoId", "posicaoId");

-- CreateIndex
CREATE UNIQUE INDEX "PosicaoOrdenha_configuracaoId_ordem_key" ON "pecuaria"."PosicaoOrdenha"("configuracaoId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "DiaProducaoLeite_propriedadeId_dataOperacional_key" ON "pecuaria"."DiaProducaoLeite"("propriedadeId", "dataOperacional");

-- CreateIndex
CREATE UNIQUE INDEX "SessaoOrdenha_diaId_posicaoId_key" ON "pecuaria"."SessaoOrdenha"("diaId", "posicaoId");

-- CreateIndex
CREATE UNIQUE INDEX "SessaoOrdenha_diaId_ordem_key" ON "pecuaria"."SessaoOrdenha"("diaId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "SessaoOrdenha_id_diaId_key" ON "pecuaria"."SessaoOrdenha"("id", "diaId");

-- CreateIndex
CREATE INDEX "ParticipanteProducaoLeite_animalId_idx" ON "pecuaria"."ParticipanteProducaoLeite"("animalId");

-- CreateIndex
CREATE INDEX "ParticipanteProducaoLeite_lactacaoId_idx" ON "pecuaria"."ParticipanteProducaoLeite"("lactacaoId");

-- CreateIndex
CREATE INDEX "ParticipanteProducaoLeite_localizacaoId_idx" ON "pecuaria"."ParticipanteProducaoLeite"("localizacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipanteProducaoLeite_diaId_animalId_key" ON "pecuaria"."ParticipanteProducaoLeite"("diaId", "animalId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipanteProducaoLeite_id_diaId_key" ON "pecuaria"."ParticipanteProducaoLeite"("id", "diaId");

-- CreateIndex
CREATE INDEX "MedicaoLeite_participanteId_idx" ON "pecuaria"."MedicaoLeite"("participanteId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicaoLeite_sessaoId_participanteId_key" ON "pecuaria"."MedicaoLeite"("sessaoId", "participanteId");

-- AddForeignKey
ALTER TABLE "pecuaria"."ConfiguracaoOrdenha" ADD CONSTRAINT "ConfiguracaoOrdenha_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."PosicaoOrdenha" ADD CONSTRAINT "PosicaoOrdenha_configuracaoId_fkey" FOREIGN KEY ("configuracaoId") REFERENCES "pecuaria"."ConfiguracaoOrdenha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."DiaProducaoLeite" ADD CONSTRAINT "DiaProducaoLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."DiaProducaoLeite" ADD CONSTRAINT "DiaProducaoLeite_configuracaoId_propriedadeId_fkey" FOREIGN KEY ("configuracaoId", "propriedadeId") REFERENCES "pecuaria"."ConfiguracaoOrdenha"("id", "propriedadeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."SessaoOrdenha" ADD CONSTRAINT "SessaoOrdenha_diaId_fkey" FOREIGN KEY ("diaId") REFERENCES "pecuaria"."DiaProducaoLeite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ParticipanteProducaoLeite" ADD CONSTRAINT "ParticipanteProducaoLeite_diaId_fkey" FOREIGN KEY ("diaId") REFERENCES "pecuaria"."DiaProducaoLeite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ParticipanteProducaoLeite" ADD CONSTRAINT "ParticipanteProducaoLeite_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ParticipanteProducaoLeite" ADD CONSTRAINT "ParticipanteProducaoLeite_localizacaoId_fkey" FOREIGN KEY ("localizacaoId") REFERENCES "pecuaria"."LocalizacaoAnimal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ParticipanteProducaoLeite" ADD CONSTRAINT "ParticipanteProducaoLeite_lactacaoId_fkey" FOREIGN KEY ("lactacaoId") REFERENCES "pecuaria"."LactacaoAnimal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MedicaoLeite" ADD CONSTRAINT "MedicaoLeite_sessaoId_diaId_fkey" FOREIGN KEY ("sessaoId", "diaId") REFERENCES "pecuaria"."SessaoOrdenha"("id", "diaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MedicaoLeite" ADD CONSTRAINT "MedicaoLeite_participanteId_diaId_fkey" FOREIGN KEY ("participanteId", "diaId") REFERENCES "pecuaria"."ParticipanteProducaoLeite"("id", "diaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariantes que não são representadas pelo Prisma.
ALTER TABLE "pecuaria"."PosicaoOrdenha" ADD CONSTRAINT "PosicaoOrdenha_campos_check"
  CHECK ("ordem" BETWEEN 1 AND 12 AND length(btrim("nome")) BETWEEN 1 AND 60
    AND ("horario" IS NULL OR "horario" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'));
ALTER TABLE "pecuaria"."SessaoOrdenha" ADD CONSTRAINT "SessaoOrdenha_campos_check"
  CHECK ("versao" > 0 AND "ordem" BETWEEN 1 AND 12 AND length(btrim("nome")) BETWEEN 1 AND 60
    AND ("horario" IS NULL OR "horario" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'));
ALTER TABLE "pecuaria"."DiaProducaoLeite" ADD CONSTRAINT "DiaProducaoLeite_versao_check" CHECK ("versao" > 0);
ALTER TABLE "pecuaria"."ParticipanteProducaoLeite" ADD CONSTRAINT "ParticipanteProducaoLeite_exclusao_check"
  CHECK (("excluidoEm" IS NULL AND "motivoExclusao" IS NULL)
    OR ("excluidoEm" IS NOT NULL AND "motivoExclusao" IS NOT NULL AND length(btrim("motivoExclusao")) >= 5));
ALTER TABLE "pecuaria"."MedicaoLeite" ADD CONSTRAINT "MedicaoLeite_estado_volume_check"
  CHECK ("versao" > 0 AND (
    ("estado" = 'MEDIDO' AND "litros" IS NOT NULL AND "litros" >= 0 AND "litros" <= 9999999.999)
    OR ("estado" = 'PENDENTE' AND "litros" IS NULL)
    OR ("estado" = 'NAO_ORDENHADO' AND "litros" IS NULL AND "motivo" IS NOT NULL AND length(btrim("motivo")) >= 5)
  ));

-- A folha referencia a configuração como parte do snapshot: congelar e editar
-- suas posições usam a mesma linha-pai como barreira, antes de conferir o uso.
CREATE FUNCTION "pecuaria"."proteger_configuracao_ordenha_usada"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM id FROM "pecuaria"."ConfiguracaoOrdenha" WHERE id=OLD.id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM "pecuaria"."DiaProducaoLeite" WHERE "configuracaoId"=OLD.id) THEN
    RAISE EXCEPTION 'Configuração utilizada por folha é imutável; publique nova vigência' USING ERRCODE='23514';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ConfiguracaoOrdenha_snapshot_imutavel"
  BEFORE UPDATE OR DELETE ON "pecuaria"."ConfiguracaoOrdenha"
  FOR EACH ROW EXECUTE FUNCTION "pecuaria"."proteger_configuracao_ordenha_usada"();

CREATE FUNCTION "pecuaria"."proteger_posicao_ordenha_usada"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE configuracoes text[]; configuracao_id text; tocar_parent boolean := true;
BEGIN
  IF TG_OP='INSERT' THEN configuracoes := ARRAY[NEW."configuracaoId"];
  ELSIF TG_OP='DELETE' THEN configuracoes := ARRAY[OLD."configuracaoId"];
  ELSE configuracoes := ARRAY[OLD."configuracaoId", NEW."configuracaoId"]; END IF;
  -- Ordem fixa também ao mover uma posição entre duas configurações ainda livres.
  FOR configuracao_id IN SELECT id FROM "pecuaria"."ConfiguracaoOrdenha"
    WHERE id=ANY(configuracoes) ORDER BY id FOR UPDATE LOOP
    NULL;
  END LOOP;
  IF EXISTS (SELECT 1 FROM "pecuaria"."DiaProducaoLeite" WHERE "configuracaoId"=ANY(configuracoes)) THEN
    RAISE EXCEPTION 'Posições de configuração utilizada por folha são imutáveis' USING ERRCODE='23514';
  END IF;
  -- Se a própria chave livre do pai acabou de mudar por FK CASCADE, ele já foi
  -- fisicamente atualizado. Evita atualizar de novo o mesmo tuple no cascade.
  IF TG_OP='UPDATE' THEN
    tocar_parent := EXISTS (SELECT 1 FROM "pecuaria"."ConfiguracaoOrdenha" WHERE id=OLD."configuracaoId");
  END IF;
  IF tocar_parent THEN
    -- Além do lock, produz versão de tuple para que snapshots RR/Serializable
    -- anteriores não possam congelar uma lista de posições já substituída.
    UPDATE "pecuaria"."ConfiguracaoOrdenha" SET id=id WHERE id=ANY(configuracoes);
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "PosicaoOrdenha_snapshot_imutavel"
  BEFORE INSERT OR UPDATE OR DELETE ON "pecuaria"."PosicaoOrdenha"
  FOR EACH ROW EXECUTE FUNCTION "pecuaria"."proteger_posicao_ordenha_usada"();

CREATE FUNCTION "pecuaria"."congelar_configuracao_dia_leite"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM id FROM "pecuaria"."ConfiguracaoOrdenha"
    WHERE id=NEW."configuracaoId" AND "propriedadeId"=NEW."propriedadeId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Configuração da folha não pertence ao sítio' USING ERRCODE='23503'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "pecuaria"."DiaProducaoLeite" WHERE "configuracaoId"=NEW."configuracaoId") THEN
    -- Primeiro uso invalida snapshots anteriores dos possíveis escritores.
    UPDATE "pecuaria"."ConfiguracaoOrdenha" SET id=id WHERE id=NEW."configuracaoId";
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "DiaProducaoLeite_congelar_configuracao"
  BEFORE INSERT ON "pecuaria"."DiaProducaoLeite"
  FOR EACH ROW EXECUTE FUNCTION "pecuaria"."congelar_configuracao_dia_leite"();

CREATE FUNCTION "pecuaria"."proteger_identidade_dia_leite"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.id, NEW."propriedadeId", NEW."dataOperacional", NEW."configuracaoId", NEW."criadoEm", NEW."criadoPorId")
    IS DISTINCT FROM ROW(OLD.id, OLD."propriedadeId", OLD."dataOperacional", OLD."configuracaoId", OLD."criadoEm", OLD."criadoPorId") THEN
    RAISE EXCEPTION 'Identidade e autoria da folha são imutáveis' USING ERRCODE='23514';
  END IF;
  IF NEW.versao <> OLD.versao + 1 THEN
    RAISE EXCEPTION 'Atualização da folha exige próxima versão' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "DiaProducaoLeite_identidade_imutavel"
  BEFORE UPDATE ON "pecuaria"."DiaProducaoLeite"
  FOR EACH ROW EXECUTE FUNCTION "pecuaria"."proteger_identidade_dia_leite"();
