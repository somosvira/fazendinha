-- Agrupamento opcional de cadastro; preserva categorias e fatos existentes.
CREATE TABLE "public"."GrupoCategoria" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "GrupoCategoria_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GrupoCategoria_nome_key" ON "public"."GrupoCategoria"("nome");
ALTER TABLE "public"."Categoria" ADD COLUMN "grupoId" TEXT;
CREATE INDEX "Categoria_grupoId_idx" ON "public"."Categoria"("grupoId");
ALTER TABLE "public"."Categoria" ADD CONSTRAINT "Categoria_grupoId_fkey"
    FOREIGN KEY ("grupoId") REFERENCES "public"."GrupoCategoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
