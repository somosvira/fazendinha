-- Migration aditiva: nenhum fato histórico recebe participação, fase ou origem presumida.
-- DropForeignKey
ALTER TABLE "pecuaria"."ItemFechamentoConsumo" DROP CONSTRAINT "ItemFechamentoConsumo_fechamentoId_fkey";

-- AlterTable
ALTER TABLE "pecuaria"."ItemFechamentoConsumo" ADD COLUMN     "grupoOfertaId" TEXT,
ALTER COLUMN "fechamentoId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "pecuaria"."AmostraQualidadeLeite" ADD COLUMN     "origemColostroId" TEXT;

-- AlterTable
ALTER TABLE "pecuaria"."ParcelaFornecimentoNutricionalLeite" ADD COLUMN     "criterioAtribuicao" TEXT NOT NULL DEFAULT 'ANIMAL_DIAS',
ADD COLUMN     "programacaoSnapshot" JSONB,
ALTER COLUMN "dias" DROP NOT NULL;

-- CreateTable
CREATE TABLE "pecuaria"."PerfilBezerreiro" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "PerfilBezerreiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ParticipacaoBezerreiro" (
    "id" TEXT NOT NULL,
    "perfilId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "desde" DATE NOT NULL,
    "ate" DATE,
    "motivoEntrada" TEXT,
    "motivoSaida" TEXT,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "ParticipacaoBezerreiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ColeiraBezerreiro" (
    "id" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "ColeiraBezerreiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ConfiguracaoBezerreiro" (
    "id" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "versao" INTEGER NOT NULL,
    "brixReferencia" DECIMAL(5,2) NOT NULL DEFAULT 25,
    "percentualPesoColostro" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "imunidade" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "ConfiguracaoBezerreiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."FaseBezerreiroVersao" (
    "id" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "identidadeId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "coleiraSnapshot" JSONB,
    "coleiraId" TEXT,
    "litrosDia" DECIMAL(12,3) NOT NULL,
    "publicada" BOOLEAN NOT NULL DEFAULT false,
    "criteriosTransicao" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "FaseBezerreiroVersao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."OfertaProgramadaBezerreiro" (
    "id" TEXT NOT NULL,
    "faseVersaoId" TEXT NOT NULL,
    "identidadeId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "percentual" DECIMAL(7,4) NOT NULL,
    "horarioPrevisto" TEXT,

    CONSTRAINT "OfertaProgramadaBezerreiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."PeriodoFaseBezerreiro" (
    "id" TEXT NOT NULL,
    "participacaoId" TEXT NOT NULL,
    "faseVersaoId" TEXT NOT NULL,
    "solicitadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "desde" DATE NOT NULL,
    "ate" DATE,
    "motivo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "PeriodoFaseBezerreiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."OfertaBezerreiro" (
    "id" TEXT NOT NULL,
    "perfilId" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "configuracaoId" TEXT,
    "configuracaoSnapshot" JSONB,
    "data" DATE NOT NULL,
    "ocorridoEm" TIMESTAMPTZ(3),
    "horarioEstimado" BOOLEAN NOT NULL DEFAULT false,
    "ofertaProgramadaId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMADO',
    "versao" INTEGER NOT NULL DEFAULT 1,
    "chave" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "responsavel" TEXT,
    "observacao" TEXT,
    "motivoEstorno" TEXT,
    "estornadoEm" TIMESTAMP(3),
    "estornadoPorId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "OfertaBezerreiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."GrupoOfertaBezerreiro" (
    "id" TEXT NOT NULL,
    "ofertaId" TEXT NOT NULL,
    "coleiraId" TEXT,
    "quantidadePrevistaLitros" DECIMAL(12,3) NOT NULL,
    "quantidadeLitros" DECIMAL(12,3) NOT NULL,
    "programacaoSnapshot" JSONB NOT NULL,
    "participantesSnapshot" JSONB NOT NULL,
    "justificativa" TEXT,

    CONSTRAINT "GrupoOfertaBezerreiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."LoteColostro" (
    "id" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "partoId" TEXT NOT NULL,
    "matrizId" TEXT NOT NULL,
    "medicaoGeralId" TEXT,
    "entradaId" TEXT,
    "data" DATE NOT NULL,
    "ocorridoEm" TIMESTAMPTZ(3),
    "horarioEstimado" BOOLEAN NOT NULL DEFAULT false,
    "primeiraRetirada" BOOLEAN NOT NULL,
    "quantidadeLitros" DECIMAL(14,3) NOT NULL,
    "origemFisicaSnapshot" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "versao" INTEGER NOT NULL DEFAULT 1,
    "chave" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "responsavel" TEXT,
    "observacao" TEXT,
    "estornadoEm" TIMESTAMP(3),
    "estornadoPorId" INTEGER,
    "motivoEstorno" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "LoteColostro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."OrigemColostro" (
    "id" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "loteColostroId" TEXT,
    "preparoId" TEXT,
    "quantidadeLitros" DECIMAL(14,3) NOT NULL,
    "valorTotal" DECIMAL(14,2),
    "snapshot" JSONB,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMADO',
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "OrigemColostro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."PreparoColostro" (
    "id" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "ocorridoEm" TIMESTAMPTZ(3),
    "volumeFinalLitros" DECIMAL(14,3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMADO',
    "versao" INTEGER NOT NULL DEFAULT 1,
    "chave" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "responsavel" TEXT NOT NULL,
    "observacao" TEXT,
    "snapshot" JSONB,
    "estornadoEm" TIMESTAMP(3),
    "estornadoPorId" INTEGER,
    "motivoEstorno" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "PreparoColostro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."OrigemPreparoColostro" (
    "id" TEXT NOT NULL,
    "preparoId" TEXT NOT NULL,
    "origemId" TEXT NOT NULL,
    "unidadeId" TEXT,
    "movimentoId" TEXT,
    "quantidadeLitros" DECIMAL(14,3) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "OrigemPreparoColostro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."InsumoPreparoColostro" (
    "id" TEXT NOT NULL,
    "preparoId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "partidaId" TEXT,
    "movimentoId" TEXT NOT NULL,
    "quantidade" DECIMAL(14,6) NOT NULL,
    "unidade" TEXT NOT NULL,

    CONSTRAINT "InsumoPreparoColostro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."UnidadeBancoColostro" (
    "destinacaoId" TEXT,
    "id" TEXT NOT NULL,
    "origemId" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "volumeLitros" DECIMAL(14,3) NOT NULL DEFAULT 2,
    "dataCongelamento" DATE NOT NULL,
    "dataRetirada" DATE,
    "retiradoEm" TIMESTAMPTZ(3),
    "status" TEXT NOT NULL DEFAULT 'CONGELADA',
    "versao" INTEGER NOT NULL DEFAULT 1,
    "chave" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "UnidadeBancoColostro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."AlocacaoFornecimentoColostro" (
    "destinacaoId" TEXT,
    "id" TEXT NOT NULL,
    "fornecimentoId" TEXT NOT NULL,
    "origemId" TEXT NOT NULL,
    "unidadeId" TEXT,
    "destinoInternoId" TEXT,
    "movimentoId" TEXT,
    "quantidadeLitros" DECIMAL(14,3) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AlocacaoFornecimentoColostro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."AcompanhamentoColostragem" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "configuracaoId" TEXT,
    "politicaSnapshot" JSONB NOT NULL,
    "pesoReferenciaKg" DECIMAL(10,3),
    "metaLitros" DECIMAL(10,3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "AcompanhamentoColostragem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ExameImunidadeColostragem" (
    "id" TEXT NOT NULL,
    "acompanhamentoId" TEXT NOT NULL,
    "exameId" TEXT NOT NULL,
    "ocorridoEm" TIMESTAMPTZ(3),
    "metodo" TEXT,
    "material" TEXT,
    "instrumento" TEXT,
    "laboratorio" TEXT,
    "politicaSnapshot" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "ExameImunidadeColostragem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."VinculoFornecimentoColostragem" (
    "acompanhamentoId" TEXT NOT NULL,
    "fornecimentoId" TEXT NOT NULL,
    "politicaSnapshot" JSONB,
    "motivoExcecao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,

    CONSTRAINT "VinculoFornecimentoColostragem_pkey" PRIMARY KEY ("acompanhamentoId","fornecimentoId")
);

-- CreateTable
CREATE TABLE "pecuaria"."DestinacaoColostro" (
    "id" TEXT NOT NULL,
    "origemId" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "ocorridoEm" TIMESTAMPTZ(3),
    "horarioEstimado" BOOLEAN NOT NULL DEFAULT false,
    "responsavel" TEXT,
    "observacao" TEXT,
    "snapshot" JSONB,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMADO',
    "chave" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "criadoPorId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estornadoEm" TIMESTAMP(3),
    "estornadoPorId" INTEGER,
    "motivoEstorno" TEXT,

    CONSTRAINT "DestinacaoColostro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PerfilBezerreiro_loteId_key" ON "pecuaria"."PerfilBezerreiro"("loteId");

-- CreateIndex
CREATE INDEX "PerfilBezerreiro_propriedadeId_ativo_idx" ON "pecuaria"."PerfilBezerreiro"("propriedadeId", "ativo");

-- CreateIndex
CREATE INDEX "ParticipacaoBezerreiro_perfilId_desde_idx" ON "pecuaria"."ParticipacaoBezerreiro"("perfilId", "desde");

-- CreateIndex
CREATE INDEX "ParticipacaoBezerreiro_animalId_desde_idx" ON "pecuaria"."ParticipacaoBezerreiro"("animalId", "desde");

-- CreateIndex
CREATE UNIQUE INDEX "ColeiraBezerreiro_propriedadeId_nome_key" ON "pecuaria"."ColeiraBezerreiro"("propriedadeId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracaoBezerreiro_propriedadeId_versao_key" ON "pecuaria"."ConfiguracaoBezerreiro"("propriedadeId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "FaseBezerreiroVersao_propriedadeId_identidadeId_versao_key" ON "pecuaria"."FaseBezerreiroVersao"("propriedadeId", "identidadeId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "OfertaProgramadaBezerreiro_faseVersaoId_identidadeId_key" ON "pecuaria"."OfertaProgramadaBezerreiro"("faseVersaoId", "identidadeId");

-- CreateIndex
CREATE UNIQUE INDEX "OfertaProgramadaBezerreiro_faseVersaoId_ordem_key" ON "pecuaria"."OfertaProgramadaBezerreiro"("faseVersaoId", "ordem");

-- CreateIndex
CREATE INDEX "PeriodoFaseBezerreiro_participacaoId_desde_idx" ON "pecuaria"."PeriodoFaseBezerreiro"("participacaoId", "desde");

-- CreateIndex
CREATE UNIQUE INDEX "OfertaBezerreiro_chave_key" ON "pecuaria"."OfertaBezerreiro"("chave");

-- CreateIndex
CREATE INDEX "OfertaBezerreiro_propriedadeId_data_idx" ON "pecuaria"."OfertaBezerreiro"("propriedadeId", "data");

-- CreateIndex
CREATE INDEX "OfertaBezerreiro_perfilId_data_idx" ON "pecuaria"."OfertaBezerreiro"("perfilId", "data");

-- CreateIndex
CREATE INDEX "GrupoOfertaBezerreiro_ofertaId_idx" ON "pecuaria"."GrupoOfertaBezerreiro"("ofertaId");

-- CreateIndex
CREATE UNIQUE INDEX "LoteColostro_medicaoGeralId_key" ON "pecuaria"."LoteColostro"("medicaoGeralId");

-- CreateIndex
CREATE UNIQUE INDEX "LoteColostro_entradaId_key" ON "pecuaria"."LoteColostro"("entradaId");

-- CreateIndex
CREATE UNIQUE INDEX "LoteColostro_chave_key" ON "pecuaria"."LoteColostro"("chave");

-- CreateIndex
CREATE INDEX "LoteColostro_propriedadeId_data_idx" ON "pecuaria"."LoteColostro"("propriedadeId", "data");

-- CreateIndex
CREATE INDEX "LoteColostro_partoId_idx" ON "pecuaria"."LoteColostro"("partoId");

-- CreateIndex
CREATE UNIQUE INDEX "OrigemColostro_loteColostroId_key" ON "pecuaria"."OrigemColostro"("loteColostroId");

-- CreateIndex
CREATE UNIQUE INDEX "OrigemColostro_preparoId_key" ON "pecuaria"."OrigemColostro"("preparoId");

-- CreateIndex
CREATE INDEX "OrigemColostro_propriedadeId_idx" ON "pecuaria"."OrigemColostro"("propriedadeId");

-- CreateIndex
CREATE UNIQUE INDEX "PreparoColostro_chave_key" ON "pecuaria"."PreparoColostro"("chave");

-- CreateIndex
CREATE INDEX "PreparoColostro_propriedadeId_data_idx" ON "pecuaria"."PreparoColostro"("propriedadeId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "OrigemPreparoColostro_movimentoId_key" ON "pecuaria"."OrigemPreparoColostro"("movimentoId");

-- CreateIndex
CREATE INDEX "OrigemPreparoColostro_origemId_idx" ON "pecuaria"."OrigemPreparoColostro"("origemId");

-- CreateIndex
CREATE UNIQUE INDEX "InsumoPreparoColostro_movimentoId_key" ON "pecuaria"."InsumoPreparoColostro"("movimentoId");

-- CreateIndex
CREATE INDEX "InsumoPreparoColostro_preparoId_idx" ON "pecuaria"."InsumoPreparoColostro"("preparoId");

-- CreateIndex
CREATE UNIQUE INDEX "UnidadeBancoColostro_chave_key" ON "pecuaria"."UnidadeBancoColostro"("chave");

-- CreateIndex
CREATE INDEX "UnidadeBancoColostro_origemId_status_idx" ON "pecuaria"."UnidadeBancoColostro"("origemId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UnidadeBancoColostro_propriedadeId_codigo_key" ON "pecuaria"."UnidadeBancoColostro"("propriedadeId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "AlocacaoFornecimentoColostro_movimentoId_key" ON "pecuaria"."AlocacaoFornecimentoColostro"("movimentoId");

-- CreateIndex
CREATE INDEX "AlocacaoFornecimentoColostro_origemId_idx" ON "pecuaria"."AlocacaoFornecimentoColostro"("origemId");

-- CreateIndex
CREATE INDEX "AlocacaoFornecimentoColostro_fornecimentoId_idx" ON "pecuaria"."AlocacaoFornecimentoColostro"("fornecimentoId");

-- CreateIndex
CREATE UNIQUE INDEX "AcompanhamentoColostragem_animalId_key" ON "pecuaria"."AcompanhamentoColostragem"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "ExameImunidadeColostragem_exameId_key" ON "pecuaria"."ExameImunidadeColostragem"("exameId");

-- CreateIndex
CREATE UNIQUE INDEX "VinculoFornecimentoColostragem_fornecimentoId_key" ON "pecuaria"."VinculoFornecimentoColostragem"("fornecimentoId");

-- CreateIndex
CREATE UNIQUE INDEX "DestinacaoColostro_chave_key" ON "pecuaria"."DestinacaoColostro"("chave");

-- CreateIndex
CREATE INDEX "DestinacaoColostro_propriedadeId_data_idx" ON "pecuaria"."DestinacaoColostro"("propriedadeId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "ItemFechamentoConsumo_grupoOfertaId_key" ON "pecuaria"."ItemFechamentoConsumo"("grupoOfertaId");

-- AddForeignKey
ALTER TABLE "pecuaria"."ItemFechamentoConsumo" ADD CONSTRAINT "ItemFechamentoConsumo_fechamentoId_fkey" FOREIGN KEY ("fechamentoId") REFERENCES "pecuaria"."FechamentoConsumo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ItemFechamentoConsumo" ADD CONSTRAINT "ItemFechamentoConsumo_grupoOfertaId_fkey" FOREIGN KEY ("grupoOfertaId") REFERENCES "pecuaria"."GrupoOfertaBezerreiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AmostraQualidadeLeite" ADD CONSTRAINT "AmostraQualidadeLeite_origemColostroId_fkey" FOREIGN KEY ("origemColostroId") REFERENCES "pecuaria"."OrigemColostro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."PerfilBezerreiro" ADD CONSTRAINT "PerfilBezerreiro_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "pecuaria"."Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."PerfilBezerreiro" ADD CONSTRAINT "PerfilBezerreiro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ParticipacaoBezerreiro" ADD CONSTRAINT "ParticipacaoBezerreiro_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "pecuaria"."PerfilBezerreiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ParticipacaoBezerreiro" ADD CONSTRAINT "ParticipacaoBezerreiro_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ColeiraBezerreiro" ADD CONSTRAINT "ColeiraBezerreiro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ConfiguracaoBezerreiro" ADD CONSTRAINT "ConfiguracaoBezerreiro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."FaseBezerreiroVersao" ADD CONSTRAINT "FaseBezerreiroVersao_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."FaseBezerreiroVersao" ADD CONSTRAINT "FaseBezerreiroVersao_coleiraId_fkey" FOREIGN KEY ("coleiraId") REFERENCES "pecuaria"."ColeiraBezerreiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."OfertaProgramadaBezerreiro" ADD CONSTRAINT "OfertaProgramadaBezerreiro_faseVersaoId_fkey" FOREIGN KEY ("faseVersaoId") REFERENCES "pecuaria"."FaseBezerreiroVersao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."PeriodoFaseBezerreiro" ADD CONSTRAINT "PeriodoFaseBezerreiro_participacaoId_fkey" FOREIGN KEY ("participacaoId") REFERENCES "pecuaria"."ParticipacaoBezerreiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."PeriodoFaseBezerreiro" ADD CONSTRAINT "PeriodoFaseBezerreiro_faseVersaoId_fkey" FOREIGN KEY ("faseVersaoId") REFERENCES "pecuaria"."FaseBezerreiroVersao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."OfertaBezerreiro" ADD CONSTRAINT "OfertaBezerreiro_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "pecuaria"."PerfilBezerreiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."OfertaBezerreiro" ADD CONSTRAINT "OfertaBezerreiro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."OfertaBezerreiro" ADD CONSTRAINT "OfertaBezerreiro_configuracaoId_fkey" FOREIGN KEY ("configuracaoId") REFERENCES "pecuaria"."ConfiguracaoBezerreiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."OfertaBezerreiro" ADD CONSTRAINT "OfertaBezerreiro_ofertaProgramadaId_fkey" FOREIGN KEY ("ofertaProgramadaId") REFERENCES "pecuaria"."OfertaProgramadaBezerreiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."GrupoOfertaBezerreiro" ADD CONSTRAINT "GrupoOfertaBezerreiro_ofertaId_fkey" FOREIGN KEY ("ofertaId") REFERENCES "pecuaria"."OfertaBezerreiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."GrupoOfertaBezerreiro" ADD CONSTRAINT "GrupoOfertaBezerreiro_coleiraId_fkey" FOREIGN KEY ("coleiraId") REFERENCES "pecuaria"."ColeiraBezerreiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."LoteColostro" ADD CONSTRAINT "LoteColostro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."LoteColostro" ADD CONSTRAINT "LoteColostro_partoId_fkey" FOREIGN KEY ("partoId") REFERENCES "pecuaria"."PartoAnimal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."LoteColostro" ADD CONSTRAINT "LoteColostro_matrizId_fkey" FOREIGN KEY ("matrizId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."LoteColostro" ADD CONSTRAINT "LoteColostro_medicaoGeralId_fkey" FOREIGN KEY ("medicaoGeralId") REFERENCES "pecuaria"."MedicaoGeralLeite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."LoteColostro" ADD CONSTRAINT "LoteColostro_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES "pecuaria"."EntradaProducaoLeite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."OrigemColostro" ADD CONSTRAINT "OrigemColostro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."OrigemColostro" ADD CONSTRAINT "OrigemColostro_loteColostroId_fkey" FOREIGN KEY ("loteColostroId") REFERENCES "pecuaria"."LoteColostro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."OrigemColostro" ADD CONSTRAINT "OrigemColostro_preparoId_fkey" FOREIGN KEY ("preparoId") REFERENCES "pecuaria"."PreparoColostro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."PreparoColostro" ADD CONSTRAINT "PreparoColostro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."OrigemPreparoColostro" ADD CONSTRAINT "OrigemPreparoColostro_preparoId_fkey" FOREIGN KEY ("preparoId") REFERENCES "pecuaria"."PreparoColostro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."OrigemPreparoColostro" ADD CONSTRAINT "OrigemPreparoColostro_origemId_fkey" FOREIGN KEY ("origemId") REFERENCES "pecuaria"."OrigemColostro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."OrigemPreparoColostro" ADD CONSTRAINT "OrigemPreparoColostro_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "pecuaria"."UnidadeBancoColostro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."OrigemPreparoColostro" ADD CONSTRAINT "OrigemPreparoColostro_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES public."MovimentoEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."InsumoPreparoColostro" ADD CONSTRAINT "InsumoPreparoColostro_preparoId_fkey" FOREIGN KEY ("preparoId") REFERENCES "pecuaria"."PreparoColostro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."InsumoPreparoColostro" ADD CONSTRAINT "InsumoPreparoColostro_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."InsumoPreparoColostro" ADD CONSTRAINT "InsumoPreparoColostro_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES public."PartidaProduto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."InsumoPreparoColostro" ADD CONSTRAINT "InsumoPreparoColostro_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES public."MovimentoEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."UnidadeBancoColostro" ADD CONSTRAINT "UnidadeBancoColostro_destinacaoId_fkey" FOREIGN KEY ("destinacaoId") REFERENCES "pecuaria"."DestinacaoColostro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."UnidadeBancoColostro" ADD CONSTRAINT "UnidadeBancoColostro_origemId_fkey" FOREIGN KEY ("origemId") REFERENCES "pecuaria"."OrigemColostro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."UnidadeBancoColostro" ADD CONSTRAINT "UnidadeBancoColostro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AlocacaoFornecimentoColostro" ADD CONSTRAINT "AlocacaoFornecimentoColostro_destinacaoId_fkey" FOREIGN KEY ("destinacaoId") REFERENCES "pecuaria"."DestinacaoColostro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AlocacaoFornecimentoColostro" ADD CONSTRAINT "AlocacaoFornecimentoColostro_fornecimentoId_fkey" FOREIGN KEY ("fornecimentoId") REFERENCES "pecuaria"."FornecimentoColostro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AlocacaoFornecimentoColostro" ADD CONSTRAINT "AlocacaoFornecimentoColostro_origemId_fkey" FOREIGN KEY ("origemId") REFERENCES "pecuaria"."OrigemColostro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AlocacaoFornecimentoColostro" ADD CONSTRAINT "AlocacaoFornecimentoColostro_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "pecuaria"."UnidadeBancoColostro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AlocacaoFornecimentoColostro" ADD CONSTRAINT "AlocacaoFornecimentoColostro_destinoInternoId_fkey" FOREIGN KEY ("destinoInternoId") REFERENCES "pecuaria"."DestinoInternoLeite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AlocacaoFornecimentoColostro" ADD CONSTRAINT "AlocacaoFornecimentoColostro_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES public."MovimentoEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AcompanhamentoColostragem" ADD CONSTRAINT "AcompanhamentoColostragem_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AcompanhamentoColostragem" ADD CONSTRAINT "AcompanhamentoColostragem_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AcompanhamentoColostragem" ADD CONSTRAINT "AcompanhamentoColostragem_configuracaoId_fkey" FOREIGN KEY ("configuracaoId") REFERENCES "pecuaria"."ConfiguracaoBezerreiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ExameImunidadeColostragem" ADD CONSTRAINT "ExameImunidadeColostragem_acompanhamentoId_fkey" FOREIGN KEY ("acompanhamentoId") REFERENCES "pecuaria"."AcompanhamentoColostragem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ExameImunidadeColostragem" ADD CONSTRAINT "ExameImunidadeColostragem_exameId_fkey" FOREIGN KEY ("exameId") REFERENCES "pecuaria"."ExameAnimal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."VinculoFornecimentoColostragem" ADD CONSTRAINT "VinculoFornecimentoColostragem_acompanhamentoId_fkey" FOREIGN KEY ("acompanhamentoId") REFERENCES "pecuaria"."AcompanhamentoColostragem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."VinculoFornecimentoColostragem" ADD CONSTRAINT "VinculoFornecimentoColostragem_fornecimentoId_fkey" FOREIGN KEY ("fornecimentoId") REFERENCES "pecuaria"."FornecimentoColostro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."DestinacaoColostro" ADD CONSTRAINT "DestinacaoColostro_origemId_fkey" FOREIGN KEY ("origemId") REFERENCES "pecuaria"."OrigemColostro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."DestinacaoColostro" ADD CONSTRAINT "DestinacaoColostro_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Invariantes complementares ao Prisma. Intervalos civis são [desde, ate).
ALTER TABLE pecuaria."ItemFechamentoConsumo" ADD CONSTRAINT "ItemFechamentoConsumo_origem_xor"
 CHECK (("fechamentoId" IS NOT NULL)::int + ("grupoOfertaId" IS NOT NULL)::int = 1);
ALTER TABLE pecuaria."ParcelaFornecimentoNutricionalLeite"
 DROP CONSTRAINT "ParcelaFornecimentoNutricionalLeite_dias_check",
 ADD CONSTRAINT "ParcelaFornecimentoNutricionalLeite_base_presenca" CHECK (
 ("criterioAtribuicao"='ANIMAL_DIAS' AND "dias" IS NOT NULL AND "dias">0) OR
 ("criterioAtribuicao"='ATRIBUIDA_POR_OFERTA' AND "dias" IS NULL AND "programacaoSnapshot" IS NOT NULL AND "baseQuantidade"='ATRIBUIDA'));
ALTER TABLE pecuaria."ParticipacaoBezerreiro"
 ADD CONSTRAINT "ParticipacaoBezerreiro_intervalo" CHECK ("ate" IS NULL OR "ate">"desde"),
 ADD CONSTRAINT "ParticipacaoBezerreiro_sem_sobreposicao" EXCLUDE USING gist ("animalId" WITH =, daterange("desde","ate",'[)') WITH &&);
ALTER TABLE pecuaria."PeriodoFaseBezerreiro"
 ADD CONSTRAINT "PeriodoFaseBezerreiro_intervalo" CHECK ("ate" IS NULL OR "ate">"desde"),
 ADD CONSTRAINT "PeriodoFaseBezerreiro_sem_sobreposicao" EXCLUDE USING gist ("participacaoId" WITH =, daterange("desde","ate",'[)') WITH &&);
ALTER TABLE pecuaria."ConfiguracaoBezerreiro" ADD CONSTRAINT "ConfiguracaoBezerreiro_referencias" CHECK
 (versao>0 AND "brixReferencia">0 AND "brixReferencia"<=100 AND "percentualPesoColostro">0 AND "percentualPesoColostro"<=100);
ALTER TABLE pecuaria."FaseBezerreiroVersao" ADD CONSTRAINT "FaseBezerreiroVersao_dose" CHECK (versao>0 AND "litrosDia">=0);
ALTER TABLE pecuaria."OfertaProgramadaBezerreiro" ADD CONSTRAINT "OfertaProgramadaBezerreiro_parametros" CHECK
 (ordem>=0 AND percentual>0 AND percentual<=100 AND ("horarioPrevisto" IS NULL OR "horarioPrevisto" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'));
ALTER TABLE pecuaria."OfertaBezerreiro" ADD CONSTRAINT "OfertaBezerreiro_estado" CHECK
 (versao>0 AND status IN ('CONFIRMADO','ESTORNADO') AND (NOT "horarioEstimado" OR "ocorridoEm" IS NOT NULL)
 AND ("ocorridoEm" IS NULL OR ("ocorridoEm" AT TIME ZONE 'America/Sao_Paulo')::date=data)
 AND ((status='CONFIRMADO' AND "estornadoEm" IS NULL) OR (status='ESTORNADO' AND "estornadoEm" IS NOT NULL AND length(btrim("motivoEstorno"))>0)));
ALTER TABLE pecuaria."GrupoOfertaBezerreiro" ADD CONSTRAINT "GrupoOfertaBezerreiro_volumes" CHECK
 ("quantidadePrevistaLitros">=0 AND "quantidadeLitros">=0 AND jsonb_typeof("participantesSnapshot")='array' AND jsonb_typeof("programacaoSnapshot") IN ('array','object'));
CREATE UNIQUE INDEX "GrupoOfertaBezerreiro_coleira_unica" ON pecuaria."GrupoOfertaBezerreiro" ("ofertaId",COALESCE("coleiraId",''));
ALTER TABLE pecuaria."LoteColostro" ADD CONSTRAINT "LoteColostro_estado" CHECK
 (versao>0 AND "quantidadeLitros">0 AND status IN ('RASCUNHO','CONFIRMADO','ESTORNADO') AND (status<>'CONFIRMADO' OR "entradaId" IS NOT NULL)
 AND (NOT "horarioEstimado" OR "ocorridoEm" IS NOT NULL)
 AND ("ocorridoEm" IS NULL OR ("ocorridoEm" AT TIME ZONE 'America/Sao_Paulo')::date=data));
CREATE UNIQUE INDEX "LoteColostro_primeira_retirada" ON pecuaria."LoteColostro" ("partoId") WHERE "primeiraRetirada" AND status<>'ESTORNADO';
ALTER TABLE pecuaria."OrigemColostro" ADD CONSTRAINT "OrigemColostro_origem_xor" CHECK
 (("loteColostroId" IS NOT NULL)::int + ("preparoId" IS NOT NULL)::int=1 AND "quantidadeLitros">0 AND status IN ('CONFIRMADO','ESTORNADO') AND versao>0 AND ("valorTotal" IS NULL OR "valorTotal">=0));
ALTER TABLE pecuaria."PreparoColostro" ADD CONSTRAINT "PreparoColostro_estado" CHECK
 (versao>0 AND "volumeFinalLitros">0 AND status IN ('CONFIRMADO','ESTORNADO') AND length(btrim(responsavel))>0 AND ("ocorridoEm" IS NULL OR ("ocorridoEm" AT TIME ZONE 'America/Sao_Paulo')::date=data));
ALTER TABLE pecuaria."OrigemPreparoColostro" ADD CONSTRAINT "OrigemPreparoColostro_volume" CHECK ("quantidadeLitros">0);
ALTER TABLE pecuaria."InsumoPreparoColostro" ADD CONSTRAINT "InsumoPreparoColostro_quantidade" CHECK (quantidade>0 AND length(btrim(unidade))>0);
ALTER TABLE pecuaria."UnidadeBancoColostro" ADD CONSTRAINT "UnidadeBancoColostro_estado" CHECK
 ("volumeLitros"=2 AND versao>0 AND status IN ('CONGELADA','RETIRADA','ESTORNADA') AND length(btrim(codigo))>0
 AND ("dataRetirada" IS NULL OR "dataRetirada">="dataCongelamento")
 AND ("retiradoEm" IS NULL OR ("retiradoEm" AT TIME ZONE 'America/Sao_Paulo')::date="dataRetirada")
 AND ((status='CONGELADA' AND "dataRetirada" IS NULL AND "retiradoEm" IS NULL) OR (status='RETIRADA' AND "dataRetirada" IS NOT NULL) OR status='ESTORNADA'));
ALTER TABLE pecuaria."AlocacaoFornecimentoColostro" ADD CONSTRAINT "AlocacaoFornecimentoColostro_volume" CHECK ("quantidadeLitros">0);
ALTER TABLE pecuaria."DestinacaoColostro" ADD CONSTRAINT "DestinacaoColostro_estado" CHECK
 (versao>0 AND status IN ('CONFIRMADO','ESTORNADO') AND (NOT "horarioEstimado" OR "ocorridoEm" IS NOT NULL)
 AND ("ocorridoEm" IS NULL OR ("ocorridoEm" AT TIME ZONE 'America/Sao_Paulo')::date=data));
ALTER TABLE pecuaria."AcompanhamentoColostragem" ADD CONSTRAINT "AcompanhamentoColostragem_meta" CHECK
 (("pesoReferenciaKg" IS NULL OR "pesoReferenciaKg">0) AND ("metaLitros" IS NULL OR "metaLitros">0));

-- Amostra do alimento continua independente do exame sanguíneo da cria.
ALTER TABLE pecuaria."AmostraQualidadeLeite" DROP CONSTRAINT "AmostraQualidadeLeite_sujeito_check",
 ADD CONSTRAINT "AmostraQualidadeLeite_sujeito_check" CHECK ((
 (sujeito='ANIMAL' AND "exameAnimalId" IS NOT NULL AND "origemColetiva" IS NULL AND "entradaId" IS NULL AND "formatoSnapshot" IS NULL AND "origemColostroId" IS NULL) OR
 (sujeito='COLETIVO' AND "exameAnimalId" IS NULL AND length(btrim("origemColetiva"))>0 AND jsonb_typeof("formatoSnapshot")='object' AND "origemColostroId" IS NULL) OR
 (sujeito='COLOSTRO' AND "origemColostroId" IS NOT NULL AND "exameAnimalId" IS NULL AND "entradaId" IS NULL AND "origemColetiva" IS NULL AND jsonb_typeof("formatoSnapshot")='object')) IS TRUE);

CREATE FUNCTION pecuaria.conferir_participacao_bezerreiro(animal_id text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE p record; cobertura datemultirange;
BEGIN
 FOR p IN SELECT p.*,b."loteId",b."propriedadeId",a."dataNascimento" FROM pecuaria."ParticipacaoBezerreiro" p
 JOIN pecuaria."PerfilBezerreiro" b ON b.id=p."perfilId" JOIN pecuaria."Animal" a ON a.id=p."animalId" WHERE p."animalId"=animal_id LOOP
  SELECT range_agg(daterange(l.desde,l.ate,'[)')) INTO cobertura FROM pecuaria."LocalizacaoAnimal" l
   WHERE l."animalId"=animal_id AND l."loteId"=p."loteId" AND l."propriedadeId"=p."propriedadeId";
  IF p.desde<p."dataNascimento" OR cobertura IS NULL OR NOT (daterange(p.desde,p.ate,'[)') <@ cobertura) THEN
   RAISE EXCEPTION 'Participação exige localização comprovada no lote/sítio durante todo o intervalo' USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT 1 FROM pecuaria."PeriodoFaseBezerreiro" f JOIN pecuaria."FaseBezerreiroVersao" v ON v.id=f."faseVersaoId"
   WHERE f."participacaoId"=p.id AND (NOT v.publicada OR v."propriedadeId"<>p."propriedadeId" OR NOT daterange(f.desde,f.ate,'[)') <@ daterange(p.desde,p.ate,'[)'))) THEN
   RAISE EXCEPTION 'Fase deve ser publicada, do mesmo sítio e contida na participação' USING ERRCODE='23514';
  END IF;
 END LOOP;
END $$;
CREATE FUNCTION pecuaria.observar_participacao_bezerreiro() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a text;
BEGIN
 IF TG_TABLE_NAME='PeriodoFaseBezerreiro' THEN
  SELECT "animalId" INTO a FROM pecuaria."ParticipacaoBezerreiro" WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD."participacaoId" ELSE NEW."participacaoId" END;
 ELSE a:=CASE WHEN TG_OP='DELETE' THEN OLD."animalId" ELSE NEW."animalId" END; END IF;
 PERFORM pecuaria.conferir_participacao_bezerreiro(a);
 IF TG_OP='UPDATE' AND TG_TABLE_NAME<>'PeriodoFaseBezerreiro' THEN
  IF OLD."animalId" IS DISTINCT FROM NEW."animalId" THEN PERFORM pecuaria.conferir_participacao_bezerreiro(OLD."animalId"); END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "ParticipacaoBezerreiro_contexto" AFTER INSERT OR UPDATE OR DELETE ON pecuaria."ParticipacaoBezerreiro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_participacao_bezerreiro();
CREATE CONSTRAINT TRIGGER "PeriodoFaseBezerreiro_contexto" AFTER INSERT OR UPDATE OR DELETE ON pecuaria."PeriodoFaseBezerreiro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_participacao_bezerreiro();
CREATE CONSTRAINT TRIGGER "LocalizacaoAnimal_bezerreiro" AFTER INSERT OR UPDATE OR DELETE ON pecuaria."LocalizacaoAnimal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_participacao_bezerreiro();

CREATE FUNCTION pecuaria.conferir_configuracao_bezerreiro() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE f record; ident text;
BEGIN
 IF TG_TABLE_NAME='PerfilBezerreiro' THEN
  IF NOT EXISTS(SELECT 1 FROM pecuaria."Lote" WHERE id=NEW."loteId" AND "propriedadeId"=NEW."propriedadeId") THEN RAISE EXCEPTION 'Perfil deve especializar lote do sítio' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='FaseBezerreiroVersao' THEN
  ident:=NEW.id;
  IF NEW."coleiraId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."ColeiraBezerreiro" WHERE id=NEW."coleiraId" AND "propriedadeId"=NEW."propriedadeId") THEN RAISE EXCEPTION 'Coleira de outro sítio' USING ERRCODE='23514'; END IF;
 ELSE ident:=CASE WHEN TG_OP='DELETE' THEN OLD."faseVersaoId" ELSE NEW."faseVersaoId" END;
 END IF;
 IF ident IS NOT NULL THEN
  SELECT * INTO f FROM pecuaria."FaseBezerreiroVersao" WHERE id=ident;
  IF f.publicada AND (SELECT COALESCE(sum(percentual),0) FROM pecuaria."OfertaProgramadaBezerreiro" WHERE "faseVersaoId"=ident)<>100 AND NOT (f."litrosDia"=0 AND NOT EXISTS(SELECT 1 FROM pecuaria."OfertaProgramadaBezerreiro" WHERE "faseVersaoId"=ident)) THEN RAISE EXCEPTION 'Programação publicada deve fechar 100 por cento' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "PerfilBezerreiro_contexto" AFTER INSERT OR UPDATE ON pecuaria."PerfilBezerreiro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_configuracao_bezerreiro();
CREATE CONSTRAINT TRIGGER "FaseBezerreiroVersao_programacao" AFTER INSERT OR UPDATE ON pecuaria."FaseBezerreiroVersao" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_configuracao_bezerreiro();
CREATE CONSTRAINT TRIGGER "OfertaProgramadaBezerreiro_total" AFTER INSERT OR UPDATE OR DELETE ON pecuaria."OfertaProgramadaBezerreiro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_configuracao_bezerreiro();
CREATE FUNCTION pecuaria.preservar_programacao_bezerreiro() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='ConfiguracaoBezerreiro' THEN
  RAISE EXCEPTION 'Configuração é histórica; crie nova versão' USING ERRCODE='23514';
 ELSIF TG_TABLE_NAME='FaseBezerreiroVersao' THEN
  IF OLD.publicada THEN RAISE EXCEPTION 'Fase publicada é histórica; crie nova versão' USING ERRCODE='23514'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM pecuaria."FaseBezerreiroVersao" WHERE id=OLD."faseVersaoId" AND publicada) THEN RAISE EXCEPTION 'Programação publicada é histórica; crie nova versão' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER "ConfiguracaoBezerreiro_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."ConfiguracaoBezerreiro" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_programacao_bezerreiro();
CREATE TRIGGER "FaseBezerreiroVersao_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."FaseBezerreiroVersao" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_programacao_bezerreiro();
CREATE TRIGGER "OfertaProgramadaBezerreiro_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."OfertaProgramadaBezerreiro" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_programacao_bezerreiro();

-- Oferta é uma origem real do item nutricional, sem vigência/dias artificiais.
CREATE FUNCTION pecuaria.conferir_oferta_bezerreiro() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE o record; g record; f record; ident text;
BEGIN
 IF TG_TABLE_NAME='OfertaBezerreiro' THEN ident:=NEW.id; ELSE ident:=NEW."ofertaId"; END IF;
 SELECT * INTO STRICT o FROM pecuaria."OfertaBezerreiro" WHERE id=ident;
 IF NOT EXISTS(SELECT 1 FROM pecuaria."PerfilBezerreiro" WHERE id=o."perfilId" AND "propriedadeId"=o."propriedadeId") OR
 (o."configuracaoId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."ConfiguracaoBezerreiro" WHERE id=o."configuracaoId" AND "propriedadeId"=o."propriedadeId")) THEN
  RAISE EXCEPTION 'Oferta incompatível com perfil/configuração do sítio' USING ERRCODE='23514';
 END IF;
 IF o."ofertaProgramadaId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."OfertaProgramadaBezerreiro" p JOIN pecuaria."FaseBezerreiroVersao" v ON v.id=p."faseVersaoId" WHERE p.id=o."ofertaProgramadaId" AND v.publicada AND v."propriedadeId"=o."propriedadeId") THEN RAISE EXCEPTION 'Oferta programada incompatível' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pecuaria."GrupoOfertaBezerreiro" WHERE "ofertaId"=ident) THEN RAISE EXCEPTION 'Oferta exige grupos conferidos' USING ERRCODE='23514'; END IF;
 FOR g IN SELECT * FROM pecuaria."GrupoOfertaBezerreiro" WHERE "ofertaId"=ident LOOP
  IF g."coleiraId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."ColeiraBezerreiro" WHERE id=g."coleiraId" AND "propriedadeId"=o."propriedadeId") THEN RAISE EXCEPTION 'Grupo de outro sítio' USING ERRCODE='23514'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(g."participantesSnapshot") s WHERE NOT EXISTS(
    SELECT 1 FROM pecuaria."ParticipacaoBezerreiro" p WHERE p."animalId"=s->>'animalId' AND p."perfilId"=o."perfilId" AND p.desde<=o.data AND (p.ate IS NULL OR p.ate>o.data))) THEN
   RAISE EXCEPTION 'Grupo exige participantes comprovados na data' USING ERRCODE='23514';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(g."participantesSnapshot"))<>(SELECT count(DISTINCT s->>'animalId') FROM jsonb_array_elements(g."participantesSnapshot") s) THEN RAISE EXCEPTION 'Participante duplicado ou desconhecido' USING ERRCODE='23514'; END IF;
  IF g."quantidadeLitros">0 AND NOT EXISTS(SELECT 1 FROM pecuaria."ItemFechamentoConsumo" i JOIN pecuaria."FornecimentoNutricionalLeite" f ON f."itemId"=i.id WHERE i."grupoOfertaId"=g.id) THEN RAISE EXCEPTION 'Grupo positivo exige único item/fornecimento nutricional' USING ERRCODE='23514'; END IF;
  FOR f IN SELECT f.id FROM pecuaria."ItemFechamentoConsumo" i JOIN pecuaria."FornecimentoNutricionalLeite" f ON f."itemId"=i.id WHERE i."grupoOfertaId"=g.id LOOP
   PERFORM pecuaria.validar_fornecimento_nutricional_leite(f.id);
  END LOOP;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pecuaria."GrupoOfertaBezerreiro" a CROSS JOIN LATERAL jsonb_array_elements(a."participantesSnapshot") s
  WHERE a."ofertaId"=ident GROUP BY s->>'animalId' HAVING count(*)>1) THEN RAISE EXCEPTION 'Animal não pode integrar dois grupos da mesma oferta' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "OfertaBezerreiro_conservacao" AFTER INSERT OR UPDATE ON pecuaria."OfertaBezerreiro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_oferta_bezerreiro();
CREATE CONSTRAINT TRIGGER "GrupoOfertaBezerreiro_conservacao" AFTER INSERT OR UPDATE ON pecuaria."GrupoOfertaBezerreiro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_oferta_bezerreiro();

-- Saldo único por origem. Embalagens segregam parte desse saldo; não criam litros.
CREATE FUNCTION pecuaria.conferir_saldo_colostro(origem_id text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE o record; usado numeric; u record; unidade_usada numeric; entrada_id text; fisico_usado numeric; reservado numeric;
BEGIN
 SELECT * INTO o FROM pecuaria."OrigemColostro" WHERE id=origem_id FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT
 COALESCE((SELECT sum("quantidadeLitros") FROM pecuaria."OrigemPreparoColostro" WHERE "origemId"=o.id AND ativo AND "unidadeId" IS NULL),0)+
 COALESCE((SELECT sum("quantidadeLitros") FROM pecuaria."AlocacaoFornecimentoColostro" WHERE "origemId"=o.id AND ativo AND "unidadeId" IS NULL),0)+
 COALESCE((SELECT sum("volumeLitros") FROM pecuaria."UnidadeBancoColostro" WHERE "origemId"=o.id AND status<>'ESTORNADA'),0) INTO usado;
 IF usado>o."quantidadeLitros" OR (o.status='ESTORNADO' AND usado<>0) THEN RAISE EXCEPTION 'Colostro sem saldo disponível ou origem estornada com consumidores' USING ERRCODE='23514'; END IF;
 IF o."loteColostroId" IS NOT NULL AND o.status='CONFIRMADO' THEN
  SELECT "entradaId" INTO entrada_id FROM pecuaria."LoteColostro" WHERE id=o."loteColostroId";
  IF NOT EXISTS(SELECT 1 FROM pecuaria."EntradaProducaoLeite" e JOIN public."MovimentoEstoque" m ON m.id=e."movimentoId" WHERE e.id=entrada_id AND e.status='CONFIRMADA' AND m.status='CONFIRMADO') THEN RAISE EXCEPTION 'Origem bruta exige produção confirmada válida' USING ERRCODE='23514'; END IF;
  SELECT COALESCE(sum(a.quantidade),0) INTO fisico_usado FROM pecuaria."AlocacaoLeiteEstoque" a JOIN public."MovimentoEstoque" m ON m.id=a."movimentoId" WHERE a."entradaId"=entrada_id AND m.status='CONFIRMADO';
  SELECT COALESCE((SELECT sum("volumeLitros") FROM pecuaria."UnidadeBancoColostro" WHERE "origemId"=o.id AND status<>'ESTORNADA'),0)
   -COALESCE((SELECT sum("quantidadeLitros") FROM pecuaria."OrigemPreparoColostro" WHERE "origemId"=o.id AND ativo AND "unidadeId" IS NOT NULL),0)
   -COALESCE((SELECT sum("quantidadeLitros") FROM pecuaria."AlocacaoFornecimentoColostro" WHERE "origemId"=o.id AND ativo AND "unidadeId" IS NOT NULL),0) INTO reservado;
  IF fisico_usado+reservado>o."quantidadeLitros" THEN RAISE EXCEPTION 'Saldo físico não comporta consumo e unidades reservadas de colostro' USING ERRCODE='23514'; END IF;
 END IF;
 FOR u IN SELECT * FROM pecuaria."UnidadeBancoColostro" WHERE "origemId"=o.id LOOP
  SELECT COALESCE((SELECT sum("quantidadeLitros") FROM pecuaria."OrigemPreparoColostro" WHERE "unidadeId"=u.id AND ativo),0)+
   COALESCE((SELECT sum("quantidadeLitros") FROM pecuaria."AlocacaoFornecimentoColostro" WHERE "unidadeId"=u.id AND ativo),0) INTO unidade_usada;
  IF unidade_usada>u."volumeLitros" OR (unidade_usada>0 AND u.status<>'RETIRADA') THEN RAISE EXCEPTION 'Consumo exige unidade retirada e saldo da embalagem' USING ERRCODE='23514'; END IF;
 END LOOP;
END $$;
CREATE FUNCTION pecuaria.travar_saldo_colostro() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ident text;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Fato de colostro é histórico; use estorno' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='OrigemColostro' THEN ident:=NEW.id; ELSE ident:=NEW."origemId"; END IF;
 IF TG_OP='UPDATE' THEN
  IF TG_TABLE_NAME='OrigemColostro' THEN
   IF (NEW."propriedadeId",NEW."loteColostroId",NEW."preparoId",NEW."quantidadeLitros") IS DISTINCT FROM (OLD."propriedadeId",OLD."loteColostroId",OLD."preparoId",OLD."quantidadeLitros") THEN RAISE EXCEPTION 'Identidade/volume da origem é histórico' USING ERRCODE='23514'; END IF;
  ELSE
   IF NEW."origemId"<>OLD."origemId" THEN RAISE EXCEPTION 'Origem de alocação é histórica' USING ERRCODE='23514'; END IF;
   IF TG_TABLE_NAME='UnidadeBancoColostro' THEN
    IF OLD.status IN ('RETIRADA','ESTORNADA') AND NEW.status<>OLD.status AND NOT (OLD.status='RETIRADA' AND NEW.status='ESTORNADA') THEN RAISE EXCEPTION 'Unidade retirada não pode ser recongelada' USING ERRCODE='23514'; END IF;
    IF (NEW."volumeLitros",NEW."propriedadeId",NEW.codigo,NEW."dataCongelamento") IS DISTINCT FROM (OLD."volumeLitros",OLD."propriedadeId",OLD.codigo,OLD."dataCongelamento") THEN RAISE EXCEPTION 'Embalagem é histórica' USING ERRCODE='23514'; END IF;
   ELSE
    IF (to_jsonb(NEW)-'ativo')<>(to_jsonb(OLD)-'ativo') OR NOT OLD.ativo OR NEW.ativo THEN RAISE EXCEPTION 'Alocação é histórica; somente desativação por estorno' USING ERRCODE='23514'; END IF;
   END IF;
  END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('colostro:'||ident,0));
 PERFORM 1 FROM pecuaria."OrigemColostro" WHERE id=ident FOR UPDATE;
 RETURN NEW;
END $$;
CREATE FUNCTION pecuaria.observar_saldo_colostro() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='OrigemColostro' THEN PERFORM pecuaria.conferir_saldo_colostro(NEW.id);
 ELSE PERFORM pecuaria.conferir_saldo_colostro(NEW."origemId"); END IF;
 RETURN NULL;
END $$;

CREATE FUNCTION pecuaria.conferir_contexto_colostro() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE o record; p record; u record; f record; d record; e record; quantidade numeric; ident text; data_origem date;
BEGIN
 IF TG_TABLE_NAME='LoteColostro' THEN
  SELECT * INTO p FROM pecuaria."PartoAnimal" WHERE id=NEW."partoId";
  IF p.status<>'VALIDO' OR p."animalId"<>NEW."matrizId" OR p."propriedadeId" IS DISTINCT FROM NEW."propriedadeId" OR p.data>NEW.data
   OR (p."ocorridoEm" IS NOT NULL AND NEW."ocorridoEm" IS NOT NULL AND NOT p."horarioEstimado" AND NOT NEW."horarioEstimado" AND p."ocorridoEm">NEW."ocorridoEm") THEN RAISE EXCEPTION 'Retirada incompatível com parto produtor, matriz ou data' USING ERRCODE='23514'; END IF;
  IF NEW."medicaoGeralId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."MedicaoGeralLeite" g JOIN pecuaria."SessaoOrdenha" s ON s.id=g."sessaoId" JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId" WHERE g.id=NEW."medicaoGeralId" AND g.natureza='COLOSTRO' AND g.litros=NEW."quantidadeLitros" AND d."propriedadeId"=NEW."propriedadeId" AND d."dataOperacional"=NEW.data AND g."animaisOrigem" @> jsonb_build_array(NEW."matrizId") AND jsonb_array_length(g."animaisOrigem")=1) THEN RAISE EXCEPTION 'Retirada exige parcela geral compatível e inteira' USING ERRCODE='23514'; END IF;
  IF NEW."entradaId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."EntradaProducaoLeite" e JOIN public."MovimentoEstoque" m ON m.id=e."movimentoId" JOIN pecuaria."ClassificacaoEntradaLeite" c ON c."entradaId"=e.id AND c.versao=(SELECT max(versao) FROM pecuaria."ClassificacaoEntradaLeite" WHERE "entradaId"=e.id) WHERE e.id=NEW."entradaId" AND e.status='CONFIRMADA' AND m."propriedadeId"=NEW."propriedadeId" AND m.data=NEW.data AND m.quantidade=NEW."quantidadeLitros" AND c.natureza='COLOSTRO' AND (NEW."medicaoGeralId" IS NULL OR e."medicaoGeralId"=NEW."medicaoGeralId")) THEN RAISE EXCEPTION 'Retirada exige entrada inteira confirmada da mesma origem' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='OrigemColostro' THEN
  IF NEW."loteColostroId" IS NOT NULL THEN
   SELECT * INTO STRICT p FROM pecuaria."LoteColostro" WHERE id=NEW."loteColostroId";
   IF p.status<>NEW.status OR p."propriedadeId"<>NEW."propriedadeId" OR p."quantidadeLitros"<>NEW."quantidadeLitros" THEN RAISE EXCEPTION 'Origem diverge da retirada confirmada' USING ERRCODE='23514'; END IF;
  ELSE
   SELECT * INTO STRICT p FROM pecuaria."PreparoColostro" WHERE id=NEW."preparoId";
   IF p.status<>NEW.status OR p."propriedadeId"<>NEW."propriedadeId" OR p."volumeFinalLitros"<>NEW."quantidadeLitros" THEN RAISE EXCEPTION 'Origem diverge do preparo' USING ERRCODE='23514'; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='PreparoColostro' THEN
  IF NOT EXISTS(SELECT 1 FROM pecuaria."OrigemPreparoColostro" WHERE "preparoId"=NEW.id) OR NOT EXISTS(SELECT 1 FROM pecuaria."InsumoPreparoColostro" WHERE "preparoId"=NEW.id) THEN RAISE EXCEPTION 'Preparo exige origens e insumos explícitos' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pecuaria."OrigemColostro" WHERE "preparoId"=NEW.id AND "propriedadeId"=NEW."propriedadeId" AND "quantidadeLitros"=NEW."volumeFinalLitros" AND status=NEW.status) THEN RAISE EXCEPTION 'Preparo exige sua origem resultante' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='InsumoPreparoColostro' THEN
  SELECT * INTO STRICT p FROM pecuaria."PreparoColostro" WHERE id=NEW."preparoId";
  IF NOT EXISTS(SELECT 1 FROM public."MovimentoEstoque" m JOIN public."Produto" pr ON pr.id=m."produtoId" WHERE m.id=NEW."movimentoId" AND m."produtoId"=NEW."produtoId" AND m."propriedadeId"=p."propriedadeId" AND m.data=p.data AND m.tipo='SAIDA' AND m.status::text=CASE WHEN p.status='CONFIRMADO' THEN 'CONFIRMADO' ELSE 'REVERTIDO' END AND m.quantidade=NEW.quantidade AND pr.unidade::text=NEW.unidade) THEN RAISE EXCEPTION 'Insumo exige baixa própria compatível' USING ERRCODE='23514'; END IF;
  IF NEW."partidaId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public."PartidaProduto" WHERE id=NEW."partidaId" AND "produtoId"=NEW."produtoId") THEN RAISE EXCEPTION 'Partida de outro produto' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='UnidadeBancoColostro' THEN
  SELECT * INTO STRICT o FROM pecuaria."OrigemColostro" WHERE id=NEW."origemId";
  IF o."propriedadeId"<>NEW."propriedadeId" OR (o.status<>'CONFIRMADO' AND NEW.status<>'ESTORNADA') THEN RAISE EXCEPTION 'Unidade de outro sítio ou origem inativa' USING ERRCODE='23514'; END IF;
  SELECT COALESCE(l.data,p.data) INTO data_origem FROM pecuaria."OrigemColostro" x LEFT JOIN pecuaria."LoteColostro" l ON l.id=x."loteColostroId" LEFT JOIN pecuaria."PreparoColostro" p ON p.id=x."preparoId" WHERE x.id=o.id;
  IF NEW."dataCongelamento"<data_origem THEN RAISE EXCEPTION 'Congelamento anterior à origem' USING ERRCODE='23514'; END IF;
 ELSE
  SELECT * INTO STRICT o FROM pecuaria."OrigemColostro" WHERE id=NEW."origemId";
  IF TG_TABLE_NAME='OrigemPreparoColostro' THEN
   SELECT * INTO STRICT p FROM pecuaria."PreparoColostro" WHERE id=NEW."preparoId";
   IF o."preparoId"=p.id OR EXISTS(WITH RECURSIVE ancestrais(id) AS (
     SELECT "origemId" FROM pecuaria."OrigemPreparoColostro" WHERE "preparoId"=o."preparoId"
     UNION SELECT a."origemId" FROM ancestrais n JOIN pecuaria."OrigemColostro" x ON x.id=n.id JOIN pecuaria."OrigemPreparoColostro" a ON a."preparoId"=x."preparoId")
     SELECT 1 FROM ancestrais n JOIN pecuaria."OrigemColostro" x ON x.id=n.id WHERE x."preparoId"=p.id) THEN RAISE EXCEPTION 'Ciclo de preparo de colostro' USING ERRCODE='23514'; END IF;
   IF NEW.ativo<>(p.status='CONFIRMADO') THEN RAISE EXCEPTION 'Alocação diverge do estado do preparo' USING ERRCODE='23514'; END IF;
  ELSE
   SELECT * INTO STRICT f FROM pecuaria."FornecimentoColostro" WHERE id=NEW."fornecimentoId";
   p:=f;
   IF NEW.ativo AND f.status<>'VALIDO' THEN RAISE EXCEPTION 'Alocação diverge do fornecimento' USING ERRCODE='23514'; END IF;
   SELECT sum("quantidadeLitros") INTO quantidade FROM pecuaria."AlocacaoFornecimentoColostro" WHERE "fornecimentoId"=f.id AND ativo;
   IF NEW.ativo AND quantidade IS DISTINCT FROM f."quantidadeLitros" THEN RAISE EXCEPTION 'Alocações devem conservar quantidade fornecida' USING ERRCODE='23514'; END IF;
   IF NEW."destinoInternoId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."DestinoInternoLeite" di JOIN pecuaria."LoteColostro" l ON l."entradaId"=di."entradaId" WHERE di.id=NEW."destinoInternoId" AND l.id=o."loteColostroId" AND di."propriedadeId"=o."propriedadeId" AND di.data=f.data) THEN RAISE EXCEPTION 'Destino interno incompatível com a origem' USING ERRCODE='23514'; END IF;
  END IF;
  IF o."propriedadeId"<>p."propriedadeId" OR (NEW.ativo AND o.status<>'CONFIRMADO') THEN RAISE EXCEPTION 'Origem de outro sítio ou inativa' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM pecuaria."LoteColostro" l WHERE l.id=o."loteColostroId" AND l.data>p.data) OR EXISTS(SELECT 1 FROM pecuaria."PreparoColostro" z WHERE z.id=o."preparoId" AND z.data>p.data) THEN RAISE EXCEPTION 'Consumo anterior à origem' USING ERRCODE='23514'; END IF;
  IF o."loteColostroId" IS NOT NULL AND NEW.ativo THEN
   IF NEW."movimentoId" IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM pecuaria."LoteColostro" l JOIN pecuaria."AlocacaoLeiteEstoque" a ON a."entradaId"=l."entradaId" JOIN public."MovimentoEstoque" m ON m.id=a."movimentoId" WHERE l.id=o."loteColostroId" AND a."movimentoId"=NEW."movimentoId" AND a.quantidade=NEW."quantidadeLitros" AND a.finalidade='CONSUMO' AND m.status='CONFIRMADO' AND m.data=p.data AND m."propriedadeId"=o."propriedadeId") THEN RAISE EXCEPTION 'Consumo bruto exige baixa única comprovada da origem' USING ERRCODE='23514'; END IF;
   ELSE
    IF TG_TABLE_NAME='OrigemPreparoColostro' THEN RAISE EXCEPTION 'Preparo bruto exige movimento de consumo' USING ERRCODE='23514';
    ELSE
     IF NEW."destinoInternoId" IS NULL OR NOT EXISTS(SELECT 1 FROM pecuaria."ParcelaDestinoLeite" x WHERE x."destinoId"=NEW."destinoInternoId" AND x."fornecimentoColostroId"=NEW."fornecimentoId" AND x.ativo AND x."quantidadeLitros"=NEW."quantidadeLitros") THEN RAISE EXCEPTION 'Fornecimento bruto exige baixa ou destino comprovado' USING ERRCODE='23514'; END IF;
    END IF;
   END IF;
  END IF;
  IF NEW."unidadeId" IS NOT NULL THEN
   SELECT * INTO STRICT u FROM pecuaria."UnidadeBancoColostro" WHERE id=NEW."unidadeId";
   IF u."origemId"<>o.id OR (NEW.ativo AND (u.status<>'RETIRADA' OR u."dataRetirada">p.data)) THEN RAISE EXCEPTION 'Unidade de outra origem, não retirada ou cronologia inválida' USING ERRCODE='23514'; END IF;
  END IF;
 END IF;
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION pecuaria.validar_fornecimento_nutricional_leite(identidade text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE f pecuaria."FornecimentoNutricionalLeite"; item pecuaria."ItemFechamentoConsumo"; c pecuaria."FechamentoConsumo"; grupo pecuaria."GrupoOfertaBezerreiro"; oferta pecuaria."OfertaBezerreiro";
BEGIN
 SELECT * INTO STRICT f FROM pecuaria."FornecimentoNutricionalLeite" WHERE "id"=identidade;
 SELECT * INTO STRICT item FROM pecuaria."ItemFechamentoConsumo" WHERE "id"=f."itemId";
 IF item."fechamentoId" IS NOT NULL THEN
  SELECT * INTO STRICT c FROM pecuaria."FechamentoConsumo" WHERE "id"=item."fechamentoId";
 ELSE
  SELECT * INTO STRICT grupo FROM pecuaria."GrupoOfertaBezerreiro" WHERE id=item."grupoOfertaId";
  SELECT * INTO STRICT oferta FROM pecuaria."OfertaBezerreiro" WHERE id=grupo."ofertaId";
  IF oferta.status<>f.status OR oferta."propriedadeId"<>f."propriedadeId" OR oferta.data<>f.data OR grupo."quantidadeLitros"<>f."quantidadeLitros" THEN
   RAISE EXCEPTION 'Fornecimento deve corresponder à oferta e grupo conferidos';
  END IF;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pecuaria."EntradaProducaoLeite" e JOIN public."MovimentoEstoque" m ON m."id"=e."movimentoId" WHERE m."produtoId"=item."produtoId" AND m."propriedadeId"=f."propriedadeId") THEN
  RAISE EXCEPTION 'Ingrediente leiteiro exige produção V5 histórica comprovada no sítio';
 END IF;
 IF (item."fechamentoId" IS NOT NULL AND (c."status"::text<>f."status" OR c."propriedadeId"<>f."propriedadeId" OR c."fim"<>f."data")) OR item."unidade"<>'L' OR item."quantidadeConfirmada"<>f."quantidadeLitros" OR item."movimentoEstoqueId" IS NOT NULL OR item."modoEstoque"<>'BAIXA_ESTOQUE' THEN
  RAISE EXCEPTION 'Fornecimento deve corresponder ao item/dieta, sítio e data sem segunda baixa genérica';
 END IF;
 IF (SELECT COALESCE(SUM("quantidadeLitros"),0) FROM pecuaria."MovimentoFornecimentoNutricionalLeite" WHERE "fornecimentoId"=f."id")<>f."quantidadeLitros" OR
    (SELECT COALESCE(SUM("quantidadeLitros"),0) FROM pecuaria."ParcelaFornecimentoNutricionalLeite" WHERE "fornecimentoId"=f."id")<>f."quantidadeLitros" THEN
  RAISE EXCEPTION 'Origens e destinatários devem conservar os litros do fornecimento';
 END IF;
 IF EXISTS (SELECT 1 FROM pecuaria."MovimentoFornecimentoNutricionalLeite" o JOIN public."MovimentoEstoque" m ON m."id"=o."movimentoId"
  WHERE o."fornecimentoId"=f."id" AND (m."status"::text<>CASE WHEN f."status"='CONFIRMADO' THEN 'CONFIRMADO' ELSE 'REVERTIDO' END OR m."propriedadeId"<>f."propriedadeId" OR m."data"<>f."data" OR m."origem"<>'NUTRICAO' OR m."tipo"<>'SAIDA' OR m."quantidade"<>o."quantidadeLitros" OR
   NOT EXISTS (SELECT 1 FROM pecuaria."AlocacaoLeiteEstoque" a JOIN pecuaria."ClassificacaoEntradaLeite" n ON n."id"=a."classificacaoId" WHERE a."movimentoId"=m."id" AND a."entradaId"=o."entradaId" AND a."quantidade"=o."quantidadeLitros" AND a."finalidade"='CONSUMO' AND n."natureza"=o."natureza"))) THEN
  RAISE EXCEPTION 'Origem nutricional divergente da baixa leiteira comprovada';
 END IF;
 IF item."fechamentoId" IS NOT NULL THEN
 IF (SELECT COUNT(*) FROM pecuaria."ParcelaFornecimentoNutricionalLeite" WHERE "fornecimentoId"=f."id")<>(SELECT COUNT(*) FROM pecuaria."ParticipacaoConsumoAnimal" WHERE "fechamentoId"=c."id") THEN
  RAISE EXCEPTION 'Todos os participantes do fechamento devem ter parcela de leite';
 END IF;
 IF EXISTS (SELECT 1 FROM pecuaria."ParcelaFornecimentoNutricionalLeite" p WHERE p."fornecimentoId"=f."id" AND NOT EXISTS (
  SELECT 1 FROM pecuaria."ParticipacaoConsumoAnimal" a WHERE a."fechamentoId"=c."id" AND a."animalId"=p."animalId" AND a."dias"=p."dias")) THEN
  RAISE EXCEPTION 'Destinatário deve participar do fechamento da dieta';
 END IF;
 ELSE
  IF (SELECT count(*) FROM pecuaria."ParcelaFornecimentoNutricionalLeite" WHERE "fornecimentoId"=f.id) <> jsonb_array_length(grupo."participantesSnapshot") OR
    EXISTS(SELECT 1 FROM pecuaria."ParcelaFornecimentoNutricionalLeite" p WHERE p."fornecimentoId"=f.id AND
      (p."dias" IS NOT NULL OR p."criterioAtribuicao"<>'ATRIBUIDA_POR_OFERTA' OR p."programacaoSnapshot" IS NULL OR
       NOT EXISTS(SELECT 1 FROM jsonb_array_elements(grupo."participantesSnapshot") s WHERE s->>'animalId'=p."animalId"))) THEN
   RAISE EXCEPTION 'Parcela atribuída por oferta exige participantes e programação comprovados, sem dias fictícios';
  END IF;
 END IF;
 RETURN;
END $$;
CREATE OR REPLACE FUNCTION pecuaria.conferir_amostra_qualidade_leite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE e RECORD; t RECORD;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Amostra de qualidade é histórica; anule com motivo' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (NEW.sujeito,NEW."propriedadeId",NEW.data,NEW."tipoExameId",NEW."exameAnimalId",NEW."entradaId",NEW."origemColetiva",NEW."formatoSnapshot",NEW."origemColostroId") IS DISTINCT FROM (OLD.sujeito,OLD."propriedadeId",OLD.data,OLD."tipoExameId",OLD."exameAnimalId",OLD."entradaId",OLD."origemColetiva",OLD."formatoSnapshot",OLD."origemColostroId") THEN
    RAISE EXCEPTION 'Identidade e formato da amostra são históricos' USING ERRCODE='23514';
  END IF;
  IF TG_OP='INSERT' THEN
    SELECT * INTO t FROM pecuaria."TipoExame" WHERE id=NEW."tipoExameId" FOR UPDATE;
    IF t.id IS NULL OR t."tipoResultado"<>'MULTIPLO' THEN RAISE EXCEPTION 'Formato de qualidade inválido' USING ERRCODE='23514'; END IF;
    IF NEW.sujeito='ANIMAL' THEN
      SELECT * INTO e FROM pecuaria."ExameAnimal" WHERE id=NEW."exameAnimalId";
      IF e.id IS NULL OR e."propriedadeId" IS DISTINCT FROM NEW."propriedadeId" OR e.data<>NEW.data OR e."tipoExameId"<>NEW."tipoExameId" THEN
        RAISE EXCEPTION 'Exame individual incompatível com amostra' USING ERRCODE='23514';
      END IF;
    ELSE
      IF NEW."formatoSnapshot"->>'tipoResultado' IS DISTINCT FROM 'MULTIPLO' OR NEW."formatoSnapshot"->'campos' IS DISTINCT FROM t.campos THEN
        RAISE EXCEPTION 'Snapshot coletivo incompatível com formato' USING ERRCODE='23514';
      END IF;
      IF NEW."entradaId" IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM pecuaria."EntradaProducaoLeite" x JOIN pecuaria."SessaoOrdenha" s ON s.id=x."sessaoId" JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId"
        WHERE x.id=NEW."entradaId" AND x.status='CONFIRMADA' AND d."propriedadeId"=NEW."propriedadeId" AND d."dataOperacional"<=NEW.data
      ) THEN RAISE EXCEPTION 'Entrada incompatível com sítio/data da amostra' USING ERRCODE='23514'; END IF;
    END IF;
  END IF;
  IF NEW."origemColostroId" IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM pecuaria."OrigemColostro" o LEFT JOIN pecuaria."LoteColostro" l ON l.id=o."loteColostroId"
   LEFT JOIN pecuaria."PreparoColostro" p ON p.id=o."preparoId"
   WHERE o.id=NEW."origemColostroId" AND o."propriedadeId"=NEW."propriedadeId" AND COALESCE(l.data,p.data)<=NEW.data
  ) THEN RAISE EXCEPTION 'Origem de colostro incompatível com sítio/data da amostra' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

-- Triggers de saldo travam a origem antes da escrita e conferem o estado final.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['OrigemColostro','OrigemPreparoColostro','AlocacaoFornecimentoColostro','UnidadeBancoColostro'] LOOP
  EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON pecuaria.%I FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_saldo_colostro()',t||'_travar_saldo',t);
  EXECUTE format('CREATE CONSTRAINT TRIGGER %I AFTER INSERT OR UPDATE ON pecuaria.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_saldo_colostro()',t||'_conferir_saldo',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['LoteColostro','OrigemColostro','PreparoColostro','OrigemPreparoColostro','InsumoPreparoColostro','AlocacaoFornecimentoColostro','UnidadeBancoColostro'] LOOP
  EXECUTE format('CREATE CONSTRAINT TRIGGER %I AFTER INSERT OR UPDATE ON pecuaria.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_contexto_colostro()',t||'_contexto',t);
 END LOOP;
END $$;

CREATE FUNCTION pecuaria.preservar_fatos_bezerreiro() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE antes jsonb; depois jsonb;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Fato histórico deve ser estornado, nunca excluído' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='GrupoOfertaBezerreiro' OR TG_TABLE_NAME='InsumoPreparoColostro' THEN RAISE EXCEPTION 'Fato confirmado é imutável' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='LoteColostro' THEN
  IF OLD.status='RASCUNHO' THEN
   IF (OLD."partoId",OLD."matrizId",OLD."propriedadeId",OLD.chave,OLD.hash) IS DISTINCT FROM (NEW."partoId",NEW."matrizId",NEW."propriedadeId",NEW.chave,NEW.hash) THEN RAISE EXCEPTION 'Identidade da retirada é histórica' USING ERRCODE='23514'; END IF;
   RETURN NEW;
  END IF;
 ELSIF TG_TABLE_NAME='DestinacaoColostro' THEN
  IF OLD.snapshot IS NULL AND NEW.snapshot IS NOT NULL AND (to_jsonb(NEW)-'snapshot')=(to_jsonb(OLD)-'snapshot') THEN RETURN NEW; END IF;
 END IF;
 antes:=to_jsonb(OLD)-ARRAY['status','versao','estornadoEm','estornadoPorId','motivoEstorno'];
 depois:=to_jsonb(NEW)-ARRAY['status','versao','estornadoEm','estornadoPorId','motivoEstorno'];
 IF OLD.status<>'CONFIRMADO' OR NEW.status<>'ESTORNADO' OR antes<>depois OR NEW.versao<>OLD.versao+1 OR NEW."estornadoEm" IS NULL OR COALESCE(length(btrim(NEW."motivoEstorno")),0)=0 THEN
  RAISE EXCEPTION 'Fato confirmado admite somente estorno motivado preservando identidade' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['OfertaBezerreiro','GrupoOfertaBezerreiro','LoteColostro','PreparoColostro','InsumoPreparoColostro','DestinacaoColostro'] LOOP
  EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON pecuaria.%I FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_fatos_bezerreiro()',t||'_historico',t);
 END LOOP;
END $$;

CREATE FUNCTION pecuaria.conferir_acompanhamento_colostragem() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a record; e record; f record; ident text;
BEGIN
 IF TG_TABLE_NAME='AcompanhamentoColostragem' THEN
  IF NEW."configuracaoId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."ConfiguracaoBezerreiro" WHERE id=NEW."configuracaoId" AND "propriedadeId"=NEW."propriedadeId") THEN RAISE EXCEPTION 'Política do acompanhamento de outro sítio' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='ExameImunidadeColostragem' THEN
  SELECT * INTO STRICT a FROM pecuaria."AcompanhamentoColostragem" WHERE id=NEW."acompanhamentoId";
  SELECT * INTO STRICT e FROM pecuaria."ExameAnimal" WHERE id=NEW."exameId";
  IF a."animalId"<>e."animalId" OR a."propriedadeId" IS DISTINCT FROM e."propriedadeId" THEN RAISE EXCEPTION 'Exame deve pertencer à cria acompanhada e ao sítio do acompanhamento' USING ERRCODE='23514'; END IF;
  IF NEW."ocorridoEm" IS NOT NULL AND (NEW."ocorridoEm" AT TIME ZONE 'America/Sao_Paulo')::date<>e.data THEN RAISE EXCEPTION 'Data/hora incompatível com coleta do exame' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='VinculoFornecimentoColostragem' THEN
  SELECT * INTO STRICT a FROM pecuaria."AcompanhamentoColostragem" WHERE id=NEW."acompanhamentoId";
  IF NOT EXISTS(SELECT 1 FROM pecuaria."FornecimentoColostro" f JOIN pecuaria."CriaParto" c ON c.id=f."criaId" WHERE f.id=NEW."fornecimentoId" AND c."animalId"=a."animalId" AND f."propriedadeId"=a."propriedadeId") THEN RAISE EXCEPTION 'Fornecimento deve pertencer à cria acompanhada' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='FornecimentoColostro' THEN
  IF EXISTS(SELECT 1 FROM pecuaria."AlocacaoFornecimentoColostro" WHERE "fornecimentoId"=NEW.id AND ativo) AND
   ((SELECT COALESCE(sum("quantidadeLitros"),0) FROM pecuaria."AlocacaoFornecimentoColostro" WHERE "fornecimentoId"=NEW.id AND ativo) IS DISTINCT FROM NEW."quantidadeLitros" OR
    EXISTS(SELECT 1 FROM pecuaria."AlocacaoFornecimentoColostro" WHERE "fornecimentoId"=NEW.id AND ativo AND NEW.status<>'VALIDO')) THEN RAISE EXCEPTION 'Fornecimento vinculado exige conservação e regularização das origens' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM pecuaria."VinculoFornecimentoColostragem" v JOIN pecuaria."AcompanhamentoColostragem" a ON a.id=v."acompanhamentoId" JOIN pecuaria."CriaParto" c ON c.id=NEW."criaId" WHERE v."fornecimentoId"=NEW.id AND (c."animalId"<>a."animalId" OR NEW."propriedadeId"<>a."propriedadeId")) THEN RAISE EXCEPTION 'Alteração invalida vínculo com acompanhamento' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='ExameAnimal' THEN
  IF EXISTS(SELECT 1 FROM pecuaria."ExameImunidadeColostragem" v JOIN pecuaria."AcompanhamentoColostragem" a ON a.id=v."acompanhamentoId" WHERE v."exameId"=NEW.id AND (a."animalId"<>NEW."animalId" OR a."propriedadeId" IS DISTINCT FROM NEW."propriedadeId" OR (v."ocorridoEm" IS NOT NULL AND (v."ocorridoEm" AT TIME ZONE 'America/Sao_Paulo')::date<>NEW.data))) THEN RAISE EXCEPTION 'Alteração invalida exame de imunidade vinculado' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['AcompanhamentoColostragem','ExameImunidadeColostragem','VinculoFornecimentoColostragem','FornecimentoColostro','ExameAnimal'] LOOP
  EXECUTE format('CREATE CONSTRAINT TRIGGER %I AFTER INSERT OR UPDATE ON pecuaria.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_acompanhamento_colostragem()',t||'_acompanhamento_contexto',t);
 END LOOP;
END $$;

CREATE FUNCTION pecuaria.conferir_destinacao_colostro() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d record; ident text;
BEGIN
 IF TG_TABLE_NAME='DestinacaoColostro' THEN ident:=NEW.id; ELSE ident:=NEW."destinacaoId"; END IF;
 IF ident IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO STRICT d FROM pecuaria."DestinacaoColostro" WHERE id=ident;
 IF NOT EXISTS(SELECT 1 FROM pecuaria."OrigemColostro" WHERE id=d."origemId" AND "propriedadeId"=d."propriedadeId") THEN RAISE EXCEPTION 'Destinação de outro sítio' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pecuaria."AlocacaoFornecimentoColostro" WHERE "destinacaoId"=ident) AND NOT EXISTS(SELECT 1 FROM pecuaria."UnidadeBancoColostro" WHERE "destinacaoId"=ident) THEN RAISE EXCEPTION 'Destinação exige fornecimento ou congelamento' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM pecuaria."AlocacaoFornecimentoColostro" WHERE "destinacaoId"=ident AND ("origemId"<>d."origemId" OR ativo<>(d.status='CONFIRMADO'))) OR
    EXISTS(SELECT 1 FROM pecuaria."UnidadeBancoColostro" WHERE "destinacaoId"=ident AND ("origemId"<>d."origemId" OR (d.status='ESTORNADO' AND status<>'ESTORNADA'))) THEN RAISE EXCEPTION 'Destinação deve ser confirmada/estornada integralmente' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "DestinacaoColostro_atomicidade" AFTER INSERT OR UPDATE ON pecuaria."DestinacaoColostro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_destinacao_colostro();
CREATE CONSTRAINT TRIGGER "AlocacaoFornecimentoColostro_atomicidade" AFTER INSERT OR UPDATE ON pecuaria."AlocacaoFornecimentoColostro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_destinacao_colostro();
CREATE CONSTRAINT TRIGGER "UnidadeBancoColostro_atomicidade" AFTER INSERT OR UPDATE ON pecuaria."UnidadeBancoColostro" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_destinacao_colostro();

-- Autoria conserva referência real, sem tornar a ponte sintética uma conta nova.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['PerfilBezerreiro','ParticipacaoBezerreiro','ColeiraBezerreiro','ConfiguracaoBezerreiro','FaseBezerreiroVersao','PeriodoFaseBezerreiro','OfertaBezerreiro','LoteColostro','OrigemColostro','PreparoColostro','UnidadeBancoColostro','AcompanhamentoColostragem','ExameImunidadeColostragem','VinculoFornecimentoColostragem','DestinacaoColostro'] LOOP
  EXECUTE format('ALTER TABLE pecuaria.%I ADD CONSTRAINT %I FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT',t,t||'_criadoPorId_fkey');
 END LOOP;
 FOREACH t IN ARRAY ARRAY['OfertaBezerreiro','LoteColostro','PreparoColostro','DestinacaoColostro'] LOOP
  EXECUTE format('ALTER TABLE pecuaria.%I ADD CONSTRAINT %I FOREIGN KEY ("estornadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT',t,t||'_estornadoPorId_fkey');
 END LOOP;
END $$;

-- Alterações pelo núcleo de estoque também devem respeitar as embalagens reservadas.
CREATE FUNCTION pecuaria.observar_fisico_colostro() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE o record;
BEGIN
 IF TG_TABLE_NAME='AlocacaoLeiteEstoque' THEN
  FOR o IN SELECT o.id FROM pecuaria."OrigemColostro" o JOIN pecuaria."LoteColostro" l ON l.id=o."loteColostroId" WHERE l."entradaId"=NEW."entradaId" LOOP PERFORM pecuaria.conferir_saldo_colostro(o.id); END LOOP;
 ELSIF TG_TABLE_NAME='EntradaProducaoLeite' THEN
  FOR o IN SELECT o.id FROM pecuaria."OrigemColostro" o JOIN pecuaria."LoteColostro" l ON l.id=o."loteColostroId" WHERE l."entradaId"=NEW.id LOOP PERFORM pecuaria.conferir_saldo_colostro(o.id); END LOOP;
 ELSE
  FOR o IN SELECT DISTINCT o.id FROM pecuaria."OrigemColostro" o JOIN pecuaria."LoteColostro" l ON l.id=o."loteColostroId" JOIN pecuaria."EntradaProducaoLeite" e ON e.id=l."entradaId" LEFT JOIN pecuaria."AlocacaoLeiteEstoque" a ON a."entradaId"=e.id WHERE e."movimentoId"=NEW.id OR a."movimentoId"=NEW.id LOOP PERFORM pecuaria.conferir_saldo_colostro(o.id); END LOOP;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "AlocacaoLeiteEstoque_colostro_reservado" AFTER INSERT OR UPDATE ON pecuaria."AlocacaoLeiteEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_fisico_colostro();
CREATE CONSTRAINT TRIGGER "MovimentoEstoque_colostro_reservado" AFTER INSERT OR UPDATE ON public."MovimentoEstoque" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_fisico_colostro();
CREATE CONSTRAINT TRIGGER "EntradaProducaoLeite_colostro_reservado" AFTER INSERT OR UPDATE ON pecuaria."EntradaProducaoLeite" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.observar_fisico_colostro();

-- A cor/nome atuais da coleira podem evoluir; cada versão de fase conserva os vistos.
CREATE FUNCTION pecuaria.preparar_fase_bezerreiro() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c record;
BEGIN
 IF NEW."coleiraId" IS NULL THEN NEW."coleiraSnapshot":=NULL;
 ELSE
  SELECT * INTO STRICT c FROM pecuaria."ColeiraBezerreiro" WHERE id=NEW."coleiraId";
  IF c."propriedadeId"<>NEW."propriedadeId" THEN RAISE EXCEPTION 'Coleira de outro sítio' USING ERRCODE='23514'; END IF;
  NEW."coleiraSnapshot":=jsonb_build_object('id',c.id,'nome',c.nome,'cor',c.cor);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "FaseBezerreiroVersao_snapshot_coleira" BEFORE INSERT ON pecuaria."FaseBezerreiroVersao" FOR EACH ROW EXECUTE FUNCTION pecuaria.preparar_fase_bezerreiro();

CREATE FUNCTION pecuaria.preservar_origens_bezerreiro() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='PerfilBezerreiro' THEN
  IF (OLD."loteId",OLD."propriedadeId") IS DISTINCT FROM (NEW."loteId",NEW."propriedadeId") THEN RAISE EXCEPTION 'Perfil conserva lote e sítio de origem' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='ColeiraBezerreiro' THEN
  IF OLD."propriedadeId"<>NEW."propriedadeId" THEN RAISE EXCEPTION 'Coleira conserva sítio de origem' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='PartoAnimal' THEN
  IF (OLD."animalId",OLD."propriedadeId",OLD.data,OLD."ocorridoEm",OLD.status) IS DISTINCT FROM (NEW."animalId",NEW."propriedadeId",NEW.data,NEW."ocorridoEm",NEW.status) AND EXISTS(SELECT 1 FROM pecuaria."LoteColostro" WHERE "partoId"=OLD.id AND status<>'ESTORNADO') THEN RAISE EXCEPTION 'Regularize retiradas de colostro antes de corrigir o parto produtor' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "PerfilBezerreiro_identidade" BEFORE UPDATE ON pecuaria."PerfilBezerreiro" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_origens_bezerreiro();
CREATE TRIGGER "ColeiraBezerreiro_identidade" BEFORE UPDATE ON pecuaria."ColeiraBezerreiro" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_origens_bezerreiro();
CREATE TRIGGER "PartoAnimal_colostro_produtor" BEFORE UPDATE ON pecuaria."PartoAnimal" FOR EACH ROW EXECUTE FUNCTION pecuaria.preservar_origens_bezerreiro();
