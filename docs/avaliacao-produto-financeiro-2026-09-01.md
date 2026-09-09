# Avaliação de Produto — Módulo Financeiro

**Data:** 01/09/2026
**Escopo:** frontend, regras de negócio e modelo de dados do Financeiro
**Objetivo:** transformar feedback exploratório em diagnóstico verificável e priorizado para evolução do produto

---

## 1. Resumo executivo

O Financeiro possui uma fundação funcional relevante: lançamentos reais, contas a pagar, fornecedores e clientes, caixinha, fechamento mensal, permissões e um dashboard que cruza financeiro e rebanho. O problema não é ausência total de produto; é que as partes foram agrupadas sem uma arquitetura de informação e uma política operacional suficientemente claras para um sistema financeiro profissional.

Os riscos mais relevantes são:

1. **Baixa financeira insegura:** uma conta pode ser marcada como paga em um clique, usando automaticamente a data atual, sem confirmação, comprovante, forma de pagamento ou fluxo explícito de reversão.
2. **Dashboard com temporalidades concorrentes:** o mesmo painel mistura dados do mês selecionado com alertas atuais. A interface informa essa diferença, mas não resolve a ambiguidade decisória.
3. **Período padrão potencialmente enganoso:** o dashboard abre no último mês encontrado dentro de uma janela histórica fixa que termina em maio de 2026. Em setembro de 2026, isso faz o produto abrir em maio mesmo havendo lançamentos posteriores no banco.
4. **Caixinha desconectada do razão financeiro:** seus movimentos alteram apenas o saldo próprio da caixinha; não atualizam automaticamente lançamentos nem saldos bancários. O usuário pode interpretar que mexeu no caixa geral quando isso não aconteceu.
5. **Cadastros incompletos para operação profissional:** não há gestão de contas bancárias no frontend, e a criação implícita de fornecedor durante um lançamento não captura os dados cadastrais completos.
6. **Arquitetura de navegação pouco explícita:** `/dashboard` é uma visão geral da fazenda, enquanto `/gastos` concentra três objetos diferentes. O produto não possui um espaço financeiro claramente delimitado.

As críticas exclusivamente visuais — tipografia, densidade e uso de colunas — são legítimas como percepção, mas precisam de critérios e testes de usabilidade para virarem requisitos. Já os problemas de baixa, conciliação, temporalidade e integridade possuem evidência objetiva e devem ter prioridade maior.

---

## 2. Método e classificação

Cada observação foi classificada como:

- **Confirmada:** comportamento comprovado no código, API, banco ou interface local.
- **Parcialmente confirmada:** existe fundamento, mas a descrição original omite uma capacidade ou generaliza o problema.
- **Não confirmada:** não foi reproduzida ou o código atual contradiz a afirmação.
- **Opinião de UX válida:** julgamento visual ou de arquitetura que precisa ser transformado em hipótese testável.

Prioridades utilizadas:

- **P0 — Integridade e confiança:** risco de saldo, pagamento, auditoria ou perda de dados.
- **P1 — Fluxo principal:** bloqueia ou confunde atividades frequentes.
- **P2 — Arquitetura e compreensão:** reduz encontrabilidade e consistência.
- **P3 — Refinamento:** qualidade visual e melhoria incremental.

---

## 3. Diagnóstico da arquitetura financeira

O sistema está ancorado em `Lancamento`. Cada lançamento possui:

- direção financeira (`CREDITO` ou `DEBITO` no banco);
- situação (`ABERTO`, `LIQUIDADO` ou `LIQUIDADO_PARCIAL`);
- categoria;
- centro de custo;
- conta bancária;
- fornecedor ou cliente;
- propriedade.

O saldo bancário é calculado como:

```text
saldo inicial da conta
+ créditos liquidados
− débitos liquidados
```

Entretanto, todas as contas importadas estão com saldo inicial igual a zero. Hoje, o “saldo” é essencialmente o fluxo acumulado dos lançamentos importados, não uma posição bancária conciliada.

Além disso, existem dois razões financeiros independentes:

```text
Razão principal: Lancamento → saldo das contas e relatórios
Razão da caixinha: MovimentoCaixinha → saldo próprio da caixinha
```

Não há ponte automática entre eles. Essa separação é tecnicamente válida, mas precisa ser explícita e acompanhada de conciliação; do contrário, cria risco de dupla contagem ou falsa percepção de atualização do caixa geral.

