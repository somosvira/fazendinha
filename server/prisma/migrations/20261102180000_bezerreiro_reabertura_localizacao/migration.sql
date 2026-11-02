-- Proteção de reaberturas e ampliações; não cria participações históricas.
-- Encerrar/encurtar um intervalo legado não exige carregar sua participação.
-- A função diferida confere o estado final, depois da sincronização transacional.
CREATE CONSTRAINT TRIGGER "LocalizacaoAnimal_reabertura_bezerreiro"
 AFTER UPDATE ON pecuaria."LocalizacaoAnimal"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 WHEN (
   NEW."animalId" IS DISTINCT FROM OLD."animalId"
   OR NEW."loteId" IS DISTINCT FROM OLD."loteId"
   OR NEW."propriedadeId" IS DISTINCT FROM OLD."propriedadeId"
   OR NEW.desde < OLD.desde
   OR (OLD.ate IS NOT NULL AND (NEW.ate IS NULL OR NEW.ate > OLD.ate))
 )
 EXECUTE FUNCTION pecuaria.conferir_entrada_localizacao_bezerreiro();
