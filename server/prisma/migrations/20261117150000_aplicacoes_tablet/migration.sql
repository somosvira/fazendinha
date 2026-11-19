CREATE TABLE pecuaria."EnvioAplicacoesTablet" (
  "id" TEXT PRIMARY KEY,
  "propriedadeId" INTEGER NOT NULL REFERENCES public."Propriedade"("id"),
  "autorId" INTEGER NOT NULL REFERENCES public."Usuario"("id"),
  "autorNome" TEXT NOT NULL,
  "data" DATE NOT NULL,
  "aplicadaEm" TIMESTAMP(3) NOT NULL,
  "animalIds" TEXT[] NOT NULL CHECK (cardinality("animalIds") > 0),
  "itens" JSONB NOT NULL,
  "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revisadoEm" TIMESTAMP(3),
  "revisorId" INTEGER REFERENCES public."Usuario"("id"),
  "revisorNome" TEXT,
  "devolucao" TEXT,
  "aplicacaoIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "corrigeId" TEXT UNIQUE REFERENCES pecuaria."EnvioAplicacoesTablet"("id"),
  CHECK (("revisadoEm" IS NULL AND "revisorId" IS NULL AND "revisorNome" IS NULL AND "devolucao" IS NULL AND cardinality("aplicacaoIds") = 0)
    OR ("revisadoEm" IS NOT NULL AND "revisorId" IS NOT NULL AND "revisorNome" IS NOT NULL AND (("devolucao" IS NULL) = (cardinality("aplicacaoIds") > 0))))
);
CREATE INDEX "EnvioAplicacoesTablet_propriedadeId_enviadoEm_idx" ON pecuaria."EnvioAplicacoesTablet" ("propriedadeId", "enviadoEm");
CREATE INDEX "EnvioAplicacoesTablet_animais_pendentes" ON pecuaria."EnvioAplicacoesTablet" USING GIN ("animalIds") WHERE "devolucao" IS NOT NULL OR "revisadoEm" IS NULL;

CREATE TABLE pecuaria."TemplateAplicacoesTablet" (
  "propriedadeId" INTEGER NOT NULL REFERENCES public."Propriedade"("id"),
  "doencaId" TEXT NOT NULL REFERENCES pecuaria."Doenca"("id"),
  "produtoIds" TEXT[] NOT NULL,
  "autorId" INTEGER NOT NULL REFERENCES public."Usuario"("id"),
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("propriedadeId", "doencaId")
);
