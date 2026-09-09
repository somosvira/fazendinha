ALTER TABLE "LinhaFolhaCampo"
ADD COLUMN "resultadoTipo" TEXT,
ADD COLUMN "resultadoId" INTEGER;

CREATE INDEX "LinhaFolhaCampo_resultadoTipo_resultadoId_idx"
ON "LinhaFolhaCampo"("resultadoTipo", "resultadoId");
