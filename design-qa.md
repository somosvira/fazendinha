# Fidelidade: entrada, agenda e seleção livre de visitas

final result: passed

## Escopo e referência

A referência aprovada é `docs/pecuaria/artefatos/mockup-selecao-livre.html#entrada`, com o percurso de agenda em `mockup-agenda-visitas.html`. O resultado usa a aplicação existente na branch `codex/pecuaria-v4`; não é um novo protótipo isolado. Navegação global, permissões e atendimento comum são preservados.

## Comparação visual

Evidências em `output/visitas-separacao/`, abertas em pares referência/implementação na mesma entrada de comparação:

| Estado | Referência | Aplicação |
| --- | --- | --- |
| Entrada sem escolha | `referencia-entrada-desktop.png` | `app-entrada-desktop.png` |
| Agenda do dia | `referencia-agenda-desktop.png` | `app-agenda-desktop.png` |
| Filtros sem manejo ativo | `referencia-filtros-desktop.png` | `app-filtros-desktop.png` |
| Revisão integral paginada | `referencia-revisao-desktop.png` | `app-revisao-desktop.png` |
| Definição de aplicação sanitária | `referencia-atividade-desktop.png` | `app-atividade-desktop.png` |
| Definição em celular | `referencia-atividade-mobile.png` | `app-atividade-mobile.png` |

Desktop: densidade 1, altura 1050 px, área comparável de 1216 px. Fonte em viewport 1216 × 1050, sem barras demonstrativas; aplicação em 1440 × 1050, com recorte de sua área de conteúdo após a navegação lateral de 224 px. Celular: viewport 390 × 844, densidade 1; a fonte reserva o espaço superior correspondente ao menu móvel. O documento real tem largura 390 px, sem transbordamento horizontal da página. Tabela e navegação de etapas podem rolar em sua própria região.

Datas, identificadores, contagens e nomes reais diferem dos dados fictícios. Na atividade, o mesmo estado selecionado (aplicação sanitária) foi comparado; a regra real também bloqueia reprodução com machos, identificando-os. A aplicação mantém a quarta etapa de atendimento comum e separa as opções reais de início sanitário/reprodutivo. Essas diferenças de contrato não foram ocultadas para a captura.

## Conferências funcionais

- Entrada: nenhum caminho marcado, contexto oficial, continuidade específica, sem criar visita ao apenas escolher cartão.
- Agenda: eixos Reprodução/Sanidade, janelas e grupos previstos. Ausência de filtros habituais e formulário extra conferida no navegador e na consulta dedicada do servidor.
- Livre: página própria, critérios, filtros salvos, prévia com totais completos por situação, revisão de 15 linhas por página, atividade definida depois.
- Revisão: cabeçalho de filtros próprios, sem campos de planejamento de protocolo; tabela em colunas, retirada e inclusão manual, retorno e retomada após recarga.
- Atendimento: escrita continua nos serviços existentes, com rascunhos/CAS, autorização e guarda de navegação; preparar não executa fatos clínicos.
- Contexto: assinatura independente da atividade impede aceitar mudança de contexto entre as duas prévias da definição. Prévia/inclusão do servidor também revalida sob travas.
- Correções verificadas: aviso transitório de grupo indisponível numa revisão válida; recuperação da etapa de atividade após recarga; resumo anterior limitado à primeira página; cabeçalho de agenda aparecendo na revisão livre; atenção repetida causando linhas excessivamente altas.
- Nenhuma exceção JavaScript não tratada registrada nas capturas finais. IDs e scripts dos HTMLs documentais conferidos; os novos casos V4-84 a V4-89 permaneceram pendentes.

## Validação e limites

As suítes completas de cliente/servidor passaram no ponto de integração. Após os ajustes, testes direcionados do fluxo, critérios, permissões, assinatura, compatibilidade e reenvio foram repetidos e passaram; builds de cliente e servidor passaram. A integração local validou peso histórico/exceção/snapshot, participação por data e criação idempotente, somente em `fazendinha_seedatev3`, com fixtures próprias revertidas por rollback. Não houve reset, clone, migration ou nova carga.

No navegador, as listas reais foram consultadas e revisadas; nenhum procedimento clínico ou consumo do seed foi confirmado. A preparação real foi validada nas fixtures em rollback. Não foram homologadas manualmente todas as combinações de filtros, execução clínica, impressão e perfis. O roteiro continua sendo a referência para homologação com a fazenda; suas marcações anteriores não foram alteradas.

P0/P1/P2 abertos neste escopo: nenhum. P3: pequenas diferenças de espaçamento e textos de etapas entre o mockup e o shell real; em celular, o indicador completo das quatro etapas requer rolagem horizontal na própria navegação. Não impedem a tarefa nem escondem a etapa atual.
