-- Pecuária v1 (Rebanho): cria o schema "pecuaria" e remove o módulo legado de
-- rebanho leiteiro + gado de corte do schema "public" (68 tabelas), junto com os
-- vínculos que o estoque e a categoria de produto tinham com dieta e sanidade.
-- Parte gerada pelo Prisma (migrate diff a partir da baseline); o fim do arquivo
-- tem o SQL escrito à mão, que o Prisma não representa.

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
CREATE TYPE "pecuaria"."TipoBaixa" AS ENUM ('VENDA', 'ABATE', 'MORTE', 'DOACAO', 'EXTRAVIO', 'CADASTRO_INDEVIDO');

-- CreateEnum
CREATE TYPE "pecuaria"."ClasseMotivoBaixa" AS ENUM ('DESCARTE_VOLUNTARIO', 'DESCARTE_INVOLUNTARIO', 'MORTE');

-- CreateEnum
CREATE TYPE "pecuaria"."TipoPesagem" AS ENUM ('NASCIMENTO', 'ENTRADA', 'DESMAMA', 'ROTINA', 'SAIDA');

-- CreateEnum
CREATE TYPE "pecuaria"."OrigemPesagem" AS ENUM ('MANUAL', 'BALANCA');

-- CreateEnum
CREATE TYPE "pecuaria"."CriterioPartos" AS ENUM ('QUALQUER', 'SEM', 'COM');

-- CreateEnum
CREATE TYPE "pecuaria"."OrigemComposicao" AS ENUM ('INFORMADA', 'CALCULADA');

-- AlterEnum
BEGIN;
CREATE TYPE "OrigemMovimentoEstoque_new" AS ENUM ('COMPRA', 'CONSUMO_DIRETO', 'TRANSFERENCIA', 'PRODUCAO', 'DEVOLUCAO', 'BONIFICACAO', 'INVENTARIO_INICIAL', 'APLICACAO', 'PERDA', 'AJUSTE_INVENTARIO');
ALTER TABLE "MovimentoEstoque" ALTER COLUMN "origem" TYPE "OrigemMovimentoEstoque_new" USING ("origem"::text::"OrigemMovimentoEstoque_new");
ALTER TYPE "OrigemMovimentoEstoque" RENAME TO "OrigemMovimentoEstoque_old";
ALTER TYPE "OrigemMovimentoEstoque_new" RENAME TO "OrigemMovimentoEstoque";
DROP TYPE "public"."OrigemMovimentoEstoque_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "AnaliseTanque" DROP CONSTRAINT "AnaliseTanque_tanqueId_fkey";

-- DropForeignKey
ALTER TABLE "Animal" DROP CONSTRAINT "Animal_grupoId_fkey";

-- DropForeignKey
ALTER TABLE "Animal" DROP CONSTRAINT "Animal_maeId_fkey";

-- DropForeignKey
ALTER TABLE "Animal" DROP CONSTRAINT "Animal_paiId_fkey";

-- DropForeignKey
ALTER TABLE "Animal" DROP CONSTRAINT "Animal_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "Animal" DROP CONSTRAINT "Animal_racaId_fkey";

-- DropForeignKey
ALTER TABLE "AplicacaoPoolDoadora" DROP CONSTRAINT "AplicacaoPoolDoadora_grupoId_fkey";

-- DropForeignKey
ALTER TABLE "AplicacaoPoolDoadora" DROP CONSTRAINT "AplicacaoPoolDoadora_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "AplicacaoProtocoloIATF" DROP CONSTRAINT "AplicacaoProtocoloIATF_animalId_fkey";

-- DropForeignKey
ALTER TABLE "AplicacaoProtocoloIATF" DROP CONSTRAINT "AplicacaoProtocoloIATF_programacaoId_fkey";

-- DropForeignKey
ALTER TABLE "AplicacaoProtocoloIATF" DROP CONSTRAINT "AplicacaoProtocoloIATF_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "AplicacaoProtocoloIATF" DROP CONSTRAINT "AplicacaoProtocoloIATF_protocoloId_fkey";

-- DropForeignKey
ALTER TABLE "AplicacaoProtocoloSanitario" DROP CONSTRAINT "AplicacaoProtocoloSanitario_animalId_fkey";

-- DropForeignKey
ALTER TABLE "AplicacaoProtocoloSanitario" DROP CONSTRAINT "AplicacaoProtocoloSanitario_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "AplicacaoProtocoloSanitario" DROP CONSTRAINT "AplicacaoProtocoloSanitario_protocoloId_fkey";

-- DropForeignKey
ALTER TABLE "AptidaoAnimal" DROP CONSTRAINT "AptidaoAnimal_animalId_fkey";

