-- CreateEnum
CREATE TYPE "Cultura" AS ENUM ('MILHO');

-- CreateEnum
CREATE TYPE "TipoCustoCultivo" AS ENUM ('ADUBACAO', 'PREPARO_SOLO', 'PLANTIO', 'TRATOS', 'COLHEITA', 'TRANSPORTE', 'MAO_DE_OBRA', 'MAQUINA', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoProducao" AS ENUM ('GRAO', 'SILAGEM');

-- CreateEnum
CREATE TYPE "UnidadeProducao" AS ENUM ('SC', 'TON');

-- CreateEnum
CREATE TYPE "DestinoProducao" AS ENUM ('VENDA', 'SILO');

-- CreateEnum
CREATE TYPE "TipoSilo" AS ENUM ('GRAO', 'SILAGEM');

-- CreateEnum
CREATE TYPE "TipoMovimentoSilo" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "OrigemMovimentoSilo" AS ENUM ('COLHEITA', 'NUTRICAO', 'VENDA', 'AJUSTE');

-- CreateTable
CREATE TABLE "SafraCultivo" (
    "id" SERIAL NOT NULL,
    "cultura" "Cultura" NOT NULL,
    "nome" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "dataInicio" DATE NOT NULL,
    "dataFim" DATE,
    "areaHaTotal" DECIMAL(10,2),
    "fechada" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafraCultivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AreaCultivo" (
    "id" SERIAL NOT NULL,
    "safraCultivoId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT,
    "areaHa" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AreaCultivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LancamentoCusto" (
    "id" SERIAL NOT NULL,
    "safraCultivoId" INTEGER NOT NULL,
    "areaCultivoId" INTEGER,
    "tipo" "TipoCustoCultivo" NOT NULL,
    "classe" "ClassificacaoCategoria" NOT NULL DEFAULT 'CUSTEIO',
    "data" DATE NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "qtd" DECIMAL(12,3),
    "unidade" TEXT,
    "horasMaquina" DECIMAL(8,2),
    "numMaquinas" INTEGER,
    "numCaminhoes" INTEGER,
    "lancamentoId" INTEGER,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LancamentoCusto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProducaoCultivo" (
    "id" SERIAL NOT NULL,
    "safraCultivoId" INTEGER NOT NULL,
    "areaCultivoId" INTEGER,
    "data" DATE NOT NULL,
    "tipo" "TipoProducao" NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "unidade" "UnidadeProducao" NOT NULL,
    "destino" "DestinoProducao",
    "siloId" INTEGER,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProducaoCultivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Silo" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoSilo" NOT NULL,
    "capacidade" DECIMAL(12,3),
    "unidade" TEXT NOT NULL,
    "saldoAtual" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Silo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentoSilo" (
    "id" SERIAL NOT NULL,
    "siloId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "tipo" "TipoMovimentoSilo" NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "origem" "OrigemMovimentoSilo" NOT NULL,
    "producaoCultivoId" INTEGER,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentoSilo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumoSafraCultivo" (
    "id" SERIAL NOT NULL,
    "safraCultivoId" INTEGER NOT NULL,
    "custeioTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "investimentoTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "areaHa" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "producaoGraoSc" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "producaoSilagemTon" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "custoHa" DECIMAL(14,2),
    "custoSaca" DECIMAL(14,2),
    "custoTonelada" DECIMAL(14,2),
    "horasMaquinaTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumoSafraCultivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SafraCultivo_cultura_ano_idx" ON "SafraCultivo"("cultura", "ano");

-- CreateIndex
CREATE UNIQUE INDEX "AreaCultivo_safraCultivoId_codigo_key" ON "AreaCultivo"("safraCultivoId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "LancamentoCusto_lancamentoId_key" ON "LancamentoCusto"("lancamentoId");

-- CreateIndex
CREATE INDEX "LancamentoCusto_safraCultivoId_data_idx" ON "LancamentoCusto"("safraCultivoId", "data");

-- CreateIndex
CREATE INDEX "LancamentoCusto_classe_idx" ON "LancamentoCusto"("classe");

-- CreateIndex
CREATE INDEX "ProducaoCultivo_safraCultivoId_data_idx" ON "ProducaoCultivo"("safraCultivoId", "data");

-- CreateIndex
CREATE INDEX "MovimentoSilo_siloId_data_idx" ON "MovimentoSilo"("siloId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "ResumoSafraCultivo_safraCultivoId_key" ON "ResumoSafraCultivo"("safraCultivoId");

-- AddForeignKey
ALTER TABLE "AreaCultivo" ADD CONSTRAINT "AreaCultivo_safraCultivoId_fkey" FOREIGN KEY ("safraCultivoId") REFERENCES "SafraCultivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LancamentoCusto" ADD CONSTRAINT "LancamentoCusto_safraCultivoId_fkey" FOREIGN KEY ("safraCultivoId") REFERENCES "SafraCultivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LancamentoCusto" ADD CONSTRAINT "LancamentoCusto_areaCultivoId_fkey" FOREIGN KEY ("areaCultivoId") REFERENCES "AreaCultivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProducaoCultivo" ADD CONSTRAINT "ProducaoCultivo_safraCultivoId_fkey" FOREIGN KEY ("safraCultivoId") REFERENCES "SafraCultivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProducaoCultivo" ADD CONSTRAINT "ProducaoCultivo_areaCultivoId_fkey" FOREIGN KEY ("areaCultivoId") REFERENCES "AreaCultivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProducaoCultivo" ADD CONSTRAINT "ProducaoCultivo_siloId_fkey" FOREIGN KEY ("siloId") REFERENCES "Silo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoSilo" ADD CONSTRAINT "MovimentoSilo_siloId_fkey" FOREIGN KEY ("siloId") REFERENCES "Silo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoSilo" ADD CONSTRAINT "MovimentoSilo_producaoCultivoId_fkey" FOREIGN KEY ("producaoCultivoId") REFERENCES "ProducaoCultivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumoSafraCultivo" ADD CONSTRAINT "ResumoSafraCultivo_safraCultivoId_fkey" FOREIGN KEY ("safraCultivoId") REFERENCES "SafraCultivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
