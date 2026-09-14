-- DropForeignKey
ALTER TABLE "Categoria" DROP CONSTRAINT "Categoria_grupoCategoriaId_fkey";

-- DropIndex
DROP INDEX "Categoria_grupoCategoriaId_nome_key";

-- AlterTable
ALTER TABLE "CentroCusto" DROP COLUMN "ehInvestimento";

-- AlterTable
ALTER TABLE "Categoria" DROP COLUMN "grupoCategoriaId";

-- AlterTable
ALTER TABLE "Operacao" ADD COLUMN     "categoriaNome" TEXT,
ADD COLUMN     "classificacao" "ClassificacaoCategoria";

-- AlterTable
ALTER TABLE "ItemOperacao" ADD COLUMN     "categoriaId" INTEGER,
ADD COLUMN     "categoriaNome" TEXT,
ADD COLUMN     "classificacao" "ClassificacaoCategoria";

-- DropTable
DROP TABLE "GrupoCategoria";

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nome_key" ON "Categoria"("nome");

-- AddForeignKey
ALTER TABLE "ItemOperacao" ADD CONSTRAINT "ItemOperacao_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

