# fix/rebanho-agregados-propriedade

## Objetivo

Fazer Produção, Custo de Produção, Custo Sanitário e IA refletirem exclusivamente a propriedade ativa.

## Escopo

- leituras agregadas filtradas por sítio;
- controles e produção de lote validados no sítio ativo;
- `ProducaoLote` recebe `propriedadeId` para representar o tanque geral de um sítio;
- custos filtram lançamentos, animais e aplicações pelo mesmo escopo;
- contexto e insights da IA usam animais e grupos do sítio selecionado;
- backfill de `ProducaoLote` por grupo ou propriedade principal.

## Implementado

- produção agregada, carência e ranking filtram animais do sítio;
- produção por lote carrega `propriedadeId`, valida o grupo e recomputa apenas animais do sítio;
- modo tanque geral procura o registro da propriedade do animal;
- custo de produção filtra lançamentos e animais e passa o escopo ao estoque;
- custo sanitário ignora estornos e filtra lançamentos/aplicações pelo sítio;
- contexto, respostas e insights da IA usam animais e grupos do sítio ativo;
- agregação por lote deixou de fazer uma query por grupo.

## Validação

- 44 testes focados de produção/custos/IA aprovados;
- backend completo: 107 arquivos e 905 testes aprovados;
- build completo de server e client aprovado;
- Prisma Client regenerado após a alteração do schema;
- aviso existente do Vite para chunks acima de 500 kB, sem relação com este PR.
