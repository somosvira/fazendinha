-- Unifica o cadastro individual da pecuária sem converter os lotes agregados
-- de corte em indivíduos inexistentes. Os dados atuais recebem finalidade não
-- informada e podem ser classificados coletivamente pela interface.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FinalidadeAnimal') THEN
    CREATE TYPE "FinalidadeAnimal" AS ENUM ('LEITE', 'CORTE', 'DUPLA_APTIDAO', 'NAO_INFORMADA');
  END IF;
END $$;

ALTER TABLE "Animal"
ADD COLUMN IF NOT EXISTS "finalidade" "FinalidadeAnimal" NOT NULL DEFAULT 'NAO_INFORMADA';

ALTER TABLE "FiltroAnimal"
ADD COLUMN IF NOT EXISTS "finalidade" TEXT;

CREATE INDEX IF NOT EXISTS "Animal_finalidade_idx" ON "Animal"("finalidade");
