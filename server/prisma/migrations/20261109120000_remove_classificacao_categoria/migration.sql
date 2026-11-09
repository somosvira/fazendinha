-- A divisão entre receita, custeio e investimento passa a ser dada pelo grupo
-- da categoria. A classificação deixa de existir no cadastro e nos lançamentos.
ALTER TABLE "public"."Categoria" DROP COLUMN "classificacao";
ALTER TABLE "public"."Operacao" DROP COLUMN "classificacao";
ALTER TABLE "public"."ItemOperacao" DROP COLUMN "classificacao";
DROP TYPE "public"."ClassificacaoCategoria";
