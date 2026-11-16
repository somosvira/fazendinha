ALTER TABLE pecuaria."Protocolo"
  ADD COLUMN "modalidadeTentativa" TEXT,
  ADD COLUMN "modalidadeDiagnostico" TEXT,
  ADD CONSTRAINT "Protocolo_modalidades_reprodutivas_check" CHECK (
    ("modalidadeTentativa" IS NULL AND "modalidadeDiagnostico" IS NULL)
    OR ("modalidadeTentativa" IS NOT NULL AND "modalidadeDiagnostico" IS NOT NULL AND "finalidade" IS NOT NULL AND "tipo" = 'REPRODUTIVO' AND "finalidade" IN ('IATF', 'TETF')
      AND "modalidadeTentativa" IN ('ETAPA', 'EXTERNA')
      AND "modalidadeDiagnostico" IN ('PROTOCOLO', 'EXTERNO'))
  );

CREATE FUNCTION pecuaria.proteger_modalidades_protocolo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW."modalidadeTentativa", NEW."modalidadeDiagnostico") IS DISTINCT FROM (OLD."modalidadeTentativa", OLD."modalidadeDiagnostico") AND (
    OLD.publicado OR OLD."publicadoEm" IS NOT NULL OR
    EXISTS (SELECT 1 FROM pecuaria."ParticipacaoProtocolo" p WHERE p."protocoloId" = OLD.id) OR
    EXISTS (SELECT 1 FROM pecuaria."ProgramacaoProtocolo" g WHERE g."protocoloId" = OLD.id)
  ) THEN RAISE EXCEPTION 'Modalidades publicadas ou utilizadas são imutáveis; crie outra versão'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "Protocolo_modalidades_imutaveis" BEFORE UPDATE OF "modalidadeTentativa", "modalidadeDiagnostico" ON pecuaria."Protocolo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_modalidades_protocolo();
