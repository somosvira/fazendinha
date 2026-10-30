# Responsividade e densidade da interface

## Estado e entrega

Plano de implementação da direção visual aprovada em 30/10/2026. O PR começa como rascunho de planejamento: este documento e o mockup não comprovam correção da aplicação. Toda a implementação, documentação e validação deste escopo deve permanecer no mesmo PR, com destino a `staging` e branch `codex/responsividade-densidade-ui`.

Base inspecionada: `53300a38`. Referência navegável: [mockup](mockup.html), com dados exclusivamente ilustrativos e ações simuladas. Para visualizar a partir da raiz do checkout, servir o repositório por HTTP e abrir `/docs/design/responsividade/mockup.html`. O mockup não acessa API, banco, autenticação ou armazenamento da aplicação.

A composição foi apresentada em 1427, 672 e 390 px e a direção foi aceita para elaboração deste plano. A revisão usou `impeccable`; a skill `frontend-design` não foi encontrada. A continuidade com a revisão disponível foi aceita na conversa. Isso não atribui homologação funcional, aprovação universal dos componentes nem validação em dispositivos físicos.

## Problema e resultado esperado

A navegação recolhida desalinha ícones e fundos; páginas deixam uma faixa extra à direita; títulos, cartões e ações consomem espaço excessivo. A escolha explícita de tabela de protocolos pode produzir cartões em telas pequenas. Os cartões de animais repetem medições e datas que o usuário quer consultar somente na ficha.

O resultado deve ser uma interface mais compacta, com margens equilibradas, uso da largura disponível, alvos acessíveis e modos de consulta previsíveis. Compactar significa ajustar composição, repetições e espaçamento; não usar zoom CSS, transformações de escala ou redução indiscriminada das fontes.

## Histórias de uso

1. Como pessoa que navega entre áreas, quero reconhecer cada ícone no menu recolhido para abrir o destino certo sem encontrar botões vazios.
2. Como pessoa que alterna o menu, quero os modos expandido, recolhido e móvel alinhados para conservar espaço e orientação.
3. Como pessoa que consulta dados, quero margens laterais iguais para aproveitar a largura da tela.
4. Como pessoa que usa o celular, quero alcançar navegação, título, filtros, assistente e ações sem sobreposição.
5. Como pessoa que consulta protocolos, quero alternar cartões e tabela conservando busca, situação, ordenação e página.
6. Como pessoa que escolheu tabela, quero comparar registros em colunas também em telas pequenas, com rolagem dentro da consulta.
7. Como pessoa que consulta protocolos sanitários, quero ver informações que diferenciam os modelos, sem uma coluna que repete a finalidade da página.
8. Como pessoa autorizada a alterar protocolos, quero acessar detalhes e comandos secundários sem que vários botões aumentem cada linha.
9. Como pessoa sem permissão de lançamento, quero consultar detalhes sem receber comandos indisponíveis ou menus vazios.
10. Como pessoa que procura um animal, quero cartões concentrados na identificação, categoria, lote, sítio e condições relevantes para localizar a ficha.
11. Como pessoa que consulta ocorrências e restrições, quero continuar vendo alertas comprovados para não perder informação que influencia a operação.
12. Como pessoa que usa teclado, ampliação ou toque, quero alcançar controles e rolagem sem cortes e com foco visível.
13. Como pessoa que aguarda uma consulta ou enfrenta uma falha, quero distinguir carregamento, vazio e erro e conseguir tentar novamente.

## Mapa dos comentários e escopo

