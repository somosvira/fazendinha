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


---

# Reprodução V4: ficha, indicadores e manejo — 17/10/2026

final result: passed

## Referência e evidência

Referências aprovadas em `/Users/montes/.codex/visualizations/2026/10/17/01a149de-c564-7e93-b69e-f88cf6475d0b/plano-v4-mockups/`: `ficha-animal.png`, `indicadores.png` e `manejo.png`. Evidências em `/Users/montes/.codex/visualizations/2026/10/17/01a149de-c564-7e93-b69e-f88cf6475d0b/implementacao-v4/`: pares `ficha-comparacao-final.png`, `indicadores-comparacao-final.png`, `manejo-comparacao-final.png`; capturas individuais `*-final.png`; recortes `*-detalhe.png`.

Desktop solicitado: 1487 × 1058, densidade 1. Capturas da área do navegador: 1472 × 1047; referências 1486/1487 × 1058/1059. As comparações preservam as imagens e seus tamanhos, sem distorcer proporções. Ficha: animal V4-007, ciclo após aborto, sítio Escola. Indicadores: sítio Escola, ano até a data atual. Manejo: fila de liberadas do mesmo sítio. Dados reais diferem dos exemplos do mockup; nenhuma fixture foi escrita para produzir uma aparência artificial.

## Cinco superfícies de fidelidade

| Superfície | Resultado |
| --- | --- |
| Composição e hierarquia | Ficha com abas por domínio, resumo, timeline, painel lateral e tentativas; indicadores com cartões, períodos e detalhe; manejo com filas, filtros e tabela. |
| Tipografia | Hierarquia de títulos, cabeçalhos e valores preservada; textos de tabela legíveis, datas curtas com contexto de ano e informação completa acessível. |
| Espaçamento e densidade | Removidos cabeçalhos duplicados, timeline excessivamente alta e cartões densos. Detalhes secundários em disclosures e tabelas paginadas. |
| Cor e superfícies | Paleta verde e superfícies claras integradas aos tokens existentes; estados conhecidos e pendências distinguíveis sem depender apenas de cor. |
| Imagens e ícones | Ilustração de uma única vaca, sem fotografia de rebanho. Ícones e ações coerentes com componentes existentes. |

Revisão visual independente dos três pares finais: nenhum P0/P1/P2 pendente. P3: pequenas diferenças de tipografia, tonalidade e espaçamento frente às imagens. O shell compartilhado permanece existente. O seletor local aparece quando o contexto global é Consolidado. Não foi reproduzida uma barra ilustrativa cuja população não corresponde aos denominadores clínicos reais.

## Regressões e correções

Corrigidos escopo de sítio nas exposições, preservação de correções históricas em animais baixados, avaliação de demanda com origem inválida, vínculo exato do aborto na timeline e datas padrão que avançavam após 21h por conversão UTC. Retentativas de relatórios repetem a operação original e preservam a chave de idempotência. Emissões históricas continuam na tela de relatórios.

Testes: suíte de reprodução com 51 arquivos e 276 testes aprovados; após correções adicionais, 35 testes focados em formulário, ficha, navegação e exposições aprovados. As contagens se sobrepõem e não devem ser somadas. Build de cliente (TypeScript e Vite) aprovado. Não executada integração com escrita no banco.

Navegador: troca entre sítios 114/115, consulta no Consolidado, normalização do fim futuro, paginação, busca nas filas, navegação entre domínios, formulário existente sem envio e reabertura de emissão preservada. Celular 390 × 844: ficha e indicadores sem transbordamento horizontal da página; tablet 1024 × 768: indicadores com painel adaptado. Teclado: abas da ficha respondem a setas e atualizam hash. Capturas mobile/tablet estão no diretório de evidências.

## Limites e preservação

Zoom não foi conferido especificamente. Não houve homologação clínica por escrita, execução completa de todos os perfis nem validação R2. Há um aviso React preexistente de botão aninhado na lista geral de animais (`ListaAnimais.tsx`/`TabelaFinanceira`), fora das três telas redesenhadas. Roteiros manuais não foram aprovados nem reiniciados automaticamente.

Usado somente o banco existente `fazendinha_seedatev3`, por consultas; nenhum backup, banco adicional, limpeza, migration ou recarga. Chrome nativo não foi utilizado. Sem commit, push ou deploy nesta entrega. Contrato vigente: `docs/pecuaria/reproducao.md`; explicação atualizada em `docs/pecuaria/artefatos/follow-up-v4-entrega.html`.

