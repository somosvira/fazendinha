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

-- Caixinha NÃO tem migration de criação (a tabela nasce só via `db push` a
-- partir do schema). Guardamos o bloco: onde a tabela existir (Neon, já
-- db-push'ado), aplica normal; onde ainda não existir, vira no-op e o `db push`
-- posterior cria a tabela já com a coluna propriedadeId do schema. IF NOT EXISTS
-- torna o bloco idempotente (re-run após um db push não quebra).
DO $$ BEGIN
  IF to_regclass('"Caixinha"') IS NOT NULL THEN
    ALTER TABLE "Caixinha" ADD COLUMN IF NOT EXISTS "propriedadeId" INTEGER;
    UPDATE "Caixinha" SET "propriedadeId" = 1 WHERE "propriedadeId" IS NULL;
    CREATE INDEX IF NOT EXISTS "Caixinha_propriedadeId_idx" ON "Caixinha"("propriedadeId");
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Caixinha_propriedadeId_fkey') THEN
      ALTER TABLE "Caixinha" ADD CONSTRAINT "Caixinha_propriedadeId_fkey"
        FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
