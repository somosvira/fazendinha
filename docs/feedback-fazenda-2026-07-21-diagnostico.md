# Feedback da fazenda — diagnóstico antes do backlog

**Data do feedback:** 2026-07-21  
**Origem:** usuária da operação da Fazenda Rio Novo, após primeiro contato com Dashboard e módulo Rebanho  
**Status:** diagnóstico inicial; **não é backlog aprovado nem especificação de implementação**  
**Próximo passo escolhido:** aprofundar primeiro a identificação dos animais, dando primazia ao número operacional

---

## 1. Objetivo deste documento

Registrar e classificar as oito observações recebidas da fazenda sem assumir que as soluções sugeridas devem ser implementadas literalmente.

O feedback mistura três camadas que precisam permanecer separadas:

1. **Problema observado:** o que a pessoa não encontrou, não entendeu ou não conseguiu fazer.
2. **Necessidade operacional:** qual trabalho real da fazenda ela tentou realizar.
3. **Solução sugerida:** a forma que ela imaginou para resolver o problema.

A necessidade operacional é a evidência mais importante. A solução sugerida é uma hipótese e só vira escopo depois de validação.

> **Regra de decisão:** não transformar “não achei” automaticamente em “falta uma feature”. Primeiro verificar se a função não existe, está escondida, está organizada segundo outro modelo mental ou não suporta o volume real da operação.

---

## 2. Síntese executiva

O feedback não comprova a ausência de oito funcionalidades. Ele revela uma distância entre a implementação técnica e a capacidade de uso autônomo da operação.

O sistema pode estar completo em três níveis diferentes:

| Nível | Pergunta |
|---|---|
| **Completude técnica** | A tela, a API, a persistência e o cálculo existem? |
| **Completude de UX** | A pessoa encontra e entende o caminho sem assistência? |
| **Completude operacional** | O caminho suporta a rotina, o volume e a velocidade exigidos na fazenda? |

O roadmap registra Reprodução e Produção como núcleos entregues (`ROADMAP.md`, §4), mas o feedback mostra que a completude de UX e a completude operacional ainda precisam ser comprovadas em lançamentos reais.

A mensagem central é:

> A usuária ainda não consegue traduzir, com segurança, as tarefas que executa na fazenda para os caminhos oferecidos pelo sistema.

Isso recomenda uma etapa de validação estruturada antes de ampliar o produto.

---

## 3. Escala de classificação

### 3.1 Confiança no problema

- **Muito alta:** observação direta, coerente com o uso real e confirmada pelo produto atual.
- **Alta:** sinal claro, mas ainda falta observar o contexto ou a frequência.
- **Média:** pode ser problema real, interpretação ou ausência de dados.
- **Baixa:** não há evidência suficiente para formular o problema.

### 3.2 Confiança na solução sugerida

- **Muito alta:** solução diretamente alinhada ao domínio, de baixo risco e sem alternativa plausivelmente melhor.
- **Alta:** solução provável, ainda dependente de pequenos detalhes.
- **Média:** uma entre várias soluções possíveis.
- **Baixa:** não deve orientar implementação antes de pesquisa adicional.

### 3.3 Decisões provisórias possíveis

- **Aceitar como regra de produto:** o princípio está suficientemente validado; o desenho ainda pode variar.
- **Auditar:** verificar cobertura, coerência ou correção técnica antes de discutir UX.
- **Observar fluxo real:** acompanhar uma tarefa concreta antes de desenhar solução.
- **Testar hipótese:** comparar alternativas pequenas e reversíveis.
- **Não implementar agora:** evidência insuficiente ou solução prematura.

---

## 4. Classificação resumida