-- DropForeignKey
ALTER TABLE "AptidaoAnimal" DROP CONSTRAINT "AptidaoAnimal_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "CentralSemen" DROP CONSTRAINT "CentralSemen_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "Coleta" DROP CONSTRAINT "Coleta_aplicacaoPoolId_fkey";

-- DropForeignKey
ALTER TABLE "Coleta" DROP CONSTRAINT "Coleta_doadoraId_fkey";

-- DropForeignKey
ALTER TABLE "Coleta" DROP CONSTRAINT "Coleta_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "ConsumoPeriodo" DROP CONSTRAINT "ConsumoPeriodo_dietaId_fkey";

-- DropForeignKey
ALTER TABLE "ConsumoPeriodo" DROP CONSTRAINT "ConsumoPeriodo_grupoId_fkey";

-- DropForeignKey
ALTER TABLE "ControleLeiteiro" DROP CONSTRAINT "ControleLeiteiro_animalId_fkey";

-- DropForeignKey
ALTER TABLE "DietaItem" DROP CONSTRAINT "DietaItem_dietaId_fkey";

-- DropForeignKey
ALTER TABLE "DietaItem" DROP CONSTRAINT "DietaItem_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "EmbriaoColeta" DROP CONSTRAINT "EmbriaoColeta_classificacaoId_fkey";

-- DropForeignKey
ALTER TABLE "EmbriaoColeta" DROP CONSTRAINT "EmbriaoColeta_fertilizacaoId_fkey";

-- DropForeignKey
ALTER TABLE "EmbriaoColeta" DROP CONSTRAINT "EmbriaoColeta_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "EstoqueSemen" DROP CONSTRAINT "EstoqueSemen_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "EstoqueSemen" DROP CONSTRAINT "EstoqueSemen_reprodutorId_fkey";

-- DropForeignKey
ALTER TABLE "EstoqueSemen" DROP CONSTRAINT "EstoqueSemen_tipoSemenId_fkey";

-- DropForeignKey
ALTER TABLE "EtapaProtocoloIATF" DROP CONSTRAINT "EtapaProtocoloIATF_protocoloId_fkey";

-- DropForeignKey
ALTER TABLE "EtapaProtocoloSanitario" DROP CONSTRAINT "EtapaProtocoloSanitario_protocoloId_fkey";

-- DropForeignKey
ALTER TABLE "EventoReprodutivo" DROP CONSTRAINT "EventoReprodutivo_animalId_fkey";

-- DropForeignKey
ALTER TABLE "EventoReprodutivo" DROP CONSTRAINT "EventoReprodutivo_criaId_fkey";

-- DropForeignKey
ALTER TABLE "EventoReprodutivo" DROP CONSTRAINT "EventoReprodutivo_doadoraId_fkey";

-- DropForeignKey
ALTER TABLE "EventoReprodutivo" DROP CONSTRAINT "EventoReprodutivo_embriaoColetaId_fkey";

-- DropForeignKey
ALTER TABLE "EventoReprodutivo" DROP CONSTRAINT "EventoReprodutivo_estoqueSemenId_fkey";

-- DropForeignKey
ALTER TABLE "EventoReprodutivo" DROP CONSTRAINT "EventoReprodutivo_resultadoGinecologicoId_fkey";

-- DropForeignKey
ALTER TABLE "EventoSanitario" DROP CONSTRAINT "EventoSanitario_animalId_fkey";

-- DropForeignKey
ALTER TABLE "EventoSanitario" DROP CONSTRAINT "EventoSanitario_movimentoEstoqueId_fkey";

-- DropForeignKey
ALTER TABLE "EventoSanitario" DROP CONSTRAINT "EventoSanitario_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "ExameQuarto" DROP CONSTRAINT "ExameQuarto_animalId_fkey";

-- DropForeignKey
ALTER TABLE "ExameQuarto" DROP CONSTRAINT "ExameQuarto_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "ExecucaoEtapaIATF" DROP CONSTRAINT "ExecucaoEtapaIATF_aplicacaoId_fkey";

-- DropForeignKey
ALTER TABLE "FertilizacaoColeta" DROP CONSTRAINT "FertilizacaoColeta_coletaId_fkey";

-- DropForeignKey
ALTER TABLE "FertilizacaoColeta" DROP CONSTRAINT "FertilizacaoColeta_estoqueSemenId_fkey";

-- DropForeignKey
ALTER TABLE "FertilizacaoColeta" DROP CONSTRAINT "FertilizacaoColeta_reprodutorId_fkey";

