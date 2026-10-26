> Evidência histórica datada. Achados e notas não representam automaticamente a V5 atual; revalidar no código antes de abrir trabalho. O contrato vigente está no índice `docs/README.md`, e lacunas atuais em `docs/lacunas.md`.

# Assessment A — revisão independente de design do cliente Terrano

15/10/2026. Modo Operate. Avaliação de design concluída antes de acesso a qualquer saída da avaliação B. Nenhum detector foi executado/lido por A. Fonte principal: aplicação local com sessão de proprietário do seed, capturas novas desta execução e código atual. Não houve gravação de fatos, envio de e-mail, upload, convite, pagamento, uso da API de IA, alteração de permissões ou logout.

## Veredito

O Terrano tem uma base operacional coerente e identificável: verdes de campo, fundos discretos, boa leitura de números, organização por sítio, vocabulário rural e ligações entre animal, produto, operação e histórico. Sua personalidade vem mais do domínio e das informações do que de uma composição excepcionalmente própria. O shell e as listas poderiam atender outro sistema administrativo com poucas mudanças; isso não é por si um defeito em um produto de operação. A maior oportunidade é fazer a clareza dos controles acompanhar o cuidado já presente na modelagem dos fatos.

Saúde de design: **28/40, boa base com problemas específicos de usabilidade**. Não equivale a aprovação funcional, segurança ou acessibilidade. As escritas e os estados de erro após submissão não foram testados.

## Método e evidência

- A capturou e reabriu 64 arquivos PNG, predominantemente em 1440×900, em `C:/Users/mathe/.codex/visualizations/2026/10/15/impeccable-client/A/`. Arquivos de página inteira preservam também seções inferiores; formulários posteriores foram capturados no viewport para evitar imagens excessivamente altas.
- O agente principal capturou, sem emitir julgamento, 26 JPGs em 1280×720 no diretório irmão `P/`. A abriu e examinou individualmente os 26 arquivos corrigidos. A autoria da captura é P, o julgamento abaixo é A. Não são evidência de B nem artefatos de auditoria anterior.
- Capturas intermediárias ainda em animação foram substituídas, como `09-form-conta.png`. Não foram aceitas telas de skeleton como a evidência final de uma página.
- Foram consultados AGENTS, README, ARCHITECTURE, índice documental, contratos Financeiro/Estoque e Pecuária, router, roteamento nutricional, componentes de autenticação, tabela compartilhada, cadastro e busca global. O contrato do assistente é a referência funcional; apenas a abertura do painel foi observada, sem pergunta ou mídia enviada.
- Aplicados Impeccable SKILL, critique e operate, e Product Design audit/index/critical-overrides/framework. O context helper foi executado pelo agente principal; PRODUCT/DESIGN ausentes não foram inventados. Sem mudanças de UI.

## Nielsen — notas de 0 a 4

| # | Heurística | Nota | Evidência e limite |
|---|---|---:|---|
| 1 | Visibilidade do estado | 3 | Status textuais, carregamento e rascunhos claros; revisão de formulários pode transmitir aprovação prematura (23,32). Sucesso de escrita não exercitado. |
| 2 | Sistema e mundo real | 3 | Sítio, brinco, lote, carência e origem têm contexto; termos técnicos ainda escapam na auditoria (`OcorrenciaSanitaria`, `INCLUSAO_RODADA`,33) e na conta (`BANCO`, `CORRENTE`,07). |
| 3 | Controle e liberdade | 3 | Cancelar/voltar, breadcrumbs e rascunhos. O aviso de novo relatório protege o trabalho, mas só apresenta continuar ou descartar (20). Reversões não executadas. |
| 4 | Consistência | 3 | Listas, chips e seletores predominantemente previsíveis; convites, recuperação e alguns formulários sanitários mantêm outra tipografia/escala e distribuição (P). |
| 5 | Prevenção de erros | 3 | Contexto do fato, saldos, versões, prévia e carências preservados. Checkmarks ao lado de instrução ainda pendente e CTA de confirmação presente em operação incompleta enfraquecem o modelo de revisão (23,32). |
| 6 | Reconhecimento | 3 | Rótulos, links de origem e resumo lateral reduzem memória; ações importantes das linhas dependem de ícones e ficha individual exige navegar uma página longa (33,45,48,50). |
| 7 | Flexibilidade e eficiência | 3 | Busca global com Ctrl/⌘K existe no código, filtros URL e seleção coletiva visíveis; pouca descoberta visual do atalho e buscas ausentes em alguns catálogos (P). Não se afirma ausência de suporte a teclado. |
| 8 | Estética e economia | 2 | Visual tranquilo e coeso; alturas extensas, espaço pouco usado em drawers breves e detalhes longos aumentam percurso; detalhe do relatório estoura lateralmente no desktop observado (19). |
| 9 | Diagnóstico/recuperação de erro | 2 | Instruções locais ajudam, mas falhas de rede, validação de submissão e retomada de confirmação não foram exercitadas. Nota conservadora com evidência parcial, não condenação desses fluxos. |
| 10 | Ajuda e documentação | 3 | Ajuda de campos, explicações de efeitos e guias no assistente; ajuda de carências fica abaixo da dobra na aplicação e alguns conceitos exigem leitura longa. |
| | **Total** | **28/40** | **Boa base. Todos os dez aplicáveis ao modo Operate.** |

