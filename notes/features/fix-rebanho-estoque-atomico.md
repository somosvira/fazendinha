# fix/rebanho-estoque-atomico

## Objetivo

Garantir consistência atômica entre movimentos de entrada do estoque leiteiro e os lançamentos financeiros gerados, além de impedir exclusão manual de movimentos automáticos ou pertencentes a outro sítio.

## Escopo

- criação movimento + lançamento + vínculo em uma transação;
- exclusão movimento + lançamento em uma transação;
- validação de mês fechado dentro da transação;
- bloqueio de origens SANIDADE/NUTRICAO;
- validação da propriedade ativa na exclusão;
- testes de regressão do serviço e rota.

## Fora deste PR

Demais achados da auditoria (lactação, import/seed, isolamento transversal, UX e documentação) serão tratados em blocos separados.

## Validação

- 8 testes novos do serviço (atomicidade, mês fechado, origem e escopo);
- 39 testes focados de estoque/ponte aprovados;
- suíte backend completa: 107 arquivos e 909 testes aprovados;
- build completo de server e client aprovado após `pnpm prisma:generate`;
- aviso existente do Vite para chunks acima de 500 kB, sem relação com este PR.
