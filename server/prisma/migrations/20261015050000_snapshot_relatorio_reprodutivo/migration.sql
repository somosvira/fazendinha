BEGIN;
CREATE TABLE pecuaria."SnapshotRelatorioReprodutivo" (
 id TEXT PRIMARY KEY,"propriedadeId" INTEGER NOT NULL,tipo TEXT NOT NULL,filtros JSONB NOT NULL,snapshot JSONB NOT NULL,
 versao INTEGER NOT NULL DEFAULT 1,"criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"criadoPorId" INTEGER,
 CONSTRAINT "SnapshotRelatorioReprodutivo_propriedadeId_fkey" FOREIGN KEY("propriedadeId") REFERENCES public."Propriedade"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "SnapshotRelatorioReprodutivo_criadoPorId_fkey" FOREIGN KEY("criadoPorId") REFERENCES public."Usuario"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "SnapshotRelatorioReprodutivo_tipo" CHECK(tipo IN ('PARTOS','INDICADORES')),
 CONSTRAINT "SnapshotRelatorioReprodutivo_versao" CHECK(versao>0),
 CONSTRAINT "SnapshotRelatorioReprodutivo_json" CHECK(jsonb_typeof(filtros)='object' AND jsonb_typeof(snapshot)='object')
);
CREATE INDEX "SnapshotRelatorioReprodutivo_propriedadeId_tipo_criadoEm_idx" ON pecuaria."SnapshotRelatorioReprodutivo"("propriedadeId",tipo,"criadoEm");
CREATE FUNCTION pecuaria.proteger_snapshot_relatorio_reprodutivo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Emissão é imutável; gere outro relatório preservando a versão antiga'; END $$;
CREATE TRIGGER "SnapshotRelatorioReprodutivo_imutavel" BEFORE UPDATE OR DELETE ON pecuaria."SnapshotRelatorioReprodutivo"
 FOR EACH ROW EXECUTE FUNCTION pecuaria.proteger_snapshot_relatorio_reprodutivo();
COMMIT;