## O que está funcionando

1. **Contexto operacional preservado.** Ficha do produto leva à origem; operação leva a compromisso e estoque; ocorrência leva aos fatos relacionados; nutrição distingue consumo confirmado e estornado. O usuário pode conferir a história sem depender de memória (03,26–29,47,56,59).
2. **Hierarquia de leitura relativamente estável.** Título, ação principal, filtros e tabela aparecem em ordem reconhecível. Cores moderadas e números alinhados dão estabilidade à leitura repetitiva (02,04,24,31,45,50).
3. **Reassurance ligado ao domínio.** Baixa explica efeito e estorno, aplicação diferencia carência desconhecida de zero e nutrição explica atribuição por permanência. Rascunhos protegidos evitam perda acidental (20,36,44,49,59,62).

## Cinco prioridades sistêmicas

### 1. [P1] O detalhe de relatório excede a largura disponível no desktop

Em `19-relatorio-detalhe.png`, a seção Por centro de custo aparece cortada à direita, com valores fora da área capturada, embora o cabeçalho e o restante do shell caibam. A grade usa `xl:grid-cols-[1.4fr_1fr]` e os painéis contêm tabelas com larguras mínimas. O layout de resumo não comunica uma intenção clara de rolagem para esse bloco. Isso dificulta conferir precisamente os totais de um documento financeiro.

**Correção:** garantir `min-width:0` nos filhos da grade e rolagem local explícita das tabelas, ou empilhar as seções antes de faltar largura real; verificar o bloco com nomes e moedas longos. Não requer acrescentar gráficos. **Comandos:** `$impeccable layout`, `$impeccable adapt`.

### 2. [P1] Resumo de revisão mistura estado válido e instrução ainda pendente

Na nova operação incompleta, `23-operacao-form.png` mostra checkmarks para “Registrar pagamento integral de R$ 0,00” e “Nenhum movimento físico de estoque será gerado”, junto de um CTA forte Confirmar operação e uma advertência inferior. No novo animal, `32-animal-novo.png` marca com check “Selecione o sítio de destino” e apresenta categoria calculada antes de identificação e sítio. As frases podem ser projeções honestas do estado parcial, mas o sinal visual de aprovação é prematuro.

**Correção:** separar “Falta informar” de “Efeitos previstos”; usar check apenas para uma decisão satisfeita. No estado incompleto, manter instrução de correção próxima do campo e resumo com linguagem condicional. Mostrar o efeito físico da compra só depois de produto/recebimento definidos. Não se afirma que o backend confirma os dados incompletos. **Comandos:** `$impeccable clarify`, `$impeccable harden`.

### 3. [P2] A escala espacial e a rolagem não acompanham a complexidade de cada tarefa

Doença e tipo de aplicação, com um campo, abrem drawer quase do tamanho da página (P/doenca-form e tipo-aplicacao-form). Informar resultado, com dois campos, também toma toda a lateral (52). Em contrapartida a ficha individual é uma página muito longa, com seis seções e muitas subseções, e a operação tem rolagem interna do formulário (23,33). O usuário precisa aprender quando a rolagem pertence à página, à tabela, ao drawer ou ao formulário.

**Correção:** usar diálogo breve para cadastro de um ou dois campos; reservar painel lateral para tarefas com contexto de comparação. Manter acesso às seções da ficha durante a leitura, sem esconder o contexto do animal; reduzir blocos repetidos e agrupar o que é preciso para a próxima decisão. Não converter tudo em abas ocultas por padrão. **Comandos:** `$impeccable distill`, `$impeccable layout`.

### 4. [P2] Descoberta de ações e busca varia entre listas semelhantes

Operações são linhas acionáveis com pouco indício visual, contas têm links explícitos, ciclos têm Abrir ciclo, enquanto ocorrências/exames/aplicações usam ícones de ver/editar/anular (02,06,40,45,48,50). Os rótulos acessíveis de várias ações estão presentes no DOM; a crítica é descoberta visual, não falta geral de nomes. O hub tem busca, mas Doenças e Motivos não mostram busca na captura inicial, embora sejam catálogos extensos (P).

**Correção:** adotar um padrão visível de “Abrir” ou identificação claramente acionável, com ações secundárias no mesmo lugar e riscos separados. Oferecer a mesma busca local nos catálogos extensos. Tornar o atalho da busca global visível sem acrescentar outro botão. **Comandos:** `$impeccable clarify`, `$impeccable polish`.

