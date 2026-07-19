-- CreateTable
CREATE TABLE "ProtocoloIATF" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "hormonioBase" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "propriedadeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtocoloIATF_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtapaProtocoloIATF" (
    "id" SERIAL NOT NULL,
    "protocoloId" INTEGER NOT NULL,
    "dia" INTEGER NOT NULL,
    "acao" TEXT NOT NULL,
    "hormonio" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EtapaProtocoloIATF_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AplicacaoProtocoloIATF" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "protocoloId" INTEGER NOT NULL,
    "dataInicio" DATE NOT NULL,
    "observacao" TEXT,
    "propriedadeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AplicacaoProtocoloIATF_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProtocoloIATF_propriedadeId_idx" ON "ProtocoloIATF"("propriedadeId");

-- CreateIndex
CREATE INDEX "ProtocoloIATF_ativo_idx" ON "ProtocoloIATF"("ativo");

-- CreateIndex
CREATE INDEX "EtapaProtocoloIATF_protocoloId_idx" ON "EtapaProtocoloIATF"("protocoloId");

-- CreateIndex
CREATE INDEX "AplicacaoProtocoloIATF_animalId_idx" ON "AplicacaoProtocoloIATF"("animalId");

-- CreateIndex
CREATE INDEX "AplicacaoProtocoloIATF_protocoloId_idx" ON "AplicacaoProtocoloIATF"("protocoloId");

-- CreateIndex
CREATE INDEX "AplicacaoProtocoloIATF_propriedadeId_idx" ON "AplicacaoProtocoloIATF"("propriedadeId");

-- CreateIndex
CREATE INDEX "AplicacaoProtocoloIATF_dataInicio_idx" ON "AplicacaoProtocoloIATF"("dataInicio");

-- AddForeignKey
ALTER TABLE "ProtocoloIATF" ADD CONSTRAINT "ProtocoloIATF_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtapaProtocoloIATF" ADD CONSTRAINT "EtapaProtocoloIATF_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES "ProtocoloIATF"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AplicacaoProtocoloIATF" ADD CONSTRAINT "AplicacaoProtocoloIATF_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AplicacaoProtocoloIATF" ADD CONSTRAINT "AplicacaoProtocoloIATF_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES "ProtocoloIATF"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AplicacaoProtocoloIATF" ADD CONSTRAINT "AplicacaoProtocoloIATF_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
