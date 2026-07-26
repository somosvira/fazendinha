-- Paridade de parto com dicionários IDEAGRI (TIPOPARTO + AUXILIOPARTO).
ALTER TABLE "EventoReprodutivo"
  ADD COLUMN IF NOT EXISTS "auxilioParto" TEXT,
  ADD COLUMN IF NOT EXISTS "criasVivas" INTEGER,
  ADD COLUMN IF NOT EXISTS "criasNatimortas" INTEGER;
