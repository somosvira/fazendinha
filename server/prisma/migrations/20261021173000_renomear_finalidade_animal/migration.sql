-- Renomeação da mesma estrutura: preserva IDs, linhas, vigências, autoria e FKs.
-- Não reescreve entidades/proveniências históricas da auditoria.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE "pecuaria"."DestinoAnimal" RENAME TO "FinalidadeAnimal";
ALTER TABLE "pecuaria"."FinalidadeAnimal" RENAME CONSTRAINT "DestinoAnimal_pkey" TO "FinalidadeAnimal_pkey";
ALTER TABLE "pecuaria"."FinalidadeAnimal" RENAME CONSTRAINT "DestinoAnimal_animalId_fkey" TO "FinalidadeAnimal_animalId_fkey";
ALTER TABLE "pecuaria"."FinalidadeAnimal" RENAME CONSTRAINT "DestinoAnimal_criadoPorId_fkey" TO "FinalidadeAnimal_criadoPorId_fkey";
ALTER INDEX "pecuaria"."DestinoAnimal_animalId_ate_idx" RENAME TO "FinalidadeAnimal_animalId_ate_idx";
ALTER INDEX "pecuaria"."DestinoAnimal_animalId_aberto_key" RENAME TO "FinalidadeAnimal_animalId_aberto_key";

COMMIT;
