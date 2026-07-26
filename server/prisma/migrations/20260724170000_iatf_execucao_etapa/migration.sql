-- Execução real de etapas IATF + dimensões de associação (CIDR/estímulo/perda).
CREATE TYPE "StatusExecucaoEtapaIATF" AS ENUM ('PENDENTE', 'CONCLUIDA', 'PULADA');

ALTER TABLE "AplicacaoProtocoloIATF"
  ADD COLUMN IF NOT EXISTS "usoCidr" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "estimulo" TEXT,
  ADD COLUMN IF NOT EXISTS "perdaImplante" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "ExecucaoEtapaIATF" (
  "id" SERIAL NOT NULL,
  "aplicacaoId" INTEGER NOT NULL,
  "dia" INTEGER NOT NULL,
  "acao" TEXT NOT NULL,
  "hormonio" TEXT,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "dataPlanejada" DATE NOT NULL,
  "status" "StatusExecucaoEtapaIATF" NOT NULL DEFAULT 'PENDENTE',
  "dataExecucao" DATE,
  "produto" TEXT,
  "dose" TEXT,
  "observacao" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExecucaoEtapaIATF_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExecucaoEtapaIATF_aplicacaoId_dia_ordem_key"
  ON "ExecucaoEtapaIATF"("aplicacaoId", "dia", "ordem");
CREATE INDEX IF NOT EXISTS "ExecucaoEtapaIATF_aplicacaoId_status_idx"
  ON "ExecucaoEtapaIATF"("aplicacaoId", "status");
CREATE INDEX IF NOT EXISTS "ExecucaoEtapaIATF_dataPlanejada_idx"
  ON "ExecucaoEtapaIATF"("dataPlanejada");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ExecucaoEtapaIATF_aplicacaoId_fkey'
  ) THEN
    ALTER TABLE "ExecucaoEtapaIATF"
      ADD CONSTRAINT "ExecucaoEtapaIATF_aplicacaoId_fkey"
      FOREIGN KEY ("aplicacaoId") REFERENCES "AplicacaoProtocoloIATF"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill: materializa etapas pendentes das aplicações existentes (agenda = D0 + offset).
INSERT INTO "ExecucaoEtapaIATF" (
  "aplicacaoId", "dia", "acao", "hormonio", "ordem", "dataPlanejada", "status", "updatedAt"
)
SELECT
  a."id",
  e."dia",
  e."acao",
  e."hormonio",
  e."ordem",
  (a."dataInicio" + (e."dia" || ' days')::interval)::date,
  'PENDENTE',
  CURRENT_TIMESTAMP
FROM "AplicacaoProtocoloIATF" a
JOIN "EtapaProtocoloIATF" e ON e."protocoloId" = a."protocoloId"
ON CONFLICT ("aplicacaoId", "dia", "ordem") DO NOTHING;
