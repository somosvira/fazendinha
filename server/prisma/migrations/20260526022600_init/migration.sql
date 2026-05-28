-- CreateEnum
CREATE TYPE "Natureza" AS ENUM ('CREDITO', 'DEBITO');

-- CreateEnum
CREATE TYPE "Situacao" AS ENUM ('ABERTO', 'LIQUIDADO', 'LIQUIDADO_PARCIAL');

-- CreateTable
CREATE TABLE "CentroCusto" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "ehInvestimento" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CentroCusto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrupoCategoria" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GrupoCategoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "grupoCategoriaId" INTEGER NOT NULL,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContaBancaria" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "banco" TEXT,
    "saldoInicial" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "ContaBancaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClienteFornecedor" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "documento" TEXT,

    CONSTRAINT "ClienteFornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lancamento" (
    "id" SERIAL NOT NULL,
    "natureza" "Natureza" NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "dataCompetencia" DATE NOT NULL,
    "dataVencimento" DATE NOT NULL,
    "dataLiquidacao" DATE,
    "situacao" "Situacao" NOT NULL DEFAULT 'ABERTO',
    "estornado" BOOLEAN NOT NULL DEFAULT false,
    "numeroDocumento" TEXT,
    "numeroParcela" INTEGER,
    "totalParcelas" INTEGER,
    "descricao" TEXT,
    "categoriaId" INTEGER NOT NULL,
    "centroCustoId" INTEGER NOT NULL,
    "contaBancariaId" INTEGER,
    "clienteFornecedorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lancamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CentroCusto_nome_key" ON "CentroCusto"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "GrupoCategoria_nome_key" ON "GrupoCategoria"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_grupoCategoriaId_nome_key" ON "Categoria"("grupoCategoriaId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "ContaBancaria_nome_key" ON "ContaBancaria"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "ClienteFornecedor_nome_key" ON "ClienteFornecedor"("nome");

-- CreateIndex
CREATE INDEX "Lancamento_situacao_dataLiquidacao_idx" ON "Lancamento"("situacao", "dataLiquidacao");

-- CreateIndex
CREATE INDEX "Lancamento_situacao_dataVencimento_idx" ON "Lancamento"("situacao", "dataVencimento");

-- CreateIndex
CREATE INDEX "Lancamento_centroCustoId_idx" ON "Lancamento"("centroCustoId");

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_grupoCategoriaId_fkey" FOREIGN KEY ("grupoCategoriaId") REFERENCES "GrupoCategoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_contaBancariaId_fkey" FOREIGN KEY ("contaBancariaId") REFERENCES "ContaBancaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_clienteFornecedorId_fkey" FOREIGN KEY ("clienteFornecedorId") REFERENCES "ClienteFornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
