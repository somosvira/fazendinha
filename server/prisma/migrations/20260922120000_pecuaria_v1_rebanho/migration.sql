-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "pecuaria";

-- CreateEnum
CREATE TYPE "pecuaria"."SexoBovino" AS ENUM ('F', 'M');

-- CreateEnum
CREATE TYPE "pecuaria"."OrigemAnimal" AS ENUM ('NASCIDO', 'COMPRADO');

-- CreateEnum
CREATE TYPE "pecuaria"."AptidaoAnimal" AS ENUM ('LEITE', 'CORTE');

-- CreateEnum
CREATE TYPE "pecuaria"."PapelReprodutivo" AS ENUM ('NENHUM', 'RECEPTORA', 'DOADORA');

-- CreateEnum
CREATE TYPE "pecuaria"."TipoSaidaAnimal" AS ENUM ('VENDA', 'ABATE', 'MORTE', 'DOACAO', 'CADASTRO_INDEVIDO', 'OUTRO');

-- CreateEnum
CREATE TYPE "pecuaria"."TipoPesagem" AS ENUM ('NASCIMENTO', 'ENTRADA', 'DESMAMA', 'ROTINA', 'SAIDA');

-- CreateEnum
CREATE TYPE "pecuaria"."OrigemPesagem" AS ENUM ('MANUAL', 'BALANCA');

-- CreateEnum
CREATE TYPE "pecuaria"."OrigemComposicao" AS ENUM ('INFORMADA', 'CALCULADA');