---

## 4. Avaliação por rota

### 4.1 `/lancar` — Novo lançamento

#### 4.1.1 Nome e estrutura da rota

**Feedback original:** `/lancar` parece informal e pouco profissional.
**Classificação:** opinião de arquitetura válida.
**Prioridade:** P2.

`/lancar` funciona tecnicamente e usa linguagem orientada à ação, mas não expressa o domínio nem o objeto criado. Em um produto amplo, a URL fica ambígua: lançar o quê?

Sugestão de arquitetura:

```text
/financeiro/lancamentos/novo
```

Na interface, “Novo lançamento” pode continuar como rótulo. A mudança recomendada é estrutural, não uma troca obrigatória da linguagem visível.

#### 4.1.2 Layout em duas colunas

**Feedback original:** design pouco claro e duas colunas desnecessárias.
**Classificação:** opinião de UX válida.
**Prioridade:** P3, salvo se teste mostrar erros de preenchimento.

Os formulários de entrada e saída utilizam duas colunas em telas largas. Isso não é, por si só, um defeito. O problema é que a organização visual não comunica claramente uma sequência operacional.

Para uma tarefa financeira, a hierarquia deveria seguir:

1. tipo da movimentação;
2. valor e data;
3. contraparte;
4. classificação gerencial;
5. conta e situação;
6. documentos e observações;
7. revisão antes de confirmar.

A recomendação é avaliar uma coluna principal com seções progressivas e resumo lateral apenas quando o resumo acrescentar valor real.

#### 4.1.3 Cadastro de fornecedor durante o lançamento

**Feedback original:** não é possível adicionar fornecedor nem navegar para o cadastro.
**Classificação:** parcialmente confirmada.
**Prioridade:** P1.

O comportamento atual permite digitar um nome inexistente. Ao salvar o lançamento, o backend cria automaticamente um `ClienteFornecedor` apenas com esse nome. Portanto, é possível criar uma contraparte sem sair da tela.

Problemas reais:

- a interface mostra “Cadastrar como novo fornecedor”, mas o cadastro só acontece quando o lançamento é enviado;
- não é possível preencher CPF/CNPJ, tipo, telefone ou e-mail nesse fluxo;
- não há ação clara “Cadastrar dados completos”;
- não há link para abrir o cadastro em outra tela preservando o lançamento;
- a criação implícita pode gerar duplicidades por variação de nome.

Recomendação:

- manter a criação rápida por nome;
- oferecer “Cadastrar dados completos” em modal ou drawer;
- preservar o formulário durante essa ação;
- aplicar busca de duplicidade por nome normalizado e documento.

#### 4.1.4 Perda do formulário ao sair da página

**Feedback original:** sair da página perde tudo.
**Classificação:** parcialmente confirmada.
**Prioridade:** P1.

O formulário de **saída** possui salvamento manual de rascunho em `localStorage` e restauração posterior. Portanto, a afirmação não é integralmente verdadeira.

As lacunas são:

- o salvamento não é automático;
- sair sem acionar “Salvar rascunho” perde as mudanças;
- o fluxo de **entrada** não possui o mesmo rascunho;
- não há alerta de navegação com alterações não salvas;
- o rascunho é local ao navegador e não fica associado ao usuário no servidor.

Recomendação mínima:

- autosave local para entrada e saída;
- indicador “Rascunho salvo agora”;
- confirmação ao descartar alterações;
- evolução futura para rascunho persistido por usuário.

#### 4.1.5 Conta de recebimento e tipo de receita

**Feedback original:** não está claro onde definir conta e tipo da receita.
**Classificação:** parcialmente confirmada.
**Prioridade:** P1.

A tela de entrada possui seção “Tipo de receita” e seleção de conta. Logo, os campos existem. O problema é de hierarquia, vocabulário e origem dos cadastros:

- a conta é apenas escolhida; não há cadastro ou edição de contas no frontend;
- o usuário não vê saldo, banco ou final da conta durante a escolha;
- os tipos de receita estão incorporados ao formulário, mas o modelo econômico ainda depende de categoria e centro de custo;
- não há explicação sobre como a seleção afeta resultado, caixa e atividade.

Recomendação: usar “Conta de destino” para entradas e “Conta de pagamento” para saídas, mostrando nome, banco e saldo conciliado quando esse dado se tornar confiável.

