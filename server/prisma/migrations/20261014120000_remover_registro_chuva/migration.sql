-- Cadastro remanescente sem rota, serviço ou interface no aplicativo atual.
-- Recusar descarte silencioso caso outro ambiente ainda contenha histórico.
BEGIN;

LOCK TABLE "public"."RegistroChuva" IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "public"."RegistroChuva" LIMIT 1) THEN
    RAISE EXCEPTION 'RegistroChuva contém dados: preserve e destine o histórico antes de aplicar sua remoção.';
  END IF;
END $$;

DROP TABLE "public"."RegistroChuva";

COMMIT;