## Correção após feedback da ficha — 17/10/2026

A revisão anterior não identificou o efeito das regras legadas sobre os cartões das demais abas. O feedback do usuário revelou padding lateral nulo e fundo transparente em Mais ações. Reproduzido no navegador: corpo do CardFicha com `16px 0px 0px` e menu `rgba(0, 0, 0, 0)`. Após correção restrita a `.ficha-v4`: corpo com `20px` e menu `rgb(255, 255, 255)`.

Resumo e ciclo usam superfície branca; tags contrastantes sem brinco repetido, situação reprodutiva e carências vêm das consultas existentes. Filiação e composição compartilham cartão; nutrição tem tabela de produtos e estado de estorno; ausência de pesagens tem bloco explicativo; ação principal explicita reprodução/pesagem. Evidências em `/Users/montes/.codex/visualizations/2026/10/17/01a149de-c564-7e93-b69e-f88cf6475d0b/feedback-ficha/` (resumo, nutrição, reprodução e peso mobile).

Conferidos no browser os dois animais do feedback, gráfico com dados, ausência de pesagens, abertura das ações reprodutivas e celular sem transbordamento na ficha de peso (390 px; documento 375 px). Testes focados de ficha, reprodução, gráfico, nutrição, sinais clínicos e sanidade; build de cliente aprovado. Nenhuma escrita no banco. Não são diagnósticos de doenças: carência vigente/desconhecida não comprova doença e ausência de registros não comprova saúde.

## Ficha em quatro eixos — implementação de 18/10/2026

Fontes visuais: `/Users/montes/.codex/generated_images/01a149de-c564-7e93-b69e-f88cf6475d0b/exec-3d4f0855-d429-4a21-a6ae-e8c64a9ad97b.png` (visão geral, 1320×1192) e `exec-1feff781-a869-480c-a536-4dadef43a329.png` no mesmo diretório (reprodução, 1374×1145). Capturas reais em `/Users/montes/.codex/visualizations/ficha-v2-implementacao/`: `03-visao-geral-final.png`, `04-reproducao-final.png`, `06-auditoria-filtrada.png`, viewport CSS 1440×1200; captura mobile `05-mobile.png`, viewport 390×844. Comparação conjunta das quatro imagens em uma entrada visual, considerando proporções relativas, não igualdade pixel a pixel: o mock usa registros ilustrativos e a implementação usa DEV-001/V4-043 existentes. As capturas do IAB têm aproximadamente 1425×1188 pixels úteis, sem chrome; não se inferiu diferença de fonte por escala de captura.

### Comparação e correções

- P2 inicial: peso ocupava toda a largura, duplicando quatro métricas e tabela aberta; manejo ficava abaixo. Corrigido para proporção 65/35 em desktop, gráfico e GMD visíveis, indicadores e pesagens recolhíveis. Evidência inicial `02-visao-geral.png`, posterior `03-visao-geral-final.png`.
- P2 funcional: ação principal não abria seção React recolhida. Corrigido com evento de revelação e estado; conferido no browser abrindo “Registros, acompanhamentos e ações”.
- P2 textual: auditoria exibia entidades técnicas conhecidas sem tradução/eixo. Mapeadas explicitamente, preservando desconhecidos como “Não classificado” e sem reescrever texto livre.
- Tipografia: hierarquia título/subtítulo/tabela legível, com fonte vigente da aplicação; mock raster não estabelece família exata. Textos reais mais longos aumentam altura em protocolo/identidade; não foram truncados para imitar dados fictícios.
- Espaçamento: superfícies brancas com padding, divisão clara e chevrons; quatro eixos, peso/manejo em duas colunas; sidebar termina no viewport com conta acessível. Altura variável de dados, área de indicadores adicionais e filtros existentes explicam diferença de densidade da visão geral.
- Cores: verde e neutros mantidos, estados distinguíveis por texto e cor; fundo opaco e separadores visíveis.
- Imagens: reutilizada imagem de uma vaca já existente; não criada aproximação em CSS/SVG. Ícones usam biblioteca vigente. O mock usa alguns ícones maiores e títulos com ícone; diferença de acabamento P3, sem perda de identificação funcional.
- Conteúdo: protocolo real, versão/programação e horário desconhecido explícitos; nenhum IATF inferido de IA avulsa. Histórico em tabela separada. “Ciclo” removido dos rótulos conhecidos desta ficha; nomes livres de lotes/dados preservados.

