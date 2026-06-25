-- CreateEnum
CREATE TYPE "ClassificacaoCategoria" AS ENUM ('CUSTEIO', 'INVESTIMENTO');

-- CreateEnum
CREATE TYPE "TipoProduto" AS ENUM ('MEDICAMENTO', 'RACAO', 'INSUMO', 'MINERAL', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoPessoa" AS ENUM ('CLIENTE', 'FORNECEDOR', 'AMBOS');

-- CreateEnum
CREATE TYPE "ModoProducao" AS ENUM ('ORDENHA', 'TOTAL_DIARIO', 'TANQUE_LOTE');

-- CreateEnum
CREATE TYPE "SexoAnimal" AS ENUM ('F', 'M');

-- CreateEnum
CREATE TYPE "CategoriaAnimal" AS ENUM ('BEZERRA', 'NOVILHA', 'VACA', 'BEZERRO', 'TOURO');

-- CreateEnum
CREATE TYPE "StatusAnimal" AS ENUM ('ATIVO', 'BAIXADO');

-- CreateEnum
CREATE TYPE "StatusReprodutivo" AS ENUM ('PEV', 'VAZIA', 'INSEMINADA', 'PRENHE');

-- CreateEnum
CREATE TYPE "TipoEventoReprodutivo" AS ENUM ('CIO', 'INSEMINACAO', 'DIAGNOSTICO', 'PARTO', 'SECAGEM');

-- CreateEnum
CREATE TYPE "TipoEventoSanitario" AS ENUM ('OCORRENCIA', 'APLICACAO', 'EXAME', 'MASTITE', 'VACINA');

-- CreateEnum
CREATE TYPE "TipoMovimento" AS ENUM ('ENTRADA', 'SAIDA', 'AJUSTE');

-- AlterTable
ALTER TABLE "Categoria" ADD COLUMN     "classificacao" "ClassificacaoCategoria";

-- AlterTable
ALTER TABLE "ClienteFornecedor" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "telefone" TEXT,
ADD COLUMN     "tipo" "TipoPessoa" NOT NULL DEFAULT 'FORNECEDOR';

-- CreateTable
CREATE TABLE "Produto" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoProduto" NOT NULL DEFAULT 'INSUMO',
    "unidade" TEXT NOT NULL DEFAULT 'un',
    "custoUnitario" DECIMAL(12,2),
    "carencia" INTEGER,
    "percentualMS" DECIMAL(5,2),
    "estocavel" BOOLEAN NOT NULL DEFAULT true,
    "minimoEstoque" DECIMAL(12,2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "categoriaId" INTEGER,
    "centroCustoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracao" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "producaoModo" "ModoProducao" NOT NULL DEFAULT 'ORDENHA',
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuracao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControleLeiteiro" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "peso1" DECIMAL(6,2),
    "peso2" DECIMAL(6,2),
    "peso3" DECIMAL(6,2),
    "pesoTotal" DECIMAL(6,2) NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ControleLeiteiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProducaoLote" (
    "id" SERIAL NOT NULL,
    "grupoId" INTEGER,
    "data" DATE NOT NULL,
    "litros" DECIMAL(10,2) NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProducaoLote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Raca" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "Raca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grupo" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "dietaId" INTEGER,

    CONSTRAINT "Grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dieta" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "pb" DECIMAL(4,1),
    "edMcal" DECIMAL(4,2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dieta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Animal" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "nome" TEXT,
    "sexo" "SexoAnimal" NOT NULL,
    "categoria" "CategoriaAnimal" NOT NULL,
    "racaId" INTEGER,
    "grauSangue" TEXT,
    "dataNascimento" DATE,
    "dataEntrada" DATE NOT NULL,
    "brincoEletronico" TEXT,
    "sisbov" TEXT,
    "maeId" INTEGER,
    "paiId" INTEGER,
    "paiNome" TEXT,
    "grupoId" INTEGER,
    "setor" TEXT,
    "status" "StatusAnimal" NOT NULL DEFAULT 'ATIVO',
    "dataBaixa" DATE,
    "motivoBaixa" TEXT,
    "numPartosEntrada" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumoAnimal" (
    "animalId" INTEGER NOT NULL,
    "statusReprodutivo" "StatusReprodutivo" NOT NULL DEFAULT 'VAZIA',
    "del" INTEGER,
    "ordemLactacao" INTEGER,
    "producaoMediaDia" DECIMAL(6,2),
    "producao305" INTEGER,
    "producaoTendencia" TEXT,
    "ccs" INTEGER,
    "ccsTendencia" TEXT,
    "ultimoDgData" DATE,
    "ultimoDgResultado" TEXT,
    "iepProjetado" INTEGER,
    "diasGestacao" INTEGER,
    "previsaoSecagem" DATE,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumoAnimal_pkey" PRIMARY KEY ("animalId")
);

-- CreateTable
CREATE TABLE "EventoReprodutivo" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "tipo" "TipoEventoReprodutivo" NOT NULL,
    "data" DATE NOT NULL,
    "observacao" TEXT,
    "reprodutor" TEXT,
    "protocolo" TEXT,
    "resultado" TEXT,
    "dtPartoPrevista" DATE,
    "tipoParto" TEXT,
    "numCrias" INTEGER,
    "sexoCria" TEXT,
    "motivoSecagem" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventoReprodutivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lactacao" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "dtInicio" DATE NOT NULL,
    "dtFim" DATE,

    CONSTRAINT "Lactacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pesagem" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "peso" DECIMAL(7,2) NOT NULL,
    "gmd" DECIMAL(6,3),

    CONSTRAINT "Pesagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoSanitario" (
    "id" SERIAL NOT NULL,
    "animalId" INTEGER NOT NULL,
    "tipo" "TipoEventoSanitario" NOT NULL,
    "data" DATE NOT NULL,
    "observacao" TEXT,
    "doenca" TEXT,
    "dtFim" DATE,
    "diasTratamento" INTEGER,
    "produto" TEXT,
    "dose" TEXT,
    "carencia" INTEGER,
    "loteProduto" TEXT,
    "ccs" INTEGER,
    "gordura" DECIMAL(4,2),
    "proteina" DECIMAL(4,2),
    "quarto" TEXT,
    "severidade" TEXT,
    "resultadoCultivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventoSanitario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentoEstoque" (
    "id" SERIAL NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "tipo" "TipoMovimento" NOT NULL,
    "data" DATE NOT NULL,
    "quantidade" DECIMAL(12,2) NOT NULL,
    "custoUnitario" DECIMAL(12,2) NOT NULL,
    "valorTotal" DECIMAL(14,2) NOT NULL,
    "grupoId" INTEGER,
    "fornecedorId" INTEGER,
    "lancamentoId" INTEGER,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovimentoEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Produto_nome_key" ON "Produto"("nome");

-- CreateIndex
CREATE INDEX "Produto_tipo_idx" ON "Produto"("tipo");

-- CreateIndex
CREATE INDEX "ControleLeiteiro_animalId_data_idx" ON "ControleLeiteiro"("animalId", "data");

-- CreateIndex
CREATE INDEX "ProducaoLote_grupoId_data_idx" ON "ProducaoLote"("grupoId", "data");

-- CreateIndex
CREATE INDEX "ProducaoLote_data_idx" ON "ProducaoLote"("data");

-- CreateIndex
CREATE UNIQUE INDEX "Raca_nome_key" ON "Raca"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Grupo_nome_key" ON "Grupo"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Dieta_nome_key" ON "Dieta"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Animal_numero_key" ON "Animal"("numero");

-- CreateIndex
CREATE INDEX "Animal_status_idx" ON "Animal"("status");

-- CreateIndex
CREATE INDEX "Animal_grupoId_idx" ON "Animal"("grupoId");

-- CreateIndex
CREATE INDEX "EventoReprodutivo_animalId_data_idx" ON "EventoReprodutivo"("animalId", "data");

-- CreateIndex
CREATE INDEX "Lactacao_animalId_idx" ON "Lactacao"("animalId");

-- CreateIndex
CREATE INDEX "Pesagem_animalId_data_idx" ON "Pesagem"("animalId", "data");

-- CreateIndex
CREATE INDEX "EventoSanitario_animalId_data_idx" ON "EventoSanitario"("animalId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "MovimentoEstoque_lancamentoId_key" ON "MovimentoEstoque"("lancamentoId");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_produtoId_data_idx" ON "MovimentoEstoque"("produtoId", "data");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_tipo_data_idx" ON "MovimentoEstoque"("tipo", "data");

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControleLeiteiro" ADD CONSTRAINT "ControleLeiteiro_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProducaoLote" ADD CONSTRAINT "ProducaoLote_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_dietaId_fkey" FOREIGN KEY ("dietaId") REFERENCES "Dieta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_racaId_fkey" FOREIGN KEY ("racaId") REFERENCES "Raca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_maeId_fkey" FOREIGN KEY ("maeId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_paiId_fkey" FOREIGN KEY ("paiId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumoAnimal" ADD CONSTRAINT "ResumoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoReprodutivo" ADD CONSTRAINT "EventoReprodutivo_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lactacao" ADD CONSTRAINT "Lactacao_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pesagem" ADD CONSTRAINT "Pesagem_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoSanitario" ADD CONSTRAINT "EventoSanitario_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "ClienteFornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "Lancamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
