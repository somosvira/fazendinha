CREATE TABLE pecuaria."TipoAplicacaoSanitaria" (
  id TEXT PRIMARY KEY, nome TEXT NOT NULL UNIQUE, ativo BOOLEAN NOT NULL DEFAULT true,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO pecuaria."TipoAplicacaoSanitaria" (id, nome) VALUES
('a0300000-0000-4000-8000-000000000001', 'Tratamento'),
('a0300000-0000-4000-8000-000000000002', 'Vacina'),
('a0300000-0000-4000-8000-000000000003', 'Vermífugo');
ALTER TABLE pecuaria."AplicacaoProduto" ALTER COLUMN finalidade DROP NOT NULL,
  ADD COLUMN "tipoAplicacaoId" TEXT REFERENCES pecuaria."TipoAplicacaoSanitaria"(id) ON DELETE RESTRICT,
  ADD COLUMN "tipoAplicacaoNomeSnapshot" TEXT,
  ADD COLUMN responsavel TEXT,
  ADD COLUMN "estadoCarenciaLeite" TEXT NOT NULL DEFAULT 'NAO_INFORMADO',
  ADD COLUMN "estadoCarenciaCarne" TEXT NOT NULL DEFAULT 'NAO_INFORMADO',
  ADD COLUMN "justificativaCarenciaLeite" TEXT,
  ADD COLUMN "aptidaoCarenciaSnapshot" TEXT,
  ADD COLUMN "justificativaCarenciaCarne" TEXT;
ALTER TABLE pecuaria."EtapaProtocoloSanitario"
  ADD COLUMN "tipoAplicacaoId" TEXT REFERENCES pecuaria."TipoAplicacaoSanitaria"(id) ON DELETE RESTRICT,
  ADD COLUMN "tipoAplicacaoNomeSnapshot" TEXT;
UPDATE pecuaria."AplicacaoProduto" a SET "tipoAplicacaoId"=t.id, "tipoAplicacaoNomeSnapshot"=t.nome
FROM pecuaria."TipoAplicacaoSanitaria" t WHERE t.nome=CASE a.finalidade WHEN 'VACINA' THEN 'Vacina' WHEN 'VERMIFUGO' THEN 'Vermífugo' ELSE 'Tratamento' END;
UPDATE pecuaria."EtapaProtocoloSanitario" a SET "tipoAplicacaoId"=t.id, "tipoAplicacaoNomeSnapshot"=t.nome
FROM pecuaria."TipoAplicacaoSanitaria" t WHERE a.finalidade IS NOT NULL AND t.nome=CASE a.finalidade WHEN 'VACINA' THEN 'Vacina' WHEN 'VERMIFUGO' THEN 'Vermífugo' ELSE 'Tratamento' END;
UPDATE pecuaria."AplicacaoProduto" SET "estadoCarenciaLeite"=CASE WHEN "carenciaLeiteHoras" IS NULL THEN 'NAO_INFORMADO' ELSE 'INFORMADO' END,
"estadoCarenciaCarne"=CASE WHEN "carenciaCarneHoras" IS NULL THEN 'NAO_INFORMADO' ELSE 'INFORMADO' END;
ALTER TABLE pecuaria."AplicacaoProduto" ADD CONSTRAINT "carencia_estados_v3" CHECK (
  "estadoCarenciaLeite" IN ('INFORMADO','NAO_INFORMADO','NAO_APLICAVEL') AND "estadoCarenciaCarne" IN ('INFORMADO','NAO_INFORMADO','NAO_APLICAVEL') AND
  (("estadoCarenciaLeite"='INFORMADO' AND "carenciaLeiteHoras" IS NOT NULL AND "carenciaLeiteHoras" >= 0) OR ("estadoCarenciaLeite"<>'INFORMADO' AND "carenciaLeiteHoras" IS NULL)) AND
  (("estadoCarenciaCarne"='INFORMADO' AND "carenciaCarneHoras" IS NOT NULL AND "carenciaCarneHoras" >= 0) OR ("estadoCarenciaCarne"<>'INFORMADO' AND "carenciaCarneHoras" IS NULL))
);
