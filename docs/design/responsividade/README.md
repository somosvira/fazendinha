# Responsividade e densidade da interface

A direção aprovada para esta entrega está incorporada ao [README do frontend](../../../client/README.md#densidade-responsiva-da-navegação-e-dos-protocolos), ao [design unificado](../cooperativa-unificada.md#responsividade-e-consultas-compactas) e à [arquitetura](../../../ARCHITECTURE.md). Este diretório conserva somente a referência visual e os limites de sua evidência; o plano temporário foi substituído pelos contratos vigentes.

## Referência visual

O [mockup](mockup.html) usa dados ilustrativos e ações simuladas, sem API, banco ou armazenamento da aplicação. Para visualizá-lo, servir a raiz do repositório por HTTP e abrir `/docs/design/responsividade/mockup.html`. Ele conserva a direção aceita de shell/sidebar e protocolos; o conteúdo dos cartões de animais foi posteriormente reduzido a cabeçalho, imagem/tags/lote e ações. Não substitui a implementação ou sua validação.

A revisão da direção usou `impeccable`; `frontend-design` não estava disponível e o usuário autorizou a continuidade com a revisão disponível. A identidade Terrano foi preservada. Os contratos funcionais continuam nos documentos de domínio.

## Escopo implementado

- Gutters simétricos, títulos compartilhados compactos e acionadores alinhados no trilho; limites de 900/901 e 1100/1101 px coerentes entre CSS e variantes do Tailwind.
- Menu móvel e expansão temporária do trilho automático preservados, separados do colapso manual.
- Protocolos em tabela explícita também no celular, com rolagem própria, finalidade somente quando relevante e comandos secundários condicionados em menu.
- Cartões de protocolos sem reserva para prévia vazia; cartões de animais limitados a cabeçalho, imagem/tags/lote e ações, com altura uniforme e seleção independente.

A resposta de `GET /animais?comContexto=true` passa a incluir a situação reprodutiva já calculada em lote para a tabela de animais. Não há alteração de banco, migrations, permissões ou cálculos. Os comentários anteriores sobre tags do cabeçalho do animal e tabela de Últimas pesagens não integram esta entrega.

## Evidência e limites

Build e checagem de tipos do client executados. Testes e conferência final da aplicação são relacionados no PR, distinguindo a primeira execução e as reexecuções necessárias. O build mantém o aviso preexistente de chunk acima de 500 kB.

A aplicação foi conferida em 1427, 1209, 1100, 901, 900, 672, 390 e 320 px, incluindo tabela explícita, rolagem por teclado, nomes de protocolos, menus e navegação móvel. A inspeção usa dados existentes; não confirma comandos de negócio em STG. Login e consultas autenticadas podem renovar sessões e timestamps de acesso.

Emulação de largura não prova zoom real de 200%, leitor de tela, Safari ou dispositivo físico. Esses itens exigem conferência própria. O atalho de zoom no navegador disponível não alterou sua escala; não foi registrado como teste de zoom aprovado. Não houve migration, seed, deploy ou homologação operacional da fazenda nesta entrega.
