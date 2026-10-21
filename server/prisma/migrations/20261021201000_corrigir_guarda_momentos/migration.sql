BEGIN;
-- Qualifica a identidade alvo sem ambiguidade com Protocolo.versao.
CREATE OR REPLACE FUNCTION pecuaria.proteger_estrutura_protocolo() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE protocolo_alvo TEXT; bloqueada BOOLEAN;
BEGIN
  protocolo_alvo := CASE WHEN TG_OP = 'DELETE' THEN OLD."protocoloId" ELSE NEW."protocoloId" END;
  IF TG_OP = 'UPDATE' AND NEW."protocoloId" <> OLD."protocoloId" THEN
    RAISE EXCEPTION 'Uma ação ou momento não pode mudar de versão';
  END IF;
  PERFORM 1 FROM pecuaria."Protocolo" p WHERE p.id = protocolo_alvo FOR UPDATE;
  SELECT p.publicado OR p."publicadoEm" IS NOT NULL
    OR EXISTS (SELECT 1 FROM pecuaria."ParticipacaoProtocolo" a WHERE a."protocoloId" = p.id)
    OR EXISTS (SELECT 1 FROM pecuaria."ProgramacaoProtocolo" g WHERE g."protocoloId" = p.id)
    INTO bloqueada FROM pecuaria."Protocolo" p WHERE p.id = protocolo_alvo;
  IF bloqueada THEN RAISE EXCEPTION 'Estrutura publicada ou utilizada é imutável; crie outra versão'; END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
COMMIT;