#### 4.1.6 “Crédito e débito” versus “entrada e saída”

**Feedback original:** a interface usa apenas crédito e débito.
**Classificação:** não confirmada na interface atual; válida para o modelo interno.
**Prioridade:** P1 para modelagem; resolvida parcialmente na UI.

A interface atual já apresenta **Entrada** e **Saída**. `CREDITO` e `DEBITO` permanecem como enum interno do banco.

Mesmo assim, há uma limitação real: entrada/saída representa apenas direção do dinheiro, não sua natureza econômica. Venda, aporte, financiamento e transferência recebida são todas entradas, mas não deveriam produzir o mesmo efeito gerencial.

Modelo recomendado:

```text
direção: ENTRADA | SAIDA
tipo de operação: RECEITA | DESPESA | INVESTIMENTO | TRANSFERENCIA |
                  APORTE | FINANCIAMENTO | RETIRADA | AJUSTE
categoria: detalhamento gerencial
```

Trocar apenas os nomes do enum melhora a linguagem, mas não resolve a classificação econômica.

---

### 4.2 `/dashboard` — Visão mensal da fazenda

#### 4.2.1 Escopo da rota

**Feedback original:** `/dashboard` parece financeiro, mas deveria ser geral; ou o financeiro deveria ter `/financeiro/dashboard`.
**Classificação:** confirmada como ambiguidade de arquitetura.
**Prioridade:** P2.

O dashboard atual é explicitamente uma “Visão mensal da fazenda”. Ele combina:

- resultado, entradas e gastos;
- situação e eventos do rebanho;
- alertas operacionais atuais.

Portanto, ele não é exclusivamente financeiro. A URL genérica é coerente com uma home cross-domain, mas o produto não possui um cockpit financeiro separado.

Arquitetura sugerida:

```text
/visao-geral                 visão executiva cross-domain
/financeiro                  cockpit financeiro
/financeiro/lancamentos      razão e contas
/financeiro/contas-a-pagar   obrigações
/financeiro/caixas           contas bancárias e caixinhas
/financeiro/relatorios       relatórios financeiros
```

Se `/dashboard` for mantido, ele deve ser entendido como home geral. Criar apenas `/financeiro/dashboard` sem rever a taxonomia duplicaria conceitos.

#### 4.2.2 Filtro mensal abre em período inesperado

**Feedback original:** o filtro de data seleciona outro período.
**Classificação:** confirmada e explicada.
**Prioridade:** P0.

O dashboard não abre no mês atual. Por decisão de código, ele procura o último mês com dados para evitar uma tela vazia, já que o BPO entrega dados com atraso.

O problema é que a descoberta usa séries fixas de 23 meses, de julho de 2024 a maio de 2026. Assim, em setembro de 2026, a interface abriu em **maio de 2026**, apesar de o banco possuir lançamentos liquidados posteriores.

Isso não é apenas um problema visual. O usuário pode acreditar que está vendo “agora” quando está vendo o último mês reconhecido por uma janela histórica congelada.

Recomendação:

- remover a janela fixa do backend;
- consultar dinamicamente o primeiro e último mês com dados;
- mostrar explicitamente “Último fechamento disponível: mai/2026”;
- diferenciar mês corrente, último mês fechado e mês selecionado;
- manter o período selecionado na URL.

#### 4.2.3 Sidebar, busca e conta do usuário

**Feedback original:** não seria necessário manter sidebar apenas para pesquisa e usuário.
**Classificação:** parcialmente incorreta como descrição; opinião de UX válida sobre densidade.
**Prioridade:** P2.

Busca e usuário ficam no header. A sidebar contém a navegação de Financeiro, Pecuária, Agronomia e Equipe. Portanto, ela não existe apenas para busca e conta.

O problema real é excesso de opções e hierarquia extensa. Para o perfil Proprietário, a sidebar contém dezenas de destinos, incluindo blocos expansíveis.

Recomendação:

- manter navegação lateral para o produto amplo;
- personalizar itens por papel e frequência;
- mostrar de início apenas áreas e tarefas principais;
- mover funções raras para hubs internos;
- validar se a busca global deve aparecer simultaneamente no header e na sidebar.

#### 4.2.4 Tipografia

**Feedback original:** tipografia incomoda e prejudica a percepção profissional.
**Classificação:** opinião de UX válida, ainda não mensurada.
**Prioridade:** P3.