### 5. [P2] Os momentos de identidade, ajuda e acesso parecem pertencer a versões diferentes

A recuperação usa creme e serifas, convite usa cabeçalho preto e serifa, e o assistente também usa serifa; a operação e os demais cadastros são verdes e sans (P/recuperar-senha, acessos-convite, assistente;09–17). Não há razão de tarefa evidente para essas diferenças. Em Acessos, o editor informa “Permissões salvas automaticamente”, mas a proximidade entre inspeção e alteração de controles de autorização exige especial clareza (P/acessos-permissoes). Não foram alteradas permissões e não se afirma comportamento de salvamento sem consulta ao código.

**Correção:** harmonizar tipografia, cabeçalhos, campos e ações desses fluxos com o sistema atual, preservando um tom acolhedor. Para permissões, diferenciar estado consultado e alteração realizada, com retorno local claro de gravação/erro e consequências legíveis; decidir explicitamente se a política de autosave é apropriada. **Comandos:** `$impeccable polish`, `$impeccable harden`.

## Carga cognitiva

Checklist aplicado à experiência observada, não a uma contagem mecânica de todos os links da aplicação:

| Item | Julgamento | Base |
|---|---|---|
| Foco único | Parcial | listas são focadas; novo animal/operacão juntam decisões de identificação, origem, classificação, dinheiro e efeitos na mesma superfície (23,32). |
| Chunking | Parcial | formulários têm seções; menu Mais ações tem sete escolhas e formulário de parceiro seis papéis. |
| Agrupamento | Bom | seções, cabeçalhos, filtros e contexto lateral ajudam consistentemente. |
| Hierarquia | Parcial | o CTA é evidente; checkmarks e alertas concorrentes na operação incompleta confundem o estado (23). |
| Uma decisão de cada vez | Parcial | aplicação e operação têm muitas dependências simultâneas; receita e atribuição são mais sequenciais (49,62,57). |
| Escolhas mínimas | Parcial | cinco cadastros financeiros; cinco abas sanitárias e duas subabas de agenda; sete ações do animal; seis papéis de parceiro. São conjuntos com domínio, mas merecem agrupamento e busca, não eliminação cega. |
| Memória de trabalho | Bom | resumo lateral e links de origem repetem contexto útil; ressalva para detalhes sanitários genéricos que omitem nome do fato no título. |
| Divulgação progressiva | Bom/parcial | filtros, endereço, composição e guias recolhidos; desenhos de um campo ainda ocupam painel extenso. |

Cinco itens parciais nas tarefas mais complexas indicam carga alta segundo o checklist do playbook; listas comuns são moderadas/baixas. Isso não é medição cognitiva com participantes. O objetivo é cortar esforço extrínseco, preservando a complexidade necessária à rastreabilidade.

## Jornada emocional

Entrada no panorama é tranquila: cores discretas, títulos objetivos e números confiáveis. A lista permite procurar o caso e entrar no detalhe. O primeiro vale aparece nos formulários extensos e na multiplicidade de origens/unidades/efeitos; a revisão lateral é o pico potencial de confiança, mas a aprovação visual prematura enfraquece esse pico. Baixa e liquidação fornecem contexto e reversibilidade (36,64), o que é adequado ao risco. O fim efetivo da jornada — confirmação, toast, atualização e retorno após escrever — não foi exercitado. Não se pode afirmar que a experiência termina bem só pela existência de um botão.

## Personas — sinais concretos

- **Alex, uso frequente:** tem filtros, busca global e seleção coletiva. O atrito é a descoberta de linha acionável, a diferença de ação por tabela e a repetição de cliques para navegar cadastros/voltar ao hub. O código da tabela possui Enter/Espaço e a busca global usa Ctrl/⌘K; não recomendar “adicionar teclado” genericamente. O detalhe de relatório com largura excedida prejudica a conferência rápida de totais.
- **Sam, dependente de acessibilidade:** há skip link, rótulos acessíveis, status de carregamento, tabs e foco visível observados; isso é mérito. Riscos a verificar: leitura linear da ficha muito longa; ações visuais apenas por ícone; hints de tamanho reduzido; símbolos de check comunicando validade contraditória. Não foram medidos contraste, zoom200%, ordem completa de foco ou testado leitor de tela, portanto sem alegação WCAG.
- **Casey, atenção interrompida:** rascunhos de operação/relatório ajudam de verdade. A ficha extensa e formulários com várias regiões de rolagem exigem recuperar posição/contexto. Seus riscos móveis específicos permanecem para avaliação B; A não infere alvos44px, rede lenta ou perda de trabalho a partir de desktop.

## Matriz por tela/estado observado

Abreviações: `A/` e `P/` referem-se aos diretórios de evidência acima. “Boa” significa leitura/entrada do estado inspecionado; nunca homologação de escrita. Quando o mesmo arquivo de página inteira cobre várias seções, isso é declarado.