| Comentários | Entrega | Critério observável |
|---|---|---|
| 1 | Ícone do Painel administrativo | O botão possui desenho visível e nome acessível nos três modos de navegação. |
| 2–3 | Ícones e fundos da sidebar | Área clicável e fundo estão centralizados; não existe um segundo retângulo branco excedente no seletor de sítio recolhido. |
| 4 e 9 | Largura e densidade compartilhadas | Panorama do Rebanho e Configurações têm margens esquerda/direita equivalentes e ocupam a largura restante. |
| 5 | Cartões de protocolos | Cabeçalho, situação, versão, estrutura e ações cabem em uma composição curta, sem blocos vazios reservados. |
| 6–7 | Tabela de protocolos | O modo Tabela continua sendo tabela; ações não empilham quatro botões por linha. |
| 8 | Finalidade sanitária redundante | A coluna Finalidade não aparece na consulta sanitária; continua disponível quando diferencia protocolos reprodutivos. |
| 10–11 | Cartões de animais | Peso, GMD, idade e datas saem do cartão; as mesmas informações permanecem na ficha e nos recursos de consulta existentes. |

No comentário 11, a data do rodapé é a última pesagem, não necessariamente o nascimento. Remover também essa data do cartão, além da data de nascimento no bloco de medidas. Não alterar o significado dos campos para acomodar o comentário.

## Decisões de implementação

### 1. Shell e sidebar

Fontes: `client/src/styles/base.css`, `client/src/components/AppSidebar.tsx`, `client/src/components/sidebar-clara.css`, `client/src/components/FarmPicker.tsx` e os estilos compartilhados que disputam essas regras.

- Remover a reserva global de 64 px à direita aplicada quando o assistente está disponível. O botão e o painel do assistente devem conservar acesso e uma posição que não cubra ações; se for necessária folga, aplicá-la no contexto inferior relevante, não em toda a largura da página.
- Centralizar o gutter da página em uma regra compartilhada, evitando somar padding no shell, no módulo e no conteúdo. Referência: 24 px no desktop, 20 px em larguras intermediárias e 16 px no móvel. Aceitar variações funcionais de documentos/impressões e telas explicitamente próprias.
- Conservar os breakpoints de navegação existentes: menu móvel até 900 px, trilho automático entre 901–1100 px e navegação expandida/recolhida em telas maiores. Conferir hover e foco no trilho automático, sem alterar a preferência de colapso manual.
- Corrigir a precedência da regra genérica de `justify-content` para que o estado recolhido centralize os ícones. Consolidar as regras conflitantes, evitando acrescentar mais uma camada de overrides gerais.
- Usar área visual/clique consistente no trilho, com 44 × 44 px e ícones proporcionais de aproximadamente 18–20 px. O desenho não deve ser esticado até preencher o botão: o ajuste pedido é eliminar folga assimétrica e fundos aninhados.
- Incluir um ícone de painel da biblioteca existente no mapa de navegação para `gerencial`; revisar todos os destinos autorizados para impedir outro botão sem ícone.
- No seletor de sítio recolhido, apresentar um único fundo e manter label, seleção, foco, tooltip e escopo. Na conta, preservar as ações existentes.
- Preservar atalhos de trabalhos ativos, confirmações de exclusão, permissões e navegação móvel. Não fazer exclusões nem confirmar ações durante a inspeção conectada ao STG.

### 2. Escala e organização das páginas

- Preservar paleta, fontes e identidade Terrano. Referência do mockup: título de página 24 px no desktop e 21–22 px no móvel; títulos de seção próximos de 17–18 px e corpo/valores em 14–16 px.
- Manter campos móveis em 16 px, foco visível e alvos de toque de 44 px. Controles de desktop podem usar a variante compacta existente, sem reduzir a acessibilidade dos estados móveis.
- Ajustar cabeçalhos, abas e intervalos pela fonte compartilhada que realmente os controla. Não aplicar um novo tamanho universal a todos os títulos, rótulos e indicadores.
- Testar as páginas citadas e os consumidores do shell: Financeiro, Estoque, Configurações e demais entradas da Pecuária. A mudança compartilhada de gutter deve beneficiar esses consumidores sem redesenhá-los.
- Conservar a navegação móvel no fluxo de leitura; menu, título e assistente não podem disputar o mesmo canto ou cobrir o conteúdo.

### 3. Protocolos sanitários e reprodutivos

Fontes: `CatalogoModelosProtocolos.tsx`, `CatalogoModelosProtocolos.css`, `PaginaCadastroProtocolo.tsx` e a composição existente de `TabelaFinanceira`/`VisualizacaoConsulta`.

