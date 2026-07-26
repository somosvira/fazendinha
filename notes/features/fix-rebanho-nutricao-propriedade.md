# fix/rebanho-nutricao-propriedade

## Objetivo

Garantir que lotes de manejo, animais e baixas de dieta respeitem a propriedade ativa.

## Escopo

- leituras e mutações de `Grupo` escopadas;
- criação de lote carimba `propriedadeId`;
- todos os `animalIds` precisam pertencer ao mesmo sítio;
- edição de lote registra o histórico de movimentação;
- previsão, fechamento, histórico e estorno de consumo validam o sítio;
- saldos e saídas de nutrição usam a propriedade do lote.

Dietas e produtos continuam compartilhados por design.

## Implementado

- rotas de lote e consumo resolvem o escopo de leitura/escrita;
- lotes são gravados e consultados somente no sítio ativo;
- criação/edição rejeitam atomicamente qualquer animal fora do sítio;
- mudanças de lote passam a gerar `MovimentacaoAnimal`;
- previsão usa cabeças e saldos do sítio;
- saídas automáticas herdam a propriedade do lote;
- histórico e estorno de consumo validam a propriedade.

## Validação

- 25 testes focados de nutrição/movimentação aprovados;
- backend completo: 108 arquivos e 908 testes aprovados;
- build completo de server e client aprovado;
- aviso existente do Vite para chunks acima de 500 kB, sem relação com este PR.