O sistema combina serif para títulos/números e sans-serif para interface. Essa escolha está documentada como editorial e orientada à legibilidade do produtor. O problema não deve ser tratado como “gosto” do time.

Próximo passo adequado:

- testar com produtores e equipe administrativa;
- medir leitura a distância, escaneabilidade e contraste;
- revisar excesso de caixa alta, tracking e variação de tamanhos;
- criar uma escala tipográfica única por função.

#### 4.2.5 Scroll não chega ao fim

**Feedback original:** a página não permite rolar até o final.
**Classificação:** não confirmada nesta auditoria.
**Prioridade:** P1 se reproduzido.

O CSS base permite scroll vertical normal. Existe bloqueio de `body` quando o drawer mobile está aberto, com limpeza prevista ao fechar. Não há evidência suficiente para afirmar a causa.

Registrar para reprodução com:

- navegador e sistema operacional;
- largura e altura da janela;
- sidebar aberta ou recolhida;
- presença de modal, drawer ou intro;
- vídeo curto mostrando o limite do scroll.

Se reproduzido, deve ser tratado como bug funcional, não como refinamento visual.

#### 4.2.6 Baixa densidade informacional

**Feedback original:** poucos cards e ausência de gráficos para uma fazenda com muitos dados.
**Classificação:** parcialmente confirmada; direção de produto precisa ser definida.
**Prioridade:** P2.

A visão atual não possui apenas seis cards: ela apresenta quatro KPIs, resumo financeiro, resumo de rebanho e lista de pendências. Porém, a crítica central procede: trata-se de uma visão rasa diante da riqueza dos dados disponíveis e praticamente sem evolução temporal visual.

Não se recomenda simplesmente adicionar mais cards. Um cockpit executivo deveria responder:

1. Estamos gerando ou consumindo caixa?
2. Qual atividade explica o resultado?
3. O realizado está acima ou abaixo do plano?
4. Quais obrigações vencem em breve?
5. Qual ação muda materialmente o resultado?

Gráficos recomendados apenas quando respondem a essas perguntas:

- receita, despesa e resultado nos últimos 12 meses;
- caixa realizado e projetado;
- despesas por atividade versus orçamento;
- contas a pagar por faixa de vencimento;
- composição de custeio versus investimento.

#### 4.2.7 Alertas atuais dentro de um dashboard mensal

**Feedback original:** alertas independentes do mês não deveriam aparecer misturados ao painel mensal.
**Classificação:** confirmada.
**Prioridade:** P1.

O próprio frontend declara: “Alertas do rebanho são atuais, independentemente do mês selecionado.” Isso reduz o risco de interpretação errada, mas não elimina a incoerência.

Há duas soluções coerentes:

- **Dashboard mensal:** tudo respeita o mês; alertas atuais ficam fora.
- **Cockpit atual:** período financeiro aparece como contexto, mas as ações são explicitamente de hoje.

Misturar os dois modelos em uma única narrativa exige esforço cognitivo desnecessário.

#### 4.2.8 “Entrou, saiu e onde foi gasto”

**Feedback original:** nomenclatura parece finanças pessoais.
**Classificação:** opinião de linguagem válida.
**Prioridade:** P2.

A frase é acessível, mas pode reduzir a percepção de robustez para gestor, BPO e contador. Uma solução não precisa abandonar linguagem simples.

Sugestões:

- título: **Desempenho financeiro do mês**;
- métricas: **Receitas**, **Despesas**, **Investimentos** e **Resultado de caixa**;
- apoio em linguagem simples: “quanto entrou, quanto saiu e quais atividades explicam o resultado”.

Isso mantém clareza sem adotar jargão contábil impreciso.

---

### 4.3 `/gastos` — Hub financeiro

#### 4.3.1 Período da tabela não está claro

**Feedback original:** não é possível saber de qual mês é a tabela.
**Classificação:** confirmada como problema de contexto.
**Prioridade:** P1.

A tabela não é mensal por padrão:

- “A vencer” mostra obrigações abertas com vencimento a partir de hoje;
- “Vencidas” mostra obrigações abertas anteriores a hoje;
- “Pagas” mostra o histórico liquidado paginado.

Portanto, perguntar “de qual mês?” revela que a interface não explica seu modelo temporal. A legenda da aba ajuda, mas não informa a data-base com destaque nem oferece filtro de período.

Recomendação:

- mostrar “Posição em 01/09/2026” nas abas abertas;
- oferecer vencimento “de/até”;
- em Pagas, exigir ou exibir claramente o período consultado;
- persistir filtros na URL.

#### 4.3.2 Alerta de vencidas enquanto “A vencer” está selecionado

**Feedback original:** a tela avisa sobre vencidas mesmo na aba A vencer.
**Classificação:** comportamento intencional, mas redundante.
**Prioridade:** P2.

O aviso serve como atalho de exceção: contas vencidas merecem atenção mesmo quando outra aba está aberta. Essa é uma decisão defensável.

O problema é repetir o mesmo número em:

- banner de alerta;
- badge da aba “Vencidas”.

Recomendação: manter somente o badge com peso visual suficiente ou manter o banner apenas quando houver severidade excepcional definida por valor, quantidade ou tempo de atraso.

#### 4.3.3 “Marcar como paga” sem confirmação e evidência

**Feedback original:** baixa ocorre sem confirmação, documentação ou comprovante.
**Classificação:** confirmada.
**Prioridade:** P0.

O botão chama imediatamente a API e altera o lançamento para `LIQUIDADO`, com `dataLiquidacao` igual à data atual. Existem apenas duas proteções:

- permissão `lancar`;
- bloqueio se o mês contábil estiver fechado.

Não existem nesse fluxo:

- modal de confirmação;
- escolha da data efetiva do pagamento;
- conta utilizada na baixa;
- valor efetivamente pago ou pagamento parcial;
- forma de pagamento;
- comprovante;
- observação;
- revisão final;
- ação de desfazer.

Para uma operação rural real, isso é insuficiente. O fluxo recomendado é:

```text
Dar baixa
→ confirmar valor
→ escolher data
→ escolher conta
→ anexar comprovante ou justificar ausência
→ confirmar
→ registrar usuário, data e alteração
```

O comprovante pode ser opcional por política, mas a decisão deve ser explícita e auditável.

#### 4.3.4 Reversão de pagamento

**Feedback original:** não há forma de reverter uma baixa.
**Classificação:** confirmada no fluxo atual.
**Prioridade:** P0.

Não há ação no frontend nem endpoint específico para reabrir/estornar a baixa. Em um sistema profissional, a reversão não deveria simplesmente apagar a informação anterior.

Recomendação:

- ação “Reverter baixa” com confirmação;
- motivo obrigatório;
- respeito ao fechamento mensal;
- registro de quem reverteu e quando;
- preservação do histórico anterior.

#### 4.3.5 “Vence em 5 dias” tratado como status

**Feedback original:** tempo para vencer não é status financeiro.
**Classificação:** confirmada.
**Prioridade:** P2.

O cabeçalho da coluna é “Status”, mas ela exibe badges como “Vence em 5d”. Conceitualmente:

- status: aberto, pago, parcialmente pago, cancelado;
- prazo: vence hoje, vence em cinco dias, vencido há dez dias.

Recomendação: renomear a coluna para **Prazo** ou separar **Situação** e **Vencimento**.

#### 4.3.6 Três subabas dentro de um único hub

**Feedback original:** Contas, Fornecedores e Caixinha deveriam estar mais visíveis ou separadas.
**Classificação:** opinião de arquitetura válida.
**Prioridade:** P2.

As subabas possuem URLs próprias (`/gastos`, `/cadastros`, `/caixinha`), mas são exibidas como um único hub chamado Financeiro. A intenção de reduzir a sidebar é válida; a taxonomia, porém, mistura:

- processo: contas a pagar;
- cadastro: fornecedores e clientes;
- instrumento/razão: caixinha.

Recomendação: organizar o módulo Financeiro em navegação secundária própria. Não é necessário colocar todas as opções na sidebar global.

Exemplo:

```text
Financeiro
├── Visão geral
├── Lançamentos
├── Contas a pagar
├── Contas bancárias e caixas
├── Fornecedores e clientes
└── Relatórios
```

---

### 4.4 Fornecedores e clientes

#### 4.4.1 Filtros e botão de criação

**Feedback original:** os filtros são bons, mas o botão diz fornecedor mesmo permitindo cliente.
**Classificação:** confirmada.
**Prioridade:** P2.

Existem filtros para Todos, Fornecedor, Cliente e Ambos. O formulário permite os três tipos. Porém, os títulos e botões usam apenas “Fornecedor”.

