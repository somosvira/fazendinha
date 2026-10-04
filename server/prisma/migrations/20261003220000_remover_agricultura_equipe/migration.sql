-- Agricultura e equipe serão reconstruídas; financeiro, estoque e pecuária permanecem.
BEGIN;

-- DropForeignKey
ALTER TABLE "Lavoura" DROP CONSTRAINT "Lavoura_planoAdubacaoId_fkey";

-- DropForeignKey
ALTER TABLE "Lavoura" DROP CONSTRAINT "Lavoura_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "Talhao" DROP CONSTRAINT "Talhao_variedadeId_fkey";

-- DropForeignKey
ALTER TABLE "Talhao" DROP CONSTRAINT "Talhao_lavouraId_fkey";

-- DropForeignKey
ALTER TABLE "Talhao" DROP CONSTRAINT "Talhao_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "ResumoTalhao" DROP CONSTRAINT "ResumoTalhao_talhaoId_fkey";

-- DropForeignKey
ALTER TABLE "SafraTalhao" DROP CONSTRAINT "SafraTalhao_talhaoId_fkey";

-- DropForeignKey
ALTER TABLE "OperacaoAgricola" DROP CONSTRAINT "OperacaoAgricola_talhaoId_fkey";

-- DropForeignKey
ALTER TABLE "OperacaoAgricola" DROP CONSTRAINT "OperacaoAgricola_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "OperacaoAgricola" DROP CONSTRAINT "OperacaoAgricola_movimentoEstoqueId_fkey";

-- DropForeignKey
ALTER TABLE "OperacaoAgricola" DROP CONSTRAINT "OperacaoAgricola_operacaoFinanceiraId_fkey";

-- DropForeignKey
ALTER TABLE "InspecaoMIP" DROP CONSTRAINT "InspecaoMIP_talhaoId_fkey";

-- DropForeignKey
ALTER TABLE "AmostraSolo" DROP CONSTRAINT "AmostraSolo_talhaoId_fkey";

-- DropForeignKey
ALTER TABLE "AmostraFoliar" DROP CONSTRAINT "AmostraFoliar_talhaoId_fkey";

-- DropForeignKey
ALTER TABLE "PassadaColheita" DROP CONSTRAINT "PassadaColheita_talhaoId_fkey";

-- DropForeignKey
ALTER TABLE "PassadaColheita" DROP CONSTRAINT "PassadaColheita_safraId_fkey";

-- DropForeignKey
ALTER TABLE "Safra" DROP CONSTRAINT "Safra_centroCustoId_fkey";

-- DropForeignKey
ALTER TABLE "TarefaAgricola" DROP CONSTRAINT "TarefaAgricola_safraId_fkey";

-- DropForeignKey
ALTER TABLE "TarefaAgricola" DROP CONSTRAINT "TarefaAgricola_talhaoId_fkey";

-- DropForeignKey
ALTER TABLE "TarefaAgricola" DROP CONSTRAINT "TarefaAgricola_lavouraId_fkey";

-- DropForeignKey
ALTER TABLE "ApontamentoMaquina" DROP CONSTRAINT "ApontamentoMaquina_safraId_fkey";

-- DropForeignKey
ALTER TABLE "ApontamentoMaquina" DROP CONSTRAINT "ApontamentoMaquina_talhaoId_fkey";

-- DropForeignKey
ALTER TABLE "Funcionario" DROP CONSTRAINT "Funcionario_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "RegistroPonto" DROP CONSTRAINT "RegistroPonto_funcionarioId_fkey";

-- DropForeignKey
ALTER TABLE "SafraCultivo" DROP CONSTRAINT "SafraCultivo_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "AreaCultivo" DROP CONSTRAINT "AreaCultivo_safraCultivoId_fkey";

-- DropForeignKey
ALTER TABLE "LancamentoCusto" DROP CONSTRAINT "LancamentoCusto_safraCultivoId_fkey";

-- DropForeignKey
ALTER TABLE "LancamentoCusto" DROP CONSTRAINT "LancamentoCusto_areaCultivoId_fkey";

-- DropForeignKey
ALTER TABLE "LancamentoCusto" DROP CONSTRAINT "LancamentoCusto_operacaoFinanceiraId_fkey";

-- DropForeignKey
ALTER TABLE "ProducaoCultivo" DROP CONSTRAINT "ProducaoCultivo_safraCultivoId_fkey";

