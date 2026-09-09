# Central de Relatórios — operação leiteira

## Objetivo

Transformar os oito modelos leiteiros hoje marcados como `Em preparação` na Central de Relatórios em pontos de entrada operacionais. O usuário poderá consultar, filtrar, exportar e agir sobre o mesmo dado tanto pela Central quanto pelo módulo de Rebanho, sem duplicar regras de negócio.

`Custos do rebanho` não faz parte deste recorte. Ele será tratado com os relatórios financeiros, pois depende da conciliação entre produção, estoque, sanidade e `Lancamento`.

## Decisões de produto

- A Central permanece em `/relatorios` e abre o relatório no mesmo contexto.
- O relatório selecionado é representado na URL por `?modelo=<id>` para suportar recarga, favoritos e compartilhamento.
- Ações rápidas abrem modal ou drawer dentro da Central e preservam filtros, resultado e posição da página.
- Toda ação oferece, quando aplicável, um caminho secundário para a ficha ou tela completa do módulo.
- Depois de uma escrita concluída, o relatório é recarregado sem apagar seus filtros.
- CSV é oferecido para resultados tabulares; PDF é oferecido para todos os formatos.
- Estados vazios descrevem quais dados faltam. Indicadores não são estimados ou preenchidos artificialmente.
- Toda leitura e escrita respeita o sítio ativo por `X-Propriedade-Id`.

## Arquitetura

### Registro da Central

O catálogo em `client/src/components/Relatorios.tsx` evolui de uma lista de cards para um registro tipado. Cada definição informa:

- identificador, título, área, descrição e palavras-chave;
- tipo de apresentação: `lista`, `analise` ou `documento`;
- componente responsável pelo resultado;
- filtros suportados;
- exportações disponíveis;
- ações rápidas e destino da tela completa;
- disponibilidade.

A Central compartilha uma moldura única com cabeçalho, filtros, carregamento, erro, atualização e exportação. Ela não força todos os relatórios a uma tabela universal.

### Serviços e contratos

As regras permanecem em `server/src/services/rebanho/`. Serviços existentes são reutilizados para quantitativo, produção, qualidade, lactações, carência, estoque e saúde do úbere. Consultas novas ficam em serviços de relatório finos, com agregações puras em arquivos `*.calc.ts` quando houver cálculo novo.

Os endpoints de relatório são somente leitura. Escritas continuam nas rotas operacionais existentes, garantindo que Central e módulo usem as mesmas validações e recomputações.

O motor configurável reprodutivo em `/api/rebanho/relatorios` permanece retrocompatível. Os novos relatórios não serão forçados ao contrato tabular reprodutivo.

### Ações operacionais

Uma ação é identificada por relatório e entidade. O frontend abre o formulário já existente ou extrai dele um componente reutilizável quando ele ainda estiver acoplado à tela de origem. Não haverá cópia de schemas ou payloads.

Após salvar:

1. o drawer/modal fecha;
2. o relatório invalida sua consulta;
3. filtros e rolagem são preservados;
4. o resultado atualizado é exibido;
5. erros do backend aparecem no próprio formulário em PT-BR.

## Relatórios

### 1. Rebanho quantitativo — análise

**Fonte:** `Animal`, `Grupo` e cálculo existente de quantitativo.

**Filtros:** data de referência, situação, categoria, grupo, setor e faixa etária.

**Resultado:** total do plantel, composição percentual e matriz categoria × faixa etária. Clicar em qualquer quantidade abre a lista dos animais que compõem a célula.

**Ações:** abrir ficha; alterar grupo ou setor individualmente; selecionar vários animais e aplicar alteração coletiva.

**Exportação:** CSV analítico por animal e PDF da composição.

### 2. Histórico de lactações — análise

**Fonte:** `Lactacao` e `ControleLeiteiro`.

**Filtros:** período, animal, grupo, situação do ciclo e ordem da lactação. Um ciclo pertence ao resultado quando sua janela cruza o período selecionado.

**Resultado:** uma linha por ciclo, com início, fim, duração, produção medida ou derivada, produção aos 305 dias, quantidade de controles, pico observado, persistência e motivo de secagem. A expansão mostra a curva e os controles utilizados.

Pico e persistência só aparecem quando a base mínima definida pelo cálculo puro estiver presente; caso contrário, o campo retorna `null` e a tela mostra `Dados insuficientes`.

**Ações:** abrir ficha; registrar controle leiteiro; marcar/desmarcar lactação induzida.

**Exportação:** CSV por ciclo e PDF analítico.

### 3. Ficha completa do animal — documento

**Fonte:** DTO do animal, insights/cockpit, timeline, lactações e movimentações já existentes.

**Seleção:** número, nome ou escolha vinda de outro relatório.

**Documento:** identificação, genealogia, localização, situação atual, reprodução, lactações, produção, sanidade e linha do tempo. Custos e margem ficam fora desta fase.

**Ações:** editar cadastro; movimentar grupo/setor; registrar evento reprodutivo; registrar evento sanitário; registrar controle leiteiro; abrir cockpit completo.

**Exportação:** PDF completo e CSV das seções históricas tabulares.

### 4. Qualidade do leite — análise

**Fonte:** `EventoSanitario` do tipo `EXAME`, `ResumoAnimal`, `Tanque` e `AnaliseTanque`.

**Filtros:** período, grupo, setor, faixa de CCS e estágio de lactação.

**Resultado:** CCS atual, gordura e proteína médias, tendência mensal, distribuição por faixa e leituras individuais. Análises individuais e de tanque aparecem em blocos separados e nunca são misturadas no mesmo indicador.

**Ações:** abrir animal; registrar exame individual; registrar análise de tanque; abrir a tela de Produção.

