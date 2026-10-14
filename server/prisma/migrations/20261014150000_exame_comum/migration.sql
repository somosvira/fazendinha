BEGIN;
LOCK TABLE pecuaria."ExameAnimal", pecuaria."AvaliacaoReprodutiva", pecuaria."TipoExame" IN ACCESS EXCLUSIVE MODE;
CREATE TEMP TABLE avaliacoes_antes ON COMMIT DROP AS TABLE pecuaria."AvaliacaoReprodutiva";
ALTER TABLE pecuaria."TipoExame" ADD COLUMN contexto TEXT NOT NULL DEFAULT 'SANITARIO', ADD COLUMN "versaoFormato" INTEGER NOT NULL DEFAULT 1, ADD COLUMN campos JSONB;
ALTER TABLE pecuaria."TipoExame" ADD CONSTRAINT "TipoExame_contexto_check" CHECK (contexto IN ('SANITARIO','REPRODUTIVO','COMPARTILHADO'));
ALTER TABLE pecuaria."TipoExame" ADD CONSTRAINT "TipoExame_versaoFormato_check" CHECK ("versaoFormato">0);
INSERT INTO pecuaria."TipoExame" (id,nome,"tipoResultado",contexto,campos)
VALUES ('b0400000-0000-4000-8000-000000000001','Avaliação reprodutiva','MULTIPLO','REPRODUTIVO',
 '[{"codigo":"CONCLUSAO_GESTACIONAL","tipo":"OPCAO","opcoes":["POSITIVO","NEGATIVO","INCONCLUSIVO"]},{"codigo":"SEXO_FETAL","tipo":"OPCAO","opcoes":["M","F"]}]'::jsonb);
ALTER TABLE pecuaria."ExameAnimal"
 ADD COLUMN finalidades TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
 ADD COLUMN "finalidadePrincipal" TEXT,
 ADD COLUMN realizacao TEXT NOT NULL DEFAULT 'REALIZADO',
 ADD COLUMN "anotacaoOriginal" TEXT,
 ADD COLUMN observacao TEXT,
 ADD COLUMN "criadoPorId" INTEGER REFERENCES public."Usuario"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
