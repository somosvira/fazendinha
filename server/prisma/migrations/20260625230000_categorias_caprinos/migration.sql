-- Adiciona categorias caprinas. CategoriaAnimal já existia com BEZERRA/NOVILHA/VACA/BEZERRO/TOURO (bovinos).
-- A espécie é inferida pela categoria no app (não persistida em coluna separada por ora).

ALTER TYPE "CategoriaAnimal" ADD VALUE IF NOT EXISTS 'CABRITA';
ALTER TYPE "CategoriaAnimal" ADD VALUE IF NOT EXISTS 'CABRA';
ALTER TYPE "CategoriaAnimal" ADD VALUE IF NOT EXISTS 'CABRITO';
ALTER TYPE "CategoriaAnimal" ADD VALUE IF NOT EXISTS 'BODE';