| Passo | Rota / tela / estado | Evidência | Força | Problema e recomendação | Saúde |
|---:|---|---|---|---|---|
| 1 | `/financeiro` visão geral | A/01-financeiro.png | disponibilidade, caixa e prazo separados | P2 calendário toma espaço para poucos fatos; oferecer prioridade operacional sem apagar calendário | Boa |
| 2 | `/financeiro/operacoes` lista | A/02-operacoes.png | efeito e status distintos | P2 linha acionável pouco evidente; expor abertura consistente | Boa |
| 3 | `/financeiro/operacoes/:id` confirmado | A/03-operacao-detalhe.png | itens, compromisso e estoque juntos | P2 Cancelar operação é a ação mais saliente no detalhe consultivo; dar tratamento secundário de risco | Boa |
| 4 | `/financeiro/operacoes/nova` rascunho de compra | A/23-operacao-form.png | revisão lateral com efeitos | P1 checkmarks/zero antes de preenchimento; separar pendências de projeções | Atenção |
| 5 | `/financeiro/compromissos` pagar/lista | A/04-compromissos.png | pendente versus total e vencimento legíveis | P2 termo “Condição de prazo, não status” fala à modelagem; explicar por que importa | Boa |
| 6 | compromissos/calendário | A/05-compromissos-calendario.png | navegação mensal e legenda | P2 muito espaço por um item; vista lista continua disponível | Boa com ressalva |
| 7 | liquidação de compromisso parcial | A/64-financeiro-liquidacao.png | saldo, data, conta e efeito confirmatório | P2 texto de consequência fica abaixo da dobra; pôr resumo de efeito perto de confirmar | Boa entrada; não submetida |
| 8 | `/financeiro/contas` consolidado, fluxo e extrato geral | A/06-contas.png página inteira | saldo separado dos movimentos brutos | P2 gráfico antecede busca da conta/extrato e amplia percurso; priorizar tarefa sem duplicar conceitos | Boa |
| 9 | `/financeiro/contas/:id` conta e extrato | A/07-conta-detalhe.png página inteira | contexto e período compartilhado | P2 enums BANCO/CORRENTE; usar rótulos portugueses já existentes | Boa |
| 10 | configurações financeiras/contas | A/08-config-fin-contas.png | situação e edição diretas | P2 busca “Nome ou documento” pouco específica para conta; adaptar placeholder | Boa |
| 11 | nova conta | A/09-form-conta.png | seções e footer fixo | P2 muitos campos bancários e identificação sobreposta; consolidar ajuda e evitar repetição | Boa entrada |
| 12 | configurações/parceiros | A/10-config-parceiros.png | papéis múltiplos legíveis | P2 “parceiro” e “cliente/fornecedor” alternam; explicar guarda-chuva | Boa |
| 13 | novo parceiro | A/11-form-parceiro.png | orientação do mínimo e endereço recolhido | P2 seis papéis, default Fornecedor mesmo em cadastro genérico; revisar origem do default | Boa entrada |
| 14 | configurações/produtos | A/12-config-produtos.png | link para estoque | P2 filtro de fornecedor truncado; dar largura ao conteúdo real | Boa |
| 15 | novo produto | A/13-form-produto.png | usos independentes e irreversibilidade do rastreio | P2 campos Nome/Categoria desalinhados verticalmente por hints; alinhar blocos | Boa entrada |
| 16 | configurações/categorias financeiras | A/14-config-categorias.png | classificação/vínculos explícitos | P2 busca genérica e rolagem interna; padronizar busca e densidade | Boa |
| 17 | nova categoria financeira | A/15-form-categoria.png | diálogo proporcional à tarefa | P3 ajuda e texto breve suficientes; manter tamanho compacto | Boa entrada |
| 18 | configurações/centros | A/16-config-centros.png | história preservada | P3 catálogo claro; evitar inferir módulos operacionais de nomes históricos | Boa |
| 19 | novo centro | A/17-form-centro.png | um campo em diálogo breve | sem problema relevante nesta entrada | Boa |
| 20 | `/financeiro/relatorios` lista | A/18-relatorios.png | autor, período, sítio e PDF | P2 abertura do detalhe depende de linha/chevron; padronizar | Boa |
| 21 | relatório emitido | A/19-relatorio-detalhe.png | recorte preservado | P1 seção direita excede largura; corrigir grade/min-width | Atenção |
| 22 | novo relatório com rascunho existente | A/20-relatorio-rascunho-aviso.png | protege trabalho | P2 falta ação neutra explícita “Voltar”; não forçar escolha destrutiva | Boa com ressalva |
| 23 | relatório/formulário | A/21-relatorio-form.png | três leituras financeiras explicadas | P2 densidade de resumo pequeno; revisar quebra de textos | Boa entrada |
| 24 | relatório/filtros avançados | A/22-relatorio-filtros.png | estado selecionado exposto | P2 seis decisões adicionais; conservar divulgação progressiva | Boa |
| 25 | `/estoque` saldos e histórico | A/24-estoque.png página inteira | unidades e origens preservadas | P2 histórico muito longo e assistente cobre valores na primeira dobra; reservar área livre | Boa |
| 26 | transferir estoque | A/25-estoque-transferir.png | efeito financeiro explicado | P2 drawer grande e instrução extensa; compactar sem perder origem/valor | Boa entrada |
| 27 | `/estoque/produtos/:id` resumo | A/26-produto-resumo.png | escopo consolidado explícito | P2 sítio da ficha e sítio global exigem explicação da relação; manter contexto claro | Boa |
| 28 | produto/lotes | A/27-produto-lotes.png | validade e saldo juntos | P3 linha clara, menu de ações não exercitado | Boa |
| 29 | produto/movimentos | A/28-produto-movimentos.png | origem consultável | P2 links se parecem com texto comum; affordance consistente | Boa |
| 30 | produto/origens de entradas | A/29-produto-origens.png | fornecedor e operação ligados | P2 mesma ressalva de links; explicitar ação de consulta | Boa |
| 31 | `/pecuaria/rebanho` visão geral | A/30-rebanho-panorama.png | efetivo e baixas com denominador | P2 atividade recente compete com ação de consultar; hierarquia operacional | Boa |
| 32 | `/pecuaria/rebanho/animais` | A/31-animais.png página inteira | filtro, seleção e GMD na lista | P2 legenda compacta trunca categorias; tooltip/expansão deve revelar rótulos | Boa |
| 33 | novo animal | A/32-animal-novo.png página inteira | identificação/genética/localização agrupadas | P1 revisão com check em sítio ainda não escolhido; sinalizar pendência | Atenção |
| 34 | ficha/Resumo e identificação-genética | A/33-animal-resumo.png página inteira | genealogia e composição lado a lado | P2 página longa, Vaca repetida no subtítulo e chip; reduzir repetição | Boa |
| 35 | ficha/Sanidade | mesmo A/33, seção inferior | carências e aplicações ligadas | P2 muitos CTAs equivalentes; orientar consulta versus registro | Boa |
| 36 | ficha/Peso e manejo | mesmo A/33, seção inferior | histórico e GMD definidos | P2 três GMDs iguais no exemplo ocupam espaço; manter distinções sem repetição visual dominante | Boa |
| 37 | ficha/Nutrição | mesmo A/33, seção inferior | estornado versus confirmado inequívoco | P2 cartões longos por período; versão compacta expansível | Boa |
| 38 | ficha/Histórico e auditoria | mesmo A/33, final | autoria/data preservadas | P2 nomes internos sem tradução; apresentar ação em português | Atenção |
| 39 | registrar pesagem | A/34-animal-pesagem.png | diálogo breve e contexto animal | P3 formulário simples; não exercitada validação | Boa entrada |
| 40 | movimentar animal | A/35-animal-movimentar.png | origem e destino juntos | P2 sítio/lote já iguais ao atual; distinguir mudança ainda não definida | Boa entrada |
| 41 | baixa animal | A/36-animal-baixa.png | carências e retorno claro | P2 alerta grande pode dominar campos; preservar consequência em síntese | Boa entrada |
| 42 | `/pecuaria/rebanho/lotes` | A/37-lotes.png página inteira | tabela antes do comparativo | P2 histórico e filtros densos abaixo; tornar mais fácil localizar data/animal | Boa |
| 43 | novo lote | A/38-lote-form.png | centro do consumo explicado | P2 espaço excessivo e ícone de ajuda em linha isolada; corrigir alinhamento | Boa entrada |
| 44 | ficha de lote | A/39-lote-detalhe.png página inteira | presente, baixas e histórico separados | P2 leitura extensa sem navegação de seções equivalente à ficha animal | Boa |
| 45 | `/pecuaria/sanidade` agenda/ciclos | A/40-sanidade-ciclos.png | Abrir ciclo explícito | P2 cinco abas+duas subabas; preservar posição/retorno | Boa |
| 46 | ciclo dedicado `rodadaId` | A/41-sanidade-ciclo-detalhe.png página inteira | versão, etapa e participação | P2 aninhamento de painéis cria ruído; menos bordas, mesma hierarquia | Boa |
| 47 | novo ciclo | A/42-sanidade-ciclo-form.png | início e sítio do fato primeiro | P2 título “Iniciar ciclo” versus “Novo ciclo” é aceitável mas unificar vocabulário ajuda | Boa entrada |
| 48 | agenda/tarefas | A/43-sanidade-tarefas.png | atrasadas e pendentes explicitadas | P2 ações se repetem e contexto de ciclo longo; conservar prioridade e compactar secundários | Boa |
| 49 | executar etapa/aplicação | A/44-sanidade-execucao-form.png | planejado fixo e desvio explícito | P2 leitura longa, lote e carência abaixo; resumo do necessário junto da conferência | Boa entrada; prévia não acionada |
| 50 | ocorrências | A/45-sanidade-ocorrencias.png | período e situação legíveis | P2 ações de encerrar/anular só por ícone; melhorar identificação visível | Boa |
| 51 | nova ocorrência | A/46-sanidade-ocorrencia-form.png | sítio na data | P2 busca animal e seletor separados; explicar dependência/reduzir repetição | Boa entrada |
| 52 | detalhe da ocorrência | A/47-sanidade-ocorrencia-detalhe.png | fatos relacionados | P2 título genérico “fato sanitário”; nomear ocorrência/animal/doença | Boa |
| 53 | aplicações | A/48-sanidade-aplicacoes.png | origem histórica explicitada | P2 “Não vinculado” antecede medicamento histórico; tornar nome factual mais evidente | Boa |
| 54 | aplicação individual | A/49-sanidade-aplicacao-form.png | várias origens sem misturar fatos | P2 campo animal escolhido não saliente na segunda etapa; repetir identificação | Boa entrada |
| 55 | exames | A/50-sanidade-exames.png | pendente versus resultado | P2 ícones de resultado/correção dependem de familiaridade; texto/tooltip | Boa |
| 56 | registrar exame | A/51-sanidade-exame-form.png | resultado opcional | P2 formulário extenso; sinalizar claramente coleta agora/resultado depois | Boa entrada |
| 57 | informar resultado | A/52-sanidade-resultado-form.png | unidade congelada | P2 drawer desproporcional, falta contexto animal/exame no topo; repetir identificação | Atenção |
| 58 | carências | A/53-sanidade-carencias.png | zero, encerrada e vigente distintos | P2 datas pequenas e texto repetido por linha; manter exatidão com melhor escala | Boa |
| 59 | gerenciar procedimentos/seleção de serviço | A/54-sanidade-procedimentos.png | serviço confirmado explícito | P2 vazio grande antes da escolha; explicar próximo passo. Etapas após seleção não capturadas | Parcial |
| 60 | `/pecuaria/nutricao` visão geral | A/55-nutricao.png página inteira | cobertura atual separada do custo histórico | P2 muito espaço do panorama antes da lista; hierarquia pelo uso cotidiano | Boa |
| 61 | nutrição/lote | A/56-nutricao-lote.png página inteira | dieta vigente primeiro | P2 Corrigir vigência parece link comum; ação de escrita precisa verbo/visual claro | Boa |
| 62 | atribuir dieta | A/57-nutricao-atribuir.png | versão publicada e histórico explicados | P2 resumo poderia informar data/receita após escolha; estado inicial adequado | Boa entrada |
| 63 | conferir consumo | A/58-nutricao-conferir.png | dados mínimos e próxima etapa | P2 título simples e contexto lote útil; prévia/confirmar não exercitados | Boa entrada |
| 64 | fechamento confirmado | A/59-nutricao-fechamento.png página inteira | origem de estoque e atribuição | P2 seção de consumo extensa; tabela deve continuar sendo fonte precisa | Boa |
| 65 | nutrição/fechamentos | A/60-nutricao-fechamentos.png | estornado separado | P2 consulta com apenas dois itens é clara; paginação/volume não testados | Boa |
| 66 | nutrição/receitas | A/61-nutricao-receitas.png | rascunho e uso dos publicados | P2 catálogo ocupa cards grandes; diferenciar ação consulta/publicação de forma consistente | Boa |
| 67 | nova receita | A/62-nutricao-receita-form.png | jornada rascunho/publicação/uso | P2 rótulo “Quantidade...1” soa mecânico; nomear pelo ingrediente ao selecionar | Boa entrada |
| 68 | receita/composição publicada | A/63-nutricao-receita-detalhe.png | unidade e matéria seca explícitas | P2 gráfico/lista/tabela repetem três ingredientes; manter comparação útil sem repetir todo valor três vezes | Boa |
| 69 | configurações/Pecuária hub | P/config-hub.jpg | grupos com descrição e busca | P2 topo usa abas sem título geral Configurações; reforçar localização | Boa |
| 70 | categorias de animais | P/config-categorias.jpg | regra e sexo explicam classificação | P2 reordenação por ícone e muitas ações por linha; explicar efeito de ordem antes de alterar | Boa |
| 71 | nova categoria animal | P/categoria-form.jpg | manual versus regra explicado | P2 defaults amplos podem produzir regra abrangente; prévia de animais afetados precisa conferência posterior | Boa entrada |
| 72 | motivos de baixa | P/config-motivos.jpg | classe e uso histórico | P2 sem busca visível no catálogo longo; acrescentar busca local | Boa com ressalva |
| 73 | novo motivo | P/motivo-form.jpg | diálogo compacto | P2 ícone de ajuda isolado em outra linha; alinhar com rótulo Classe | Boa entrada |
| 74 | raças | P/config-racas.jpg | base versus composta | P2 sem busca visível; padrão de filtro de ativos diferente dos sanitários | Boa |
| 75 | nova raça | P/raca-form.jpg | consequência da raça base explicada | P2 ajuda Sigla em linha separada; compactar | Boa entrada |
| 76 | genitores externos | P/config-genitores.jpg | nome, sexo, código e filhos | P2 siglas raciais exigem conhecimento; revelar nome da raça em ajuda | Boa |
| 77 | novo genitor | P/genitor-form.jpg | fornecedor e composição juntos | P2 0/64 pouco autoexplicativo; linguagem de fração mais clara | Boa entrada |
| 78 | materiais genéticos | P/config-materiais.jpg | produto e saldo juntos | P2 ações/linha sem tratamento consistente com origem do estoque; manter ida/volta clara | Boa |
| 79 | novo material/sêmen | P/material-form.jpg | interno/externo explícito | P2 preta a seleção enquanto maioria usa verde; embrião não capturado | Boa entrada; variante parcial |
| 80 | protocolos | P/config-protocolos.jpg | publicação e versão preservadas | P2 linha expansível pouco explícita e ações copiar/publicar por ícone; legendas | Boa |
| 81 | novo protocolo | P/protocolo-form.jpg | dia relativo e etapa agrupados | P2 sequência longa no drawer; facilitar revisão de conjunto antes de salvar | Boa entrada |
| 82 | doenças | P/config-doencas.jpg | lista simples | P2 catálogo longo sem busca visível; adicionar busca | Boa com ressalva |
| 83 | nova doença | P/doenca-form.jpg | um campo | P2 drawer enorme; diálogo compacto | Atenção espacial |
| 84 | tipos de aplicação | P/config-aplicacoes.jpg | define limites sem prometer carência | P3 leitura simples e bem delimitada | Boa |
| 85 | novo tipo de aplicação | P/tipo-aplicacao-form.jpg | um campo | P2 drawer enorme; diálogo compacto | Atenção espacial |
| 86 | tipos de exame | P/config-exames.jpg | formato/unidade juntos | P2 sem explicação da imutabilidade na lista, fornecida no form | Boa |
| 87 | novo tipo de exame | P/tipo-exame-form.jpg | bloqueio após coleta explicado | P2 espaço pouco usado e formato como decisão principal; manter explicação junto do formato | Boa entrada |
| 88 | `/configuracoes/sitios` | P/sitios.jpg | pesquisa e sítio principal explícitos | P3 clara com poucos registros; grandes volumes não testados | Boa |
| 89 | novo sítio | P/sitio-form.jpg | principal único explicado | P2 drawer muito largo para poucos campos; UF em texto livre merece validação posterior | Boa entrada |
| 90 | `/acessos` dono/lista | P/acessos.jpg | dono irreduzível explícito | P2 estilo avatar/badge distinto; harmonizar sem perder distinção do dono | Boa |
| 91 | acessos/editor operador | P/acessos-permissoes.jpg | áreas, perfil e autosave declarados | P2 alteração de autorização imediata merece feedback/consequência local; não testado salvamento | Parcial |
| 92 | convidar pessoa | P/acessos-convite.jpg | quatro papéis descritos | P2 linguagem/serifa/cabeçalho preto destoam; harmonizar. Não enviado | Boa entrada |
| 93 | assistente/painel inicial | P/assistente.jpg | consultas rápidas, fonte e só consulta | P2 cinco atalhos e mídia competem com guias; reduzir decisão inicial e contextualizar ajuda. Nenhuma consulta acionada | Parcial |
| 94 | `/forgot-password` | P/recuperar-senha.jpg | privacidade e retorno explícitos | P2 linguagem visual creme/serifa diverge; harmonizar mantendo clareza | Boa entrada; não enviado |