| # | Observação | Tipo predominante | Confiança no problema | Confiança na solução sugerida | Decisão provisória |
|---:|---|---|---:|---:|---|
| 1 | Dashboard também deveria ter rebanho | Expectativa de visão unificada | Alta | Média-baixa | Investigar qual decisão ela esperava tomar ao abrir o sistema |
| 2 | Escolher propriedade, lactação e novilhas da Mexicana | Escopo e modelo mental | Muito alta | Baixa | Auditar o recorte por sítio e separar propriedade física de grupo/categoria |
| 3 | Número do animal em evidência | Regra de identificação operacional | Muito alta | Muito alta | Aceitar como regra de produto; desenhar aplicação consistente |
| 4 | Filtro na linha do tempo | Densidade e recuperação de informação | Alta | Média-alta | Validar com ficha densa e tarefa concreta |
| 5 | Reprodução confusa e incompleta | Arquitetura de informação | Muito alta | Muito baixa | Não redesenhar antes de observar tarefas reprodutivas reais |
| 6 | Como incluir animal ausente na Sanidade | Descoberta e recuperação de fluxo | Alta | Média-alta | Confirmar se busca, explicação e atalho para cadastro resolvem |
| 7 | Como lançar produção, inclusive de uma vaca | Descoberta, eficiência e volume | Muito alta | Média-baixa | Observar lançamento individual e coletivo no IDEAGRI e no Fazendinha |
| 8 | Dieta e gastos precisam ser lançados para calcular custo | Proveniência e completude dos dados | Alta | Baixa | Mapear a formação do custo antes de criar mais formulários |

---

## 5. Diagnóstico detalhado

## 5.1 Dashboard com dados do rebanho

### Observação recebida

> “O Dashboard poderia ter os dados do rebanho também, não só financeiro.”

### Evidência

Ao abrir o produto, a usuária esperava encontrar uma visão mais completa da fazenda. O Dashboard inicial é percebido como a porta de entrada do sistema, não apenas como relatório financeiro.

### Cobertura atual

- O Dashboard principal é deliberadamente financeiro.
- O módulo Rebanho possui um painel próprio, com produção, estado reprodutivo, indicadores, alertas e grupos.
- O produto também possui o conceito de Painel “Hoje”, orientado a ações operacionais.

### Hipóteses de causa

1. O destino inicial não corresponde à expectativa de “visão da fazenda toda”.
2. O Painel do Rebanho ou o Painel Hoje não estão suficientemente evidentes.
3. A usuária esperava apenas dois ou três indicadores zootécnicos no início, não o painel completo.
4. O nome “Dashboard” pode estar sendo interpretado como resumo geral, enquanto o produto o usa como resumo financeiro.

### Solução sugerida pela usuária

Adicionar dados do rebanho ao Dashboard.

### Riscos de implementar literalmente

- Duplicar o Painel do Rebanho.
- Misturar indicadores mensais financeiros com tarefas zootécnicas diárias.
- Tornar a tela inicial longa e sem foco.
- Reintroduzir o “dilúvio de dados” que o produto pretende evitar.

### Validação necessária

Perguntar e observar:

- Quais dados de rebanho ela esperava ver?
- Qual decisão tomaria com esses dados?
- Ela quer um resumo executivo ou acesso rápido ao painel completo?
- O Painel Hoje, se apresentado como entrada principal, resolveria essa expectativa?

### Decisão provisória

**Não implementar literalmente agora.** Investigar a necessidade de uma entrada executiva unificada e comparar três possibilidades: resumo zootécnico mínimo no Dashboard, Painel Hoje como início ou navegação mais evidente para o Painel do Rebanho.

---

## 5.2 Propriedade física e recorte do rebanho

### Observação recebida

> “No Painel do Rebanho, poderia escolher a propriedade dos dados, como o gado principal que está em lactação, as novilhas da Mexicana e assim por diante, porque só aparecem os dados gerais.”

### Evidência

A usuária precisa navegar por duas dimensões diferentes:

1. **Propriedade física:** Rio Novo, Mexicana e outros sítios.
2. **Recorte zootécnico dentro da propriedade:** vacas em lactação, novilhas, receptoras, grupos ou lotes.

A conversa confirmou que ela necessita dos dois recortes.

### Cobertura atual

- Existe seletor global de propriedade/sítio no topo da barra lateral, com opção consolidada.
- O Dashboard do Rebanho aplica o escopo de propriedade.
- A lista de animais e partes do módulo possuem conceitos de grupo, setor, categoria e filtros salvos.
- O acesso a esses recortes é fragmentado e nem todo controle está exposto de forma coerente.
- Algumas agregações de Produção e Custo precisam ser auditadas para confirmar que respeitam o sítio ativo.

### Hipóteses de causa

1. O seletor global existe, mas não foi percebido.
2. O rótulo “Fazenda/Sítio” não coincide com o vocabulário usado pela operação.
3. Propriedade, categoria, lote e grupo aparecem como conceitos independentes, sem hierarquia clara.
4. O painel mostra um consolidado sem tornar o escopo atual suficientemente explícito.
5. Algumas telas podem realmente misturar dados por falta de escopo nas agregações.

