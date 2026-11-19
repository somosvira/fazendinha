-- Quantidades explicitamente configuradas, com unidade congelada por medicamento.
-- Templates anteriores continuam sem dose padrão; não inferir dose clínica na migração.
ALTER TABLE pecuaria."TemplateAplicacoesTablet"
 ADD COLUMN "quantidades" JSONB NOT NULL DEFAULT '{}'::jsonb,
 ADD CONSTRAINT "TemplateAplicacoesTablet_quantidades_objeto" CHECK (jsonb_typeof("quantidades") = 'object');
