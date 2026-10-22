-- Somente previsões. Nenhum efeito físico ou financeiro nesta configuração.
CREATE TABLE pecuaria."ProgramacaoRetiradaLeite" (
  "id" UUID NOT NULL,
  "propriedadeId" INTEGER NOT NULL,
  "vigenteDesde" DATE NOT NULL,
  "tipo" TEXT NOT NULL,
  "diaSemana" INTEGER,
  "diasSemana" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "produtoId" TEXT,
  "metaLitros" DECIMAL(12,3),
  "versao" INTEGER NOT NULL,
  "criadoPorId" INTEGER,
  "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgramacaoRetiradaLeite_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProgramacaoRetiradaLeite_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES public."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProgramacaoRetiradaLeite_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public."Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProgramacaoRetiradaLeite_versao_positiva" CHECK ("versao" > 0),
  CONSTRAINT "ProgramacaoRetiradaLeite_regra_exclusiva" CHECK (
    ("tipo" = 'DIARIA' AND "diaSemana" IS NULL AND cardinality("diasSemana") = 0 AND "metaLitros" IS NULL AND "produtoId" IS NULL) OR
    ("tipo" = 'SEMANAL' AND "diaSemana" BETWEEN 0 AND 6 AND "diaSemana" IS NOT NULL AND cardinality("diasSemana") = 0 AND "metaLitros" IS NULL AND "produtoId" IS NULL) OR
    ("tipo" = 'DIAS_ESCOLHIDOS' AND "diaSemana" IS NULL AND cardinality("diasSemana") BETWEEN 1 AND 7 AND "diasSemana" <@ ARRAY[0,1,2,3,4,5,6] AND array_position("diasSemana",NULL) IS NULL AND "metaLitros" IS NULL AND "produtoId" IS NULL) OR
    ("tipo" = 'META_LITROS' AND "diaSemana" IS NULL AND cardinality("diasSemana") = 0 AND "metaLitros" IS NOT NULL AND "metaLitros" > 0 AND "produtoId" IS NOT NULL)
  ),
  CONSTRAINT "ProgramacaoRetiradaLeite_dias_unicos" CHECK (cardinality("diasSemana") =
    (CASE WHEN 0 = ANY("diasSemana") THEN 1 ELSE 0 END) + (CASE WHEN 1 = ANY("diasSemana") THEN 1 ELSE 0 END) +
    (CASE WHEN 2 = ANY("diasSemana") THEN 1 ELSE 0 END) + (CASE WHEN 3 = ANY("diasSemana") THEN 1 ELSE 0 END) +
    (CASE WHEN 4 = ANY("diasSemana") THEN 1 ELSE 0 END) + (CASE WHEN 5 = ANY("diasSemana") THEN 1 ELSE 0 END) +
    (CASE WHEN 6 = ANY("diasSemana") THEN 1 ELSE 0 END))
);
CREATE UNIQUE INDEX "ProgramacaoRetiradaLeite_propriedadeId_vigenteDesde_key" ON pecuaria."ProgramacaoRetiradaLeite"("propriedadeId","vigenteDesde");
CREATE UNIQUE INDEX "ProgramacaoRetiradaLeite_propriedadeId_versao_key" ON pecuaria."ProgramacaoRetiradaLeite"("propriedadeId","versao");
CREATE INDEX "ProgramacaoRetiradaLeite_propriedadeId_vigenteDesde_idx" ON pecuaria."ProgramacaoRetiradaLeite"("propriedadeId","vigenteDesde");