### Solução sugerida pela usuária

Adicionar uma escolha de propriedade ou tipo de rebanho dentro do Painel do Rebanho.

### Riscos de implementar literalmente

- Criar dois seletores de propriedade concorrentes, um global e outro local.
- Misturar “propriedade” com “categoria” e “grupo” num único campo.
- Aplicar apenas um filtro visual enquanto algum cálculo continua consolidado.
- Tornar difícil saber se uma ação será gravada na Rio Novo ou na Mexicana.

### Validação necessária

1. Auditar todas as leituras e agregações do Rebanho por propriedade.
2. Observar como a usuária procura a Mexicana.
3. Mapear o vocabulário real para propriedade, lote, grupo, categoria e fase produtiva.
4. Testar tarefas concretas:
   - ver todas as novilhas da Mexicana;
   - ver apenas as vacas em lactação da propriedade principal;
   - voltar ao consolidado;
   - cadastrar um animal no sítio correto.

### Decisão provisória

**Auditar antes de redesenhar.** A hierarquia conceitual recomendada para validação é:

> Fazenda-cliente → propriedade física → grupo/categoria produtiva → animal.

O seletor global deve governar a propriedade. O Painel do Rebanho pode precisar de filtros locais para grupo, categoria e situação produtiva, mas não de outro seletor concorrente de propriedade.

---

## 5.3 Número do animal em evidência

### Observação recebida

> “Em Animal, os números têm que vir em evidência na frente, porque são realmente as identificações que usamos nos animais.”

### Evidência

A identificação operacional usada pela fazenda é o **número do animal**. O nome, quando existe, é complementar.

No produto atual, várias listas apresentam primeiro o nome e deixam o número em corpo menor. A ficha individual também prioriza o nome quando ele está preenchido. Isso inverte a hierarquia usada pela operação.

### Necessidade operacional

- Reconhecer imediatamente o animal certo.
- Localizar e lançar dados com rapidez no curral e no escritório.
- Evitar confusão entre animais com nomes semelhantes ou sem nome.
- Manter consistência com brincos, planilhas, IDEAGRI e futura leitura RFID.

### Regra de produto validada

> **O número é a identidade visual primária do animal em qualquer contexto operacional. O nome é informação secundária.**

Essa regra está alinhada ao princípio de “número grande primeiro” do produto e ao futuro uso de brinco eletrônico/bastão.

### Pontos que ainda precisam de desenho

- Forma visual exata: `#1234 Jurema`, `1234 · Jurema` ou número em coluna própria.
- Tamanho e contraste por contexto.
- Comportamento em tabelas, cards, modais, busca, sugestões, relatórios e ficha.
- Relação entre número visual, brinco eletrônico e SISBOV.
- Ordenação correta para números guardados como texto, incluindo zeros à esquerda.

### Critérios preliminares

1. O número aparece antes do nome em listas e seletores operacionais.
2. O número não é apresentado como metadado pequeno quando identifica a ação.
3. O nome não ocupa a posição principal quando há número.
4. A busca aceita número parcial e brinco eletrônico.
5. Zeros à esquerda são preservados.
6. Leitores de tela recebem uma identificação compreensível, como “Animal número 1234, Jurema”.
7. A regra deve ser consistente em todo o módulo, não apenas na aba Animal.

### Decisão provisória

**Aceitar como regra de produto.** Este é o primeiro ponto escolhido para aprofundamento. A implementação ainda depende de um inventário das superfícies e da aprovação de uma hierarquia visual consistente.

---

## 5.4 Filtro na linha do tempo do animal

### Observação recebida

> “Na linha do tempo do animal, poderia ter um filtro para escolher o que quero ver, por exemplo só Produção ou só Sanidade.”

### Evidência

A usuária considera a timeline completa ruidosa quando procura um tipo específico de histórico.

### Cobertura atual

A timeline já classifica os eventos por domínio — Reprodução, Sanidade, Nutrição e Produção — e os apresenta em ordem cronológica inversa. Não há controle de filtro.

### Hipóteses de causa

1. Fichas reais possuem eventos suficientes para dificultar a leitura.
2. A distinção por cor/tag não basta para uma busca direcionada.
3. A usuária abre a timeline com uma pergunta concreta, como “quais foram os últimos controles?”.
4. Pode haver necessidade adicional de filtro por período.

### Solução sugerida pela usuária

