BEGIN;
ALTER TABLE pecuaria."ExameAnimal" ADD COLUMN "partoPosPartoId" TEXT;
ALTER TABLE pecuaria."ExameAnimal" ADD CONSTRAINT "ExameAnimal_partoPosPartoId_fkey"
  FOREIGN KEY ("partoPosPartoId") REFERENCES pecuaria."PartoAnimal"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ExameAnimal_partoPosPartoId_idx" ON pecuaria."ExameAnimal"("partoPosPartoId");
INSERT INTO pecuaria."TipoExame" (id,nome,"tipoResultado",contexto,"versaoFormato",campos)
VALUES ('b0841f3c-3f88-4c2d-9d0d-3ef33d49b841','Escore corporal · avaliação estruturada','MULTIPLO','COMPARTILHADO',1,
 '[{"codigo":"ESCORE","rotulo":"Escore corporal","tipo":"NUMERO","obrigatorio":true},{"codigo":"ESCALA_MIN","rotulo":"Mínimo da escala","tipo":"NUMERO","obrigatorio":true},{"codigo":"ESCALA_MAX","rotulo":"Máximo da escala","tipo":"NUMERO","obrigatorio":true},{"codigo":"ESCALA_DESCRICAO","rotulo":"Descrição da escala","tipo":"TEXTO","obrigatorio":false}]'::jsonb);
CREATE FUNCTION pecuaria.conferir_exame_pos_parto(id_exame text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE exame pecuaria."ExameAnimal"%ROWTYPE; parto pecuaria."PartoAnimal"%ROWTYPE;
BEGIN
 SELECT * INTO exame FROM pecuaria."ExameAnimal" WHERE id=id_exame;
 IF NOT FOUND OR exame.status <> 'VALIDO' OR exame."partoPosPartoId" IS NULL THEN RETURN; END IF;
 SELECT * INTO STRICT parto FROM pecuaria."PartoAnimal" WHERE id=exame."partoPosPartoId" FOR UPDATE;
 IF parto.status <> 'VALIDO' OR exame."animalId" <> parto."animalId" OR exame.data < parto.data THEN
  RAISE EXCEPTION 'Exame pós-parto exige parto válido da matriz e data a partir do parto';
 END IF;
END $$;
CREATE FUNCTION pecuaria.conferir_exame_pos_parto_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE id_exame text;
BEGIN
 IF TG_TABLE_NAME='ExameAnimal' THEN
  PERFORM pecuaria.conferir_exame_pos_parto(NEW.id);
 ELSE
  FOR id_exame IN SELECT id FROM pecuaria."ExameAnimal" WHERE "partoPosPartoId"=NEW.id AND status='VALIDO' ORDER BY id
  LOOP PERFORM pecuaria.conferir_exame_pos_parto(id_exame); END LOOP;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "ExameAnimal_pos_parto" AFTER INSERT OR UPDATE ON pecuaria."ExameAnimal"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_exame_pos_parto_trigger();
CREATE CONSTRAINT TRIGGER "PartoAnimal_exames_pos_parto" AFTER UPDATE ON pecuaria."PartoAnimal"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_exame_pos_parto_trigger();
COMMIT;