## Inventário de variantes não capturadas e limites explícitos

Cobertura acima é ampla de telas, não uma promessa de todos os estados. As variantes abaixo existem no código ou dependem de pré-condição não exercitada. **Sem evidência visual própria não recebem aprovação de design.**

| Superfície/variante | Fonte / motivo | O que permanece sem verificar |
|---|---|---|
| `/signin` | Login.tsx; sessão autenticada redireciona; sem logout | composição real, erro de credencial, login em andamento e retorno autorizado |
| `/invite/:token`, `/reset-password/:token` e aliases | DefinirSenha.tsx/navegacaoAuth.ts; token válido não disponível; sem criar credenciais | estado válido, inválido/expirado, confirmação e sucesso; código mostra senha mínima e comparação |
| inicialização/splash | TerranoIntro.tsx; não recarregado só para capturar | duração/movimento/experiência com rede lenta |
| busca global/paleta e menu conta/sítio abertos | CommandPalette/AppSidebar/FarmPicker; entrada existe, popup não capturado | ordem foco/resultados/empty state; código confirma Ctrl/⌘K e tratamento de Enter |
| Plano de categorias `/financeiro/configuracoes/categorias` se usa PlanoContas em vez de aba | router/PlanoContas; não visitado como superfície separada | diferenças de navegação/simulação; não confundir com captura14 da aba Categorias |
| compromissos a receber, liquidados, cancelados e detalhe completo/histórico | CompromissosFinanceiros/CompromissoDetalheDialog/HistoricoLiquidacoes | filtros de situação, recebimento e reversões. Lista pagar e calendário foram vistos |
| nova operação outros tipos/condições, correção, perda/ajuste/transferência entre contas | FormOperacao/OperacaoFinanceiraDetalhe | nove naturezas/efeitos, recebimento físico, parcelas, adiantamento etc. Não mudar rascunho existente para explorar variantes; transferência de estoque vista25 |
| confirmar/cancelar/estornar operação ou liquidação | componentes financeiros respectivos | confirmação, validação pós-submissão, atomicidade e sucesso; nenhuma escrita |
| relatório PDF, prévia expandida e emissão | RelatorioGerencialDocumento/NovoRelatorio | documento exportado, sucesso de emissão e linkR2. Detalhe do snapshot visto |
| estoque perda/ajuste, edição de partida/rastreio de legado, preview e confirmação | EstoqueContent/PartidasProduto/TransferirEstoque | guardrails, validade desconhecida/vencida, erros e reversão |
| ficha animal menus de editar dados, finalidade, categoria, composição, filiação; manejo/desmama/castração | forms e manejo/ManejoAnimal | prévias e validações; cadastro completo32 e formulários34–36 vistos; todas seis seções da ficha estão no full-page33 |
| seleção coletiva/pesagem coletiva/movimentação e desfazer | ListaAnimais, SeletorAnimais, FormMovimentar, ConfirmarDesfazer | seleção visível31, mas operações coletivas não percorridas |
| histórico de movimentação/detalhe e baixa de animal já baixado | DetalheMovimentacao/HistoricoBaixas | retorno por fatos anteriores, estorno/ciência; baixa inicial vista36 |
| sanidade detalhe aplicação/exame, correção de carência, encerramento/anulação, reconciliação de origem, serviços e rateio | DetalheSanitario/ReconciliarOrigem/GerenciarProcedimentosServico/ResultadoExame | novo registro, tarefa e ocorrência detalhe vistos; demais não exercitados; sem assumir equivalência por componente compartilhado |
| ciclo adicionar/remover/associar/renomear e prévia de execução/desvios | AgendaRodadas/FormRodada/PreviaExecucao | detalhe visto41 e form inicial42/44; nenhuma etapa confirmada |
| nutrição correção de vigência, conferência com dados, confirmação e estorno | FormOperacaoNutricional/ConferenciaPeriodos | prévia não acionada. Detalhe de fechamento confirmado59 e estornado no histórico60 |
| receita editar rascunho, criar versão e publicar | FormReceitaDieta/ReceitasDieta | novo formulário e publicada consultados; publicação não clicada |
| configuração editar, desativar, restaurar, simular/reordenar e variantes embrião/genitor | cadastros e CadastrosSanitarios | campos base vistosP, mas estados pós-alteração/impactos não homologados |
| acesso restrito sem valores, sem permissão ou outro sítio | somente sessão dono utilizada | segurança/mascaramento não deduzidos da visão dono; contrato financeiro já declara limitação atual |
| vazio, erro de rede, centenas de itens, zoom, leitor de tela, mobile e baixa conectividade | sem simulação nesta avaliaçãoA | não afirmar contraste/targets/performance/compliance a partir das capturas |