-- DropForeignKey
ALTER TABLE "FiltroAnimal" DROP CONSTRAINT "FiltroAnimal_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "FolhaCampo" DROP CONSTRAINT "FolhaCampo_modeloId_fkey";

-- DropForeignKey
ALTER TABLE "FolhaCampo" DROP CONSTRAINT "FolhaCampo_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "Grupo" DROP CONSTRAINT "Grupo_centroCustoId_fkey";

-- DropForeignKey
ALTER TABLE "Grupo" DROP CONSTRAINT "Grupo_dietaId_fkey";

-- DropForeignKey
ALTER TABLE "Grupo" DROP CONSTRAINT "Grupo_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "GrupoPoolDoadora" DROP CONSTRAINT "GrupoPoolDoadora_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "ItemCombinacaoMedida" DROP CONSTRAINT "ItemCombinacaoMedida_combinacaoId_fkey";

-- DropForeignKey
ALTER TABLE "ItemCombinacaoMedida" DROP CONSTRAINT "ItemCombinacaoMedida_medidaId_fkey";

-- DropForeignKey
ALTER TABLE "ItemGrupoPoolDoadora" DROP CONSTRAINT "ItemGrupoPoolDoadora_doadoraId_fkey";

-- DropForeignKey
ALTER TABLE "ItemGrupoPoolDoadora" DROP CONSTRAINT "ItemGrupoPoolDoadora_grupoId_fkey";

-- DropForeignKey
ALTER TABLE "ItemMedidaAcasalamento" DROP CONSTRAINT "ItemMedidaAcasalamento_indicadorId_fkey";

-- DropForeignKey
ALTER TABLE "ItemMedidaAcasalamento" DROP CONSTRAINT "ItemMedidaAcasalamento_medidaId_fkey";

-- DropForeignKey
ALTER TABLE "Lactacao" DROP CONSTRAINT "Lactacao_animalId_fkey";

-- DropForeignKey
ALTER TABLE "LinhaFolhaCampo" DROP CONSTRAINT "LinhaFolhaCampo_animalId_fkey";

-- DropForeignKey
ALTER TABLE "LinhaFolhaCampo" DROP CONSTRAINT "LinhaFolhaCampo_eventoGeradoId_fkey";

-- DropForeignKey
ALTER TABLE "LinhaFolhaCampo" DROP CONSTRAINT "LinhaFolhaCampo_eventoOrigemId_fkey";

-- DropForeignKey
ALTER TABLE "LinhaFolhaCampo" DROP CONSTRAINT "LinhaFolhaCampo_folhaId_fkey";

-- DropForeignKey
ALTER TABLE "LinhaPlanoAcasalamento" DROP CONSTRAINT "LinhaPlanoAcasalamento_femeaId_fkey";

-- DropForeignKey
ALTER TABLE "LinhaPlanoAcasalamento" DROP CONSTRAINT "LinhaPlanoAcasalamento_reprodutorEscolhidoId_fkey";

-- DropForeignKey
ALTER TABLE "LinhaPlanoAcasalamento" DROP CONSTRAINT "LinhaPlanoAcasalamento_versaoId_fkey";

-- DropForeignKey
ALTER TABLE "LoteCorte" DROP CONSTRAINT "LoteCorte_piqueteId_fkey";

-- DropForeignKey
ALTER TABLE "LoteCorte" DROP CONSTRAINT "LoteCorte_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "ManejoSanitario" DROP CONSTRAINT "ManejoSanitario_loteId_fkey";

-- DropForeignKey
ALTER TABLE "ManejoSanitario" DROP CONSTRAINT "ManejoSanitario_operacaoFinanceiraId_fkey";

-- DropForeignKey
ALTER TABLE "ModeloFormularioCampo" DROP CONSTRAINT "ModeloFormularioCampo_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "MovimentacaoAnimal" DROP CONSTRAINT "MovimentacaoAnimal_animalId_fkey";

-- DropForeignKey
ALTER TABLE "MovimentacaoAnimal" DROP CONSTRAINT "MovimentacaoAnimal_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "MovimentoEstoque" DROP CONSTRAINT "MovimentoEstoque_consumoPeriodoId_fkey";

-- DropForeignKey
ALTER TABLE "MovimentoEstoque" DROP CONSTRAINT "MovimentoEstoque_grupoId_fkey";

-- DropForeignKey
ALTER TABLE "OocitoColeta" DROP CONSTRAINT "OocitoColeta_coletaId_fkey";

-- DropForeignKey
ALTER TABLE "OperacaoComercial" DROP CONSTRAINT "OperacaoComercial_loteId_fkey";

