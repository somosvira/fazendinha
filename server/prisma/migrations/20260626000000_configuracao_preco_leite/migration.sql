-- Preço médio do litro de leite recebido. Alimenta estimativas de receita por animal
-- (DEL × producaoMediaDia × precoLeite). NULL = service usa fallback R$ 2,40/L.

ALTER TABLE "Configuracao" ADD COLUMN "precoLeite" DECIMAL(10, 4);