## Observações menores

- Datas e quantidades têm boa base PT-BR; alguns resumos ainda mostram KG/ML e frações/siglas mais técnicas que o necessário.
- O assistente flutuante sobrepõe parte de valores/ações na dobra de várias páginas (01,24,41). Reservar espaço consistente; a lista de animais já usa acionador menor (31).
- O título genérico “Detalhe do fato sanitário” obriga ler o corpo para reconhecer ocorrência, animal e doença (47).
- Ícones de ajuda às vezes quebram para uma linha isolada (38 e formuláriosP). Isso é problema de alinhamento, não motivo para remover ajuda.
- O vocabulário de status é em geral preciso. Não colapsar carência desconhecida, zero e encerrada para “liberado”, nem custo desconhecido para zero ao simplificar.
- Não há evidência de que adicionar mais gráficos melhoraria a tarefa; a prioridade é o conteúdo caber, a ação ser reconhecível e a revisão representar o estado real.

## Perguntas propostas para a síntese final

1. Primeiro ciclo de melhoria: **clareza dos formulários e revisão**, **densidade/rolagem das consultas** ou **consistência entre ajuda/acesso e módulos**?
2. A implantação deve cobrir **três maiores problemas**, **todos os P1/P2** ou **um domínio completo por vez**?

Estas perguntas são insumos ao agente principal; A não pede autorização nem encerra o fluxo do usuário por conta própria. Nenhuma implementação foi feita.
