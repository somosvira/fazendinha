BEGIN;
-- Regularizações anteriores encerradas deixam de participar da projeção do vínculo atual.
UPDATE pecuaria."VinculoTarefaProtocolo" v SET estado='ENCERRADO'
 FROM pecuaria."TarefaProtocolo" t WHERE v."tarefaId"=t.id AND v.estado IN ('ATUAL','HISTORICO')
 AND t."historicoRegularizacao"->-1->>'acao'='ENCERRAR_SEM_SUBSTITUICAO';
-- Apenas metadados de execução/regularização: nenhum fato, consumo, valor ou impressão é reexecutado.
WITH referencias AS (
 SELECT t.id, v.id AS vinculo, COALESCE(a.data,e.data) AS data,
        COALESCE(a.status,e.status)::text AS status,
        COALESCE(a."motivoAnulacao",e."motivoAnulacao") AS motivo,
        COALESCE(a."anuladoEm",e."anuladoEm") AS "anuladoEm",
        CASE WHEN a.id IS NOT NULL THEN 'APLICACAO' ELSE 'EXAME' END AS "fatoTipo",
        COALESCE(a.id,e.id) AS "fatoId",
        CASE WHEN a."consumoMantido" THEN 'MANTER_CONSUMO' WHEN a."movimentoEstoqueId" IS NOT NULL THEN 'DEVOLVER_ESTOQUE' ELSE NULL END AS destino
 FROM pecuaria."TarefaProtocolo" t JOIN pecuaria."ParticipacaoProtocolo" p ON p.id=t."participacaoId"
 JOIN pecuaria."Protocolo" pr ON pr.id=p."protocoloId" AND pr.tipo='SANITARIO'
 JOIN LATERAL (SELECT v.* FROM pecuaria."VinculoTarefaProtocolo" v WHERE v."tarefaId"=t.id ORDER BY (v.estado='ATUAL') DESC,v.ordem DESC LIMIT 1) v ON TRUE
 LEFT JOIN pecuaria."AplicacaoProduto" a ON a.id=v."aplicacaoId"
 LEFT JOIN pecuaria."ExameAnimal" e ON e.id=v."exameId"
 WHERE t."dispensadaEm" IS NULL AND p."canceladaEm" IS NULL AND v.estado IN ('ATUAL','HISTORICO')
)
UPDATE pecuaria."TarefaProtocolo" t SET "realizadaEm"=COALESCE(t."realizadaEm",r.data::timestamp),
 "regularizacaoPendente"=CASE WHEN r.status='ANULADO' THEN TRUE ELSE t."regularizacaoPendente" END,
 "historicoRegularizacao"=CASE WHEN r.status='ANULADO' AND NOT t."regularizacaoPendente" THEN t."historicoRegularizacao" || jsonb_build_array(jsonb_build_object('acao','FATO_ANULADO','fatoTipo',r."fatoTipo",'fatoId',r."fatoId",'motivo',r.motivo,'data',r."anuladoEm",'destinoConsumo',r.destino,'origem','CONFERENCIA_MIGRACAO','marcadoEm',CURRENT_TIMESTAMP)) ELSE t."historicoRegularizacao" END
 FROM referencias r WHERE t.id=r.id;
UPDATE pecuaria."ParticipanteVisita" v SET "regularizacaoPendente"=TRUE,
 "historicoRegularizacao"=v."historicoRegularizacao" || t."historicoRegularizacao"
 FROM pecuaria."TarefaProtocolo" t WHERE v."tarefaId"=t.id AND v.status='CONFIRMADO' AND t."regularizacaoPendente" AND NOT v."regularizacaoPendente";
COMMIT;
