# Auditoria de Sanidade e Leite

10/11/2026 · Ambiente local · Sítio principal

## Achados

| Prioridade | Local | Evidência | Ajuste sugerido |
| --- | --- | --- | --- |
| Alta | Leite → Alimentação e descarte → Registrar fornecimento | Em 390 px, o diálogo tem 356 px de largura útil e 423 px de conteúdo. O seletor de data e parte dos controles ultrapassam a lateral. | Limitar a largura dos campos e dar ao formulário corpo rolável com ações acessíveis. |
| Alta | Leite → Qualidade → Formatos de laudo | Em 390 px, o diálogo tem 356 px úteis e 418 px de conteúdo. Linhas de descrição e ação extrapolam o diálogo. | Deixar os nomes quebrarem e empilhar ações na largura estreita. |
| Alta | Leite → Qualidade → Criar formato de laudo | Digitei no formulário e fechei pelo X. O formulário fechou sem confirmação e o foco voltou ao acionador. | Usar a proteção de rascunho do painel compartilhado, incluindo mudanças em seletores e calendário. |
| Alta | Leite → Alimentação e descarte → Fornecimentos | A área principal a 390 px alcançou 449 px de conteúdo. A seção Distribuição da alimentação extrapolou 59 px. | Permitir que o bloco de distribuição encolha e conferir a rolagem interna da navegação. |
| Média | Leite → Registrar ordenha, Registrar amostra, Venda avulsa, Configurar rotina de coleta e Período e emissão | Os diálogos longos têm rolagem no contêiner inteiro e não usam um rodapé estrutural comum. Formulário, ações e navegação interna variam entre eles. | Fixar cabeçalho e ações nos formulários longos, com rolagem no corpo. Preservar a navegação por etapas da ordenha. |
| Média | Sanidade → Agenda → Ciclos → Participação individual | O documento respeitou os 390 px, mas a tabela interna das etapas tem largura mínima de 680 px e deixa ações além da borda visível inicialmente. | Dar prioridade ao resumo e à ação da etapa em telas estreitas, preservando a tabela completa para consulta. |
| A verificar | Leite → Alimentação e descarte → Retirada interna / descarte e fornecimento | O código de retirada e descarte limpa os campos ao fechar. O de fornecimento fecha por mudança direta de estado. Esses caminhos foram abertos, mas a perda de rascunho foi reproduzida separadamente só no formato de laudo. | Conferir X, Escape e cancelamento com dados preenchidos antes de unificar os formulários. |

## Evidências

- [Alimentação e descarte em 390 px](destinos-celular.png)
- [Registrar fornecimento em 390 px](registrar-fornecimento.png)
- [Formatos de laudo em 390 px](formatos-laudo.png)
- [Inventário dos componentes e declarações de modais](inventario.md)

## Cobertura e limites

- 32 telas navegadas em desktop e celular. Inclui Agenda de Sanidade e suas visões, Ocorrências, Aplicações, Exames, Carências, calendário, ciclo, participação individual, sete abas do Leite, subvisões, ferramentas e configurações vinculadas.
- 44 acionadores exercitados no celular. 41 abriram um diálogo, dois abriram uma página e uma ação de relatório não apresentou diálogo no cenário consultado. Os 41 diálogos abertos estavam centralizados. Dois apresentaram rolagem lateral medida.
- 103 arquivos TSX de interface inventariados em Sanidade e Leite, com 50 chamadas aos componentes de diálogo ou painel incluídos na busca estática. Uma chamada pode representar vários estados e vários acionadores podem abrir o mesmo diálogo.
- Não houve gravações de negócio. Estados dependentes de outras permissões, dados ausentes, gravação, erros do servidor e todas as combinações de modais encadeados ficaram na revisão de código ou fora da homologação no navegador.
- A checagem estática registrou 69 avisos de convenções de design. Esses avisos não foram tratados como falhas visuais sem reprodução.

## Telas verificadas