-- CreateTable
CREATE TABLE "pecuaria"."Animal" (
    "id" TEXT NOT NULL,
    "ideagriId" INTEGER,
    "brinco" TEXT NOT NULL,
    "nome" TEXT,
    "brincoEletronico" TEXT,
    "sisbov" TEXT,
    "sexo" "pecuaria"."SexoBovino" NOT NULL,
    "dataNascimento" DATE NOT NULL,
    "nascimentoEstimado" BOOLEAN NOT NULL DEFAULT false,
    "origem" "pecuaria"."OrigemAnimal" NOT NULL,
    "dataEntrada" DATE NOT NULL,
    "partosAntesDaEntrada" INTEGER NOT NULL DEFAULT 0,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."Raca" (
    "id" TEXT NOT NULL,
    "ideagriId" INTEGER,
    "nome" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "base" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Raca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ComposicaoRacial" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "racaId" TEXT NOT NULL,
    "fracao64" INTEGER NOT NULL,
    "origem" "pecuaria"."OrigemComposicao" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComposicaoRacial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."Lote" (
    "id" TEXT NOT NULL,
    "ideagriId" INTEGER,
    "nome" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."LocalizacaoAnimal" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "loteId" TEXT,
    "desde" DATE NOT NULL,
    "ate" DATE,
    "motivo" TEXT,
    "movimentacaoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalizacaoAnimal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."DestinoAnimal" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "aptidao" "pecuaria"."AptidaoAnimal" NOT NULL,
    "papelReprodutivo" "pecuaria"."PapelReprodutivo" NOT NULL DEFAULT 'NENHUM',
    "desde" DATE NOT NULL,
    "ate" DATE,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DestinoAnimal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."SaidaAnimal" (
    "id" TEXT NOT NULL,
    "ideagriId" INTEGER,
    "animalId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "tipo" "pecuaria"."TipoSaidaAnimal" NOT NULL,
    "motivoId" TEXT,
    "observacao" TEXT,
    "estornadaEm" TIMESTAMP(3),
    "estornoMotivo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaidaAnimal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."MotivoSaida" (
    "id" TEXT NOT NULL,
    "ideagriId" INTEGER,
    "nome" TEXT NOT NULL,
    "tipo" "pecuaria"."TipoSaidaAnimal" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MotivoSaida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."Pesagem" (
    "id" TEXT NOT NULL,
    "ideagriId" INTEGER,
    "animalId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "pesoKg" DECIMAL(7,2) NOT NULL,
    "tipo" "pecuaria"."TipoPesagem" NOT NULL,
    "origem" "pecuaria"."OrigemPesagem" NOT NULL DEFAULT 'MANUAL',
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pesagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."AuditoriaPecuaria" (
    "id" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "antes" JSONB,
    "depois" JSONB,
    "usuarioId" INTEGER,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditoriaPecuaria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Animal_ideagriId_key" ON "pecuaria"."Animal"("ideagriId");

-- CreateIndex
CREATE UNIQUE INDEX "Animal_brincoEletronico_key" ON "pecuaria"."Animal"("brincoEletronico");

-- CreateIndex
CREATE UNIQUE INDEX "Animal_sisbov_key" ON "pecuaria"."Animal"("sisbov");

-- CreateIndex
CREATE INDEX "Animal_brinco_idx" ON "pecuaria"."Animal"("brinco");

-- CreateIndex
CREATE UNIQUE INDEX "Raca_ideagriId_key" ON "pecuaria"."Raca"("ideagriId");

-- CreateIndex
CREATE INDEX "ComposicaoRacial_racaId_idx" ON "pecuaria"."ComposicaoRacial"("racaId");

-- CreateIndex
CREATE UNIQUE INDEX "ComposicaoRacial_animalId_racaId_key" ON "pecuaria"."ComposicaoRacial"("animalId", "racaId");

-- CreateIndex
CREATE UNIQUE INDEX "Lote_ideagriId_key" ON "pecuaria"."Lote"("ideagriId");

-- CreateIndex
CREATE UNIQUE INDEX "Lote_propriedadeId_nome_key" ON "pecuaria"."Lote"("propriedadeId", "nome");

-- CreateIndex
CREATE INDEX "LocalizacaoAnimal_animalId_ate_idx" ON "pecuaria"."LocalizacaoAnimal"("animalId", "ate");

-- CreateIndex
CREATE INDEX "LocalizacaoAnimal_propriedadeId_ate_idx" ON "pecuaria"."LocalizacaoAnimal"("propriedadeId", "ate");

-- CreateIndex
CREATE INDEX "LocalizacaoAnimal_loteId_ate_idx" ON "pecuaria"."LocalizacaoAnimal"("loteId", "ate");

-- CreateIndex
CREATE INDEX "LocalizacaoAnimal_movimentacaoId_idx" ON "pecuaria"."LocalizacaoAnimal"("movimentacaoId");

-- CreateIndex
CREATE INDEX "DestinoAnimal_animalId_ate_idx" ON "pecuaria"."DestinoAnimal"("animalId", "ate");

-- CreateIndex
CREATE UNIQUE INDEX "SaidaAnimal_ideagriId_key" ON "pecuaria"."SaidaAnimal"("ideagriId");

-- CreateIndex
CREATE INDEX "SaidaAnimal_animalId_idx" ON "pecuaria"."SaidaAnimal"("animalId");

-- CreateIndex
CREATE INDEX "SaidaAnimal_data_idx" ON "pecuaria"."SaidaAnimal"("data");

-- CreateIndex
CREATE UNIQUE INDEX "MotivoSaida_ideagriId_key" ON "pecuaria"."MotivoSaida"("ideagriId");

-- CreateIndex
CREATE UNIQUE INDEX "Pesagem_ideagriId_key" ON "pecuaria"."Pesagem"("ideagriId");

-- CreateIndex
CREATE INDEX "Pesagem_animalId_data_idx" ON "pecuaria"."Pesagem"("animalId", "data");

-- CreateIndex
CREATE INDEX "AuditoriaPecuaria_entidade_entidadeId_idx" ON "pecuaria"."AuditoriaPecuaria"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "AuditoriaPecuaria_em_idx" ON "pecuaria"."AuditoriaPecuaria"("em");

-- AddForeignKey
ALTER TABLE "pecuaria"."Animal" ADD CONSTRAINT "Animal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."Raca" ADD CONSTRAINT "Raca_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ComposicaoRacial" ADD CONSTRAINT "ComposicaoRacial_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ComposicaoRacial" ADD CONSTRAINT "ComposicaoRacial_racaId_fkey" FOREIGN KEY ("racaId") REFERENCES "pecuaria"."Raca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ComposicaoRacial" ADD CONSTRAINT "ComposicaoRacial_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."Lote" ADD CONSTRAINT "Lote_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."Lote" ADD CONSTRAINT "Lote_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."LocalizacaoAnimal" ADD CONSTRAINT "LocalizacaoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."LocalizacaoAnimal" ADD CONSTRAINT "LocalizacaoAnimal_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."LocalizacaoAnimal" ADD CONSTRAINT "LocalizacaoAnimal_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "pecuaria"."Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."LocalizacaoAnimal" ADD CONSTRAINT "LocalizacaoAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."DestinoAnimal" ADD CONSTRAINT "DestinoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."DestinoAnimal" ADD CONSTRAINT "DestinoAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."SaidaAnimal" ADD CONSTRAINT "SaidaAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."SaidaAnimal" ADD CONSTRAINT "SaidaAnimal_motivoId_fkey" FOREIGN KEY ("motivoId") REFERENCES "pecuaria"."MotivoSaida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."SaidaAnimal" ADD CONSTRAINT "SaidaAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MotivoSaida" ADD CONSTRAINT "MotivoSaida_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."Pesagem" ADD CONSTRAINT "Pesagem_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."Pesagem" ADD CONSTRAINT "Pesagem_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AuditoriaPecuaria" ADD CONSTRAINT "AuditoriaPecuaria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AuditoriaPecuaria" ADD CONSTRAINT "AuditoriaPecuaria_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Índice único parcial (não expressável no Prisma): no máximo uma localização
-- aberta (ate IS NULL) por animal.
CREATE UNIQUE INDEX "LocalizacaoAnimal_animalId_aberta_key" ON "pecuaria"."LocalizacaoAnimal"("animalId") WHERE "ate" IS NULL;
