-- Multi-propriedade — Fatia 4C: cultivo (grãos), equipe/ponto e caixinha por sítio.
-- Funcionario, SafraCultivo, Silo e Caixinha ganham propriedadeId (nullable),
-- backfillado para a principal. Aditivo — fazenda de 1 sítio não muda nada.
-- Os filhos (RegistroPonto, AreaCultivo/LancamentoCusto/ProducaoCultivo,
-- MovimentoSilo, MovimentoCaixinha) herdam o escopo via o pai nas leituras.

ALTER TABLE "Funcionario" ADD COLUMN "propriedadeId" INTEGER;
UPDATE "Funcionario" SET "propriedadeId" = 1;
CREATE INDEX "Funcionario_propriedadeId_idx" ON "Funcionario"("propriedadeId");
ALTER TABLE "Funcionario" ADD CONSTRAINT "Funcionario_propriedadeId_fkey"
    FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SafraCultivo" ADD COLUMN "propriedadeId" INTEGER;
UPDATE "SafraCultivo" SET "propriedadeId" = 1;
CREATE INDEX "SafraCultivo_propriedadeId_idx" ON "SafraCultivo"("propriedadeId");
ALTER TABLE "SafraCultivo" ADD CONSTRAINT "SafraCultivo_propriedadeId_fkey"
    FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Silo" ADD COLUMN "propriedadeId" INTEGER;
UPDATE "Silo" SET "propriedadeId" = 1;
CREATE INDEX "Silo_propriedadeId_idx" ON "Silo"("propriedadeId");
ALTER TABLE "Silo" ADD CONSTRAINT "Silo_propriedadeId_fkey"
    FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Caixinha" ADD COLUMN "propriedadeId" INTEGER;
UPDATE "Caixinha" SET "propriedadeId" = 1;
CREATE INDEX "Caixinha_propriedadeId_idx" ON "Caixinha"("propriedadeId");
ALTER TABLE "Caixinha" ADD CONSTRAINT "Caixinha_propriedadeId_fkey"
    FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
