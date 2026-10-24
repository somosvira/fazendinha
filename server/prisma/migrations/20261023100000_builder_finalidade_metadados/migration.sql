BEGIN;
-- Aditiva: versões e tarefas anteriores permanecem sem classificação declarada.
CREATE TYPE pecuaria."FinalidadeProtocolo" AS ENUM ('SANITARIO', 'PRE_SINCRONIZACAO', 'IATF', 'TETF');
ALTER TABLE pecuaria."Protocolo" ADD COLUMN finalidade pecuaria."FinalidadeProtocolo";
ALTER TABLE pecuaria."Protocolo" ADD CONSTRAINT "Protocolo_finalidade_dominio_check" CHECK (
  finalidade IS NULL OR (tipo = 'SANITARIO' AND finalidade = 'SANITARIO') OR
  (tipo = 'REPRODUTIVO' AND finalidade IN ('PRE_SINCRONIZACAO', 'IATF', 'TETF'))
);
ALTER TABLE pecuaria."MomentoProtocolo"
  ADD COLUMN "instrucoesGerais" TEXT CHECK (length("instrucoesGerais") <= 2000),
  ADD COLUMN "modoAtendimento" TEXT CHECK ("modoAtendimento" IN ('AUTOMATIZADA', 'MANUAL'));
ALTER TABLE pecuaria."PerfilSanitarioProduto"
  ADD COLUMN "orientacaoUso" TEXT CHECK (length("orientacaoUso") <= 2000),
  ADD COLUMN "tipoAplicacaoId" TEXT REFERENCES pecuaria."TipoAplicacaoSanitaria"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
-- A guarda existente protege os demais dados. A classificação segue a mesma
-- imutabilidade inclusive quando a versão já foi adotada por uma turma.
CREATE FUNCTION pecuaria.proteger_finalidade_protocolo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.finalidade IS DISTINCT FROM OLD.finalidade AND (
    OLD.publicado OR OLD."publicadoEm" IS NOT NULL OR
    EXISTS (SELECT 1 FROM pecuaria."ParticipacaoProtocolo" p WHERE p."protocoloId" = OLD.id) OR
    EXISTS (SELECT 1 FROM pecuaria."ProgramacaoProtocolo" g WHERE g."protocoloId" = OLD.id)
  ) THEN RAISE EXCEPTION 'Finalidade publicada ou utilizada é imutável; crie outra versão'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "Protocolo_finalidade_imutavel" BEFORE UPDATE OF finalidade ON pecuaria."Protocolo"
  FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_finalidade_protocolo();
COMMIT;
