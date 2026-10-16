CREATE TABLE "pecuaria"."PeriodoReprodutivoAnimal" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "referenciaExterna" TEXT UNIQUE,
 "animalId" TEXT NOT NULL REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "propriedadeId" INTEGER REFERENCES "public"."Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "tipo" TEXT NOT NULL CHECK ("tipo" IN ('DOADORA','RECEPTORA')),
 "inicio" DATE NOT NULL,
 "fim" DATE,
 "origem" TEXT NOT NULL DEFAULT 'IDEAGRI',
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "criadoPorId" INTEGER REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CHECK ("fim" IS NULL OR "fim">="inicio")
);
CREATE INDEX "PeriodoReprodutivoAnimal_animalId_inicio_idx" ON "pecuaria"."PeriodoReprodutivoAnimal"("animalId","inicio");