Filtros por domínio.

### Alternativas possíveis

- Botões: Tudo, Reprodução, Sanidade, Produção e Nutrição.
- Seções recolhíveis por domínio.
- Busca textual na timeline.
- Filtro combinado de domínio e período.

### Validação necessária

- Usar uma ficha real com histórico denso.
- Pedir que encontre o último controle, o último tratamento e a última inseminação.
- Medir se os filtros por domínio resolvem sem exigir período ou busca.

### Decisão provisória

**Hipótese forte, ainda não aprovada para implementação.** Filtro por domínio é a solução mais provável e de menor risco, mas deve ser validado com uma ficha real.

---

## 5.5 Reprodução confusa e aparentemente incompleta

### Observação recebida

> “Reprodução: não entendi muito bem; achei que ficaram faltando informações. Temos que conversar.”

### Evidência

A usuária não compreendeu a finalidade, a leitura ou o fluxo da tela. Esse problema é real mesmo que todos os dados técnicos estejam presentes.

### Cobertura atual

A tela reúne, entre outros elementos:

- taxa de concepção por método;
- indicadores reprodutivos;
- listas de animais a inseminar, com DG pendente, a secar e com parto próximo;
- protocolos IATF;
- programação em lote;
- reprodutores;
- registro de cio, inseminação, transferência de embrião, diagnóstico, parto, secagem, exame ginecológico e desmame.

### Hipóteses de causa

1. Informação demais sem uma sequência operacional clara.
2. KPIs, catálogos, programações e tarefas disputam a mesma prioridade.
3. A terminologia da tela não corresponde à linguagem usada pela fazenda.
4. A usuária esperava dados específicos que ainda não identificamos.
5. Parte da tela pode estar vazia ou pouco informativa por falta de lançamentos reais.
6. O clique numa linha registra evento, quando a pessoa talvez espere abrir a ficha.

### O que não sabemos

- Qual tarefa ela tentou realizar.
- Quais informações considerou ausentes.
- Qual tela do IDEAGRI serve como referência mental.
- Se a necessidade principal é registrar, planejar, acompanhar ou analisar.

### Risco de implementar agora

Um redesenho baseado apenas na palavra “confuso” pode reorganizar a tela na direção errada e ainda esconder funcionalidades importantes.

### Validação necessária

Observar tarefas específicas:

1. identificar quem precisa ser inseminada hoje;
2. registrar uma inseminação;
3. localizar DG pendente;
4. registrar resultado do diagnóstico;
5. verificar partos e secagens próximos;
6. programar ou acompanhar um protocolo;
7. explicar quais números usa para decidir.

### Decisão provisória

**Não redesenhar antes da conversa e da observação.** Este ponto tem alta confiança no problema e muito baixa confiança em qualquer solução atual.

---

## 5.6 Animal ausente na lista de Sanidade

### Observação recebida

> “Sanidade ficou boa; só não entendi como colocar um animal novo que não esteja naquela lista.”

### Evidência

A tela de Sanidade não oferece uma recuperação evidente quando o animal procurado não aparece.

### Cobertura atual

- O cadastro de animal existe na aba Animal.
- Sanidade lista animais ativos já cadastrados.
- Clicar no animal abre o registro sanitário.

### Hipóteses de causa

1. O animal ainda não foi cadastrado.
2. Está em outra propriedade ativa.
3. Está baixado ou filtrado.
4. A usuária procurou por um número que não estava visível.
5. Ela esperava cadastrar o animal a partir da própria tarefa de Sanidade.

### Solução sugerida implicitamente

Permitir adicionar um novo animal a partir de Sanidade.

### Riscos de implementar literalmente

- Duplicar o formulário de cadastro.
- Criar cadastros parciais sem propriedade, categoria ou origem corretas.
- Confundir animal ausente com animal cadastrado em outro escopo.

### Hipótese de solução mais segura

Uma recuperação contextual:

1. busca explícita por número;
2. explicação do escopo atual;
3. estado vazio “Não encontrou o animal?”;
4. atalho para o cadastro canônico;
5. retorno automático à tarefa de Sanidade após salvar.

### Validação necessária

Reproduzir os diferentes motivos pelos quais um animal pode não aparecer e verificar qual deles ocorreu no teste.

### Decisão provisória

**Problema de descoberta confirmado; solução ainda a validar.** Não duplicar o cadastro sem evidência.

---

