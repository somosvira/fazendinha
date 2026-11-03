CREATE TABLE pecuaria."ControleHistoricoLeite" (
  id text PRIMARY KEY, "referenciaHistorica" text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('CONTROLE_PERIODICO','AGREGADO_MENSAL')),
  inicio date NOT NULL, fim date NOT NULL CHECK (fim >= inicio),
  "contextoHistorico" text NOT NULL CHECK ("contextoHistorico" IN ('INTERNO','EXTERNO')),
  "propriedadeId" integer REFERENCES public."Propriedade"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "animalId" text REFERENCES pecuaria."Animal"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "lactacaoId" text REFERENCES pecuaria."LactacaoAnimal"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "origemColetiva" text,
  total numeric(14,3) CHECK (total IS NULL OR total >= 0),
  unidade text NOT NULL CHECK (unidade IN ('L','KG')),
  "referenciaUnidade" text NOT NULL CHECK (length(btrim("referenciaUnidade")) >= 5),
  parcelas jsonb NOT NULL CHECK (jsonb_typeof(parcelas) = 'array'),
  "provenienciaSnapshot" jsonb NOT NULL CHECK (jsonb_typeof("provenienciaSnapshot") = 'object'),
  versao integer NOT NULL DEFAULT 1 CHECK (versao > 0),
  "criadoPorId" integer NOT NULL REFERENCES public."Usuario"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "criadoEm" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "atualizadoEm" timestamp(3) NOT NULL,
  CHECK (("contextoHistorico"='INTERNO' AND "propriedadeId" IS NOT NULL) OR ("contextoHistorico"='EXTERNO' AND "propriedadeId" IS NULL AND "lactacaoId" IS NULL)),
  CHECK ((tipo='CONTROLE_PERIODICO' AND "animalId" IS NOT NULL AND inicio=fim) OR (tipo='AGREGADO_MENSAL' AND "animalId" IS NULL AND "lactacaoId" IS NULL AND "origemColetiva" IS NOT NULL AND length(btrim("origemColetiva"))>=3 AND inicio=date_trunc('month',inicio)::date AND fim=(date_trunc('month',inicio)+interval '1 month - 1 day')::date))
);
CREATE UNIQUE INDEX "ControleHistoricoLeite_referenciaHistorica_key" ON pecuaria."ControleHistoricoLeite"("referenciaHistorica");
CREATE INDEX "ControleHistoricoLeite_propriedadeId_inicio_fim_idx" ON pecuaria."ControleHistoricoLeite"("propriedadeId",inicio,fim);
CREATE INDEX "ControleHistoricoLeite_animalId_inicio_idx" ON pecuaria."ControleHistoricoLeite"("animalId",inicio);
