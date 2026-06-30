-- CreateEnum
CREATE TYPE "TipoInsumoPlantio" AS ENUM ('FERTILIZANTE', 'DEFENSIVO', 'HERBICIDA', 'CORRETIVO', 'BIOLOGICO', 'FOLIAR', 'MUDA', 'OUTRO');

-- AlterTable
ALTER TABLE "Produto" ADD COLUMN     "subtipoPlantio" "TipoInsumoPlantio";
