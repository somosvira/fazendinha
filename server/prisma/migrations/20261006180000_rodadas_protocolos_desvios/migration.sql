CREATE TABLE "pecuaria"."RodadaProtocoloSanitario" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "protocoloId" TEXT NOT NULL,
  "propriedadeId" INTEGER NOT NULL,
  "inicioReferencia" DATE NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RodadaProtocoloSanitario_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RodadaProtocoloSanitario_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES "pecuaria"."ProtocoloSanitario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RodadaProtocoloSanitario_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "public"."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "RodadaProtocoloSanitario_propriedadeId_inicioReferencia_idx" ON "pecuaria"."RodadaProtocoloSanitario"("propriedadeId", "inicioReferencia");
CREATE INDEX "RodadaProtocoloSanitario_protocoloId_idx" ON "pecuaria"."RodadaProtocoloSanitario"("protocoloId");
ALTER TABLE "pecuaria"."ExecucaoProtocoloSanitario" ADD COLUMN "rodadaId" TEXT;
ALTER TABLE "pecuaria"."ExecucaoProtocoloSanitario" ADD CONSTRAINT "ExecucaoProtocoloSanitario_rodadaId_fkey" FOREIGN KEY ("rodadaId") REFERENCES "pecuaria"."RodadaProtocoloSanitario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ExecucaoProtocoloSanitario_rodadaId_idx" ON "pecuaria"."ExecucaoProtocoloSanitario"("rodadaId");
CREATE UNIQUE INDEX "ExecucaoProtocoloSanitario_rodada_animal_ativa" ON "pecuaria"."ExecucaoProtocoloSanitario"("rodadaId", "animalId") WHERE "rodadaId" IS NOT NULL AND "canceladaEm" IS NULL;
ALTER TABLE "pecuaria"."AplicacaoProduto" ADD COLUMN "desvioProtocoloSnapshot" JSONB;
ALTER TABLE "pecuaria"."ExameAnimal" ADD COLUMN "desvioProtocoloSnapshot" JSONB;