-- DropForeignKey
ALTER TABLE "OperacaoComercial" DROP CONSTRAINT "OperacaoComercial_operacaoFinanceiraId_fkey";

-- DropForeignKey
ALTER TABLE "PedigreeReprodutor" DROP CONSTRAINT "PedigreeReprodutor_reprodutorId_fkey";

-- DropForeignKey
ALTER TABLE "Pesagem" DROP CONSTRAINT "Pesagem_animalId_fkey";

-- DropForeignKey
ALTER TABLE "PesagemLote" DROP CONSTRAINT "PesagemLote_loteId_fkey";

-- DropForeignKey
ALTER TABLE "Piquete" DROP CONSTRAINT "Piquete_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "PlanoAcasalamento" DROP CONSTRAINT "PlanoAcasalamento_combinacaoId_fkey";

-- DropForeignKey
ALTER TABLE "PlanoAcasalamento" DROP CONSTRAINT "PlanoAcasalamento_grupoId_fkey";

-- DropForeignKey
ALTER TABLE "PlanoAcasalamento" DROP CONSTRAINT "PlanoAcasalamento_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "PrincipioProtocoloIATF" DROP CONSTRAINT "PrincipioProtocoloIATF_protocoloId_fkey";

-- DropForeignKey
ALTER TABLE "ProducaoLote" DROP CONSTRAINT "ProducaoLote_grupoId_fkey";

-- DropForeignKey
ALTER TABLE "ProducaoLote" DROP CONSTRAINT "ProducaoLote_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "ProgramacaoIATFLote" DROP CONSTRAINT "ProgramacaoIATFLote_grupoId_fkey";

-- DropForeignKey
ALTER TABLE "ProgramacaoIATFLote" DROP CONSTRAINT "ProgramacaoIATFLote_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "ProgramacaoIATFLote" DROP CONSTRAINT "ProgramacaoIATFLote_protocoloId_fkey";

-- DropForeignKey
ALTER TABLE "ProtocoloIATF" DROP CONSTRAINT "ProtocoloIATF_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "ProtocoloSanitario" DROP CONSTRAINT "ProtocoloSanitario_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "Reprodutor" DROP CONSTRAINT "Reprodutor_centralSemenId_fkey";

-- DropForeignKey
ALTER TABLE "Reprodutor" DROP CONSTRAINT "Reprodutor_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "Reprodutor" DROP CONSTRAINT "Reprodutor_racaId_fkey";

-- DropForeignKey
ALTER TABLE "ResumoAnimal" DROP CONSTRAINT "ResumoAnimal_animalId_fkey";

-- DropForeignKey
ALTER TABLE "ResumoLote" DROP CONSTRAINT "ResumoLote_loteId_fkey";

-- DropForeignKey
ALTER TABLE "Suplementacao" DROP CONSTRAINT "Suplementacao_loteId_fkey";

-- DropForeignKey
ALTER TABLE "Tanque" DROP CONSTRAINT "Tanque_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "VacinaAgendada" DROP CONSTRAINT "VacinaAgendada_animalId_fkey";

-- DropForeignKey
ALTER TABLE "VacinaAgendada" DROP CONSTRAINT "VacinaAgendada_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "ValorCaseinaReprodutor" DROP CONSTRAINT "ValorCaseinaReprodutor_caseinaId_fkey";

-- DropForeignKey
ALTER TABLE "ValorCaseinaReprodutor" DROP CONSTRAINT "ValorCaseinaReprodutor_reprodutorId_fkey";

-- DropForeignKey
ALTER TABLE "ValorIndicadorReprodutor" DROP CONSTRAINT "ValorIndicadorReprodutor_indicadorId_fkey";

-- DropForeignKey
ALTER TABLE "ValorIndicadorReprodutor" DROP CONSTRAINT "ValorIndicadorReprodutor_reprodutorId_fkey";

-- DropForeignKey
ALTER TABLE "ValorMarcadorReprodutor" DROP CONSTRAINT "ValorMarcadorReprodutor_marcadorId_fkey";

-- DropForeignKey
ALTER TABLE "ValorMarcadorReprodutor" DROP CONSTRAINT "ValorMarcadorReprodutor_reprodutorId_fkey";

-- DropForeignKey
ALTER TABLE "VersaoPlanoAcasalamento" DROP CONSTRAINT "VersaoPlanoAcasalamento_planoId_fkey";

-- DropIndex
DROP INDEX "MovimentoEstoque_consumoPeriodoId_idx";

-- AlterTable
ALTER TABLE "Categoria" DROP COLUMN "usoNutricional",
DROP COLUMN "usoSanitario";

