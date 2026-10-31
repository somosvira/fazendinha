-- Cada sítio conserva sua política, autoria e vínculos do acompanhamento.
-- O índice global anterior já garante que os dados existentes cabem na nova chave.
-- Nenhum ID, snapshot ou vínculo histórico precisa ser regravado.
BEGIN;

CREATE UNIQUE INDEX "AcompanhamentoColostragem_animalId_propriedadeId_key"
  ON "pecuaria"."AcompanhamentoColostragem"("animalId", "propriedadeId");

DROP INDEX "pecuaria"."AcompanhamentoColostragem_animalId_key";

COMMIT;