**Exportação:** CSV das leituras e PDF da análise.

### 5. Medicamentos aplicados — lista operacional

**Fonte:** `EventoSanitario` do tipo `APLICACAO`, com `Produto` quando houver vínculo.

**Filtros:** período, animal, grupo, produto e presença de carência.

**Colunas:** data, animal, grupo, produto, dose, quantidade usada, lote, carência e custo conhecido.

O modelo atual não possui responsável. Essa coluna não será inventada. O relatório informa a indisponibilidade até existir uma decisão própria de schema. Custo só é exibido quando `produtoId`, quantidade e custo unitário permitirem cálculo confiável; registros importados por texto permanecem como custo indisponível.

**Ações:** abrir ficha; registrar nova aplicação; abrir cadastro do produto.

**Exportação:** CSV e PDF tabular.

### 6. Animais em carência — lista operacional

**Fonte:** aplicações com `carencia > 0`; término derivado de data/hora do evento mais duração informada.

**Filtros:** ativas, encerradas ou todas; animal; grupo; produto; intervalo de liberação.

**Colunas:** animal, grupo, produto, aplicação, duração, liberação, tempo restante e estado.

Carência é derivada do evento sanitário e não terá botão de “liberação manual”. Corrigir a carência exige corrigir o evento de origem na ficha, preservando rastreabilidade.

**Ações:** abrir ficha; registrar aplicação; abrir o evento de origem quando houver suporte de edição.

**Exportação:** CSV e PDF tabular com aviso sanitário.

### 7. Mastite e CMT por quarto — análise

**Fonte principal:** `ExameQuarto`. `EventoSanitario` do tipo `MASTITE` é contado separadamente como ocorrência legada quando não possui estrutura por quarto.

**Filtros:** período, animal, grupo, quarto, resultado CMT, ocorrência clínica, severidade e cronicidade.

**Resultado:** incidência, recorrência, quartos afetados/perdidos, distribuição CMT, evolução por quarto e lista de animais. Registros legados sem quarto aparecem em um bloco de qualidade dos dados; não são atribuídos artificialmente a uma teta.

**Ações:** abrir ficha; registrar CMT/exame por quarto; registrar mastite clínica.

**Exportação:** CSV dos exames/ocorrências e PDF analítico.

### 8. Posição de estoque do leite — lista operacional

**Fonte:** `Produto`, `MovimentoEstoque` e `LoteProduto`, sempre com setor `LEITE` neste relatório.

**Filtros:** produto, tipo, abaixo do mínimo, com saldo, vencido e a vencer em 30/60/90 dias.

**Resultado:** saldo, unidade, valor, mínimo, situação, lotes, validade e último movimento. Produtos compartilhados só entram quando classificados no setor leiteiro; movimentos respeitam o sítio ativo.

**Ações:** registrar movimento; editar produto; cadastrar lote; abrir Estoque completo.

**Exportação:** CSV e PDF tabular.

## Qualidade atual dos dados

A implementação precisa funcionar com a realidade da base, não apenas com dados ideais:

- 520 animais ativos e quantitativo já calculável;
- 349 lactações e 1.722 controles leiteiros;
- 467 exames individuais de leite;
- 2.470 aplicações, mas somente 337 com dose, nenhuma vinculada a `Produto` e nenhuma com custo confiável;
- nenhuma aplicação atual com carência positiva;
- 28 ocorrências legadas de mastite sem quarto estruturado;
- nenhum `ExameQuarto`, tanque, análise de tanque, movimento de estoque ou lote de produto;
- 15 produtos estocáveis, atualmente com saldo zero.

Cada relatório deve, portanto, diferenciar `sem registros`, `campo não informado` e `métrica indisponível por base insuficiente`.

## Ordem de entrega

1. Fundação da Central e roteamento por `modelo`.
2. Rebanho quantitativo.
3. Histórico de lactações.
4. Ficha completa do animal.
5. Qualidade do leite.
6. Medicamentos aplicados.
7. Animais em carência.
8. Mastite/CMT por quarto.
9. Posição de estoque do leite.

Cada fatia deixa o card correspondente disponível e inclui contrato backend, interface, ações cabíveis, exportação e testes.

## Tratamento de erros e limites

- Payloads e queries são validados com Zod.
- Consultas limitam resultados tabulares e informam truncamento.
- Falhas parciais em uma seção da ficha não apagam as demais; a seção mostra seu erro local.
- PDF e CSV são gerados a partir do resultado já carregado, sem refazer cálculos divergentes no navegador.
- Escritas continuam respeitando bloqueios de mês fechado quando gerarem ou alterarem `Lancamento`.
- Dados `Decimal` são convertidos apenas na borda dos DTOs; cálculos financeiros não usam `number` como fonte de verdade.

## Testes e aceite

- Testes puros para interseção de períodos, pico/persistência, carência e agregação por quarto.
- Testes de serviço para escopo de propriedade e campos ausentes.
- Testes de rota para validação dos filtros.
- Testes React para seleção por URL, preservação dos filtros, estados vazios, ações e recarga depois de salvar.
- Verificação no navegador dos oito modelos, incluindo base vazia e base populada.
- Verificação de CSV e inspeção visual dos PDFs.
- Os cards só deixam de mostrar `Em preparação` quando o fluxo do respectivo relatório estiver funcional de ponta a ponta.

## Fora de escopo

- Custos do rebanho e qualquer conciliação financeira.
- Criação do campo responsável em eventos sanitários.
- Migração automática de mastites legadas para quartos inventados.
- Integração com equipamentos de ordenha ou laboratórios.
- Novos indicadores que não possam ser derivados dos campos atuais.
