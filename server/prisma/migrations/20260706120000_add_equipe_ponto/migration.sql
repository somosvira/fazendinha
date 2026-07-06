-- CreateEnum
CREATE TYPE "TipoDiaPonto" AS ENUM ('UTIL', 'DOMINGO', 'FERIADO', 'FOLGA', 'FALTA');

-- CreateTable
CREATE TABLE "Funcionario" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cargo" TEXT,
    "salarioMensal" DECIMAL(12,2) NOT NULL,
    "cargaMensalHoras" DECIMAL(6,2) NOT NULL DEFAULT 220,
    "jornadaDiariaHoras" DECIMAL(5,2) NOT NULL DEFAULT 8,
    "dataAdmissao" DATE,
    "cpf" TEXT,
    "chavePix" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Funcionario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroPonto" (
    "id" SERIAL NOT NULL,
    "funcionarioId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "entrada" TEXT,
    "saida" TEXT,
    "intervaloMin" INTEGER NOT NULL DEFAULT 60,
    "tipoDia" "TipoDiaPonto" NOT NULL DEFAULT 'UTIL',
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistroPonto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Funcionario_ativo_idx" ON "Funcionario"("ativo");

-- CreateIndex
CREATE INDEX "RegistroPonto_funcionarioId_data_idx" ON "RegistroPonto"("funcionarioId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "RegistroPonto_funcionarioId_data_key" ON "RegistroPonto"("funcionarioId", "data");

-- AddForeignKey
ALTER TABLE "RegistroPonto" ADD CONSTRAINT "RegistroPonto_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