Recomendação: adotar **Fornecedor ou cliente** no botão e **Pessoas e empresas** ou **Parceiros comerciais** como nome da área, após validar a linguagem com os usuários.

#### 4.4.2 Busca e hierarquia visual

**Feedback original:** busca aparece em posição pouco natural.
**Classificação:** opinião de UX parcialmente confirmada.
**Prioridade:** P3.

A busca fica na mesma faixa dos filtros, alinhada à direita, abaixo do cabeçalho com o botão de criação. Não está literalmente abaixo apenas do botão, mas a hierarquia pode ser melhorada.

Padrão recomendado:

```text
Título                              + Novo fornecedor ou cliente
Busca principal
Filtros: Todos | Fornecedores | Clientes | Ambos | Inativos
Tabela
```

#### 4.4.3 Desativação e restauração

**Feedback original:** é possível desativar em um clique e não fica claro como restaurar.
**Classificação:** parcialmente confirmada.
**Prioridade:** P1.

A desativação realmente ocorre em um clique, sem confirmação. Contudo, o registro não desaparece: ele continua na lista como “Inativo” e o botão muda para “Ativar”. Portanto, a restauração existe.

Melhorias:

- confirmação quando houver lançamentos vinculados;
- filtro explícito Ativos/Inativos;
- toast informando “Fornecedor desativado — Desfazer”;
- impedir uso de inativo em novos lançamentos, sem afetar o histórico.

#### 4.4.4 Edição e efeito sobre o histórico

**Feedback original:** editar fornecedor pode alterar transações antigas em cascata.
**Classificação:** preocupação confirmada conceitualmente.
**Prioridade:** P1.

Os lançamentos guardam o ID do fornecedor. Se o nome da entidade for editado, as telas históricas passam a exibir o novo nome. Os lançamentos não são apagados nem perdem o vínculo, mas a apresentação histórica muda.

Isso é adequado para correção de grafia, mas problemático para mudança de identidade empresarial.

Recomendação:

- manter ID estável;
- registrar histórico de alterações cadastrais;
- tratar fusão de duplicados como operação específica;
- não permitir trocar documento para outra entidade sem confirmação e trilha de auditoria.

---

### 4.5 Caixinha

#### 4.5.1 Quantidade de caixinhas

**Feedback original:** parece que só é possível criar uma caixinha.
**Classificação:** parcialmente confirmada.
**Prioridade:** P2.

O backend aceita múltiplas caixinhas e a interface possui seletor quando existem duas ou mais. Porém, depois que a primeira é criada, a tela não apresenta claramente uma ação para criar a segunda.

É necessário decidir o produto:

- se cada propriedade terá uma única caixinha, criar automaticamente a padrão e remover a gestão múltipla;
- se haverá caixas por responsável/local, expor “Nova caixinha”, titularidade, saldo de abertura e situação.

Manter suporte múltiplo oculto produz complexidade sem benefício claro.

#### 4.5.2 Impacto no saldo geral

**Feedback original:** não está claro se o movimento altera o saldo geral.
**Classificação:** confirmada como ambiguidade crítica.
**Prioridade:** P0.

Hoje, registrar um movimento na Caixinha altera apenas `Caixinha.saldoAtual`. Não cria nem atualiza `Lancamento`, não altera `ContaBancaria` e não entra automaticamente no dashboard financeiro.

Consequências possíveis:

- usuário registra na caixinha e acredita que o gasto entrou no financeiro;
- usuário registra também como lançamento e duplica a despesa;
- saldo físico diverge do razão principal.

Recomendação: escolher e documentar um dos modelos:

1. **Caixinha como conta financeira:** cada movimento gera lançamento no razão principal.
2. **Caixinha como adiantamento:** aporte sai do banco e entra na caixinha; despesas prestam contas e são conciliadas posteriormente.
3. **Caixinha apenas operacional:** permanece separada, com aviso explícito e processo formal de conciliação.

Para uma plataforma profissional, o segundo modelo tende a representar melhor fundo fixo, mas deve ser validado com o BPO.

#### 4.5.3 Relação com orçamento

**Feedback original:** poderia funcionar como budget.
**Classificação:** não existe atualmente.
**Prioridade:** descoberta de produto, não implementação imediata.

