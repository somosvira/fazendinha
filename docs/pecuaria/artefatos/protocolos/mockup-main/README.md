# Mockup de IATF — estilo da main

Proposta visual isolada para a turma de IATF, na direção **Operate**. Preserva a UX aprovada: etapas e animais na mesma seção, procedimentos e custos ao final, seções recolhíveis, ações explícitas por botões e até dez itens por página nas listas. O contexto funcional está nos [contratos de Pecuária](../../../README.md); este artefato não altera o aplicativo.

Abra [a demonstração local](http://127.0.0.1:41877/docs/pecuaria/artefatos/protocolos/mockup-main/index.html#turma). Se o servidor não estiver ativo, execute na raiz do repositório:

```sh
python3 -m http.server 41877 --bind 127.0.0.1
```

Também é possível abrir `index.html` diretamente no navegador. Os dados são ilustrativos; as alterações simuladas ficam na memória da página e reiniciam ao recarregar. Não há escrita em API ou banco de dados.

## Fonte visual

A referência é `origin/main` na revisão `895ae3d3` (PR #318). `main-tokens.css` reproduz `client/src/styles/cooperativa-theme.css`, com apenas o caminho da fonte adaptado; `main-tables.css` reproduz `client/src/styles/tabelas-operacionais.css`. A fonte Manrope e sua licença `OFL.txt` acompanham o artefato, provenientes da mesma revisão. Embora documentação visual anterior cite DM para títulos, o CSS dessa referência usa Manrope, adotada aqui.

A proposta usa verde principal `#006f68`, fundo `#f7f8fa`, barra lateral `#dce8e5`, seleção `#2f7570` e cabeçalhos de tabela `#e2e7ea`. `index.html`, `layout.css` e `mockup.js` preservam a base do mockup irmão; `proposta.css` aplica esta adaptação de estilo. Esses arquivos registram uma proposta local, sem estabelecer um novo padrão visual global.

## Validação e limites

A verificação de navegador está registrada em `.scratch/mockup-main-proof/verificacoes.txt`, com capturas em desktop, tablet e celular, incluindo a tabela final no celular. Foram exercitados troca de etapa, filtro de pendentes, adiamento na linha, abertura de custos e atendimento simulado; a paginação dos procedimentos mostrou dez itens na primeira página e dois na segunda após a simulação. O registro também conferiu a cor principal e Manrope no título.

Essas evidências cobrem o mockup de IATF. Não comprovam implementação de backend, integração com estoque/financeiro ou homologação operacional da fazenda.
