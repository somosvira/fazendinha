BEGIN;
-- Sem PEV clínico padrão nem vínculo histórico inferido. Versão aplicável ao
-- ciclo é congelada explicitamente, inclusive a ausência de política.
CREATE TABLE pecuaria."PoliticaElegibilidadeReprodutiva" (
 id TEXT PRIMARY KEY,"propriedadeId" INTEGER NOT NULL,versao INTEGER NOT NULL,
 "vigenteDesde" DATE NOT NULL,parametros JSONB NOT NULL,
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"criadoPorId" INTEGER,
 CONSTRAINT "PoliticaElegibilidadeReprodutiva_propriedadeId_fkey" FOREIGN KEY("propriedadeId") REFERENCES public."Propriedade"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "PoliticaElegibilidadeReprodutiva_criadoPorId_fkey" FOREIGN KEY("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "PoliticaElegibilidade_versao" CHECK(versao>0),
 CONSTRAINT "PoliticaElegibilidade_parametros" CHECK(jsonb_typeof(parametros)='object')
);
CREATE UNIQUE INDEX "PoliticaElegibilidadeReprodutiva_propriedadeId_versao_key" ON pecuaria."PoliticaElegibilidadeReprodutiva"("propriedadeId",versao);
CREATE UNIQUE INDEX "PoliticaElegibilidadeReprodutiva_propriedadeId_vigenteDesde_key" ON pecuaria."PoliticaElegibilidadeReprodutiva"("propriedadeId","vigenteDesde");
CREATE TABLE pecuaria."VinculoPoliticaCiclo" (
 id TEXT PRIMARY KEY,"animalId" TEXT NOT NULL,"propriedadeId" INTEGER NOT NULL,"chaveCiclo" TEXT NOT NULL,
 "partoId" TEXT,"situacaoInicialId" TEXT,"inicioCiclo" DATE NOT NULL,"politicaId" TEXT,
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"criadoPorId" INTEGER,
 CONSTRAINT "VinculoPoliticaCiclo_animalId_fkey" FOREIGN KEY("animalId") REFERENCES pecuaria."Animal"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "VinculoPoliticaCiclo_propriedadeId_fkey" FOREIGN KEY("propriedadeId") REFERENCES public."Propriedade"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "VinculoPoliticaCiclo_partoId_fkey" FOREIGN KEY("partoId") REFERENCES pecuaria."PartoAnimal"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "VinculoPoliticaCiclo_situacaoInicialId_fkey" FOREIGN KEY("situacaoInicialId") REFERENCES pecuaria."SituacaoInicialReprodutiva"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "VinculoPoliticaCiclo_politicaId_fkey" FOREIGN KEY("politicaId") REFERENCES pecuaria."PoliticaElegibilidadeReprodutiva"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "VinculoPoliticaCiclo_criadoPorId_fkey" FOREIGN KEY("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "VinculoPoliticaCiclo_chave" CHECK (("partoId" IS NULL AND "situacaoInicialId" IS NOT NULL AND "chaveCiclo"='INICIAL') OR ("partoId" IS NOT NULL AND "situacaoInicialId" IS NULL AND "chaveCiclo"='PARTO:'||"partoId"))
);
CREATE UNIQUE INDEX "VinculoPoliticaCiclo_partoId_key" ON pecuaria."VinculoPoliticaCiclo"("partoId");
CREATE UNIQUE INDEX "VinculoPoliticaCiclo_animalId_chaveCiclo_key" ON pecuaria."VinculoPoliticaCiclo"("animalId","chaveCiclo");
CREATE INDEX "VinculoPoliticaCiclo_propriedadeId_inicioCiclo_idx" ON pecuaria."VinculoPoliticaCiclo"("propriedadeId","inicioCiclo");
CREATE TABLE pecuaria."DecisaoElegibilidadeCiclo" (
 id TEXT PRIMARY KEY,"vinculoCicloId" TEXT NOT NULL,data DATE NOT NULL,tipo TEXT NOT NULL,"aptaDesde" DATE,motivo TEXT NOT NULL,
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"criadoPorId" INTEGER,
 status pecuaria."StatusFatoPecuariaV3" NOT NULL DEFAULT 'VALIDO',"anuladoEm" TIMESTAMP(3),"motivoAnulacao" TEXT,
 CONSTRAINT "DecisaoElegibilidadeCiclo_vinculoCicloId_fkey" FOREIGN KEY("vinculoCicloId") REFERENCES pecuaria."VinculoPoliticaCiclo"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "DecisaoElegibilidadeCiclo_criadoPorId_fkey" FOREIGN KEY("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "DecisaoElegibilidade_tipo" CHECK(tipo IN ('LIBERAR','BLOQUEAR','RETOMAR_POLITICA')),
 CONSTRAINT "DecisaoElegibilidade_data_liberacao" CHECK(tipo<>'LIBERAR' OR "aptaDesde">=data),
 CONSTRAINT "DecisaoElegibilidade_motivo" CHECK(length(btrim(motivo))>=5),
 CONSTRAINT "DecisaoElegibilidade_aptaDesde" CHECK((tipo='LIBERAR' AND "aptaDesde" IS NOT NULL) OR (tipo<>'LIBERAR' AND "aptaDesde" IS NULL)),
 CONSTRAINT "DecisaoElegibilidade_anulacao" CHECK((status='VALIDO' AND "anuladoEm" IS NULL AND "motivoAnulacao" IS NULL)
 OR(status='ANULADO' AND "anuladoEm" IS NOT NULL AND length(btrim("motivoAnulacao"))>=5 AND "motivoAnulacao" IS NOT NULL))
);
CREATE INDEX "DecisaoElegibilidadeCiclo_vinculoCicloId_data_idx" ON pecuaria."DecisaoElegibilidadeCiclo"("vinculoCicloId",data);
CREATE FUNCTION pecuaria.proteger_politica_e_ciclo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Versões e vínculos de ciclo preservam o critério histórico; registre nova decisão'; END $$;
CREATE TRIGGER "PoliticaElegibilidade_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."PoliticaElegibilidadeReprodutiva" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_politica_e_ciclo();
CREATE TRIGGER "VinculoPoliticaCiclo_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."VinculoPoliticaCiclo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_politica_e_ciclo();
CREATE FUNCTION pecuaria.proteger_decisao_elegibilidade() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Anule a decisão de elegibilidade com motivo'; END IF;
 IF OLD.status<>'VALIDO' OR NEW.status<>'ANULADO'
 OR (to_jsonb(NEW)-ARRAY['status','anuladoEm','motivoAnulacao']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','anuladoEm','motivoAnulacao'])
 THEN RAISE EXCEPTION 'Decisões são imutáveis; registre outro evento ou anule explicitamente'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "DecisaoElegibilidade_historico" BEFORE UPDATE OR DELETE ON pecuaria."DecisaoElegibilidadeCiclo" FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_decisao_elegibilidade();
CREATE FUNCTION pecuaria.conferir_ciclo_elegibilidade() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE inicial pecuaria."SituacaoInicialReprodutiva"%ROWTYPE; parto pecuaria."PartoAnimal"%ROWTYPE; politica pecuaria."PoliticaElegibilidadeReprodutiva"%ROWTYPE;
BEGIN
 IF NEW."partoId" IS NOT NULL THEN
  SELECT * INTO STRICT parto FROM pecuaria."PartoAnimal" WHERE id=NEW."partoId" FOR UPDATE;
  IF parto."animalId"<>NEW."animalId" OR parto.data<>NEW."inicioCiclo" OR parto.status<>'VALIDO' THEN RAISE EXCEPTION 'Vínculo de ciclo incompatível com matriz ou data do parto'; END IF;
 END IF;
 IF NEW."situacaoInicialId" IS NOT NULL THEN
  SELECT * INTO STRICT inicial FROM pecuaria."SituacaoInicialReprodutiva" WHERE id=NEW."situacaoInicialId";
  IF inicial.status<>'VALIDO' OR inicial."animalId"<>NEW."animalId" OR inicial.data<>NEW."inicioCiclo" THEN
   RAISE EXCEPTION 'Fonte inicial incompatível com matriz ou data do ciclo';
  END IF;
 END IF;
 IF NEW."politicaId" IS NOT NULL THEN
  SELECT * INTO STRICT politica FROM pecuaria."PoliticaElegibilidadeReprodutiva" WHERE id=NEW."politicaId";
  IF politica."propriedadeId"<>NEW."propriedadeId" OR politica."vigenteDesde">NEW."inicioCiclo" THEN RAISE EXCEPTION 'Política incompatível com sítio ou data do ciclo'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "VinculoPoliticaCiclo_consistencia" BEFORE INSERT ON pecuaria."VinculoPoliticaCiclo" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_ciclo_elegibilidade();
CREATE FUNCTION pecuaria.conferir_decisao_elegibilidade() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE inicio DATE;
BEGIN
 SELECT "inicioCiclo" INTO STRICT inicio FROM pecuaria."VinculoPoliticaCiclo" WHERE id=NEW."vinculoCicloId";
 IF NEW.data<inicio OR NEW."aptaDesde"<inicio THEN RAISE EXCEPTION 'Decisão deve respeitar o início conhecido do ciclo'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "DecisaoElegibilidade_cronologia" BEFORE INSERT ON pecuaria."DecisaoElegibilidadeCiclo" FOR EACH ROW EXECUTE FUNCTION pecuaria.conferir_decisao_elegibilidade();
COMMIT;