A Caixinha controla saldo e movimentos; não há orçamento, limite mensal ou alocação planejada. Antes de adicionar budget, é necessário estabilizar conciliação, titularidade e integração com o razão.

---

### 4.6 `/relatorios` — Central de relatórios

#### 4.6.1 Relatório financeiro disponível

**Feedback original:** não é possível fazer relatório financeiro.
**Classificação:** parcialmente incorreta.
**Prioridade:** P1 para capacidade configurável.

Existe um relatório financeiro pronto e disponível: **Fechamento financeiro mensal**, com geração de PDF. Também existe acesso a Custos do rebanho classificado na área Financeiro.

O que não existe é um construtor configurável de relatório financeiro. O botão global “+ Criar relatório” sempre leva ao construtor de relatórios do rebanho. Logo:

- relatório financeiro pronto: existe;
- relatório financeiro customizável: não existe;
- botão “Criar relatório” para a área Financeiro: comportamento inadequado.

Recomendação: contextualizar o CTA pela área selecionada ou ocultá-lo quando não houver construtor compatível.

#### 4.6.2 “Abrir Dashboard interativo”

**Feedback original:** o botão promete interatividade e leva a um dashboard pouco interativo.
**Classificação:** parcialmente confirmada.
**Prioridade:** P2.

O dashboard possui seletor de mês, cards clicáveis e navegação para detalhes. Portanto, não é completamente estático. Ainda assim, “Dashboard interativo” promete análise exploratória mais ampla do que a tela mensal entrega.

Sugestões de rótulo:

- **Ver visão mensal**;
- **Explorar dados do mês**;
- **Abrir visão geral**.

---

## 5. Pontos ausentes no feedback original

Além das observações levantadas, a auditoria identificou lacunas estruturais adicionais.

### 5.1 Não existe gestão de contas bancárias

As contas atuais são criadas pela importação do Excel. Não há tela para:

- cadastrar conta;
- editar banco e identificação;
- informar saldo de abertura e respectiva data;
- inativar conta;
- conciliar saldo com extrato.

Sem saldo e data de abertura, o card de saldo não representa necessariamente a disponibilidade bancária real.

### 5.2 Transferências não são uma operação vinculada

Uma transferência precisa ser registrada como débito em uma conta e crédito em outra, sem vínculo formal entre as pontas. Isso permite divergência e classificação indevida como receita/despesa.

### 5.3 Pagamento parcial existe no enum, mas não no fluxo principal

O banco conhece `LIQUIDADO_PARCIAL`, mas a baixa rápida transforma a obrigação diretamente em `LIQUIDADO`. Não há experiência clara para juros, descontos, pagamento parcial ou parcelamento posterior.

### 5.4 Auditoria financeira é insuficiente

`Lancamento` possui `createdAt` e `updatedAt`, mas não registra de forma explícita:

- quem criou;
- quem alterou;
- valores anteriores;
- motivo da alteração;
- quem deu baixa ou reverteu;
- trilha de anexos por evento.

### 5.5 A nomenclatura “Gastos” subrepresenta o módulo

A rota `/gastos` também contém contas pagas, fornecedores, clientes e caixinha. O nome induz o usuário a pensar apenas em despesas, enquanto o sistema pretende ser um módulo financeiro.

---

## 6. Priorização recomendada

### P0 — Confiança financeira

1. Substituir “Marcar como paga” por fluxo de baixa com data, conta, valor, confirmação e evidência.
2. Criar reversão/estorno auditável de baixa.
3. Definir integração e conciliação da Caixinha com o razão principal.
4. Remover a janela histórica fixa do dashboard e corrigir o período padrão.
5. Modelar conta bancária com saldo e data de abertura.

### P1 — Operação diária

1. Autosave consistente para entradas e saídas.
2. Cadastro completo de fornecedor/cliente sem perder o lançamento.
3. Contexto temporal e filtros de período em Contas.
4. Trilha de alterações cadastrais de fornecedores.
5. Fluxo de pagamento parcial, juros e descontos.
6. Corrigir CTA de criação de relatório financeiro.

### P2 — Arquitetura de informação

1. Separar visão geral da fazenda e cockpit financeiro.
2. Criar navegação secundária do módulo Financeiro.
3. Separar Situação de Prazo nas contas.
4. Resolver a mistura entre painel mensal e alertas atuais.
5. Revisar nomenclaturas: Receitas, Despesas, Investimentos e Resultado de caixa.
6. Definir produto de múltiplas caixinhas versus caixinha única por propriedade.

