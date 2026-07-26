-- Princípios/produtos/doses/usos estruturados do catálogo de protocolos IDEAGRI.
CREATE TABLE IF NOT EXISTS "PrincipioProtocoloIATF" (
  "id" SERIAL NOT NULL,
  "protocoloId" INTEGER NOT NULL,
  "dia" INTEGER NOT NULL DEFAULT 0,
  "principio" TEXT,
  "produto" TEXT,
  "dose" TEXT,
  "uso" TEXT,
  CONSTRAINT "PrincipioProtocoloIATF_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PrincipioProtocoloIATF_protocoloId_dia_principio_produto_uso_key"
  ON "PrincipioProtocoloIATF"("protocoloId", "dia", "principio", "produto", "uso");
CREATE INDEX IF NOT EXISTS "PrincipioProtocoloIATF_protocoloId_idx"
  ON "PrincipioProtocoloIATF"("protocoloId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PrincipioProtocoloIATF_protocoloId_fkey'
  ) THEN
    ALTER TABLE "PrincipioProtocoloIATF"
      ADD CONSTRAINT "PrincipioProtocoloIATF_protocoloId_fkey"
      FOREIGN KEY ("protocoloId") REFERENCES "ProtocoloIATF"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
