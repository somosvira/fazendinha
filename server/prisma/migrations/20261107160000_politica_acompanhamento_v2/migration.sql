ALTER TABLE pecuaria."PoliticaAcompanhamentoReprodutivo" DROP CONSTRAINT "PoliticaAcompanhamento_alerta";
ALTER TABLE pecuaria."PoliticaAcompanhamentoReprodutivo" ADD CONSTRAINT "PoliticaAcompanhamento_alerta" CHECK (
 jsonb_typeof(parametros)='object' AND parametros->>'efeito' IS NOT DISTINCT FROM 'ALERTA' AND
 CASE parametros->>'versao'
  WHEN '1' THEN true
  WHEN '2' THEN CASE WHEN jsonb_typeof(parametros->'regras')='array' THEN jsonb_array_length(parametros->'regras') BETWEEN 1 AND 100 ELSE false END
  ELSE false
 END
);
