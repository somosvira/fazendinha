CREATE TABLE "pecuaria"."RegistroGenealogicoAnimal" (
  "registro" TEXT PRIMARY KEY CHECK ("registro" ~ '^ABCZ:(RGD|RGN):[A-Z]{2,10}:[1-9][0-9]{0,9}$'),
  "animalId" TEXT NOT NULL REFERENCES "pecuaria"."Animal"("id") ON DELETE RESTRICT,
  "evidencia" TEXT NOT NULL CHECK (length(trim("evidencia")) > 0),
  "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "pecuaria"."EventoLeilaoExterno" (
  "fonte" TEXT NOT NULL,
  "idExterno" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "vistoNaAgendaEm" TIMESTAMPTZ NOT NULL,
  "catalogo" JSONB,
  "catalogoTentadoEm" TIMESTAMPTZ,
  "catalogoConsultadoEm" TIMESTAMPTZ,
  PRIMARY KEY ("fonte", "idExterno")
);

CREATE VIEW "pecuaria"."VinculoLoteLeilaoAnimal" AS
SELECT evento."fonte", evento."idExterno", lote->>'numero' AS "numeroLote",
       registro."registro", registro."animalId"
FROM "pecuaria"."EventoLeilaoExterno" evento
CROSS JOIN LATERAL jsonb_array_elements(evento."catalogo"->'lotes') AS lotes(lote)
JOIN "pecuaria"."RegistroGenealogicoAnimal" registro ON registro."registro" = lote->>'registro';