-- AlterTable
ALTER TABLE "MovimentoEstoque" DROP COLUMN "consumoPeriodoId",
DROP COLUMN "grupoId";

-- DropTable
DROP TABLE "AnaliseTanque";

-- DropTable
DROP TABLE "Animal";

-- DropTable
DROP TABLE "AplicacaoPoolDoadora";

-- DropTable
DROP TABLE "AplicacaoProtocoloIATF";

-- DropTable
DROP TABLE "AplicacaoProtocoloSanitario";

-- DropTable
DROP TABLE "AptidaoAnimal";

-- DropTable
DROP TABLE "Caseina";

-- DropTable
DROP TABLE "CentralSemen";

-- DropTable
DROP TABLE "Coleta";

-- DropTable
DROP TABLE "CombinacaoMedidaAcasalamento";

-- DropTable
DROP TABLE "Configuracao";

-- DropTable
DROP TABLE "ConsumoPeriodo";

-- DropTable
DROP TABLE "ControleLeiteiro";

-- DropTable
DROP TABLE "Dieta";

-- DropTable
DROP TABLE "DietaItem";

-- DropTable
DROP TABLE "EmbriaoClassificacao";

-- DropTable
DROP TABLE "EmbriaoColeta";

-- DropTable
DROP TABLE "EstoqueSemen";

-- DropTable
DROP TABLE "EtapaProtocoloIATF";

-- DropTable
DROP TABLE "EtapaProtocoloSanitario";

-- DropTable
DROP TABLE "EventoReprodutivo";

-- DropTable
DROP TABLE "EventoSanitario";

-- DropTable
DROP TABLE "ExameQuarto";

-- DropTable
DROP TABLE "ExecucaoEtapaIATF";

-- DropTable
DROP TABLE "FertilizacaoColeta";

-- DropTable
DROP TABLE "FiltroAnimal";

-- DropTable
DROP TABLE "FolhaCampo";

-- DropTable
DROP TABLE "Grupo";

-- DropTable
DROP TABLE "GrupoPoolDoadora";

-- DropTable
DROP TABLE "IndicadorGenetico";

-- DropTable
DROP TABLE "ItemCombinacaoMedida";

-- DropTable
DROP TABLE "ItemGrupoPoolDoadora";

-- DropTable
DROP TABLE "ItemMedidaAcasalamento";

-- DropTable
DROP TABLE "Lactacao";

-- DropTable
DROP TABLE "LinhaFolhaCampo";

-- DropTable
DROP TABLE "LinhaPlanoAcasalamento";

-- DropTable
DROP TABLE "LoteCorte";

-- DropTable
DROP TABLE "ManejoSanitario";

-- DropTable
DROP TABLE "MarcadorGenetico";

-- DropTable
DROP TABLE "MedidaAcasalamento";

-- DropTable
DROP TABLE "ModeloFormularioCampo";

-- DropTable
DROP TABLE "MovimentacaoAnimal";

-- DropTable
DROP TABLE "OocitoColeta";

-- DropTable
DROP TABLE "OperacaoComercial";

-- DropTable
DROP TABLE "ParametroManejo";

-- DropTable
DROP TABLE "PedigreeReprodutor";

-- DropTable
DROP TABLE "Pesagem";

-- DropTable
DROP TABLE "PesagemLote";

-- DropTable
DROP TABLE "Piquete";

-- DropTable
DROP TABLE "PlanoAcasalamento";

-- DropTable
DROP TABLE "PrincipioProtocoloIATF";

-- DropTable
DROP TABLE "ProducaoLote";

-- DropTable
DROP TABLE "ProgramacaoIATFLote";

-- DropTable
DROP TABLE "ProtocoloIATF";

-- DropTable
DROP TABLE "ProtocoloSanitario";

-- DropTable
DROP TABLE "Raca";

-- DropTable
DROP TABLE "Reprodutor";

-- DropTable
DROP TABLE "ResultadoExameGinecologico";

-- DropTable
DROP TABLE "ResumoAnimal";

-- DropTable
DROP TABLE "ResumoLote";

-- DropTable
DROP TABLE "Suplementacao";

-- DropTable
DROP TABLE "Tanque";

-- DropTable
DROP TABLE "TipoSemen";

-- DropTable
DROP TABLE "VacinaAgendada";

-- DropTable
DROP TABLE "ValorCaseinaReprodutor";

-- DropTable
DROP TABLE "ValorIndicadorReprodutor";

-- DropTable
DROP TABLE "ValorMarcadorReprodutor";

-- DropTable
DROP TABLE "VersaoPlanoAcasalamento";

-- DropEnum
DROP TYPE "CategoriaAnimal";

-- DropEnum
DROP TYPE "CategoriaLote";

