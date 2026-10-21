-- Compatibilidade com o servidor anterior durante a publicação do novo Worker.
-- View simples e atualizável: não duplica dados nem remove as garantias da tabela.
-- Manter até a retirada definitiva das versões que consultam DestinoAnimal.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE VIEW "pecuaria"."DestinoAnimal" AS
SELECT id, "animalId", aptidao, desde, ate, "criadoEm", "criadoPorId", "atualizadoEm"
FROM "pecuaria"."FinalidadeAnimal";
COMMIT;
