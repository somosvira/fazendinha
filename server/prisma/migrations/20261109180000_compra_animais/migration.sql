-- Compra de animais: um item da operação por animal, ligado pelo próprio item
-- (como produtoId). Os dados do animal ficam só no Rebanho.
ALTER TYPE "public"."TipoOperacaoFinanceira" ADD VALUE 'COMPRA_ANIMAIS';
-- Baixa de animal devolvido ao vendedor ou de compra estornada; não aceita motivo.
ALTER TYPE pecuaria."TipoBaixa" ADD VALUE 'COMPRA_ESTORNADA';

ALTER TABLE "public"."ItemOperacao" ADD COLUMN "animalId" TEXT;
ALTER TABLE "public"."ItemOperacao"
  ADD CONSTRAINT "ItemOperacao_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES pecuaria."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ItemOperacao_animalId_idx" ON "public"."ItemOperacao"("animalId");
-- Item de animal não é produto nem estoque.
ALTER TABLE "public"."ItemOperacao"
  ADD CONSTRAINT "ItemOperacao_animal_sem_estoque" CHECK ("animalId" IS NULL OR ("produtoId" IS NULL AND "estocavel" = false));

-- Um animal pertence a no máximo uma compra e uma devolução não canceladas.
-- A correção cancela a original e cria outra apontando para o mesmo animal, por
-- isso a unicidade depende do status da operação e não cabe num índice.
CREATE OR REPLACE FUNCTION public.validar_item_operacao_animal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  tipo_operacao text;
  status_operacao text;
BEGIN
  IF NEW."animalId" IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT o."tipo"::text, o."status"::text INTO tipo_operacao, status_operacao FROM "public"."Operacao" o WHERE o."id" = NEW."operacaoId";
  IF tipo_operacao NOT IN ('COMPRA_ANIMAIS', 'DEVOLUCAO') THEN
    RAISE EXCEPTION 'Item com animal só é aceito em compra ou devolução de animais' USING ERRCODE = '23514';
  END IF;
  IF status_operacao = 'CANCELADA' THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('item-operacao-animal:' || NEW."animalId"));
  IF EXISTS (
    SELECT 1 FROM "public"."ItemOperacao" i
    JOIN "public"."Operacao" o ON o."id" = i."operacaoId"
    WHERE i."animalId" = NEW."animalId" AND i."id" <> NEW."id"
      AND o."tipo"::text = tipo_operacao AND o."status"::text <> 'CANCELADA'
  ) THEN
    RAISE EXCEPTION 'O animal já está em outra % ativa', CASE WHEN tipo_operacao = 'DEVOLUCAO' THEN 'devolução' ELSE 'compra' END USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ItemOperacao_animal_validar" BEFORE INSERT OR UPDATE OF "animalId", "operacaoId" ON "public"."ItemOperacao"
  FOR EACH ROW EXECUTE FUNCTION public.validar_item_operacao_animal();
