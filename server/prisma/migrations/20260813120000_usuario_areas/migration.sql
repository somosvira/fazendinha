ALTER TABLE "Usuario"
ADD COLUMN "areas" TEXT[] NOT NULL DEFAULT ARRAY['financeiro', 'rebanho', 'agricultura', 'gado_corte', 'equipe']::TEXT[];
