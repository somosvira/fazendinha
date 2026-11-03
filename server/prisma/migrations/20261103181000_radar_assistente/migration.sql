CREATE TABLE public."AssinaturaRadarAssistente" (
 "chave" text PRIMARY KEY, "usuarioId" integer NOT NULL REFERENCES public."Usuario"("id") ON DELETE CASCADE,
 "propriedadeId" integer REFERENCES public."Propriedade"("id") ON DELETE CASCADE,
 "permissoes" text NOT NULL, "ultimoUso" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."SnapshotRadarAssistente" (
 "chave" text NOT NULL, "dia" date NOT NULL, "usuarioId" integer NOT NULL REFERENCES public."Usuario"("id") ON DELETE CASCADE,
 "criadoEm" timestamptz NOT NULL DEFAULT now(), "conteudo" jsonb, "iaReservada" boolean NOT NULL DEFAULT false,
 PRIMARY KEY ("chave", "dia")
);
CREATE INDEX "SnapshotRadarAssistente_dia_idx" ON public."SnapshotRadarAssistente"("dia");
CREATE INDEX "AssinaturaRadarAssistente_ultimoUso_idx" ON public."AssinaturaRadarAssistente"("ultimoUso");
