CREATE TABLE public."ConversaAssistente" (
 "id" UUID PRIMARY KEY,
 "usuarioId" INTEGER NOT NULL REFERENCES public."Usuario"("id") ON DELETE CASCADE,
 "propriedadeId" INTEGER REFERENCES public."Propriedade"("id") ON DELETE RESTRICT,
 "permissoes" TEXT NOT NULL,
 "revisao" BIGINT NOT NULL DEFAULT 0,
 "titulo" TEXT NOT NULL,
 "mensagens" JSONB NOT NULL CHECK (jsonb_typeof("mensagens") = 'array'),
 "atualizadoEm" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "ConversaAssistente_usuarioId_propriedadeId_atualizadoEm_idx" ON public."ConversaAssistente" ("usuarioId", "propriedadeId", "atualizadoEm" DESC);
