-- Reabrir o fechamento de consumo não apaga mais as SAIDAs de estoque por cascata:
-- elas são estornadas e o vínculo com o cabeçalho removido vira NULL.

-- DropForeignKey
ALTER TABLE "MovimentoEstoque" DROP CONSTRAINT "MovimentoEstoque_consumoPeriodoId_fkey";

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_consumoPeriodoId_fkey" FOREIGN KEY ("consumoPeriodoId") REFERENCES "ConsumoPeriodo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

