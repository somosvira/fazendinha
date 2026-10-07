ALTER TABLE pecuaria."ExecucaoProtocoloSanitario" ADD COLUMN "valorServicoAtribuido" DECIMAL(14,2);
ALTER TABLE pecuaria."ExameAnimal" ADD COLUMN "valorServicoAtribuido" DECIMAL(14,2);
ALTER TABLE pecuaria."ExecucaoProtocoloSanitario" ADD CONSTRAINT "execucao_rateio_nao_negativo" CHECK ("valorServicoAtribuido" IS NULL OR ("valorServicoAtribuido" >= 0 AND "operacaoServicoId" IS NOT NULL));
ALTER TABLE pecuaria."ExameAnimal" ADD CONSTRAINT "exame_rateio_nao_negativo" CHECK ("valorServicoAtribuido" IS NULL OR ("valorServicoAtribuido" >= 0 AND "operacaoServicoId" IS NOT NULL));
