CREATE TABLE "pecuaria"."HistoricoPrevisaoParto" (
 "id" TEXT PRIMARY KEY NOT NULL,
 "gestacaoId" TEXT NOT NULL REFERENCES "pecuaria"."GestacaoAnimal"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "previsaoAnterior" DATE,
 "previsaoNova" DATE,
 "motivo" TEXT NOT NULL,
 "origem" TEXT NOT NULL,
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "criadoPorId" INTEGER REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "HistoricoPrevisaoParto_gestacaoId_criadoEm_idx" ON "pecuaria"."HistoricoPrevisaoParto"("gestacaoId","criadoEm");
