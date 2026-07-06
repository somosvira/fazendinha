-- Baixa automática de consumo de dieta (Fatia 2).
-- Adiciona origem à SAIDA de estoque, cria o cabeçalho ConsumoPeriodo (um por
-- lote+janela, idempotente) e liga as SAIDAs geradas a ele.
-- Aditivo: `origem` tem default MANUAL (backfill implícito), `consumoPeriodoId`
-- é nullable — nenhum movimento existente muda de comportamento.

CREATE TYPE "OrigemMovimentoEstoque" AS ENUM ('MANUAL', 'NUTRICAO', 'PERDA', 'AJUSTE_INVENTARIO');

ALTER TABLE "MovimentoEstoque"
    ADD COLUMN "origem" "OrigemMovimentoEstoque" NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN "consumoPeriodoId" INTEGER;

CREATE TABLE "ConsumoPeriodo" (
    "id" SERIAL NOT NULL,
    "grupoId" INTEGER NOT NULL,
    "dietaId" INTEGER,
    "dataInicio" DATE NOT NULL,
    "dataFim" DATE NOT NULL,
    "numCabecas" INTEGER NOT NULL,
    "diasBase" INTEGER NOT NULL,
    "custoTotal" DECIMAL(14,2) NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumoPeriodo_pkey" PRIMARY KEY ("id")
);

-- Idempotência: um lote não fecha a mesma janela duas vezes.
CREATE UNIQUE INDEX "ConsumoPeriodo_grupoId_dataInicio_dataFim_key" ON "ConsumoPeriodo"("grupoId", "dataInicio", "dataFim");
CREATE INDEX "ConsumoPeriodo_grupoId_idx" ON "ConsumoPeriodo"("grupoId");
CREATE INDEX "MovimentoEstoque_consumoPeriodoId_idx" ON "MovimentoEstoque"("consumoPeriodoId");

ALTER TABLE "ConsumoPeriodo" ADD CONSTRAINT "ConsumoPeriodo_grupoId_fkey"
    FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConsumoPeriodo" ADD CONSTRAINT "ConsumoPeriodo_dietaId_fkey"
    FOREIGN KEY ("dietaId") REFERENCES "Dieta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_consumoPeriodoId_fkey"
    FOREIGN KEY ("consumoPeriodoId") REFERENCES "ConsumoPeriodo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
