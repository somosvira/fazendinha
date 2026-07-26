# fix/rebanho-lactacao-coerente

## Objetivo

Preservar a coerência entre eventos reprodutivos, lactações persistidas e o resumo do animal.

## Escopo inicial revalidado

- novo parto precisa encerrar uma lactação anterior ainda aberta;
- o resumo deve usar as lactações persistidas, inclusive ciclos importados sem evento de parto correspondente;
- exclusão de parto não pode deixar uma lactação fantasma;
- primeiro parto deve promover novilha para vaca.

DEL e gestação dinâmicos, concorrência/constraints de banco e alterações de schema serão avaliados separadamente para manter o PR revisável.

## Implementado

- novo parto encerra todos os ciclos abertos antes de criar a lactação seguinte;
- exclusão do parto remove seu ciclo e reabre o anterior quando ele foi encerrado automaticamente por esse parto; ciclos com produção, controles ou metadados enriquecidos são protegidos por conflito explícito;
- o resumo passa a ler as lactações persistidas após a sincronização, preservando ciclos importados;
- primeiro parto promove `NOVILHA → VACA` e `CABRITA → CABRA` na mesma transação.

## Validação

- 80 testes focados de reprodução/lactação aprovados;
- backend completo: 107 arquivos e 908 testes aprovados;
- build completo de server e client aprovado;
- aviso existente do Vite para chunks acima de 500 kB, sem relação com este PR.

## Continuação necessária

- derivar DEL e dias de gestação na leitura para não congelarem sem mutação;
- adicionar constraints/serialização para proteger partos concorrentes;
- decidir e migrar unicidade estrutural de lactações em um PR de schema separado.