-- DropEnum
DROP TYPE "EspecieAnimal";

-- DropEnum
DROP TYPE "EstadoLote";

-- DropEnum
DROP TYPE "EstadoPiquete";

-- DropEnum
DROP TYPE "FaseCiclo";

-- DropEnum
DROP TYPE "FinalidadeAnimal";

-- DropEnum
DROP TYPE "FinalidadeIATF";

-- DropEnum
DROP TYPE "MetodoPesagem";

-- DropEnum
DROP TYPE "ModoProducao";

-- DropEnum
DROP TYPE "OrigemAptidao";

-- DropEnum
DROP TYPE "QuartoMamario";

-- DropEnum
DROP TYPE "ScoreCmt";

-- DropEnum
DROP TYPE "SexoAnimal";

-- DropEnum
DROP TYPE "StatusAnimal";

-- DropEnum
DROP TYPE "StatusExecucaoEtapaIATF";

-- DropEnum
DROP TYPE "StatusFolhaCampo";

-- DropEnum
DROP TYPE "StatusLinhaFolha";

-- DropEnum
DROP TYPE "StatusReprodutivo";

-- DropEnum
DROP TYPE "TipoComercial";

-- DropEnum
DROP TYPE "TipoEventoReprodutivo";

-- DropEnum
DROP TYPE "TipoEventoSanitario";

-- DropEnum
DROP TYPE "TipoMovimentacaoAnimal";

-- DropEnum
DROP TYPE "TipoSanitario";

