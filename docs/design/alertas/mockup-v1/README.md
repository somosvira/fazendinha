# Mockup navegável — Alertas

Proposta para avaliação do usuário, com referência fictícia em **27/10/2026**. A revisão atual apresenta Visão geral, central de cuidados, histórico separado, ficha do animal e Agenda de Sanidade. Conserva o agrupamento por produto/cuidado e a campanha ilustrativa de **561 animais**. A agenda transcreve **14 atividades** do documento da fazenda; os demais dados são sintéticos. O mockup não implementa a feature nem representa aprovação do usuário.

## Abrir

Na raiz do repositório:

```bash
python3 -m http.server 41921 --bind 127.0.0.1 --directory docs/design/alertas/mockup-v1
```

Acesse [Visão geral](http://127.0.0.1:41921/index.html?v=20261028-feedback4#geral), [Alertas](http://127.0.0.1:41921/index.html?v=20261028-feedback4#central), [Histórico](http://127.0.0.1:41921/index.html?v=20261028-feedback4#historico), [Agenda](http://127.0.0.1:41921/index.html?v=20261028-feedback4#agenda) ou [Estrela · 026](http://127.0.0.1:41921/index.html?v=20261028-feedback4#animal/026). Recarregar restaura os dados iniciais e desfaz as simulações. Para encerrar o servidor, use `Ctrl+C` no terminal que o iniciou.

## Uso e comportamento atual

- **Visão geral e central:** alterne Cartões e Tabela. A tabela horizontal distingue cuidado/produto, origem, programação/motivo, público, situação e ações. Os botões abrem participantes ou detalhes; não são apenas elementos decorativos.
- **Busca e filtros:** busque animal ou cuidado na barra e abra **Filtros** para editar tipo e lote no modal. **Aplicar filtros** confirma a edição; cancelar descarta; limpar dentro do modal apenas limpa o rascunho. As situações ativas ficam na central e os encerrados têm consulta própria em `#historico`.
- **Participantes:** abra **Ver animais** na campanha contra raiva. O estado inicial tem 561 pendentes, com páginas de 12 animais; Novilhas contém 186. Buscar **raiva** conserva a campanha completa; buscar **Estrela** restringe a um animal. O retorno à central ou ao histórico conserva situação, lote, busca e tipo do link de entrada. Mudanças posteriores dos filtros e do modo de exibição continuam valendo.
- **Detalhe individual:** confira o motivo original e a situação atual simulada na origem, incluindo carregamento, falha e origem removida. Esses estados preservam a evidência do disparo. A ficha de Estrela mantém três cuidados no cenário inicial. O atendimento individual simulado afeta apenas aquele participante; não registra uma aplicação real.
- **Agenda:** busque atividade, filtre por tipo e alterne **Eventos do mês** e **Calendário anual**. Uma marcação anual abre o mês e a atividade. O ícone de informação apresenta em tooltip a ressalva sobre programação e atendimento; **Observações do documento** abre as limitações da fonte.
- **PDF:** **Baixar calendário em PDF** baixa o [calendário anual completo](output/pdf/agenda-sanidade.pdf), com as 14 atividades em uma página A4 horizontal. É um arquivo estático, independente do mês, busca e filtros exibidos; não é uma exportação do recorte atual.

O banner explicativo sobre origens futuras e o texto de transcrição antes da agenda foram removidos. A moldura superior identifica o mockup e conserva os controles de cenário, várias origens e publicação nas consultas de alertas; esses controles ficam ocultos na agenda. As simulações de publicação, consulta à origem, adiamento, atendimento e prévia de tarefa continuam locais, sem API, banco ou persistência.

## Dados e limites da proposta

O agrupamento considera sítio, produto e identidade do cuidado; doses, programações ou campanhas diferentes conservam identidades próprias. Cada participante mantém motivo, data, situação e detalhe individual. Cuidados, necessidades individuais e animais distintos são contagens diferentes. A campanha fictícia de raiva com 561 animais é independente das janelas do calendário transcrito.

Os gatilhos sanitários iniciais propostos são **idade e data fixa**; peso não gera alerta. Os exemplos de outras origens demonstram evoluções futuras e não ampliam esse escopo. Consulte o [plano funcional](../../../pecuaria/plano-alertas-sanitarios.md).

A [transcrição da fonte](calendario-fonte.md) preserva atividades, públicos e meses. O documento não informa ano ou dias de execução: 2026 é contexto de simulação. Marcações em todos os meses são janelas de programação, sem presumir aplicação mensal no mesmo animal. Produtos, indicação e elegibilidade não foram validados; as regras da agenda continuam desativadas. A prévia **Simular alerta deste evento** mantém público a selecionar e reutiliza o mesmo evento/mês em memória.

## Padrões de interface e fontes

O refinamento acompanha os padrões vivos de [BarraConsulta](../../../../client/src/financeiro/BarraConsulta.tsx), [PainelFiltros](../../../../client/src/financeiro/PainelFiltros.tsx) e [VisualizacaoConsulta](../../../../client/src/components/VisualizacaoConsulta.tsx): busca e ações na barra, modal centralizado com aplicação explícita dos filtros e alternância entre cartões e tabela. O HTML estático reproduz esses padrões; não importa os componentes React nem implementa sua persistência de preferências.

Foram preservados o verde `#006f68`, o fundo `#f7f8fa`, a lateral `#dce8e5` e as fontes locais DM Sans/Manrope do mockup, em continuidade com os [tokens compartilhados](../../../../client/src/styles/cooperativa-theme.css). Esta revisão local não define uma nova identidade ou altera os documentos globais de design.

Fontes do artefato: [index.html](index.html), [mockup.css](mockup.css), [consultas.js](consultas.js), [grupos.js](grupos.js), [agenda.js](agenda.js) e [mockup.js](mockup.js). A navegação usa fragmentos `#`; os participantes recebem contexto em `#cuidado/<chave>?estado=…&lote=…&busca=…&tipo=…`.

## Evidência desta revisão — 28/10/2026

A sessão de navegador verificou alternância de cartões/tabela, modal de filtros, campanha com 561 participantes, Novilhas com 186, busca de Estrela com um resultado, carregamento/detalhe individual e três cuidados na ficha 026. Na agenda, Exame em outubro apresentou vazio, o tooltip abriu por clique e o botão baixou efetivamente o PDF anual.

A navegação de retorno e a aplicação posterior dos filtros foram conferidas após correções: Histórico com Novilhas → participantes → retorno manteve um cuidado; trocar para Matrizes mostrou zero; limpar e alternar para cartões mostrou um; buscar um termo inexistente e alternar para tabela conservou zero. Os filtros da URL são restaurados ao entrar na rota, sem sobrescrever cada edição local durante a renderização.

As verificações usaram viewports de **1888 × 863** e **390 × 844**, com zoom do navegador em 110% (larguras CSS observadas de aproximadamente 1716 e 355 px), sem overflow horizontal da página. Tabelas podem ter rolagem própria. O console não apresentou erros; `node --check` passou nos quatro arquivos JavaScript e [detector-feedback.json](detector-feedback.json) retornou `[]` em uma execução.

A revisão visual independente examinou nove imagens, incluindo o PDF, e o código. O parecer final **SHIP** permite apresentar este mockup para avaliação e considerou resolvidos os achados de retorno ao histórico e reaplicação indevida dos filtros. Não é aprovação do usuário nem validação da aplicação.

| Superfície | Desktop | Mobile |
|---|---|---|
| Visão geral | [Captura](capturas/feedback-user-1888-geral.png) | [Captura](capturas/feedback-mobile-geral.png) |
| Central | [Captura](capturas/feedback-user-1888-central.png) | [Captura](capturas/feedback-mobile-central.png) |
| Agenda | [Captura](capturas/feedback-user-1888-agenda.png) | [Captura](capturas/feedback-mobile-agenda.png) |
| Histórico | [Captura](capturas/feedback-user-1888-historico.png) | — |
| Filtros | [Captura](capturas/feedback-desktop-filtros.png) | — |

As capturas anteriores permanecem no diretório, mas não representam a revisão vigente. A etapa documental conferiu fontes e links; não repetiu a sessão de navegador descrita acima. Não foram executados testes da aplicação, integração com banco, CI ou deploy, nem homologação pela fazenda. O artefato não comprova autorização, persistência, processamento periódico ou resolução real na origem.