### Interações e limites

Navegador: quatro abas, recolher/abrir, CTA revela seção, protocolo com horário pendente, pesos com dados e vazio, auditoria filtrada por Rebanho com antes/depois expandido. Console consultado: sem erros capturados. Desktop e mobile inspecionados; viewport restaurado. O mobile conserva rolagem interna para timeline/tabelas. Não foi homologado zoom/leitor de tela nem executada escrita clínica em navegador.

Testes: execução ampla cliente registrou 197 arquivos aprovados e três falhas; as três foram resolvidas/reexecutadas em 17 testes focados aprovados (mensagem renomeada, fixture aguardando instalação da guarda de navegação e teste de seção durante edição concorrente). Demais testes focais dos agentes, typechecks e builds cliente/servidor aprovados. A suíte ampla não foi repetida integralmente após essas correções. Guia HTML validado offline com 172 casos, persistência/importação/exportação e impressão; marcações do usuário preservadas, sem aprovação automática.

Mesmo banco `fazendinha_seedatev3`, sem escrita de dados nesta entrega, sem banco extra, backup, seed ou migration. R2 pendente. Nenhum publish/deploy.

final result: passed

## Ajustes da ficha após mockups revisados — 18/10/2026

Referência: `/Users/montes/.codex/visualizations/review-feedbacks-ficha/mockups-revisados/mockups.html`. Capturas da implementação em `/Users/montes/.codex/visualizations/ficha-v3-implementacao/`: `01-visao-geral.png`, `02-sanidade.png`, `03-nutricao.png`, `04-reproducao.png`, `05-mobile.png` e `06-peso-sem-dados.png`.

A comparação da reprodução colocou referência e captura real lado a lado na inspeção. Foram preservados timeline do protocolo, histórico em tabela, cabeçalhos de cartão recolhíveis, botões secundários, quatro eixos e sidebar ocupando a altura. Os dados são os existentes, não os exemplos do mockup. Aptidão inclui filtro de data e intervalos existentes, e por isso ocupa mais altura que a proposta ilustrativa. Ações sanitárias ficam junto do título da aba; ações de reprodução ficam no cabeçalho de Registros e ações, acessível também pelo botão superior.

Peso e manejo compartilham a largura disponível, com alturas iguais em duas colunas e empilhamento em celular. Medição em viewport de 950 px: cartões com 338,89 px de altura; em 1107 px, ambos com 429,78 px. A faixa de GMD integra o gráfico. Casos com duas pesagens e sem pesagens foram conferidos. Nutrição mostra período do fechamento (não permanência individual), produtos em tabela e fechamento acessível por botão no título.

Conferência no navegador integrado em 390, 950, 1107 e 1440 px, sem overflow global nas medições de 390/950. Expansão por Enter, menu sanitário e fechamento por Escape, navegação das quatro abas e consulta de aptidão foram exercitados. Alterar consulta para 01/10 manteve Data da decisão em 18/10; nenhuma decisão foi gravada. Houve uma resposta 500 durante recargas do servidor em desenvolvimento; após estabilização e recarga a ficha voltou normalmente. Não foi tratado como evidência de sucesso antes da recarga.

Revisão independente corrigiu rótulo do período nutricional, referência/contagem clínica após transferência de sítio e separação entre leitura de custos operacionais e evidências documentais financeiras. Listas de fatos e custos continuam limitadas pelo escopo autorizado. Edição financeira permanece protegida.

Validação: suíte completa do cliente com 1.444 testes; reexecuções focadas após integração com 32 e 47 testes; agente de custos executou 182 testes backend e 26 client; cálculo do resumo clínico com 12 testes. Builds de cliente e servidor passaram. Build frontend conserva aviso de bundle acima de 500 kB. `git diff --check` passou. Roteiro manual atualizado para 176 casos, com validação offline de persistência/importação/exportação e sem alterar marcações existentes.

Sem escrita no banco, migrations, recarga de seed, cópia ou backup. Apenas consultas no ambiente local existente; R2 continua pendente. Validação visual pontual não substitui homologação manual completa, nem comprova execução de ações clínicas ou financeiras.
