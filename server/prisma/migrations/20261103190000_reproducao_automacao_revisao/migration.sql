ALTER TABLE pecuaria."AutomacaoProtocolo" ADD COLUMN "revisao" INTEGER NOT NULL DEFAULT 1 CHECK ("revisao" > 0);
-- O contrato dos fatos clínicos usa o dia em Brasília nesta versão.
ALTER TABLE pecuaria."MomentoProtocolo" ADD CONSTRAINT "MomentoProtocolo_fuso_automacao_check" CHECK ("politicaExecucao" <> 'AUTOMATICA_EXCECAO' OR "fusoHorario" = 'America/Sao_Paulo');
