CREATE TABLE pecuaria."RegraImpactoProcedimentoReprodutivo" (
 id text PRIMARY KEY,
 "propriedadeId" integer NOT NULL REFERENCES public."Propriedade"(id),
 "tipoAplicacaoId" text NOT NULL REFERENCES pecuaria."TipoAplicacaoSanitaria"(id),
 finalidade text NOT NULL CHECK (finalidade IN ('PROTOCOLO','IATF','TETF','PRE_SINCRONIZACAO')),
 efeito text NOT NULL CHECK (efeito IN ('AVISAR','BLOQUEAR','RETIRAR')),
 motivo text NOT NULL CHECK (length(btrim(motivo)) BETWEEN 5 AND 1000),
 ativo boolean NOT NULL DEFAULT true, versao integer NOT NULL DEFAULT 1 CHECK (versao>0),
 "criadoPorId" integer NOT NULL REFERENCES public."Usuario"(id),
 "atualizadoPorId" integer NOT NULL REFERENCES public."Usuario"(id),
 "criadoEm" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "atualizadoEm" timestamp(3) NOT NULL,
 CONSTRAINT "RegraImpactoProcedimento_publico_unico" UNIQUE ("propriedadeId","tipoAplicacaoId",finalidade)
);
CREATE INDEX "RegraImpactoProcedimentoReprodutivo_propriedadeId_ativo_idx" ON pecuaria."RegraImpactoProcedimentoReprodutivo"("propriedadeId",ativo);

CREATE OR REPLACE FUNCTION pecuaria.proteger_regra_impacto_procedimento() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Preserve a regra de procedimento; registre inativação auditada' USING ERRCODE='23514'; END IF;
 IF (NEW.id,NEW."propriedadeId",NEW."criadoPorId",NEW."criadoEm") IS DISTINCT FROM (OLD.id,OLD."propriedadeId",OLD."criadoPorId",OLD."criadoEm") OR NEW.versao<>OLD.versao+1 THEN
  RAISE EXCEPTION 'Revisão exige identidade/autoria original preservadas e versão seguinte' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "RegraImpactoProcedimento_revisao" BEFORE UPDATE OR DELETE ON pecuaria."RegraImpactoProcedimentoReprodutivo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_regra_impacto_procedimento();