- Reutilizar `TabelaFinanceira`, os tokens de tabelas operacionais e `DropdownMenu` do projeto. Não criar outra implementação de tabela/menu nem alterar o modo automático de todos os consumidores.
- Quando a pessoa escolher Tabela, fornecer explicitamente `visualizacao="tabela"`; colunas continuam semânticas em qualquer largura e a rolagem horizontal fica no contêiner da consulta, com acesso por teclado e indicação quando necessária.
- Na consulta sanitária: Protocolo, Situação, Versão, Estrutura e Ações. Distribuir larguras conforme o conteúdo, conservando alinhamento do cabeçalho e das células e legibilidade de nomes longos.
- Remover a finalidade repetida do cartão sanitário. No catálogo reprodutivo, manter a distinção entre IATF, TETF e preparação, inclusive na tabela.
- Deixar Ver detalhes diretamente acessível. Reunir Concluir cadastro, Nova versão e Inativar em Mais ações, mantendo exatamente os handlers, confirmações, condições de publicação/uso, permissão e bloqueio por carregamento/gravação.
- O menu deve identificar nome/versão do registro, não aparecer vazio e respeitar foco, Escape e retorno ao acionador. Em tabela rolável, o menu não pode ser cortado pelo contêiner.
- Cartões: nome, situação e metadados curtos primeiro; prévia real de procedimentos em seguida quando houver; detalhes e menu no rodapé. Não reservar altura para uma prévia ausente nem repetir “0 procedimentos” e outra frase com o mesmo significado.
- Quantidade de colunas dos cartões segue a largura efetiva, não só a viewport. Em 672 px, duas colunas são aceitáveis se nome, situação e controles couberem; em 390 px, uma coluna. Nomes extensos podem ampliar o cartão.
- Manter paginação de até dez itens, filtros, persistência e parâmetros `visualCadastroProtocolos`. Estados vazio, erro, atualização e itens inativos não perdem feedback.

### 4. Cartões de animais

Fontes: `CartaoAnimal.tsx`, `cartao-animal.css`, `ListaAnimais.tsx` e os testes de navegação/seleção existentes.

- Remover do cartão o bloco de último peso, GMD, idade e nascimento; remover também a data da última pesagem do rodapé. Não remover os campos dos DTOs, da tabela de animais ou da ficha.
- Preservar brinco/nome juntos, seleção, situação, categoria/manual, finalidade, lote, sítio e papel reprodutivo quando informado.
- Preservar fase produtiva, ciclo, pendências e ocorrências com a semântica e os dados existentes, eliminando apenas repetições visuais. Não inferir condição clínica nem criar novos indicadores.
- Manter ações adicionais e Ver animal com destino exato, filtros e retorno preservados. A seleção não deve abrir a ficha e o botão da ficha não deve disparar seleção.
- Compactar retrato, espaçamento e rodapé de forma responsiva. Não impor uma altura fixa que corte nomes, alertas ou estados.

### 5. Contratos e documentação

Não há alteração planejada de API, schema, migrations ou variáveis de ambiente. A autorização continua no servidor. URLs, filtros, escopo por sítio, cálculos e efeitos das ações permanecem os existentes.

Atualizar na implementação `client/README.md`, `client/DESIGN.md` e `docs/design/cooperativa-unificada.md` para refletir escala, tabela explícita e conteúdo dos cartões. Rever `ARCHITECTURE.md` somente onde a descrição atual divergir do resultado. Conferir catálogo/destinos da busca global e registrar a preservação no contrato se necessário; não adicionar fontes ou páginas novas.

Ao concluir a implementação, incorporar as decisões vigentes aos contratos e retirar este plano temporário. A referência visual pode permanecer como evidência identificada, sem confundi-la com a tela funcional.

## Ordem de execução no mesmo PR

