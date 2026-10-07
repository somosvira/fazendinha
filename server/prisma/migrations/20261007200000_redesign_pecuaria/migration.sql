ALTER TABLE "pecuaria"."VigenciaDietaLote"
  ADD COLUMN "status" "pecuaria"."StatusFatoPecuariaV3" NOT NULL DEFAULT 'VALIDO',
  ADD COLUMN "motivoAnulacao" TEXT,
  ADD COLUMN "anuladoEm" TIMESTAMP(3);
ALTER TABLE "pecuaria"."VigenciaDietaLote" DROP CONSTRAINT "VigenciaDietaLote_sem_sobreposicao";
ALTER TABLE "pecuaria"."VigenciaDietaLote" ADD CONSTRAINT "VigenciaDietaLote_sem_sobreposicao"
  EXCLUDE USING gist ("loteId" WITH =, daterange("desde", "ate", '[)') WITH &&) WHERE ("status" = 'VALIDO');
ALTER TABLE "pecuaria"."VigenciaDietaLote" ADD CONSTRAINT "VigenciaDietaLote_anulacao_check"
  CHECK (("status" = 'VALIDO' AND "anuladoEm" IS NULL AND "motivoAnulacao" IS NULL)
      OR ("status" = 'ANULADO' AND "anuladoEm" IS NOT NULL AND length(trim("motivoAnulacao")) >= 5));

CREATE TABLE "pecuaria"."ColetaCampo" (
  "id" TEXT NOT NULL,
  "propriedadeId" INTEGER NOT NULL,
  "tipo" TEXT NOT NULL,
  "data" DATE NOT NULL,
  "titulo" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PREPARADA',
  "versao" INTEGER NOT NULL DEFAULT 1,
  "snapshot" JSONB NOT NULL,
  "rascunho" JSONB NOT NULL,
  "resultados" JSONB,
  "criadoPorId" INTEGER,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  "concluidoEm" TIMESTAMP(3),
  CONSTRAINT "ColetaCampo_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ColetaCampo_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "public"."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ColetaCampo_tipo_check" CHECK ("tipo" IN ('PESAGEM', 'EXAME', 'APLICACAO')),
  CONSTRAINT "ColetaCampo_status_check" CHECK ("status" IN ('PREPARADA', 'EM_PREENCHIMENTO', 'CONCLUIDA')),
  CONSTRAINT "ColetaCampo_versao_check" CHECK ("versao" > 0)
);
CREATE INDEX "ColetaCampo_propriedadeId_status_data_idx" ON "pecuaria"."ColetaCampo"("propriedadeId", "status", "data");
