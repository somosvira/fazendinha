-- CreateEnum
CREATE TYPE "pecuaria"."StatusFatoPecuariaV3" AS ENUM ('VALIDO', 'ANULADO');

-- CreateEnum
CREATE TYPE "pecuaria"."OrigemInsumoSanitario" AS ENUM ('BAIXA_ESTOQUE', 'COMPRA_CONSUMO_DIRETO', 'INCLUSO_SERVICO', 'SEM_ORIGEM_JUSTIFICADA', 'HISTORICO_IMPORTADO');

-- CreateEnum
CREATE TYPE "pecuaria"."FinalidadeAplicacao" AS ENUM ('TRATAMENTO', 'VACINA', 'VERMIFUGO');

-- CreateEnum
CREATE TYPE "pecuaria"."StatusFechamentoConsumo" AS ENUM ('CONFIRMADO', 'ESTORNADO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrigemMovimentoEstoque" ADD VALUE 'SANIDADE';
ALTER TYPE "OrigemMovimentoEstoque" ADD VALUE 'NUTRICAO';

-- AlterTable
ALTER TABLE "Categoria" ADD COLUMN     "usoNutricional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "usoSanitario" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Produto" ADD COLUMN     "rastrearPartidas" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ItemOperacao" ADD COLUMN     "partidasSnapshot" JSONB;

-- AlterTable
ALTER TABLE "pecuaria"."Lote" ADD COLUMN     "centroCustoId" TEXT;

-- AlterTable
ALTER TABLE "pecuaria"."BaixaAnimal" ADD COLUMN     "cienciaCarenciaSnapshot" JSONB;

-- AlterTable
ALTER TABLE "pecuaria"."Pesagem" ADD COLUMN     "requisicaoId" TEXT;

-- AlterTable
ALTER TABLE "pecuaria"."AuditoriaPecuaria" ADD COLUMN     "propriedadeId" INTEGER,
ADD COLUMN     "requisicaoId" TEXT;

-- CreateTable
CREATE TABLE "PartidaProduto" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "validade" DATE,
    "fabricante" TEXT,
    "origemRastreio" TEXT NOT NULL DEFAULT 'INFORMADA',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartidaProduto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlocacaoPartidaEstoque" (
    "id" TEXT NOT NULL,
    "movimentoEstoqueId" TEXT NOT NULL,
    "partidaId" TEXT NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "AlocacaoPartidaEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."PerfilSanitarioProduto" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "carenciaLeiteHoras" INTEGER,
    "carenciaCarneHoras" INTEGER,
    "viaPadrao" TEXT,
    "referenciaTecnica" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfilSanitarioProduto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."PerfilNutricionalProduto" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "materiaSecaPercentual" DECIMAL(5,2),
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfilNutricionalProduto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."Doenca" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "motivoBaixaSugeridoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Doenca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."OcorrenciaSanitaria" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "propriedadeId" INTEGER,
    "doencaId" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE,
    "desfecho" TEXT,
    "observacao" TEXT,
    "status" "pecuaria"."StatusFatoPecuariaV3" NOT NULL DEFAULT 'VALIDO',
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "motivoAnulacao" TEXT,
    "anuladoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcorrenciaSanitaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."AplicacaoProduto" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "propriedadeId" INTEGER,
    "produtoId" TEXT,
    "nomeProdutoAplicado" TEXT NOT NULL,
    "ocorrenciaId" TEXT,
    "tarefaId" TEXT,
    "data" DATE NOT NULL,
    "aplicadaEm" TIMESTAMP(3),
    "precisaoTemporal" TEXT NOT NULL DEFAULT 'HORA',
    "finalidade" "pecuaria"."FinalidadeAplicacao" NOT NULL,
    "dose" DECIMAL(12,3),
    "unidadeDose" TEXT,
    "via" TEXT,
    "carenciaLeiteHoras" INTEGER,
    "carenciaCarneHoras" INTEGER,
    "referenciaCarencia" TEXT,
    "origemInsumo" "pecuaria"."OrigemInsumoSanitario" NOT NULL,
    "quantidadeUtilizada" DECIMAL(12,3),
    "movimentoEstoqueId" TEXT,
    "itemCompraDiretaId" TEXT,
    "quantidadeCompraDireta" DECIMAL(12,3),
    "operacaoServicoId" TEXT,
    "valorProdutoAtribuido" DECIMAL(14,2),
    "valorServicoAtribuido" DECIMAL(14,2),
    "situacaoCusto" TEXT NOT NULL DEFAULT 'NAO_APURADO',
    "partidaCodigoSnapshot" TEXT,
    "partidaValidadeSnapshot" DATE,
    "justificativaSemOrigem" TEXT,
    "status" "pecuaria"."StatusFatoPecuariaV3" NOT NULL DEFAULT 'VALIDO',
    "motivoAnulacao" TEXT,
    "anuladoEm" TIMESTAMP(3),
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AplicacaoProduto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ProtocoloSanitario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "descricao" TEXT,
    "publicadoEm" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtocoloSanitario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."EtapaProtocoloSanitario" (
    "id" TEXT NOT NULL,
    "protocoloId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "diaRelativo" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "produtoId" TEXT,
    "tipoExameId" TEXT,
    "finalidade" "pecuaria"."FinalidadeAplicacao",
    "dose" DECIMAL(12,3),
    "unidade" TEXT,
    "via" TEXT,

    CONSTRAINT "EtapaProtocoloSanitario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ExecucaoProtocoloSanitario" (
    "id" TEXT NOT NULL,
    "protocoloId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "propriedadeId" INTEGER,
    "inicio" DATE NOT NULL,
    "ocorrenciaId" TEXT,
    "operacaoServicoId" TEXT,
    "canceladaEm" TIMESTAMP(3),
    "motivoCancelamento" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecucaoProtocoloSanitario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."TarefaSanitaria" (
    "id" TEXT NOT NULL,
    "execucaoId" TEXT NOT NULL,
    "etapaId" TEXT NOT NULL,
    "previstaPara" DATE NOT NULL,
    "parametros" JSONB NOT NULL,
    "dispensadaEm" TIMESTAMP(3),
    "motivoDispensa" TEXT,

    CONSTRAINT "TarefaSanitaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."TipoExame" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipoResultado" TEXT NOT NULL,
    "unidade" TEXT,
    "opcoes" JSONB,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TipoExame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ExameAnimal" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "propriedadeId" INTEGER,
    "tipoExameId" TEXT NOT NULL,
    "ocorrenciaId" TEXT,
    "tarefaId" TEXT,
    "operacaoServicoId" TEXT,
    "data" DATE NOT NULL,
    "resultadoTexto" TEXT,
    "resultadoNumero" DECIMAL(14,4),
    "resultadoOpcao" TEXT,
    "formatoSnapshot" JSONB NOT NULL,
    "responsavel" TEXT,
    "status" "pecuaria"."StatusFatoPecuariaV3" NOT NULL DEFAULT 'VALIDO',
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "motivoAnulacao" TEXT,
    "anuladoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExameAnimal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ManejoAnimal" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "propriedadeId" INTEGER,
    "tipo" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "pesagemId" TEXT,
    "responsavel" TEXT,
    "observacao" TEXT,
    "status" "pecuaria"."StatusFatoPecuariaV3" NOT NULL DEFAULT 'VALIDO',
    "motivoAnulacao" TEXT,
    "anuladoEm" TIMESTAMP(3),
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManejoAnimal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."Dieta" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "publicadaEm" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dieta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ItemDieta" (
    "id" TEXT NOT NULL,
    "dietaId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidadeCabecaDia" DECIMAL(12,3) NOT NULL,
    "unidade" TEXT NOT NULL,
    "materiaSecaPercentualSnapshot" DECIMAL(5,2),

    CONSTRAINT "ItemDieta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."VigenciaDietaLote" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "dietaId" TEXT NOT NULL,
    "desde" DATE NOT NULL,
    "ate" DATE,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VigenciaDietaLote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."FechamentoConsumo" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "vigenciaId" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,
    "centroCustoId" TEXT NOT NULL,
    "animalDias" INTEGER NOT NULL,
    "confirmadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "pecuaria"."StatusFechamentoConsumo" NOT NULL DEFAULT 'CONFIRMADO',
    "motivoEstorno" TEXT,
    "estornadoEm" TIMESTAMP(3),

    CONSTRAINT "FechamentoConsumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ItemFechamentoConsumo" (
    "id" TEXT NOT NULL,
    "fechamentoId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidadePrevista" DECIMAL(12,3) NOT NULL,
    "quantidadeConfirmada" DECIMAL(12,3) NOT NULL,
    "baseQuantidade" TEXT NOT NULL,
    "motivoAjuste" TEXT,
    "unidade" TEXT NOT NULL,
    "movimentoEstoqueId" TEXT,
    "modoEstoque" TEXT NOT NULL,
    "justificativaSemBaixa" TEXT,
    "situacaoCusto" TEXT NOT NULL,

    CONSTRAINT "ItemFechamentoConsumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ParticipacaoConsumoAnimal" (
    "id" TEXT NOT NULL,
    "fechamentoId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "dias" INTEGER NOT NULL,

    CONSTRAINT "ParticipacaoConsumoAnimal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."RequisicaoPecuaria" (
    "chave" TEXT NOT NULL,
    "propriedadeId" INTEGER NOT NULL,
    "usuarioId" INTEGER,
    "operacao" TEXT NOT NULL,
    "hashPayload" TEXT NOT NULL,
    "resultadoIds" JSONB NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequisicaoPecuaria_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "pecuaria"."VinculoImportacaoPecuaria" (
    "id" TEXT NOT NULL,
    "bancoOrigem" TEXT NOT NULL,
    "tabelaOrigem" TEXT NOT NULL,
    "chaveOrigem" TEXT NOT NULL,
    "entidadeDestino" TEXT NOT NULL,
    "destinoId" TEXT NOT NULL,
    "hashOrigem" TEXT NOT NULL,
    "importadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VinculoImportacaoPecuaria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartidaProduto_produtoId_codigo_key" ON "PartidaProduto"("produtoId", "codigo");

-- CreateIndex
CREATE INDEX "AlocacaoPartidaEstoque_partidaId_idx" ON "AlocacaoPartidaEstoque"("partidaId");

-- CreateIndex
CREATE UNIQUE INDEX "AlocacaoPartidaEstoque_movimentoEstoqueId_partidaId_key" ON "AlocacaoPartidaEstoque"("movimentoEstoqueId", "partidaId");

-- CreateIndex
CREATE UNIQUE INDEX "PerfilSanitarioProduto_produtoId_key" ON "pecuaria"."PerfilSanitarioProduto"("produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "PerfilNutricionalProduto_produtoId_key" ON "pecuaria"."PerfilNutricionalProduto"("produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "Doenca_nome_key" ON "pecuaria"."Doenca"("nome");

-- CreateIndex
CREATE INDEX "OcorrenciaSanitaria_animalId_inicio_idx" ON "pecuaria"."OcorrenciaSanitaria"("animalId", "inicio");

-- CreateIndex
CREATE INDEX "OcorrenciaSanitaria_propriedadeId_inicio_idx" ON "pecuaria"."OcorrenciaSanitaria"("propriedadeId", "inicio");

-- CreateIndex
CREATE UNIQUE INDEX "AplicacaoProduto_tarefaId_key" ON "pecuaria"."AplicacaoProduto"("tarefaId");

-- CreateIndex
CREATE UNIQUE INDEX "AplicacaoProduto_movimentoEstoqueId_key" ON "pecuaria"."AplicacaoProduto"("movimentoEstoqueId");

-- CreateIndex
CREATE INDEX "AplicacaoProduto_animalId_data_idx" ON "pecuaria"."AplicacaoProduto"("animalId", "data");

-- CreateIndex
CREATE INDEX "AplicacaoProduto_propriedadeId_data_idx" ON "pecuaria"."AplicacaoProduto"("propriedadeId", "data");

-- CreateIndex
CREATE INDEX "AplicacaoProduto_itemCompraDiretaId_idx" ON "pecuaria"."AplicacaoProduto"("itemCompraDiretaId");

-- CreateIndex
CREATE INDEX "AplicacaoProduto_operacaoServicoId_idx" ON "pecuaria"."AplicacaoProduto"("operacaoServicoId");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocoloSanitario_nome_versao_key" ON "pecuaria"."ProtocoloSanitario"("nome", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "EtapaProtocoloSanitario_protocoloId_ordem_key" ON "pecuaria"."EtapaProtocoloSanitario"("protocoloId", "ordem");

-- CreateIndex
CREATE INDEX "ExecucaoProtocoloSanitario_animalId_inicio_idx" ON "pecuaria"."ExecucaoProtocoloSanitario"("animalId", "inicio");

-- CreateIndex
CREATE INDEX "ExecucaoProtocoloSanitario_operacaoServicoId_idx" ON "pecuaria"."ExecucaoProtocoloSanitario"("operacaoServicoId");

-- CreateIndex
CREATE INDEX "TarefaSanitaria_previstaPara_idx" ON "pecuaria"."TarefaSanitaria"("previstaPara");

-- CreateIndex
CREATE UNIQUE INDEX "TarefaSanitaria_execucaoId_etapaId_key" ON "pecuaria"."TarefaSanitaria"("execucaoId", "etapaId");

-- CreateIndex
CREATE UNIQUE INDEX "TipoExame_nome_key" ON "pecuaria"."TipoExame"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "ExameAnimal_tarefaId_key" ON "pecuaria"."ExameAnimal"("tarefaId");

-- CreateIndex
CREATE INDEX "ExameAnimal_animalId_data_idx" ON "pecuaria"."ExameAnimal"("animalId", "data");

-- CreateIndex
CREATE INDEX "ExameAnimal_operacaoServicoId_idx" ON "pecuaria"."ExameAnimal"("operacaoServicoId");

-- CreateIndex
CREATE UNIQUE INDEX "ManejoAnimal_pesagemId_key" ON "pecuaria"."ManejoAnimal"("pesagemId");

-- CreateIndex
CREATE INDEX "ManejoAnimal_animalId_data_idx" ON "pecuaria"."ManejoAnimal"("animalId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "Dieta_nome_versao_key" ON "pecuaria"."Dieta"("nome", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "ItemDieta_dietaId_produtoId_key" ON "pecuaria"."ItemDieta"("dietaId", "produtoId");

-- CreateIndex
CREATE INDEX "VigenciaDietaLote_loteId_desde_idx" ON "pecuaria"."VigenciaDietaLote"("loteId", "desde");

-- CreateIndex
CREATE INDEX "FechamentoConsumo_loteId_inicio_fim_idx" ON "pecuaria"."FechamentoConsumo"("loteId", "inicio", "fim");

-- CreateIndex
CREATE UNIQUE INDEX "ItemFechamentoConsumo_movimentoEstoqueId_key" ON "pecuaria"."ItemFechamentoConsumo"("movimentoEstoqueId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemFechamentoConsumo_fechamentoId_produtoId_key" ON "pecuaria"."ItemFechamentoConsumo"("fechamentoId", "produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipacaoConsumoAnimal_fechamentoId_animalId_key" ON "pecuaria"."ParticipacaoConsumoAnimal"("fechamentoId", "animalId");

-- CreateIndex
CREATE UNIQUE INDEX "VinculoImportacaoPecuaria_bancoOrigem_tabelaOrigem_chaveOri_key" ON "pecuaria"."VinculoImportacaoPecuaria"("bancoOrigem", "tabelaOrigem", "chaveOrigem");

-- AddForeignKey
ALTER TABLE "pecuaria"."Lote" ADD CONSTRAINT "Lote_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."Pesagem" ADD CONSTRAINT "Pesagem_requisicaoId_fkey" FOREIGN KEY ("requisicaoId") REFERENCES "pecuaria"."RequisicaoPecuaria"("chave") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AuditoriaPecuaria" ADD CONSTRAINT "AuditoriaPecuaria_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AuditoriaPecuaria" ADD CONSTRAINT "AuditoriaPecuaria_requisicaoId_fkey" FOREIGN KEY ("requisicaoId") REFERENCES "pecuaria"."RequisicaoPecuaria"("chave") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartidaProduto" ADD CONSTRAINT "PartidaProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlocacaoPartidaEstoque" ADD CONSTRAINT "AlocacaoPartidaEstoque_movimentoEstoqueId_fkey" FOREIGN KEY ("movimentoEstoqueId") REFERENCES "MovimentoEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlocacaoPartidaEstoque" ADD CONSTRAINT "AlocacaoPartidaEstoque_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "PartidaProduto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."PerfilSanitarioProduto" ADD CONSTRAINT "PerfilSanitarioProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."PerfilNutricionalProduto" ADD CONSTRAINT "PerfilNutricionalProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."Doenca" ADD CONSTRAINT "Doenca_motivoBaixaSugeridoId_fkey" FOREIGN KEY ("motivoBaixaSugeridoId") REFERENCES "pecuaria"."MotivoBaixa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."OcorrenciaSanitaria" ADD CONSTRAINT "OcorrenciaSanitaria_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."OcorrenciaSanitaria" ADD CONSTRAINT "OcorrenciaSanitaria_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."OcorrenciaSanitaria" ADD CONSTRAINT "OcorrenciaSanitaria_doencaId_fkey" FOREIGN KEY ("doencaId") REFERENCES "pecuaria"."Doenca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AplicacaoProduto" ADD CONSTRAINT "AplicacaoProduto_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AplicacaoProduto" ADD CONSTRAINT "AplicacaoProduto_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AplicacaoProduto" ADD CONSTRAINT "AplicacaoProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AplicacaoProduto" ADD CONSTRAINT "AplicacaoProduto_ocorrenciaId_fkey" FOREIGN KEY ("ocorrenciaId") REFERENCES "pecuaria"."OcorrenciaSanitaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AplicacaoProduto" ADD CONSTRAINT "AplicacaoProduto_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "pecuaria"."TarefaSanitaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AplicacaoProduto" ADD CONSTRAINT "AplicacaoProduto_movimentoEstoqueId_fkey" FOREIGN KEY ("movimentoEstoqueId") REFERENCES "MovimentoEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AplicacaoProduto" ADD CONSTRAINT "AplicacaoProduto_itemCompraDiretaId_fkey" FOREIGN KEY ("itemCompraDiretaId") REFERENCES "ItemOperacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AplicacaoProduto" ADD CONSTRAINT "AplicacaoProduto_operacaoServicoId_fkey" FOREIGN KEY ("operacaoServicoId") REFERENCES "Operacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."EtapaProtocoloSanitario" ADD CONSTRAINT "EtapaProtocoloSanitario_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES "pecuaria"."ProtocoloSanitario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."EtapaProtocoloSanitario" ADD CONSTRAINT "EtapaProtocoloSanitario_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."EtapaProtocoloSanitario" ADD CONSTRAINT "EtapaProtocoloSanitario_tipoExameId_fkey" FOREIGN KEY ("tipoExameId") REFERENCES "pecuaria"."TipoExame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ExecucaoProtocoloSanitario" ADD CONSTRAINT "ExecucaoProtocoloSanitario_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES "pecuaria"."ProtocoloSanitario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ExecucaoProtocoloSanitario" ADD CONSTRAINT "ExecucaoProtocoloSanitario_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ExecucaoProtocoloSanitario" ADD CONSTRAINT "ExecucaoProtocoloSanitario_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ExecucaoProtocoloSanitario" ADD CONSTRAINT "ExecucaoProtocoloSanitario_ocorrenciaId_fkey" FOREIGN KEY ("ocorrenciaId") REFERENCES "pecuaria"."OcorrenciaSanitaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ExecucaoProtocoloSanitario" ADD CONSTRAINT "ExecucaoProtocoloSanitario_operacaoServicoId_fkey" FOREIGN KEY ("operacaoServicoId") REFERENCES "Operacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."TarefaSanitaria" ADD CONSTRAINT "TarefaSanitaria_execucaoId_fkey" FOREIGN KEY ("execucaoId") REFERENCES "pecuaria"."ExecucaoProtocoloSanitario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."TarefaSanitaria" ADD CONSTRAINT "TarefaSanitaria_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "pecuaria"."EtapaProtocoloSanitario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ExameAnimal" ADD CONSTRAINT "ExameAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ExameAnimal" ADD CONSTRAINT "ExameAnimal_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ExameAnimal" ADD CONSTRAINT "ExameAnimal_tipoExameId_fkey" FOREIGN KEY ("tipoExameId") REFERENCES "pecuaria"."TipoExame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ExameAnimal" ADD CONSTRAINT "ExameAnimal_ocorrenciaId_fkey" FOREIGN KEY ("ocorrenciaId") REFERENCES "pecuaria"."OcorrenciaSanitaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ExameAnimal" ADD CONSTRAINT "ExameAnimal_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "pecuaria"."TarefaSanitaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ExameAnimal" ADD CONSTRAINT "ExameAnimal_operacaoServicoId_fkey" FOREIGN KEY ("operacaoServicoId") REFERENCES "Operacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ManejoAnimal" ADD CONSTRAINT "ManejoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ManejoAnimal" ADD CONSTRAINT "ManejoAnimal_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ManejoAnimal" ADD CONSTRAINT "ManejoAnimal_pesagemId_fkey" FOREIGN KEY ("pesagemId") REFERENCES "pecuaria"."Pesagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ItemDieta" ADD CONSTRAINT "ItemDieta_dietaId_fkey" FOREIGN KEY ("dietaId") REFERENCES "pecuaria"."Dieta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ItemDieta" ADD CONSTRAINT "ItemDieta_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."VigenciaDietaLote" ADD CONSTRAINT "VigenciaDietaLote_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "pecuaria"."Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."VigenciaDietaLote" ADD CONSTRAINT "VigenciaDietaLote_dietaId_fkey" FOREIGN KEY ("dietaId") REFERENCES "pecuaria"."Dieta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."FechamentoConsumo" ADD CONSTRAINT "FechamentoConsumo_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "pecuaria"."Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."FechamentoConsumo" ADD CONSTRAINT "FechamentoConsumo_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."FechamentoConsumo" ADD CONSTRAINT "FechamentoConsumo_vigenciaId_fkey" FOREIGN KEY ("vigenciaId") REFERENCES "pecuaria"."VigenciaDietaLote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."FechamentoConsumo" ADD CONSTRAINT "FechamentoConsumo_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ItemFechamentoConsumo" ADD CONSTRAINT "ItemFechamentoConsumo_fechamentoId_fkey" FOREIGN KEY ("fechamentoId") REFERENCES "pecuaria"."FechamentoConsumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ItemFechamentoConsumo" ADD CONSTRAINT "ItemFechamentoConsumo_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ItemFechamentoConsumo" ADD CONSTRAINT "ItemFechamentoConsumo_movimentoEstoqueId_fkey" FOREIGN KEY ("movimentoEstoqueId") REFERENCES "MovimentoEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ParticipacaoConsumoAnimal" ADD CONSTRAINT "ParticipacaoConsumoAnimal_fechamentoId_fkey" FOREIGN KEY ("fechamentoId") REFERENCES "pecuaria"."FechamentoConsumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ParticipacaoConsumoAnimal" ADD CONSTRAINT "ParticipacaoConsumoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."RequisicaoPecuaria" ADD CONSTRAINT "RequisicaoPecuaria_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."RequisicaoPecuaria" ADD CONSTRAINT "RequisicaoPecuaria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Invariantes que não cabem no schema Prisma.
ALTER TABLE "pecuaria"."PerfilSanitarioProduto"
  ADD CONSTRAINT "PerfilSanitarioProduto_carencias_check"
  CHECK (("carenciaLeiteHoras" IS NULL OR "carenciaLeiteHoras" >= 0)
     AND ("carenciaCarneHoras" IS NULL OR "carenciaCarneHoras" >= 0));
ALTER TABLE "pecuaria"."PerfilNutricionalProduto"
  ADD CONSTRAINT "PerfilNutricionalProduto_ms_check"
  CHECK ("materiaSecaPercentual" IS NULL OR "materiaSecaPercentual" BETWEEN 0 AND 100);
ALTER TABLE "pecuaria"."AplicacaoProduto"
  ADD CONSTRAINT "AplicacaoProduto_origem_check"
  CHECK (
    ("origemInsumo" = 'BAIXA_ESTOQUE' AND "produtoId" IS NOT NULL AND "movimentoEstoqueId" IS NOT NULL AND "itemCompraDiretaId" IS NULL)
    OR ("origemInsumo" = 'COMPRA_CONSUMO_DIRETO' AND "produtoId" IS NOT NULL AND "itemCompraDiretaId" IS NOT NULL AND "movimentoEstoqueId" IS NULL)
    OR ("origemInsumo" = 'INCLUSO_SERVICO' AND "operacaoServicoId" IS NOT NULL AND "itemCompraDiretaId" IS NULL AND "movimentoEstoqueId" IS NULL)
    OR ("origemInsumo" = 'SEM_ORIGEM_JUSTIFICADA' AND length(trim(coalesce("justificativaSemOrigem", ''))) > 0 AND "itemCompraDiretaId" IS NULL AND "movimentoEstoqueId" IS NULL)
    OR ("origemInsumo" = 'HISTORICO_IMPORTADO' AND "itemCompraDiretaId" IS NULL AND "movimentoEstoqueId" IS NULL)
  );
ALTER TABLE "pecuaria"."ItemDieta"
  ADD CONSTRAINT "ItemDieta_quantidade_check" CHECK ("quantidadeCabecaDia" > 0);
ALTER TABLE "pecuaria"."VigenciaDietaLote"
  ADD CONSTRAINT "VigenciaDietaLote_periodo_check" CHECK ("ate" IS NULL OR "ate" > "desde");
ALTER TABLE "pecuaria"."FechamentoConsumo"
  ADD CONSTRAINT "FechamentoConsumo_periodo_check" CHECK ("fim" >= "inicio" AND "animalDias" > 0);
ALTER TABLE "pecuaria"."ParticipacaoConsumoAnimal"
  ADD CONSTRAINT "ParticipacaoConsumoAnimal_dias_check" CHECK ("dias" > 0);
ALTER TABLE "pecuaria"."ManejoAnimal"
  ADD CONSTRAINT "ManejoAnimal_tipo_check" CHECK ("tipo" IN ('DESMAMA', 'CASTRACAO'));
CREATE UNIQUE INDEX "ManejoAnimal_unico_valido" ON "pecuaria"."ManejoAnimal" ("animalId", "tipo") WHERE "status" = 'VALIDO';
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "pecuaria"."VigenciaDietaLote"
  ADD CONSTRAINT "VigenciaDietaLote_sem_sobreposicao"
  EXCLUDE USING gist ("loteId" WITH =, daterange("desde", "ate", '[)') WITH &&);
ALTER TABLE "pecuaria"."FechamentoConsumo"
  ADD CONSTRAINT "FechamentoConsumo_sem_sobreposicao"
  EXCLUDE USING gist ("loteId" WITH =, daterange("inicio", "fim" + 1, '[)') WITH &&) WHERE ("status" = 'CONFIRMADO');

-- A conferência diferida permite criar o movimento e suas alocações na mesma
-- transação, mas impede qualquer writer (inclusive financeiro/agricultura antigo)
-- de confirmar um produto rastreado sem cobrir exatamente a quantidade física.
CREATE FUNCTION "conferir_alocacao_partida_v3"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  movimento_id text;
  movimento record;
  soma numeric;
BEGIN
  IF TG_TABLE_NAME = 'MovimentoEstoque' THEN
    movimento_id := NEW."id";
  ELSIF TG_OP = 'DELETE' THEN
    movimento_id := OLD."movimentoEstoqueId";
  ELSE
    movimento_id := NEW."movimentoEstoqueId";
  END IF;
  SELECT m."id", m."produtoId", m."quantidade", p."rastrearPartidas"
    INTO movimento FROM "MovimentoEstoque" m JOIN "Produto" p ON p."id" = m."produtoId"
    WHERE m."id" = movimento_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF EXISTS (
    SELECT 1 FROM "AlocacaoPartidaEstoque" a JOIN "PartidaProduto" pp ON pp."id" = a."partidaId"
    WHERE a."movimentoEstoqueId" = movimento_id AND pp."produtoId" <> movimento."produtoId"
  ) THEN RAISE EXCEPTION 'partida de outro produto no movimento %', movimento_id USING ERRCODE = '23514'; END IF;
  SELECT coalesce(sum(a."quantidade"), 0) INTO soma
    FROM "AlocacaoPartidaEstoque" a WHERE a."movimentoEstoqueId" = movimento_id;
  IF movimento."rastrearPartidas" AND soma <> movimento."quantidade" THEN
    RAISE EXCEPTION 'partidas do movimento % somam %, esperado %', movimento_id, soma, movimento."quantidade" USING ERRCODE = '23514';
  END IF;
  IF NOT movimento."rastrearPartidas" AND soma <> 0 THEN
    RAISE EXCEPTION 'produto sem rastreio não pode ter partida no movimento %', movimento_id USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "MovimentoEstoque_partidas_v3" AFTER INSERT OR UPDATE ON "MovimentoEstoque"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "conferir_alocacao_partida_v3"();
CREATE CONSTRAINT TRIGGER "AlocacaoPartidaEstoque_partidas_v3" AFTER INSERT OR UPDATE OR DELETE ON "AlocacaoPartidaEstoque"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "conferir_alocacao_partida_v3"();
