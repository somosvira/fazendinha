-- CreateEnum
CREATE TYPE "pecuaria"."TipoMaterialGenetico" AS ENUM ('SEMEN', 'EMBRIAO');

-- CreateEnum
CREATE TYPE "pecuaria"."TipoSemen" AS ENUM ('CONVENCIONAL', 'SEXADO_FEMEA', 'SEXADO_MACHO');

-- AlterTable
ALTER TABLE "pecuaria"."Animal" ADD COLUMN     "maeExternaId" TEXT,
ADD COLUMN     "maeId" TEXT,
ADD COLUMN     "paiExternoId" TEXT,
ADD COLUMN     "paiId" TEXT;

-- AlterTable
ALTER TABLE "Categoria" ADD COLUMN     "usoGenetico" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "pecuaria"."GenitorExterno" (
    "id" TEXT NOT NULL,
    "ideagriId" INTEGER,
    "sexo" "pecuaria"."SexoBovino" NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT,
    "fornecedor" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenitorExterno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."ComposicaoGenitorExterno" (
    "id" TEXT NOT NULL,
    "genitorId" TEXT NOT NULL,
    "racaId" TEXT NOT NULL,
    "fracao64" INTEGER NOT NULL,

    CONSTRAINT "ComposicaoGenitorExterno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecuaria"."MaterialGenetico" (
    "id" TEXT NOT NULL,
    "tipo" "pecuaria"."TipoMaterialGenetico" NOT NULL,
    "tipoSemen" "pecuaria"."TipoSemen",
    "touroId" TEXT,
    "touroExternoId" TEXT,
    "doadoraId" TEXT,
    "doadoraExternaId" TEXT,
    "produtoId" TEXT NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialGenetico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GenitorExterno_ideagriId_key" ON "pecuaria"."GenitorExterno"("ideagriId");

-- CreateIndex
CREATE INDEX "GenitorExterno_sexo_nome_idx" ON "pecuaria"."GenitorExterno"("sexo", "nome");

-- CreateIndex
CREATE INDEX "ComposicaoGenitorExterno_racaId_idx" ON "pecuaria"."ComposicaoGenitorExterno"("racaId");

-- CreateIndex
CREATE UNIQUE INDEX "ComposicaoGenitorExterno_genitorId_racaId_key" ON "pecuaria"."ComposicaoGenitorExterno"("genitorId", "racaId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialGenetico_produtoId_key" ON "pecuaria"."MaterialGenetico"("produtoId");

-- CreateIndex
CREATE INDEX "MaterialGenetico_touroId_idx" ON "pecuaria"."MaterialGenetico"("touroId");

-- CreateIndex
CREATE INDEX "MaterialGenetico_touroExternoId_idx" ON "pecuaria"."MaterialGenetico"("touroExternoId");

-- CreateIndex
CREATE INDEX "MaterialGenetico_doadoraId_idx" ON "pecuaria"."MaterialGenetico"("doadoraId");

-- CreateIndex
CREATE INDEX "MaterialGenetico_doadoraExternaId_idx" ON "pecuaria"."MaterialGenetico"("doadoraExternaId");

-- CreateIndex
CREATE INDEX "Animal_maeId_idx" ON "pecuaria"."Animal"("maeId");

-- CreateIndex
CREATE INDEX "Animal_paiId_idx" ON "pecuaria"."Animal"("paiId");

-- CreateIndex
CREATE INDEX "Animal_maeExternaId_idx" ON "pecuaria"."Animal"("maeExternaId");

-- CreateIndex
CREATE INDEX "Animal_paiExternoId_idx" ON "pecuaria"."Animal"("paiExternoId");

-- AddForeignKey
ALTER TABLE "pecuaria"."Animal" ADD CONSTRAINT "Animal_maeId_fkey" FOREIGN KEY ("maeId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."Animal" ADD CONSTRAINT "Animal_paiId_fkey" FOREIGN KEY ("paiId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."Animal" ADD CONSTRAINT "Animal_maeExternaId_fkey" FOREIGN KEY ("maeExternaId") REFERENCES "pecuaria"."GenitorExterno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."Animal" ADD CONSTRAINT "Animal_paiExternoId_fkey" FOREIGN KEY ("paiExternoId") REFERENCES "pecuaria"."GenitorExterno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."GenitorExterno" ADD CONSTRAINT "GenitorExterno_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ComposicaoGenitorExterno" ADD CONSTRAINT "ComposicaoGenitorExterno_genitorId_fkey" FOREIGN KEY ("genitorId") REFERENCES "pecuaria"."GenitorExterno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."ComposicaoGenitorExterno" ADD CONSTRAINT "ComposicaoGenitorExterno_racaId_fkey" FOREIGN KEY ("racaId") REFERENCES "pecuaria"."Raca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MaterialGenetico" ADD CONSTRAINT "MaterialGenetico_touroId_fkey" FOREIGN KEY ("touroId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MaterialGenetico" ADD CONSTRAINT "MaterialGenetico_touroExternoId_fkey" FOREIGN KEY ("touroExternoId") REFERENCES "pecuaria"."GenitorExterno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MaterialGenetico" ADD CONSTRAINT "MaterialGenetico_doadoraId_fkey" FOREIGN KEY ("doadoraId") REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MaterialGenetico" ADD CONSTRAINT "MaterialGenetico_doadoraExternaId_fkey" FOREIGN KEY ("doadoraExternaId") REFERENCES "pecuaria"."GenitorExterno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MaterialGenetico" ADD CONSTRAINT "MaterialGenetico_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecuaria"."MaterialGenetico" ADD CONSTRAINT "MaterialGenetico_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Escrito à mão: regras que o Prisma não expressa ─────────────────────────────
-- Filiação: cada lado aponta para um animal nosso OU para um genitor externo, nunca os dois;
-- um animal não é genitor de si mesmo. Sexo e ciclo mais longo são checados na aplicação.
ALTER TABLE "pecuaria"."Animal" ADD CONSTRAINT "Animal_mae_unica_chk" CHECK ("maeId" IS NULL OR "maeExternaId" IS NULL);
ALTER TABLE "pecuaria"."Animal" ADD CONSTRAINT "Animal_pai_unico_chk" CHECK ("paiId" IS NULL OR "paiExternoId" IS NULL);
ALTER TABLE "pecuaria"."Animal" ADD CONSTRAINT "Animal_mae_nao_si_chk" CHECK ("maeId" IS NULL OR "maeId" <> "id");
ALTER TABLE "pecuaria"."Animal" ADD CONSTRAINT "Animal_pai_nao_si_chk" CHECK ("paiId" IS NULL OR "paiId" <> "id");

-- Material genético: exatamente um touro; doadora só (e sempre) no embrião; tipo de sêmen só no sêmen.
ALTER TABLE "pecuaria"."MaterialGenetico" ADD CONSTRAINT "MaterialGenetico_um_touro_chk"
  CHECK (("touroId" IS NULL) <> ("touroExternoId" IS NULL));
ALTER TABLE "pecuaria"."MaterialGenetico" ADD CONSTRAINT "MaterialGenetico_doadora_chk"
  CHECK (
    ("tipo" = 'EMBRIAO' AND ("doadoraId" IS NULL) <> ("doadoraExternaId" IS NULL))
    OR ("tipo" = 'SEMEN' AND "doadoraId" IS NULL AND "doadoraExternaId" IS NULL)
  );
ALTER TABLE "pecuaria"."MaterialGenetico" ADD CONSTRAINT "MaterialGenetico_tipo_semen_chk"
  CHECK ("tipo" = 'SEMEN' OR "tipoSemen" IS NULL);

-- Composição do genitor externo: fração de 1 a 64 (soma ≤ 64 checada na aplicação).
ALTER TABLE "pecuaria"."ComposicaoGenitorExterno" ADD CONSTRAINT "ComposicaoGenitorExterno_fracao_chk"
  CHECK ("fracao64" BETWEEN 1 AND 64);