### P3 — Refinamento visual

1. Revisar escala tipográfica com testes de leitura.
2. Avaliar formulário linear versus duas colunas.
3. Reorganizar busca e filtros de fornecedores.
4. Reduzir redundância de alertas e badges.
5. Padronizar densidade, espaçamento e hierarquia entre telas financeiras.

---

## 7. Proposta de arquitetura futura do Financeiro

```text
Financeiro
├── Visão geral
│   ├── posição de caixa
│   ├── resultado do período
│   ├── previsto x realizado
│   └── alertas financeiros
├── Lançamentos
│   ├── todos
│   ├── novo lançamento
│   ├── importação
│   └── rascunhos
├── Contas a pagar e receber
│   ├── abertas
│   ├── vencidas
│   ├── liquidadas
│   └── baixas e reversões
├── Contas e caixas
│   ├── contas bancárias
│   ├── transferências
│   ├── caixinhas
│   └── conciliação
├── Cadastros
│   ├── fornecedores e clientes
│   ├── categorias
│   └── centros de custo
└── Relatórios
    ├── fechamento mensal
    ├── fluxo de caixa
    ├── resultado gerencial
    └── relatórios configuráveis
```

Essa arquitetura não implica construir tudo imediatamente. Ela fornece um mapa para impedir que novos recursos sejam adicionados em hubs conceitualmente incoerentes.

---

## 8. Critérios de aceite sugeridos para a próxima fase

### Baixa de conta

- usuário escolhe data, conta e valor da baixa;
- sistema permite pagamento total ou parcial;
- confirmação apresenta o efeito antes de gravar;
- comprovante pode ser anexado;
- baixa registra usuário e horário;
- reversão exige motivo e preserva histórico;
- mês fechado impede baixa e reversão.

### Dashboard

- período selecionado é inequívoco;
- último fechamento disponível é explícito;
- nenhum dado fora do período aparece sem separação visual;
- séries históricas são dinâmicas;
- visão geral e visão financeira possuem objetivos diferentes;
- todo card responde a uma decisão ou leva a um detalhe coerente.

### Novo lançamento

- entrada e saída possuem autosave equivalente;
- fornecedor/cliente pode ser criado por completo sem perda do formulário;
- conta exibe identificação suficiente;
- tipo de operação é separado da direção do dinheiro;
- usuário entende o efeito no caixa e no resultado antes de salvar.

### Caixinha

- produto define se é fundo fixo, conta financeira ou controle isolado;
- cada movimento informa claramente seu efeito no Financeiro;
- não há dupla contagem;
- múltiplas caixinhas são explicitamente suportadas ou removidas do escopo;
- conciliação possui responsável e periodicidade.

---

## 9. Conclusão

O feedback original identifica corretamente uma sensação de produto pouco consolidado, mas mistura problemas críticos, preferências visuais e afirmações que o sistema atual já resolveu parcialmente.

O julgamento mais importante é:

> O Financeiro ainda se comporta como um conjunto de telas construídas sobre uma importação real, e não como um sistema financeiro fechado, conciliável e auditável de ponta a ponta.

A prioridade não deve ser “embelezar o dashboard” nem adicionar mais cards. Primeiro é necessário tornar confiáveis os eventos que alteram dinheiro: abertura de contas, baixa, reversão, transferência, caixinha e conciliação. Depois, a arquitetura de informação e o dashboard podem representar essa verdade de forma clara e profissional.

---

## 10. Evidências técnicas consultadas

- `client/src/router.ts`
- `client/src/App.tsx`
- `client/src/components/Dashboard.tsx`
- `client/src/components/Lancar.tsx`
- `client/src/financeiro/ContasAVencer.tsx`
- `client/src/financeiro/Caixinha.tsx`
- `client/src/components/Relatorios.tsx`
- `client/src/components/Relatorio.tsx`
- `client/src/rebanho/components/CadastrosView.tsx`
- `client/src/rebanho/components/FornecedorForm.tsx`
- `server/src/routes/lancamentos.ts`
- `server/src/routes/vencimentos.ts`
- `server/src/services/dashboard.ts`
- `server/src/services/vencimentos.ts`
- `server/src/services/caixinha/caixinhas.ts`
- `server/prisma/schema.prisma`
- ambiente local com o dataset importado da Fazenda Rio Novo
