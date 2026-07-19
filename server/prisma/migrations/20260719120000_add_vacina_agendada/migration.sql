-- CreateTable
CREATE TABLE "VacinaAgendada" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "propriedadeId" INTEGER,
    "vacina" TEXT NOT NULL,
    "dataPrevista" DATE NOT NULL,
    "aplicadaEm" DATE,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VacinaAgendada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VacinaAgendada_animalId_idx" ON "VacinaAgendada"("animalId");

-- CreateIndex
CREATE INDEX "VacinaAgendada_propriedadeId_idx" ON "VacinaAgendada"("propriedadeId");

-- CreateIndex
CREATE INDEX "VacinaAgendada_dataPrevista_idx" ON "VacinaAgendada"("dataPrevista");

-- AddForeignKey
ALTER TABLE "VacinaAgendada" ADD CONSTRAINT "VacinaAgendada_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacinaAgendada" ADD CONSTRAINT "VacinaAgendada_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
