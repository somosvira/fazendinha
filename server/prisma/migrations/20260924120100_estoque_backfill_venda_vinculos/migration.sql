-- Backfill da migration anterior. Idempotente: só toca linhas ainda sem o dado.

-- Saídas de venda gravadas com a origem genérica de ajuste.
UPDATE "MovimentoEstoque" m SET "origem" = 'VENDA'
FROM "Operacao" o
WHERE m."operacaoId" = o."id" AND o."tipo" = 'VENDA'
  AND m."tipo" = 'SAIDA' AND m."reversaoDeId" IS NULL AND m."origem" = 'AJUSTE_INVENTARIO';

-- Vínculo a partir dos eventos que ainda existem.
UPDATE "MovimentoEstoque" m SET "animalId" = e."animalId"
FROM "EventoSanitario" e
WHERE e."movimentoEstoqueId" = m."id" AND m."animalId" IS NULL;

UPDATE "MovimentoEstoque" m SET "talhaoId" = a."talhaoId"
FROM "OperacaoAgricola" a
WHERE a."movimentoEstoqueId" = m."id" AND m."talhaoId" IS NULL;

-- Eventos já excluídos: recupera pela observação gerada na baixa
-- ("Consumo em aplicacao (animal 12)", "Aplicação em T-03").
UPDATE "MovimentoEstoque" m SET "animalId" = an."id"
FROM "Animal" an
WHERE m."origem" = 'SANIDADE' AND m."reversaoDeId" IS NULL AND m."animalId" IS NULL
  AND an."id" = CAST(substring(m."observacao" FROM '\(animal (\d+)\)$') AS INTEGER);

UPDATE "MovimentoEstoque" m SET "talhaoId" = t."id"
FROM "Talhao" t
WHERE m."origem" = 'APLICACAO' AND m."reversaoDeId" IS NULL AND m."talhaoId" IS NULL
  AND m."observacao" = 'Aplicação em ' || t."codigo";

-- Estornos herdam o vínculo do movimento original.
UPDATE "MovimentoEstoque" inv SET "animalId" = orig."animalId", "talhaoId" = orig."talhaoId"
FROM "MovimentoEstoque" orig
WHERE inv."reversaoDeId" = orig."id" AND inv."animalId" IS NULL AND inv."talhaoId" IS NULL
  AND (orig."animalId" IS NOT NULL OR orig."talhaoId" IS NOT NULL);