## 5.7 Lançamento de produção e controle de uma vaca

### Observação recebida

> “Em Produção, como eu faria o lançamento de um novo controle? Seria pelo assistente? E se eu precisar lançar de uma vaca só, como faço? Não achei.”

### Evidência

A usuária procurou a ação de lançamento na aba Produção e não encontrou um caminho principal.

### Cobertura atual

- O controle individual existe na ficha do animal, pelo botão “Registrar controle”.
- A aba Produção mostra ranking e informa em texto que os controles são registrados na ficha.
- No modo tanque/lote, há formulário na própria aba Produção.
- O assistente não deveria ser requisito para uma operação básica.

### Hipóteses de causa

1. A arquitetura posiciona a ação no contexto do animal, mas a usuária pensa a partir do processo “Produção”.
2. A instrução textual está discreta demais.
3. O fluxo individual existe, mas pode ser lento para um dia de controle com várias vacas.
4. A configuração do modo de produção pode não estar clara.
5. Ela não sabe quais operações podem ser realizadas pelo assistente.

### Pergunta decisiva

O trabalho real é:

- corrigir ou lançar ocasionalmente uma vaca;
- realizar uma sessão de controle com dezenas de vacas;
- lançar ordenhas manhã/tarde/noite;
- importar dados de equipamento;
- registrar apenas o total do tanque ou lote?

Cada resposta exige uma solução diferente.

### Soluções candidatas, ainda não aprovadas

- Botão “Registrar controle” na aba Produção, seguido de busca do animal.
- Grade de lançamento rápido em lote, orientada por número.
- Atalho na busca global.
- Assistente como canal secundário por texto/voz.
- Integração futura com equipamento ou arquivo.

### Validação necessária

Comparar uma sessão real no IDEAGRI com o Fazendinha, registrando volume, ordem dos campos, número de vacas e tempo total.

### Decisão provisória

**Não escolher ainda entre atalho individual, lançamento coletivo ou assistente.** Primeiro caracterizar o volume e a frequência do trabalho real.

---

## 5.8 Dieta, gastos e confiabilidade do custo

### Observação recebida

> “Sobre custo, teria que lançar tudo sobre dieta e gastos para saber se vai dar certo.”

### Evidência

A usuária entende que o custo só é confiável quando as entradas operacionais e financeiras estão completas. O sistema não deixou claro o que alimenta o cálculo nem o que ainda falta preencher.

### Cobertura atual

O produto já possui partes da cadeia:

- produtos e custos unitários;
- dietas e composição por quantidade/cabeça/dia;
- lotes e animais;
- consumo da dieta por período;
- baixa e custo de estoque;
- despesas financeiras da atividade leiteira;
- produção registrada;
- custo por vaca/dia e custo por litro estimado.

### Hipóteses de causa

1. As partes existem em telas diferentes, sem jornada guiada.
2. O custo é exibido sem uma explicação suficientemente visível sobre a proveniência.
3. Não há indicador de completude ou qualidade dos dados.
4. A pessoa não sabe se deve lançar a compra, o consumo, a dieta ou todos eles.
5. Parte do resultado usa produção atual projetada para o período e pode ser interpretada como realizado exato.

### Risco de implementar agora

Adicionar mais campos ou formulários pode aumentar a burocracia sem melhorar o cálculo. Também pode gerar dupla contagem entre compra financeira, entrada de estoque e consumo.

### Mapa preliminar da formação do custo

1. Produto cadastrado e precificado.
2. Produto entra no estoque.
3. Dieta define quantidade por cabeça/dia.
4. Dieta é atribuída ao lote.
5. Animais pertencem ao lote correto.
6. Consumo do período é fechado e baixa o estoque.
7. Despesas financeiras são classificadas na atividade leiteira.
8. Produção é registrada.
9. O sistema calcula e identifica claramente o que é realizado, estimado ou incompleto.

### Validação necessária

- Conferir a cadeia com quem lança dieta, estoque e financeiro.
- Identificar quais passos já são feitos fora do sistema.
- Verificar risco de dupla contagem.
- Definir o mínimo de dados que torna cada KPI utilizável.
- Testar se uma lista de pendências de dados é mais útil que novos formulários.

### Decisão provisória

**Mapear proveniência e completude antes de ampliar o módulo.** A solução mais promissora é tornar visível “como chegamos neste custo” e “o que falta informar”, não necessariamente criar outra tela de lançamento.

---