1. Corrigir shell, gutters, ícones e seletor de sítio; conferir consumidores representativos.
2. Aplicar a escala compacta aos cabeçalhos e à consulta de protocolos, respeitando tokens e estados.
3. Corrigir tabela explícita, colunas sanitárias e menus de ações; compactar os cartões de protocolos.
4. Simplificar cartões de animais e conferir seleção, alertas e navegação.
5. Atualizar contratos, executar verificações proporcionais e registrar evidências. O PR deixa de ser rascunho somente quando a implementação e seus critérios estiverem atendidos.

Commits podem acompanhar esses blocos; não dividir a entrega em outros PRs nem incluir correções funcionais descobertas fora do escopo.

## Validação e aceite

### Automatização

- Adaptar os testes existentes de `AppSidebar`, `CatalogoModelosProtocolos`, `CartaoAnimal`, `VisualizacaoConsulta` e `TabelaFinanceira` apenas onde há mudança de comportamento verificável.
- Cobrir a permanência em tabela após escolher o modo em contêiner estreito, filtros/paginação preservados, condições dos comandos e acesso de consulta sem menu vazio.
- Conferir a remoção das medidas/datas do cartão junto da permanência de identidade, alertas, seleção e abertura do registro correto. Reutilizar as fixtures e os handlers públicos existentes, sem testar cada declaração CSS por string.
- Rodar os testes afetados e o build do client; incluir testes de consumidores compartilhados quando as alterações justificarem. Executar `git diff --check` e o detector de design sobre os alvos finais.
- Esta é uma entrega visual: não executar integrações com escrita, migrations, seeds ou rotinas de banco para validar o layout.

### Navegador

| Condição | Conferência |
|---|---|
| 1427 × 863 e 1209 × 863 | Gutters iguais, tabela legível, cabeçalho compacto, ações sem empilhamento excessivo. |
| 1100 e 901 px | Trilho automático, hover/foco e transição sem deslocamento ou recorte de ícones. |
| 900 e 672 px | Navegação móvel, título/filtros sem sobreposição e tabela explícita com rolagem própria. |
| 390 e 320 px | Cartões de uma coluna, busca e comandos alcançáveis, nenhum overflow horizontal da página; exceção somente no contêiner da tabela. |
| Zoom real de 200% | Foco, navegação e conteúdo essenciais acessíveis; emulação de largura não substitui esta conferência. |
| Teclado | Tab/Shift+Tab, Escape, menus, retorno de foco e rolagem da tabela. |
| Conteúdo extremo | Nome longo, várias condições/alertas, lista vazia, erro, atualização e ausência de permissão de escrita. |

Usar dados existentes e contas autorizadas; não alterar o banco remoto para fabricar estados. Estados destrutivos, conclusão/inativação e novos registros são exercitados por testes de interface com fixtures, não confirmados em STG. A inspeção autenticada pode renovar a sessão e timestamps de acesso. O ambiente local conectado ao STG foi uma escolha explícita do usuário para feedback; isso não autoriza cargas, manutenção, migrações ou testes que escrevam fixtures no remoto.

Registrar evidências por viewport no PR e distinguir testes automatizados, conferência de navegador e aceite humano. Safari, leitores de tela e dispositivos físicos só recebem evidência se forem de fato exercitados.

## Fora do escopo

- Regras de reprodução, sanidade, carência, peso/GMD, protocolos, estoque ou financeiro.
- Mudança do inventário de tags no cabeçalho do animal e transformação de Últimas pesagens em tabela; os comentários anteriores sobre esses pontos não integram este PR.
- Redesign de módulos inteiros, nova identidade, fontes alternativas ou ajuste global de zoom.
- Mudança de API, banco, migrations, seeds, permissões, credenciais, R2 e autenticação.
- Remoção de campos operacionais dos DTOs, fichas, relatórios ou exportações.
- Deploy, merge automático ou promoção de dados entre STG e produção.

## Situação da evidência

Planejamento: concluído. Mockup: apresentado e direção aceita, com conteúdo ilustrativo. Implementação na aplicação: pendente. Testes funcionais/build da alteração: pendentes. Validação em navegador da aplicação modificada: pendente. Homologação e deploy: pendentes.
