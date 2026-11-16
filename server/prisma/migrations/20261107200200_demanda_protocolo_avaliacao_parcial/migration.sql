-- Mantém a função de 2001, ampliando apenas a origem protocolar de DG não avaliado.
CREATE OR REPLACE FUNCTION pecuaria.validar_demanda_acompanhamento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE registro_origem RECORD; registro_politica RECORD; registro_exame RECORD;
BEGIN
 IF TG_OP='UPDATE' AND (NEW."animalId",NEW."propriedadeOrigemId",NEW."finalidade",NEW."tentativaId",NEW."gestacaoId",NEW."ocorrencia",NEW."politicaId",NEW."dataReferencia",NEW."previstaPara",NEW."regraSnapshot",NEW."origemAdocao")
  IS DISTINCT FROM (OLD."animalId",OLD."propriedadeOrigemId",OLD."finalidade",OLD."tentativaId",OLD."gestacaoId",OLD."ocorrencia",OLD."politicaId",OLD."dataReferencia",OLD."previstaPara",OLD."regraSnapshot",OLD."origemAdocao") THEN
  IF (NEW."animalId",NEW."propriedadeOrigemId",NEW."finalidade",NEW."tentativaId",NEW."gestacaoId",NEW."ocorrencia",NEW."dataReferencia") IS DISTINCT FROM (OLD."animalId",OLD."propriedadeOrigemId",OLD."finalidade",OLD."tentativaId",OLD."gestacaoId",OLD."ocorrencia",OLD."dataReferencia") OR (NEW."origemAdocao" IS DISTINCT FROM OLD."origemAdocao" AND NOT ((OLD."origemAdocao"='MODELO' OR (OLD."origemAdocao"='SEM_REGRA' AND OLD."regraSnapshot"->>'motivo'='REGRA_NAO_CONFIGURADA')) AND NEW."origemAdocao"='ADOCAO_EXPLICITA')) OR OLD.estado <> 'PENDENTE' OR NEW.estado <> 'PENDENTE' OR OLD."tarefaId" IS DISTINCT FROM NEW."tarefaId" OR (OLD."tarefaId" IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM pecuaria."RevisaoPrazoAcompanhamento" revisao
   JOIN pecuaria."TarefaProtocolo" t ON t.id=OLD."tarefaId"
   JOIN pecuaria."ParticipacaoProtocolo" p ON p.id=t."participacaoId"
   LEFT JOIN pecuaria."ProgramacaoProtocolo" programacao ON programacao.id=p."programacaoId"
   WHERE revisao."demandaId"=OLD.id AND revisao."versaoAnterior"=OLD.versao AND revisao."tarefaId"=t.id
    AND revisao."tarefaPrevistaAnterior"=t."previstaEm" AND revisao."tarefaPrevistaNova"=NEW."previstaPara"::timestamp
    AND t."previstaEm"::date=OLD."previstaPara" AND t."precisaoTemporal"='DIA' AND NOT t."previsaoPendente"
    AND t."realizadaEm" IS NULL AND t."dispensadaEm" IS NULL AND NOT t."regularizacaoPendente" AND p."canceladaEm" IS NULL
    AND (programacao.id IS NULL OR programacao.status='ABERTA')
    AND t."previsaoOriginal" IS NOT NULL AND t."planejadoSnapshot"->>'previsaoOriginal'=to_char(t."previsaoOriginal",'YYYY-MM-DD')
    AND jsonb_typeof(t."historicoReprogramacao")='array'
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(t."historicoReprogramacao") h WHERE h->>'acao' IS DISTINCT FROM 'REVISAO_REGRA_ACOMPANHAMENTO')
    AND (CASE WHEN jsonb_array_length(t."historicoReprogramacao")=0 THEN t."previstaEm"=t."previsaoOriginal" ELSE t."historicoReprogramacao"->-1->>'previstaNova'=to_char(t."previstaEm",'YYYY-MM-DD') END)
    AND NOT EXISTS (SELECT 1 FROM pecuaria."EventoTarefaProtocolo" e WHERE e."tarefaId"=t.id)
    AND NOT EXISTS (SELECT 1 FROM pecuaria."VinculoTarefaProtocolo" v WHERE v."tarefaId"=t.id)
    AND NOT EXISTS (SELECT 1 FROM pecuaria."ExameAnimal" e WHERE e."tarefaId"=t.id)
    AND NOT EXISTS (SELECT 1 FROM pecuaria."AplicacaoProduto" a WHERE a."tarefaId"=t.id)
    AND NOT EXISTS (SELECT 1 FROM pecuaria."TentativaReprodutiva" tentativa WHERE tentativa."tarefaId"=t.id)
    AND NOT EXISTS (SELECT 1 FROM pecuaria."ManejoAnimal" m WHERE m."tarefaId"=t.id)
  )) OR NEW.versao <> OLD.versao + 1 OR NOT EXISTS (
    SELECT 1 FROM pecuaria."RevisaoPrazoAcompanhamento" r WHERE r."demandaId"=OLD.id AND r."versaoAnterior"=OLD.versao AND r."tarefaId" IS NOT DISTINCT FROM OLD."tarefaId" AND r."politicaAnteriorId" IS NOT DISTINCT FROM OLD."politicaId" AND r."politicaNovaId"=NEW."politicaId" AND r."previstaAnterior" IS NOT DISTINCT FROM OLD."previstaPara" AND r."previstaNova"=NEW."previstaPara" AND r."regraAnterior"=OLD."regraSnapshot" AND r."regraNova"=NEW."regraSnapshot"
  ) THEN RAISE EXCEPTION 'origem e regra da demanda são congeladas sem revisão explícita' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW."origemAdocao"='PROTOCOLO' THEN
  IF TG_OP='UPDATE' AND (NEW."tarefaId",NEW."exameOrigemId") IS DISTINCT FROM (OLD."tarefaId",OLD."exameOrigemId") THEN
   RAISE EXCEPTION 'origem protocolar da demanda é congelada' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (
   SELECT 1 FROM pecuaria."TarefaProtocolo" t
   JOIN pecuaria."ParticipacaoProtocolo" p ON p.id=t."participacaoId"
   JOIN pecuaria."EtapaProtocolo" a ON a.id=t."etapaId"
   JOIN pecuaria."ExameAnimal" e ON e.id=NEW."exameOrigemId"
   LEFT JOIN pecuaria."InterpretacaoReprodutiva" i ON i."exameId"=e.id
   WHERE t.id=NEW."tarefaId" AND p."animalId"=NEW."animalId" AND p."propriedadeId"=NEW."propriedadeOrigemId"
    AND a.tipo='EXAME' AND a.configuracao->>'tipo'='AVALIACAO'
    AND NEW."regraSnapshot"->'acao' IS NOT DISTINCT FROM a.configuracao
    AND e."animalId"=NEW."animalId" AND e."tarefaId"=t.id AND e."propriedadeId"=NEW."propriedadeOrigemId"
    AND e.data=NEW."dataReferencia" AND (NEW.finalidade=ANY(e.finalidades) OR (
     NEW.finalidade IN ('DIAGNOSTICO','RECONFIRMACAO') AND a.configuracao->'planoAvaliacao'->>'tipo'=NEW.finalidade
     AND e."finalidadePrincipal"='AVALIACAO_REPRODUTIVA' AND e."avaliacaoContextualSnapshot" IS NOT NULL
    ))
    AND e."tipoExameId"=NEW."regraSnapshot"->>'tipoExameId'
    AND e."formatoSnapshot"->>'versao'=NEW."regraSnapshot"->>'tipoExameVersao'
    AND i."tentativaId" IS NOT DISTINCT FROM NEW."tentativaId" AND i."gestacaoId" IS NOT DISTINCT FROM NEW."gestacaoId"
    AND (TG_OP='UPDATE' OR (e.status='VALIDO' AND e.realizacao='REALIZADO' AND (
     EXISTS (SELECT 1 FROM pecuaria."ResultadoExame" r WHERE r."exameId"=e.id AND r.vigente AND r.campo='CONCLUSAO_GESTACIONAL' AND r.valor='"INCONCLUSIVO"'::jsonb)
     OR (NEW.finalidade IN ('DIAGNOSTICO','RECONFIRMACAO') AND a.configuracao->'planoAvaliacao'->>'tipo'=NEW.finalidade
      AND e."finalidadePrincipal"='AVALIACAO_REPRODUTIVA' AND e."avaliacaoContextualSnapshot" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM pecuaria."ResultadoExame" r WHERE r."exameId"=e.id AND r.vigente AND r.campo='CONCLUSAO_GESTACIONAL')))))
  ) THEN RAISE EXCEPTION 'demanda protocolar exige tarefa e exame parcial ou inconclusivo compatíveis' USING ERRCODE='23514'; END IF;
 ELSIF NEW."origemAdocao" IN ('MODELO','INDIVIDUAL','SEM_REGRA') THEN
  IF NOT (
   (NEW.finalidade='DIAGNOSTICO' AND NEW.ocorrencia=1 AND EXISTS (
    SELECT 1 FROM pecuaria."ParticipacaoProtocolo" p
    JOIN pecuaria."TentativaReprodutiva" t ON t.id=NEW."tentativaId"
    LEFT JOIN pecuaria."TarefaProtocolo" tarefa ON tarefa.id=t."tarefaId" AND tarefa."participacaoId"=p.id
    WHERE p.id=NEW."participacaoAcompanhamentoId" AND (tarefa.id IS NOT NULL OR EXISTS (SELECT 1 FROM pecuaria."VinculoTentativaParticipacao" v WHERE v."participacaoId"=p.id AND v."tentativaId"=t.id AND (v."revogadoEm" IS NULL OR TG_OP='UPDATE'))) AND p."animalId"=NEW."animalId" AND p."propriedadeId"=NEW."propriedadeOrigemId"
     AND t."animalId"=p."animalId" AND t."propriedadeId"=p."propriedadeId" AND t.data=NEW."dataReferencia" AND (TG_OP='UPDATE' OR t.status='VALIDO')
     AND NEW."regraSnapshot"->>'origem'=NEW."origemAdocao" AND NEW."regraSnapshot"->>'participacaoId'=p.id AND NEW."regraSnapshot"->>'protocoloId'=p."protocoloId"
     AND ((NEW."origemAdocao"='INDIVIDUAL' AND NEW."previstaPara"=(p."acompanhamentoSnapshot"->>'diagnosticoIndividualEm')::date AND NEW."regraSnapshot"->>'dataIndividual'=p."acompanhamentoSnapshot"->>'diagnosticoIndividualEm' AND NEW."regraSnapshot"->>'referencia'=t.tipo)
      OR (NEW."origemAdocao"='SEM_REGRA' AND NEW."previstaPara" IS NULL AND NEW."regraSnapshot"->>'referencia'=t.tipo AND (
        (NEW."regraSnapshot"->>'motivo'='AGENDAMENTO_ANTERIOR_A_TENTATIVA' AND (p."acompanhamentoSnapshot"->>'diagnosticoIndividualEm')::date < t.data)
        OR (NEW."regraSnapshot"->>'motivo'='REGRA_NAO_CONFIGURADA' AND p."acompanhamentoSnapshot"->>'diagnosticoIndividualEm' IS NULL
          AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(p."acompanhamentoSnapshot"->'modelo'->'regras','[]'::jsonb)) r WHERE r->>'finalidade'='DIAGNOSTICO' AND r->>'publico'=t.tipo)
          AND (p."acompanhamentoSnapshot"->'sitio' IS NULL OR p."acompanhamentoSnapshot"->'sitio'='null'::jsonb
            OR (p."acompanhamentoSnapshot"->'sitio'->'parametros'->>'versao'='1' AND p."acompanhamentoSnapshot"->'sitio'->'parametros'->'diagnostico'='null'::jsonb)
            OR (p."acompanhamentoSnapshot"->'sitio'->'parametros'->>'versao'='2' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p."acompanhamentoSnapshot"->'sitio'->'parametros'->'regras') r WHERE r->>'finalidade'='DIAGNOSTICO' AND r->>'publico'=t.tipo)))
        )))
      OR (NEW."origemAdocao"='MODELO' AND p."acompanhamentoSnapshot"->'modelo'->'regras' @> jsonb_build_array(NEW."regraSnapshot"->'regra')
       AND NEW."regraSnapshot"->'regra'->>'publico'=t.tipo AND NEW."regraSnapshot"->'regra'->>'finalidade'='DIAGNOSTICO'
       AND NEW."regraSnapshot"->>'referencia'=NEW."regraSnapshot"->'regra'->>'referencia'
       AND NEW."regraSnapshot"->>'tipoExameId' IS NOT DISTINCT FROM NEW."regraSnapshot"->'regra'->>'tipoExameId'
       AND NEW."regraSnapshot"->>'tipoExameVersao' IS NOT DISTINCT FROM NEW."regraSnapshot"->'regra'->>'tipoExameVersao'
       AND NEW."previstaPara"=t.data + (NEW."regraSnapshot"->'regra'->>'intervalo')::integer))
   )) OR (NEW.finalidade='RECONFIRMACAO' AND NEW."origemAdocao"='MODELO' AND EXISTS (
    SELECT 1 FROM pecuaria."ParticipacaoProtocolo" p
    JOIN pecuaria."TentativaReprodutiva" t ON t."animalId"=p."animalId" AND t."propriedadeId"=p."propriedadeId"
    LEFT JOIN pecuaria."TarefaProtocolo" tarefa ON tarefa.id=t."tarefaId" AND tarefa."participacaoId"=p.id
    JOIN pecuaria."GestacaoAnimal" g ON g.id=NEW."gestacaoId" AND g."tentativaId"=t.id
    JOIN pecuaria."ExameAnimal" e ON e.id=NEW."exameOrigemId"
    JOIN pecuaria."InterpretacaoReprodutiva" i ON i."exameId"=e.id AND i."gestacaoId"=g.id
    WHERE p.id=NEW."participacaoAcompanhamentoId" AND (tarefa.id IS NOT NULL OR EXISTS (SELECT 1 FROM pecuaria."VinculoTentativaParticipacao" v WHERE v."participacaoId"=p.id AND v."tentativaId"=t.id AND (v."revogadoEm" IS NULL OR TG_OP='UPDATE')) OR EXISTS (
      SELECT 1 FROM pecuaria."DemandaAcompanhamentoReprodutivo" dg
      LEFT JOIN pecuaria."VinculoConclusaoAcompanhamento" conclusao ON conclusao.id=dg."vinculoConclusaoResolucaoId" AND conclusao.vigente
      LEFT JOIN pecuaria."ResultadoExame" resultado ON resultado.id=conclusao."resultadoId" AND resultado.vigente
      WHERE dg."participacaoAcompanhamentoId"=p.id AND dg."tentativaId"=t.id AND dg.finalidade='DIAGNOSTICO'
       AND t.status='VALIDO' AND dg.estado IN ('PENDENTE','RESOLVIDA')
       AND ((dg.estado='RESOLVIDA' AND dg."exameResolucaoId"=e.id)
        OR e."demandaAcompanhamentoId"=dg.id
        OR (dg.estado='RESOLVIDA' AND conclusao."demandaId"=dg.id AND conclusao.fonte='RESULTADO'
         AND resultado."exameId"=e.id AND resultado.campo='CONCLUSAO_GESTACIONAL' AND resultado.valor='"POSITIVO"'::jsonb))
     )) AND p."animalId"=NEW."animalId" AND p."propriedadeId"=NEW."propriedadeOrigemId"
     AND e."animalId"=p."animalId" AND e.data=NEW."dataReferencia"
     AND (TG_OP='UPDATE' OR (g.status='VALIDO' AND e.status='VALIDO' AND e.realizacao='REALIZADO' AND EXISTS (SELECT 1 FROM pecuaria."ResultadoExame" r WHERE r."exameId"=e.id AND r.vigente AND r.campo='CONCLUSAO_GESTACIONAL' AND r.valor='"POSITIVO"'::jsonb)))
     AND NEW."regraSnapshot"->>'origem'='MODELO' AND NEW."regraSnapshot"->>'participacaoId'=p.id AND NEW."regraSnapshot"->>'protocoloId'=p."protocoloId"
     AND p."acompanhamentoSnapshot"->'modelo'->'regras' @> jsonb_build_array(NEW."regraSnapshot"->'regra')
     AND NEW."regraSnapshot"->'regra'->>'publico'='GESTACAO' AND NEW."regraSnapshot"->'regra'->>'finalidade'='RECONFIRMACAO'
     AND NEW."regraSnapshot"->>'referencia'=NEW."regraSnapshot"->'regra'->>'referencia'
     AND NEW."regraSnapshot"->>'tipoExameId' IS NOT DISTINCT FROM NEW."regraSnapshot"->'regra'->>'tipoExameId'
     AND NEW."regraSnapshot"->>'tipoExameVersao' IS NOT DISTINCT FROM NEW."regraSnapshot"->'regra'->>'tipoExameVersao'
     AND (NEW."regraSnapshot"->'regra'->>'ocorrencia')::integer=NEW.ocorrencia
     AND NEW."previstaPara"=e.data + (NEW."regraSnapshot"->'regra'->>'intervalo')::integer
   ))
  ) THEN RAISE EXCEPTION 'demanda exige origem e prazo válidos da participação' USING ERRCODE='23514'; END IF;
 ELSE
 IF NEW."tentativaId" IS NOT NULL THEN SELECT t."animalId",t."propriedadeId" INTO registro_origem FROM pecuaria."TentativaReprodutiva" t WHERE t.id=NEW."tentativaId";
 ELSE SELECT g."animalId",g."propriedadeId" INTO registro_origem FROM pecuaria."GestacaoAnimal" g WHERE g.id=NEW."gestacaoId"; END IF;
 SELECT p."propriedadeId",p.versao INTO registro_politica FROM pecuaria."PoliticaAcompanhamentoReprodutivo" p WHERE p.id=NEW."politicaId";
 IF registro_origem."animalId" IS DISTINCT FROM NEW."animalId" OR registro_origem."propriedadeId" IS DISTINCT FROM NEW."propriedadeOrigemId"
  OR registro_politica."propriedadeId" IS DISTINCT FROM NEW."propriedadeOrigemId" THEN RAISE EXCEPTION 'demanda incompatível com animal/sítio da origem' USING ERRCODE='23514'; END IF;
 IF NEW."regraSnapshot"->>'politicaId' IS DISTINCT FROM NEW."politicaId" OR NEW."regraSnapshot"->>'politicaVersao' IS DISTINCT FROM registro_politica.versao::TEXT THEN RAISE EXCEPTION 'snapshot da demanda diverge da versão congelada' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW."tarefaId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pecuaria."TarefaProtocolo" t JOIN pecuaria."ParticipacaoProtocolo" p ON p.id=t."participacaoId" WHERE t.id=NEW."tarefaId" AND p."animalId"=NEW."animalId") THEN RAISE EXCEPTION 'tarefa de outro animal' USING ERRCODE='23514'; END IF;
 IF NEW."exameResolucaoId" IS NOT NULL THEN
  SELECT e.*, i."tentativaId" AS "tentativaOrigemId",i."gestacaoId" AS "gestacaoOrigemId" INTO registro_exame FROM pecuaria."ExameAnimal" e LEFT JOIN pecuaria."InterpretacaoReprodutiva" i ON i."exameId"=e.id WHERE e.id=NEW."exameResolucaoId";
  IF registro_exame."animalId" IS DISTINCT FROM NEW."animalId" OR registro_exame.status IS DISTINCT FROM 'VALIDO' OR registro_exame.realizacao IS DISTINCT FROM 'REALIZADO'
   OR NOT (NEW.finalidade=ANY(registro_exame.finalidades)) OR registro_exame.data<NEW."dataReferencia" OR (NEW.finalidade='RECONFIRMACAO' AND registro_exame.data<NEW."previstaPara")
   OR (NEW."tentativaId" IS NOT NULL AND registro_exame."tentativaOrigemId" IS DISTINCT FROM NEW."tentativaId")
   OR (NEW."gestacaoId" IS NOT NULL AND registro_exame."gestacaoOrigemId" IS DISTINCT FROM NEW."gestacaoId")
   OR (registro_exame."demandaAcompanhamentoId" IS NOT NULL AND registro_exame."demandaAcompanhamentoId"<>NEW.id)
   OR NOT EXISTS(SELECT 1 FROM pecuaria."ResultadoExame" r WHERE r."exameId"=registro_exame.id AND r.vigente AND ((NEW.finalidade='SEXAGEM' AND r.campo='SEXO_FETAL' AND r.valor IN ('"F"'::jsonb,'"M"'::jsonb)) OR (NEW.finalidade<>'SEXAGEM' AND r.campo='CONCLUSAO_GESTACIONAL' AND r.valor IN ('"POSITIVO"'::jsonb,'"NEGATIVO"'::jsonb)))) THEN
   RAISE EXCEPTION 'resolução exige conclusão vigente compatível com a demanda' USING ERRCODE='23514';
  END IF;
  IF NEW."regraSnapshot"->>'tipoExameId' IS NOT NULL AND (registro_exame."tipoExameId" IS DISTINCT FROM NEW."regraSnapshot"->>'tipoExameId' OR registro_exame."formatoSnapshot"->>'versao' IS DISTINCT FROM NEW."regraSnapshot"->>'tipoExameVersao') THEN RAISE EXCEPTION 'resolução difere do formato congelado' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