-- DropForeignKey
ALTER TABLE "ProducaoCultivo" DROP CONSTRAINT "ProducaoCultivo_areaCultivoId_fkey";

-- DropForeignKey
ALTER TABLE "ProducaoCultivo" DROP CONSTRAINT "ProducaoCultivo_siloId_fkey";

-- DropForeignKey
ALTER TABLE "Silo" DROP CONSTRAINT "Silo_propriedadeId_fkey";

-- DropForeignKey
ALTER TABLE "MovimentoSilo" DROP CONSTRAINT "MovimentoSilo_siloId_fkey";

-- DropForeignKey
ALTER TABLE "MovimentoSilo" DROP CONSTRAINT "MovimentoSilo_producaoCultivoId_fkey";

-- DropForeignKey
ALTER TABLE "ResumoSafraCultivo" DROP CONSTRAINT "ResumoSafraCultivo_safraCultivoId_fkey";

-- AlterTable
ALTER TABLE "Categoria" DROP COLUMN "usoAgricola";

-- AlterTable
ALTER TABLE "Produto" DROP COLUMN "usoAgricola";

-- AlterTable
ALTER TABLE "Usuario" ALTER COLUMN "areas" SET DEFAULT ARRAY['financeiro', 'pecuaria']::TEXT[];

-- DropTable
DROP TABLE "VariedadeCafe";

-- DropTable
DROP TABLE "Lavoura";

-- DropTable
DROP TABLE "PlanoAdubacao";

-- DropTable
DROP TABLE "Talhao";

-- DropTable
DROP TABLE "ResumoTalhao";

-- DropTable
DROP TABLE "SafraTalhao";

-- DropTable
DROP TABLE "OperacaoAgricola";

-- DropTable
DROP TABLE "InspecaoMIP";

-- DropTable
DROP TABLE "AmostraSolo";

-- DropTable
DROP TABLE "AmostraFoliar";

-- DropTable
DROP TABLE "PassadaColheita";

-- DropTable
DROP TABLE "Safra";

-- DropTable
DROP TABLE "TarefaAgricola";

-- DropTable
DROP TABLE "ApontamentoMaquina";

-- DropTable
DROP TABLE "Funcionario";

-- DropTable
DROP TABLE "RegistroPonto";

-- DropTable
DROP TABLE "SafraCultivo";

-- DropTable
DROP TABLE "AreaCultivo";

-- DropTable
DROP TABLE "LancamentoCusto";

-- DropTable
DROP TABLE "ProducaoCultivo";

-- DropTable
DROP TABLE "Silo";

-- DropTable
DROP TABLE "MovimentoSilo";

-- DropTable
DROP TABLE "ResumoSafraCultivo";

-- DropEnum
DROP TYPE "EstadoTalhao";

-- DropEnum
DROP TYPE "FaseFenologica";

-- DropEnum
DROP TYPE "DominioCultural";

-- DropEnum
DROP TYPE "TipoOperacao";

-- DropEnum
DROP TYPE "PragaDoenca";

-- DropEnum
DROP TYPE "MetodoColheita";

-- DropEnum
DROP TYPE "Bienalidade";

-- DropEnum
DROP TYPE "StatusTarefa";

-- DropEnum
DROP TYPE "TipoApontamento";

-- DropEnum
DROP TYPE "TipoDiaPonto";

-- DropEnum
DROP TYPE "Cultura";

-- DropEnum
DROP TYPE "TipoCustoCultivo";

-- DropEnum
DROP TYPE "TipoProducao";

-- DropEnum
DROP TYPE "UnidadeProducao";

-- DropEnum
DROP TYPE "DestinoProducao";

-- DropEnum
DROP TYPE "TipoSilo";

-- DropEnum
DROP TYPE "TipoMovimentoSilo";

-- DropEnum
DROP TYPE "OrigemMovimentoSilo";

-- Retira áreas descontinuadas sem ampliar permissões existentes.
UPDATE "Usuario" SET areas = ARRAY(
  SELECT DISTINCT CASE WHEN area IN ('rebanho', 'gado_corte') THEN 'pecuaria' ELSE area END
  FROM unnest(areas) AS area
  WHERE area IN ('financeiro', 'pecuaria', 'rebanho', 'gado_corte')
);

COMMIT;
