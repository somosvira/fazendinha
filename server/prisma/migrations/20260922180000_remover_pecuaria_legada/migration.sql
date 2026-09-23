-- F9: remove o módulo legado de pecuária (rebanho + corte) do schema public.
-- A pecuária v1 (schema `pecuaria`) não é tocada. Prod não tinha uso do legado.
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

