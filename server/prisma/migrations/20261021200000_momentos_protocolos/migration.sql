BEGIN;
-- Aditiva: ações e calendários anteriores ficam intactos, sem agrupamento inferido.
CREATE TABLE pecuaria."MomentoProtocolo" (
  id TEXT PRIMARY KEY,
  "protocoloId" TEXT NOT NULL REFERENCES pecuaria."Protocolo"(id) ON DELETE CASCADE,
  nome TEXT NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 120),
  ordem INTEGER NOT NULL CHECK (ordem > 0),
  UNIQUE ("protocoloId", ordem),
  UNIQUE (id, "protocoloId")
);
ALTER TABLE pecuaria."EtapaProtocolo" ADD COLUMN "momentoId" TEXT;
ALTER TABLE pecuaria."EtapaProtocolo" DROP CONSTRAINT "EtapaProtocoloSanitario_protocoloId_fkey";
ALTER TABLE pecuaria."EtapaProtocolo" ADD CONSTRAINT "EtapaProtocolo_protocoloId_fkey"
  FOREIGN KEY ("protocoloId") REFERENCES pecuaria."Protocolo"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE pecuaria."EtapaProtocolo" ADD CONSTRAINT "EtapaProtocolo_momento_versao_fkey"
  FOREIGN KEY ("momentoId", "protocoloId") REFERENCES pecuaria."MomentoProtocolo"(id, "protocoloId") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE pecuaria."TarefaProtocolo" ADD COLUMN "momentoSnapshot" JSONB;

-- Trava a versão antes da edição. Publicação/adoção e edição não podem passar
-- simultaneamente pela consulta de imutabilidade usando snapshots diferentes.
CREATE FUNCTION pecuaria.proteger_estrutura_protocolo() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE versao TEXT; bloqueada BOOLEAN;
BEGIN
  versao := CASE WHEN TG_OP = 'DELETE' THEN OLD."protocoloId" ELSE NEW."protocoloId" END;
  IF TG_OP = 'UPDATE' AND NEW."protocoloId" <> OLD."protocoloId" THEN
    RAISE EXCEPTION 'Uma ação ou momento não pode mudar de versão';
  END IF;
  PERFORM 1 FROM pecuaria."Protocolo" p WHERE p.id = versao FOR UPDATE;
  SELECT p.publicado OR p."publicadoEm" IS NOT NULL
    OR EXISTS (SELECT 1 FROM pecuaria."ParticipacaoProtocolo" a WHERE a."protocoloId" = p.id)
    OR EXISTS (SELECT 1 FROM pecuaria."ProgramacaoProtocolo" g WHERE g."protocoloId" = p.id)
    INTO bloqueada FROM pecuaria."Protocolo" p WHERE p.id = versao;
  IF bloqueada THEN RAISE EXCEPTION 'Estrutura publicada ou utilizada é imutável; crie outra versão'; END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER "MomentoProtocolo_imutavel" BEFORE INSERT OR UPDATE OR DELETE ON pecuaria."MomentoProtocolo"
  FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_estrutura_protocolo();
CREATE TRIGGER "EtapaProtocolo_estrutura_imutavel" BEFORE INSERT OR UPDATE OR DELETE ON pecuaria."EtapaProtocolo"
  FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_estrutura_protocolo();

CREATE FUNCTION pecuaria.proteger_momento_snapshot_tarefa() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."momentoSnapshot" IS DISTINCT FROM OLD."momentoSnapshot" THEN
    RAISE EXCEPTION 'O momento congelado da tarefa é imutável';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "TarefaProtocolo_momento_snapshot" BEFORE UPDATE OF "momentoSnapshot" ON pecuaria."TarefaProtocolo"
  FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_momento_snapshot_tarefa();

-- A adoção serializa com edição de ações/momentos no registro da versão.
CREATE FUNCTION pecuaria.travar_versao_adotada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM pecuaria."Protocolo" p WHERE p.id = NEW."protocoloId" FOR UPDATE;
  RETURN NEW;
END $$;
CREATE TRIGGER "ProgramacaoProtocolo_trava_versao" BEFORE INSERT OR UPDATE OF "protocoloId" ON pecuaria."ProgramacaoProtocolo"
  FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_versao_adotada();
CREATE TRIGGER "ParticipacaoProtocolo_trava_versao" BEFORE INSERT OR UPDATE OF "protocoloId" ON pecuaria."ParticipacaoProtocolo"
  FOR EACH ROW EXECUTE FUNCTION pecuaria.travar_versao_adotada();

COMMIT;