-- DropEnum
DROP TYPE "TipoSuplemento";

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
CREATE TABLE "pecuaria"."CategoriaAnimal" (
    "id" TEXT NOT NULL,
    "ideagriId" INTEGER,
    "chavePadrao" TEXT,
    "nome" TEXT NOT NULL,
    "sexo" "pecuaria"."SexoBovino" NOT NULL,
    "automatica" BOOLEAN NOT NULL DEFAULT true,
    "idadeMinMeses" INTEGER,
    "idadeMaxMeses" INTEGER,
    "partos" "pecuaria"."CriterioPartos" NOT NULL DEFAULT 'QUALQUER',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoriaAnimal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."CategoriaManualAnimal" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "desde" DATE NOT NULL,
    "ate" DATE,
    "motivo" TEXT NOT NULL,
    "motivoEncerramento" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoriaManualAnimal_pkey" PRIMARY KEY ("id")
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
    "movimentacaoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalizacaoAnimal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."Movimentacao" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "propriedadeDestinoId" INTEGER NOT NULL,
    "loteDestinoId" TEXT,
    "motivo" TEXT,
    "quantidade" INTEGER NOT NULL,
    "desfeitaEm" TIMESTAMP(3),
    "desfeitaMotivo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Movimentacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."MovimentacaoAnimal" (
    "id" TEXT NOT NULL,
    "movimentacaoId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "origemPropriedadeId" INTEGER,
    "origemLoteId" TEXT,
    "localizacaoId" TEXT,
    "desfeitoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentacaoAnimal_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "pecuaria"."BaixaAnimal" (
    "id" TEXT NOT NULL,
    "ideagriId" INTEGER,
    "animalId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "tipo" "pecuaria"."TipoBaixa" NOT NULL,
    "motivoId" TEXT,
    "observacao" TEXT,
    "estornadaEm" TIMESTAMP(3),
    "estornoMotivo" TEXT,
    "localizacaoFechadaId" TEXT,
    "destinoFechadoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BaixaAnimal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."MotivoBaixa" (
    "id" TEXT NOT NULL,
    "ideagriId" INTEGER,
    "nome" TEXT NOT NULL,
    "classe" "pecuaria"."ClasseMotivoBaixa" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MotivoBaixa_pkey" PRIMARY KEY ("id")
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
    "animalId" TEXT,
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
CREATE UNIQUE INDEX "CategoriaAnimal_ideagriId_key" ON "pecuaria"."CategoriaAnimal"("ideagriId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaAnimal_chavePadrao_key" ON "pecuaria"."CategoriaAnimal"("chavePadrao");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaAnimal_sexo_nome_key" ON "pecuaria"."CategoriaAnimal"("sexo", "nome");

-- CreateIndex
CREATE INDEX "CategoriaManualAnimal_animalId_ate_idx" ON "pecuaria"."CategoriaManualAnimal"("animalId", "ate");

-- CreateIndex
CREATE INDEX "CategoriaManualAnimal_categoriaId_ate_idx" ON "pecuaria"."CategoriaManualAnimal"("categoriaId", "ate");

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
CREATE INDEX "Movimentacao_loteDestinoId_data_idx" ON "pecuaria"."Movimentacao"("loteDestinoId", "data");

-- CreateIndex
CREATE INDEX "Movimentacao_propriedadeDestinoId_data_idx" ON "pecuaria"."Movimentacao"("propriedadeDestinoId", "data");

-- CreateIndex
CREATE INDEX "Movimentacao_data_idx" ON "pecuaria"."Movimentacao"("data");

-- CreateIndex
CREATE UNIQUE INDEX "MovimentacaoAnimal_localizacaoId_key" ON "pecuaria"."MovimentacaoAnimal"("localizacaoId");

-- CreateIndex
CREATE INDEX "MovimentacaoAnimal_animalId_idx" ON "pecuaria"."MovimentacaoAnimal"("animalId");

-- CreateIndex
CREATE INDEX "MovimentacaoAnimal_origemLoteId_idx" ON "pecuaria"."MovimentacaoAnimal"("origemLoteId");

-- CreateIndex
CREATE INDEX "MovimentacaoAnimal_origemPropriedadeId_idx" ON "pecuaria"."MovimentacaoAnimal"("origemPropriedadeId");

-- CreateIndex
CREATE UNIQUE INDEX "MovimentacaoAnimal_movimentacaoId_animalId_key" ON "pecuaria"."MovimentacaoAnimal"("movimentacaoId", "animalId");

-- CreateIndex
CREATE INDEX "DestinoAnimal_animalId_ate_idx" ON "pecuaria"."DestinoAnimal"("animalId", "ate");

-- CreateIndex
CREATE UNIQUE INDEX "BaixaAnimal_ideagriId_key" ON "pecuaria"."BaixaAnimal"("ideagriId");

-- CreateIndex
CREATE INDEX "BaixaAnimal_animalId_idx" ON "pecuaria"."BaixaAnimal"("animalId");

-- CreateIndex
CREATE INDEX "BaixaAnimal_data_idx" ON "pecuaria"."BaixaAnimal"("data");

-- CreateIndex
CREATE INDEX "BaixaAnimal_localizacaoFechadaId_idx" ON "pecuaria"."BaixaAnimal"("localizacaoFechadaId");

-- CreateIndex
CREATE INDEX "BaixaAnimal_destinoFechadoId_idx" ON "pecuaria"."BaixaAnimal"("destinoFechadoId");

-- CreateIndex
CREATE UNIQUE INDEX "MotivoBaixa_ideagriId_key" ON "pecuaria"."MotivoBaixa"("ideagriId");

-- CreateIndex
CREATE UNIQUE INDEX "Pesagem_ideagriId_key" ON "pecuaria"."Pesagem"("ideagriId");

-- CreateIndex
CREATE INDEX "Pesagem_animalId_data_idx" ON "pecuaria"."Pesagem"("animalId", "data");

-- CreateIndex
CREATE INDEX "AuditoriaPecuaria_entidade_entidadeId_idx" ON "pecuaria"."AuditoriaPecuaria"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "AuditoriaPecuaria_animalId_em_idx" ON "pecuaria"."AuditoriaPecuaria"("animalId", "em");

-- CreateIndex
CREATE INDEX "AuditoriaPecuaria_em_idx" ON "pecuaria"."AuditoriaPecuaria"("em");

-- AddForeignKey
ALTER TABLE "pecuaria"."Animal" ADD CONSTRAINT "Animal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."CategoriaAnimal" ADD CONSTRAINT "CategoriaAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."CategoriaManualAnimal" ADD CONSTRAINT "CategoriaManualAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."CategoriaManualAnimal" ADD CONSTRAINT "CategoriaManualAnimal_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "pecuaria"."CategoriaAnimal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."CategoriaManualAnimal" ADD CONSTRAINT "CategoriaManualAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "pecuaria"."LocalizacaoAnimal" ADD CONSTRAINT "LocalizacaoAnimal_movimentacaoId_fkey" FOREIGN KEY ("movimentacaoId") REFERENCES "pecuaria"."Movimentacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."LocalizacaoAnimal" ADD CONSTRAINT "LocalizacaoAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."Movimentacao" ADD CONSTRAINT "Movimentacao_propriedadeDestinoId_fkey" FOREIGN KEY ("propriedadeDestinoId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."Movimentacao" ADD CONSTRAINT "Movimentacao_loteDestinoId_fkey" FOREIGN KEY ("loteDestinoId") REFERENCES "pecuaria"."Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."Movimentacao" ADD CONSTRAINT "Movimentacao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MovimentacaoAnimal" ADD CONSTRAINT "MovimentacaoAnimal_movimentacaoId_fkey" FOREIGN KEY ("movimentacaoId") REFERENCES "pecuaria"."Movimentacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MovimentacaoAnimal" ADD CONSTRAINT "MovimentacaoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MovimentacaoAnimal" ADD CONSTRAINT "MovimentacaoAnimal_origemPropriedadeId_fkey" FOREIGN KEY ("origemPropriedadeId") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MovimentacaoAnimal" ADD CONSTRAINT "MovimentacaoAnimal_origemLoteId_fkey" FOREIGN KEY ("origemLoteId") REFERENCES "pecuaria"."Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MovimentacaoAnimal" ADD CONSTRAINT "MovimentacaoAnimal_localizacaoId_fkey" FOREIGN KEY ("localizacaoId") REFERENCES "pecuaria"."LocalizacaoAnimal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."DestinoAnimal" ADD CONSTRAINT "DestinoAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."DestinoAnimal" ADD CONSTRAINT "DestinoAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."BaixaAnimal" ADD CONSTRAINT "BaixaAnimal_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."BaixaAnimal" ADD CONSTRAINT "BaixaAnimal_motivoId_fkey" FOREIGN KEY ("motivoId") REFERENCES "pecuaria"."MotivoBaixa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."BaixaAnimal" ADD CONSTRAINT "BaixaAnimal_localizacaoFechadaId_fkey" FOREIGN KEY ("localizacaoFechadaId") REFERENCES "pecuaria"."LocalizacaoAnimal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."BaixaAnimal" ADD CONSTRAINT "BaixaAnimal_destinoFechadoId_fkey" FOREIGN KEY ("destinoFechadoId") REFERENCES "pecuaria"."DestinoAnimal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."BaixaAnimal" ADD CONSTRAINT "BaixaAnimal_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MotivoBaixa" ADD CONSTRAINT "MotivoBaixa_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."Pesagem" ADD CONSTRAINT "Pesagem_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."Pesagem" ADD CONSTRAINT "Pesagem_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AuditoriaPecuaria" ADD CONSTRAINT "AuditoriaPecuaria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."AuditoriaPecuaria" ADD CONSTRAINT "AuditoriaPecuaria_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Escrito à mão (o Prisma não representa estes itens; `db push` os apagaria).
-- ---------------------------------------------------------------------------

-- Índices únicos parciais: no máximo uma linha aberta por animal em cada
-- histórico e no máximo uma baixa não estornada.
CREATE UNIQUE INDEX "LocalizacaoAnimal_animalId_aberta_key" ON "pecuaria"."LocalizacaoAnimal"("animalId") WHERE "ate" IS NULL;
CREATE UNIQUE INDEX "DestinoAnimal_animalId_aberto_key" ON "pecuaria"."DestinoAnimal"("animalId") WHERE "ate" IS NULL;
CREATE UNIQUE INDEX "CategoriaManualAnimal_animalId_aberta_key" ON "pecuaria"."CategoriaManualAnimal"("animalId") WHERE "ate" IS NULL;
CREATE UNIQUE INDEX "BaixaAnimal_animalId_ativa_key" ON "pecuaria"."BaixaAnimal"("animalId") WHERE "estornadaEm" IS NULL;

-- Padrões de fábrica: as categorias do IDEAGRI (CATEGORIA, códigos 1–7). Mesmos valores de
-- CATEGORIAS_PADRAO em services/pecuaria/rebanho/categorias.ts ("Restaurar padrões").
INSERT INTO "pecuaria"."CategoriaAnimal" ("id", "ideagriId", "chavePadrao", "nome", "sexo", "automatica", "idadeMinMeses", "idadeMaxMeses", "partos", "ordem", "atualizadoEm") VALUES
  (gen_random_uuid()::text, 7, 'F_VACA',           'Vaca',           'F', true,  NULL, NULL, 'COM',      10, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 5, 'F_EM_CRESCIMENTO', 'Em crescimento', 'F', true,  NULL, 12,   'SEM',      20, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 6, 'F_NOVILHA',        'Novilha',        'F', true,  12,   NULL, 'SEM',      30, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 1, 'M_EM_CRESCIMENTO', 'Em crescimento', 'M', true,  NULL, NULL, 'QUALQUER', 40, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 2, 'M_REPRODUTOR',     'Reprodutor',     'M', false, NULL, NULL, 'QUALQUER', 50, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 3, 'M_BOI_CARREIRO',   'Boi carreiro',   'M', false, NULL, NULL, 'QUALQUER', 60, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 4, 'M_RUFIAO',         'Rufião',         'M', false, NULL, NULL, 'QUALQUER', 70, CURRENT_TIMESTAMP);