## 6. Ordem de investigação recomendada

Esta ordem considera risco operacional e capacidade de produzir evidência:

1. **Identificação pelo número** — regra de domínio já confirmada; inventariar e desenhar consistência visual.
2. **Escopo de propriedade e grupos** — auditar correção antes de qualquer polimento.
3. **Produção individual versus coletiva** — observar o lançamento real no IDEAGRI.
4. **Sanidade e animal ausente** — testar busca, escopo e recuperação de cadastro.
5. **Reprodução** — sessão específica de entendimento de fluxo e informação.
6. **Timeline** — validar filtros usando uma ficha densa.
7. **Formação do custo** — mapear os responsáveis e a proveniência dos dados.
8. **Tela inicial** — decidir entre Dashboard financeiro, resumo unificado e Painel Hoje depois de compreender a rotina.

A ordem não representa ordem definitiva de implementação.

---

## 7. Protocolo para o próximo teste real

Durante uma sessão em que a usuária também fará lançamentos no IDEAGRI:

1. Pedir que execute a tarefa no IDEAGRI como faz normalmente.
2. Pedir que repita a mesma tarefa no Fazendinha sem orientação inicial.
3. Registrar:
   - tarefa;
   - primeiro lugar em que procurou;
   - palavras que esperava encontrar;
   - sequência de cliques;
   - hesitações;
   - pedido de ajuda;
   - tempo aproximado;
   - conclusão ou bloqueio;
   - informação que considerou ausente.
4. Só depois pedir que explique o que esperava.
5. Não ensinar antecipadamente, pois isso elimina a evidência de descoberta.

### Tarefas prioritárias

- selecionar a propriedade Mexicana;
- mostrar somente as novilhas da Mexicana;
- mostrar apenas vacas em lactação da propriedade principal;
- encontrar um animal pelo número;
- registrar sanidade em animal existente;
- lidar com um animal que não aparece na lista;
- lançar controle de uma vaca;
- repetir o lançamento para várias vacas;
- identificar o que precisa ser feito hoje em Reprodução;
- explicar de onde vem o custo apresentado.

---

## 8. Regra para transformar achados em trabalho

Após a validação, cada achado deve ser encaminhado assim:

| Evidência | Tratamento provável |
|---|---|
| A função existe, mas não é encontrada | Navegação, nomenclatura, hierarquia visual ou onboarding |
| A função é encontrada, mas exige passos demais | Redesenho do fluxo |
| A função não suporta o volume real | Nova capacidade operacional |
| O dado muda ou mistura propriedades incorretamente | Correção de bug e teste de isolamento |
| O termo do sistema difere do termo da fazenda | Ajuste de linguagem e modelo mental |
| O pedido adiciona complexidade sem melhorar decisão | Não implementar |
| A solução sugerida compete com um mecanismo já existente | Consolidar caminhos, não duplicar |

Nenhum item entra no backlog apenas porque foi citado. Ele entra quando existe:

1. problema formulado;
2. evidência observável;
3. pessoa e frequência identificadas;
4. impacto operacional ou decisório;
5. solução escolhida entre alternativas;
6. critério de sucesso verificável.

---

## 9. Decisão atual

### Aprovado como princípio

- **Número do animal como identidade visual primária.**

### Em investigação

- visão inicial unificada;
- propriedade versus grupo/categoria;
- filtro da timeline;
- arquitetura da Reprodução;
- recuperação de animal ausente na Sanidade;
- lançamento individual e coletivo de produção;
- completude e proveniência do custo.

### Não aprovado

- colocar automaticamente todos os dados de rebanho no Dashboard;
- criar um segundo seletor de propriedade dentro do Painel do Rebanho;
- duplicar o cadastro de Animal em Sanidade;
- tornar o assistente obrigatório para lançar produção;
- redesenhar Reprodução sem observar o fluxo real;
- criar novos formulários de custo antes de mapear a cadeia existente.

---

## 10. Veredito

**Go para validação estruturada; no-go para converter os oito comentários diretamente em implementação.**

O feedback indica que o próximo ganho não está necessariamente em ampliar o número de funcionalidades. Está em provar que o núcleo atual é:

- encontrável;
- compreensível;
- correto por propriedade;
- eficiente no volume real;
- transparente sobre a origem dos números.

O primeiro aprofundamento será a consistência da identificação dos animais, tomando o **número** como elemento primário e o nome como complemento.