- [Sanidade · Protocolo vacina demonstrativo](http://localhost:41875/pecuaria/sanidade?propriedadeId=1&aba=agenda&visaoAgenda=cuidados)
- [Sanidade · Demonstração vacinacao futura Principal](http://localhost:41875/pecuaria/sanidade?propriedadeId=1&aba=agenda&visaoAgenda=rodadas)
- [Sanidade](http://localhost:41875/pecuaria/sanidade?propriedadeId=1&aba=agenda&visaoAgenda=tarefas)
- [Sanidade · Semana de trabalho](http://localhost:41875/pecuaria/sanidade?propriedadeId=1&aba=agenda&visaoAgenda=tarefas&agendaSanitaria=semana)
- [Sanidade · Casos abertos por doença](http://localhost:41875/pecuaria/sanidade?propriedadeId=1&aba=ocorrencias)
- [Sanidade](http://localhost:41875/pecuaria/sanidade?propriedadeId=1&aba=aplicacoes)
- [Sanidade](http://localhost:41875/pecuaria/sanidade?propriedadeId=1&aba=exames)
- [Sanidade](http://localhost:41875/pecuaria/sanidade?propriedadeId=1&aba=carencias)
- [Demonstração vacinacao futura Principal · Aplicação · Vacina sintética de teste](http://localhost:41875/pecuaria/sanidade?propriedadeId=1&aba=agenda&visaoAgenda=rodadas&rodadaId=8d013c9f-3641-4c9a-a82e-149abb4a51c8&protocoloContexto=8d013c9f-3641-4c9a-a82e-149abb4a51c8&etapaId=4f96c4ee-826a-46af-bff8-0e741eef3d30)
- [Ordenhas](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=ordenhas)
- [Produção · Produção registrada](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=producao)
- [Estoque](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=estoque)
- [Coletas](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=coletas)
- [Qualidade](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=qualidade)
- [Vendas](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=vendas)
- [Alimentação e descarte · Distribuição do dia](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=destinos)
- [Relatórios do leite · Produção no período](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=relatorios)
- [Conferir importação · Conferir importação de leite](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=historico)
- [Leite · Rotina de coleta](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=programacao)
- [Configurações de produção · Rotina de produção](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=configuracoes)
- [Ordenhas · Ordenha em foco](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=ordenhas&leiteModo=individual)
- [Alimentação e descarte · Distribuição do dia](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=destinos&destinosAba=retiradas)
- [Alimentação e descarte · Distribuição do dia](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=destinos&destinosAba=descarte)
- [Alertas · Primeira vacina de bezerras (demonstrativa)](http://localhost:41875/configuracoes/pecuaria/sanidade/alertas?propriedadeId=1)
- [Protocolos sanitários](http://localhost:41875/configuracoes/pecuaria/sanidade/protocolos?propriedadeId=1)
- [Doenças](http://localhost:41875/configuracoes/pecuaria/sanidade/doencas?propriedadeId=1)
- [Tipos de aplicação](http://localhost:41875/configuracoes/pecuaria/sanidade/tipos-aplicacao?propriedadeId=1)
- [Tipos de exame](http://localhost:41875/configuracoes/pecuaria/sanidade/tipos-exame?propriedadeId=1)
- [Rotina de produção · Tanques e calibração](http://localhost:41875/configuracoes/pecuaria/producao/leite?propriedadeId=1)
- [Rotina de coleta  · Rotina vigente na referência](http://localhost:41875/configuracoes/pecuaria/producao/coleta?propriedadeId=1)
- [Agenda de Sanidade · Novembro](http://localhost:41875/pecuaria/sanidade/calendario?propriedadeId=1)
- [Participação individual · Lactantes 31](http://localhost:41875/pecuaria/sanidade/participacoes/a4fca248-bb48-47a0-b5f1-6bf5deb5976e?aba=agenda&visaoAgenda=tarefas&sitio=1&etapaId=4f96c4ee-826a-46af-bff8-0e741eef3d30)

## Acionadores verificados no celular

| Módulo | Acionador | Resultado |
| --- | --- | --- |
| Sanidade | [Filtros](http://localhost:41875/pecuaria/sanidade?propriedadeId=1&aba=agenda&visaoAgenda=cuidados) | Filtros |
| Sanidade | [Calendário sanitário](http://localhost:41875/pecuaria/sanidade?propriedadeId=1&aba=agenda&visaoAgenda=cuidados) | Navegou para outra página |
| Sanidade | [Gerenciar procedimentos](http://localhost:41875/pecuaria/sanidade?propriedadeId=1&aba=agenda&visaoAgenda=cuidados) | Gerenciar procedimentos |
| Sanidade | [Ver cuidado](http://localhost:41875/pecuaria/sanidade?propriedadeId=1&aba=agenda&visaoAgenda=cuidados) | Aplicar Vacina sintética de teste |
| Sanidade | [Abrir tarefa](http://localhost:41875/pecuaria/sanidade?propriedadeId=1&aba=agenda&visaoAgenda=cuidados) | Navegou para outra página |
| Sanidade | [Novo ciclo](http://localhost:41875/pecuaria/sanidade?propriedadeId=1&aba=agenda&visaoAgenda=rodadas) | Iniciar ciclo de protocolo |
| Sanidade | [Atender](http://localhost:41875/pecuaria/sanidade?propriedadeId=1&aba=agenda&visaoAgenda=rodadas&rodadaId=8d013c9f-3641-4c9a-a82e-149abb4a51c8&protocoloContexto=8d013c9f-3641-4c9a-a82e-149abb4a51c8&etapaId=4f96c4ee-826a-46af-bff8-0e741eef3d30) | Registrar aplicação sanitária |
| Sanidade | [Nova ocorrência](http://localhost:41875/pecuaria/sanidade?propriedadeId=1&aba=ocorrencias) | Nova ocorrência |
| Sanidade | [Registrar aplicação](http://localhost:41875/pecuaria/sanidade?propriedadeId=1&aba=aplicacoes) | Registrar aplicação sanitária |
| Sanidade | [Corrigir carência de Medicamento sintético com carência](http://localhost:41875/pecuaria/sanidade?propriedadeId=1&aba=aplicacoes) | Corrigir carência |
| Sanidade | [Anular aplicação de Medicamento sintético com carência](http://localhost:41875/pecuaria/sanidade?propriedadeId=1&aba=aplicacoes) | Anular aplicação sanitária |
| Sanidade | [Registrar coleta / exame](http://localhost:41875/pecuaria/sanidade?propriedadeId=1&aba=exames) | Registrar exame |
| Sanidade | [Corrigir resultado](http://localhost:41875/pecuaria/sanidade?propriedadeId=1&aba=exames) | Corrigir resultado |
| Sanidade | [Informar resultado](http://localhost:41875/pecuaria/sanidade?propriedadeId=1&aba=exames) | Informar resultado |
| Sanidade | [Anular exame](http://localhost:41875/pecuaria/sanidade?propriedadeId=1&aba=exames) | Anular exame |
| Sanidade | [Filtros](http://localhost:41875/pecuaria/sanidade?propriedadeId=1&aba=carencias) | Filtros |
| Leite | [Registrar ordenha](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=ordenhas) | Registro de ordenha |
| Leite | [Filtros](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=ordenhas) | Filtros |
| Leite | [Incluir animal](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=ordenhas&leiteModo=individual) | Incluir animal no dia |
| Leite | [Ver animais](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=ordenhas&leiteModo=individual) | Animais fora da ordenha |
| Leite | [Consultar produção](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=producao) | Leite produzido · 10/11/2026 |
| Leite | [Filtros](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=producao) | Filtros |
| Leite | [Ver origens](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=estoque) | V5 · Leite colostro · origens e operações |
| Leite | [Confirmar produção individual](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=estoque) | Confirmar produção individual |
| Leite | [Registrar retirada](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=coletas) | Registrar retirada |
| Leite | [Filtros](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=coletas) | Filtros |
| Leite | [Registrar amostra](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=qualidade) | Registrar amostra |
| Leite | [Criar formato de laudo](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=qualidade) | Formato do laudo |
| Leite | [Formatos de laudo](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=qualidade) | Formatos de laudo · transbordamento lateral |
| Leite | [Filtros](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=qualidade) | Filtros |
| Leite | [Entregas e demonstrativos](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=vendas) | Entregas e demonstrativos |
| Leite | [Nova operação por período](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=vendas) | Nova operação por período |
| Leite | [Venda avulsa](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=vendas) | Venda avulsa |
| Leite | [Registrar fornecimento](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=destinos) | Registrar fornecimento · transbordamento lateral |
| Leite | [Registrar retirada interna](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=destinos&destinosAba=retiradas) | Registrar retirada interna |
| Leite | [Registrar descarte](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=destinos&destinosAba=descarte) | Registrar descarte físico |
| Leite | [Período e emissão](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=relatorios) | Período e emissão de leite |
| Leite | [Exportar e gerenciar relatório](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=relatorios) | Sem diálogo observado |
| Leite | [Nova configuração](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=configuracoes) | Configurar ordenhas |
| Leite | [Cadastrar tanque](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=configuracoes) | Cadastrar tanque |
| Leite | [Configurar rotina de coleta](http://localhost:41875/pecuaria/leite?propriedadeId=1&leiteSecao=configuracoes) | Configurar rotina de coleta |
| Sanidade | [Nova doença](http://localhost:41875/configuracoes/pecuaria/sanidade/doencas?propriedadeId=1) | Doença |
| Sanidade | [Novo tipo de aplicação](http://localhost:41875/configuracoes/pecuaria/sanidade/tipos-aplicacao?propriedadeId=1) | Tipo de aplicação |
| Sanidade | [Novo tipo de exame](http://localhost:41875/configuracoes/pecuaria/sanidade/tipos-exame?propriedadeId=1) | Tipo de exame |
