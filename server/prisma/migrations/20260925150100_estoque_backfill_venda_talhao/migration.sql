-- Backfill da migration anterior. Idempotente: só toca linhas ainda sem o dado.

-- Saídas de venda gravadas com a origem genérica de ajuste.
UPDATE "MovimentoEstoque" m SET "origem" = 'VENDA'
FROM "Operacao" o
WHERE m."operacaoId" = o."id" AND o."tipo" = 'VENDA'
  AND m."tipo" = 'SAIDA' AND m."reversaoDeId" IS NULL AND m."origem" = 'AJUSTE_INVENTARIO';

-- Talhão a partir das operações agrícolas que ainda existem.
UPDATE "MovimentoEstoque" m SET "talhaoId" = a."talhaoId"
FROM "OperacaoAgricola" a
WHERE a."movimentoEstoqueId" = m."id" AND m."talhaoId" IS NULL;

-- Operações já excluídas: recupera pela observação gerada na baixa ("Aplicação em T-03").
UPDATE "MovimentoEstoque" m SET "talhaoId" = t."id"
FROM "Talhao" t
WHERE m."origem" = 'APLICACAO' AND m."reversaoDeId" IS NULL AND m."talhaoId" IS NULL
  AND m."observacao" = 'Aplicação em ' || t."codigo";

-- Estornos herdam o talhão do movimento original.
UPDATE "MovimentoEstoque" inv SET "talhaoId" = orig."talhaoId"
FROM "MovimentoEstoque" orig
WHERE inv."reversaoDeId" = orig."id" AND inv."talhaoId" IS NULL AND orig."talhaoId" IS NOT NULL;