UPDATE pecuaria."ExameAnimal" SET realizacao='COLETA_REGISTRADA' WHERE "resultadoTexto" IS NULL AND "resultadoNumero" IS NULL AND "resultadoOpcao" IS NULL;
ALTER TABLE pecuaria."ExameAnimal" ADD CONSTRAINT "ExameAnimal_realizacao_check" CHECK (realizacao IN ('REALIZADO','COLETA_REGISTRADA','NAO_REALIZADO'));
ALTER TABLE pecuaria."ExameAnimal" ADD CONSTRAINT "ExameAnimal_finalidade_check" CHECK ("finalidadePrincipal" IS NULL OR "finalidadePrincipal"=ANY(finalidades));
ALTER TABLE pecuaria."ExameAnimal" ADD CONSTRAINT "ExameAnimal_formato_multiplo_check" CHECK ("formatoSnapshot"->>'tipoResultado'<>'MULTIPLO' OR ("resultadoTexto" IS NULL AND "resultadoNumero" IS NULL AND "resultadoOpcao" IS NULL));
CREATE TABLE pecuaria."ResultadoExame" (
 id TEXT PRIMARY KEY,
 "exameId" TEXT NOT NULL REFERENCES pecuaria."ExameAnimal"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 campo TEXT NOT NULL CHECK (length(trim(campo))>0),
 valor JSONB NOT NULL,
 unidade TEXT,
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 vigente BOOLEAN NOT NULL DEFAULT TRUE,
 "substituidoEm" TIMESTAMP(3),
 "criadoPorId" INTEGER REFERENCES public."Usuario"(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ResultadoExame_exameId_campo_idx" ON pecuaria."ResultadoExame"("exameId",campo);
CREATE UNIQUE INDEX "ResultadoExame_um_vigente" ON pecuaria."ResultadoExame"("exameId",campo) WHERE vigente;

ALTER TABLE pecuaria."AvaliacaoReprodutiva" RENAME TO "InterpretacaoReprodutiva";
ALTER TABLE pecuaria."InterpretacaoReprodutiva" ADD COLUMN "exameId" TEXT;
UPDATE pecuaria."InterpretacaoReprodutiva" i SET "exameId"=CASE WHEN EXISTS (SELECT 1 FROM pecuaria."ExameAnimal" e WHERE e.id=i.id) THEN 'exame-reprodutivo:'||i.id ELSE i.id END;
INSERT INTO pecuaria."ExameAnimal" (id,"animalId","propriedadeId","tipoExameId",data,status,origem,"motivoAnulacao","anuladoEm","criadoEm","atualizadoEm","criadoPorId","formatoSnapshot",finalidades,"finalidadePrincipal",realizacao,"anotacaoOriginal",observacao)
SELECT "exameId","animalId","propriedadeId",'b0400000-0000-4000-8000-000000000001',data,status,origem,"motivoAnulacao","anuladoEm","criadoEm","criadoEm","criadoPorId",
 jsonb_build_object('nome','Avaliação reprodutiva','tipoResultado','MULTIPLO','versao',1,'origem','AVALIACAO_LEGADA'),
 ARRAY[CASE WHEN resultado IN ('RECONFIRMACAO','SEXAGEM') THEN resultado ELSE 'DIAGNOSTICO' END] || CASE WHEN "sexoFetal" IS NOT NULL AND resultado<>'SEXAGEM' THEN ARRAY['SEXAGEM'] ELSE ARRAY[]::text[] END,
 CASE WHEN resultado IN ('RECONFIRMACAO','SEXAGEM') THEN resultado ELSE 'DIAGNOSTICO' END,
 CASE WHEN resultado='NAO_AVALIADO' THEN 'NAO_REALIZADO' ELSE 'REALIZADO' END,
 "anotacaoOriginal",observacao
FROM pecuaria."InterpretacaoReprodutiva";
INSERT INTO pecuaria."ResultadoExame" (id,"exameId",campo,valor,"criadoEm")
SELECT 'conclusao:'||id,"exameId",'CONCLUSAO_GESTACIONAL',to_jsonb(CASE WHEN resultado='RECONFIRMACAO' THEN 'POSITIVO' ELSE resultado END),"criadoEm" FROM pecuaria."InterpretacaoReprodutiva" WHERE resultado IN ('POSITIVO','NEGATIVO','INCONCLUSIVO','RECONFIRMACAO');
INSERT INTO pecuaria."ResultadoExame" (id,"exameId",campo,valor,"criadoEm")
SELECT 'sexo:'||id,"exameId",'SEXO_FETAL',to_jsonb("sexoFetal"::text),"criadoEm" FROM pecuaria."InterpretacaoReprodutiva" WHERE "sexoFetal" IS NOT NULL;
ALTER TABLE pecuaria."InterpretacaoReprodutiva" ALTER COLUMN "exameId" SET NOT NULL;
ALTER TABLE pecuaria."InterpretacaoReprodutiva" ADD CONSTRAINT "InterpretacaoReprodutiva_exameId_fkey" FOREIGN KEY ("exameId") REFERENCES pecuaria."ExameAnimal"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "InterpretacaoReprodutiva_exameId_key" ON pecuaria."InterpretacaoReprodutiva"("exameId");
-- Os valores clínicos foram transferidos; a interpretação conserva apenas vínculos/efeitos/conduta.
ALTER TABLE pecuaria."InterpretacaoReprodutiva"
 DROP COLUMN "animalId", DROP COLUMN "propriedadeId", DROP COLUMN data, DROP COLUMN origem,
 DROP COLUMN status, DROP COLUMN "motivoAnulacao", DROP COLUMN "anuladoEm", DROP COLUMN "criadoEm", DROP COLUMN "criadoPorId",
 DROP COLUMN resultado, DROP COLUMN "sexoFetal", DROP COLUMN "anotacaoOriginal", DROP COLUMN observacao;

-- Contrato antigo de leitura, calculado da evidência única. Não é outra tabela nem recebe escritas.
CREATE VIEW pecuaria."AvaliacaoReprodutiva" AS
SELECT i.id,i."referenciaExterna",e."animalId",e."propriedadeId",e.data,e.origem,e.status,e."motivoAnulacao",e."anuladoEm",e."criadoEm",e."criadoPorId",
 i."gestacaoCriada",i."restricaoId",
 CASE WHEN e.realizacao='NAO_REALIZADO' THEN 'NAO_AVALIADO' WHEN e."finalidadePrincipal"='RECONFIRMACAO' AND c.valor#>>'{}'='POSITIVO' THEN 'RECONFIRMACAO' WHEN e."finalidadePrincipal"='SEXAGEM' AND c.valor IS NULL THEN 'SEXAGEM' ELSE COALESCE(c.valor#>>'{}','INCONCLUSIVO') END AS resultado,
 i."tentativaId",i."gestacaoId",(s.valor#>>'{}')::pecuaria."SexoBovino" AS "sexoFetal",i.conduta,i.motivo,e."anotacaoOriginal",i."retornoEm",e.observacao
FROM pecuaria."InterpretacaoReprodutiva" i JOIN pecuaria."ExameAnimal" e ON e.id=i."exameId"
LEFT JOIN pecuaria."ResultadoExame" c ON c."exameId"=e.id AND c.campo='CONCLUSAO_GESTACIONAL' AND c.vigente
LEFT JOIN pecuaria."ResultadoExame" s ON s."exameId"=e.id AND s.campo='SEXO_FETAL' AND s.vigente;
DO $$ BEGIN
 IF EXISTS ((SELECT to_jsonb(a) FROM avaliacoes_antes a) EXCEPT (SELECT to_jsonb(a) FROM pecuaria."AvaliacaoReprodutiva" a))
 OR (SELECT count(*) FROM avaliacoes_antes) <> (SELECT count(*) FROM pecuaria."AvaliacaoReprodutiva")
 THEN RAISE EXCEPTION 'Conversão de exames diverge do histórico; migração revertida para revisão'; END IF;
END $$;
COMMIT;
