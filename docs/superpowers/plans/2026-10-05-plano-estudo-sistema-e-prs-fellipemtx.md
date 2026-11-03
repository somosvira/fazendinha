# Plano de estudo do sistema e dos PRs de FellipeMTX

> **Para quem for executar este roteiro:** ele é um plano de estudo e homologação, não um plano de mudança. Não altere dados reais. Para alterações futuras, use `superpowers:writing-plans` e execute cada tarefa em uma branch própria.

**Objetivo:** entender a arquitetura atual do Fazendinha, praticar cada fluxo funcional e identificar no código e nos PRs de FellipeMTX onde cada regra vive.

**Arquitetura:** o cliente React usa rotas leves baseadas em `history` e chama a API Hono. A API aplica sessão, área e escopo de sítio antes de delegar a regra de negócio para services Prisma; os cálculos puros ficam em arquivos `*.calc.ts`; o PostgreSQL é a fonte de verdade. Uma escrita relevante cria auditoria e, quando precisa ser desfeita, produz um estorno em vez de apagar história.

**Tecnologias:** React 18, Vite, TypeScript, Hono, Zod, Prisma 6, PostgreSQL, Vitest, Cloudflare Worker/Pages e Render.

**Fontes de verdade:** `AI_RULES.md`, `README.md`, `ARCHITECTURE.md`, `CLAUDE.md`, `server/prisma/schema.prisma`, `docs/pecuaria/README.md` e os PRs listados no final deste documento.

## Regras para todo o estudo

- [ ] Trabalhar primeiro na `main` para estudar o produto integrado. A branch atual `codex/pecuaria-v3` inclui a V3 da pecuária em desenvolvimento e não representa apenas funcionalidades já liberadas.
- [ ] Tratar IDEAGRI somente como origem da carga inicial e referência de reconciliação. Depois de carregado, o Fazendinha é a fonte operacional.
- [ ] Manter o escopo do sítio: toda consulta ou escrita usa a propriedade escolhida pelo cabeçalho `X-Propriedade-Id`; catálogos como produto, raça, categoria, parceiro e centro de custo são compartilhados de propósito.
- [ ] Não reintroduzir o módulo pecuário removido. A sequência vigente é Rebanho V1 → Genética V2 → V3 Sanidade/Peso/Nutrição → V4 Reprodução → V5 Leite.
- [ ] Para dados financeiros, usar `Prisma.Decimal`; valores no front chegam como texto e são formatados em reais. Não concluir que um valor futuro altera o caixa: compromisso não é pagamento.
- [ ] Confirmar sempre os três níveis de proteção: sessão (`authMiddleware`), área (`exigeArea`) e flag fina (`exigePermissao`). Esconder um botão no cliente não substitui o bloqueio do servidor.
- [ ] Para testar visualmente, conferir 1180 px e 720 px. Para testar uma regra, executar primeiro o teste unitário ou de integração associado e só então repetir pela interface.

## Mapa de leitura do código

| Camada | Ponto inicial | Papel |
|---|---|---|
| Navegação | `client/src/App.tsx`, `client/src/router.ts` | Converte URL em aba/tela, mantém histórico e carrega o sítio ativo. |
| Cliente por módulo | `client/src/<modulo>/` | Renderiza tela, mantém estado local e chama a API do módulo. |
| Escopo | `client/src/propriedadeScope.ts`, `server/src/services/propriedade.ts` | Propaga e resolve o sítio ativo. |
| API | `server/src/app.ts`, `server/src/routes/` | Monta gates e rotas finas; não deve conter cálculo de domínio. |
| Regra de negócio | `server/src/services/` | Valida invariantes, abre transações, persiste e audita. |
| Banco | `server/prisma/schema.prisma`, `server/prisma/migrations/` | Define entidades, constraints e mudanças reproduzíveis. |
| Testes | Arquivos `*.test.ts(x)` ao lado do código | Travam cálculo, entrada Zod, permissão, renderização e invariantes. |

## Preparação única

### Tarefa 0: iniciar um ambiente de estudo seguro

**Arquivos para ler:**
- `README.md` — portas, scripts e pré-requisitos.
- `server/.env.example` — variáveis exigidas.
- `docker-compose.yml` — PostgreSQL local na porta 54332.
- `server/prisma/seed-qa249.ts` — massa financeira de homologação.
- `docs/qa/249-roteiro-interface.md` — dados e resultados esperados da massa financeira.

- [ ] Instalar dependências e preparar uma base local descartável conforme o README.

  ```bash
  pnpm install
  pnpm db:local:up
  cp server/.env.example server/.env
  ```

- [ ] Ajustar em `server/.env` uma conexão local para `fazendinha_local`; executar as migrations existentes, sem `db push` para a pecuária.

  ```bash
  pnpm --filter rionovo-server exec prisma migrate deploy
  ```

- [ ] Criar a massa financeira e iniciar cliente e servidor.

  ```bash
  pnpm --filter rionovo-server run seed:qa249
  pnpm dev
  ```

- [ ] Abrir `http://localhost:41875`, entrar com `qa249@example.test` / `QA249-local-2026!` e selecionar **QA249 Principal**.

- [ ] Conferir o estado inicial: saldo geral R$ 18.200; três inventários de estoque; compromissos e pagamentos vazios. O roteiro detalhado está em `docs/qa/249-roteiro-interface.md`.

**Resultado esperado:** há uma massa previsível para errar, cancelar e repetir sem tocar na fazenda real. A seed é aditiva; para reiniciar deliberadamente, recrie somente seu banco local de estudo.

---

## Trilhas de estudo funcional e técnico

### Tarefa 1: navegação, sessão, áreas e sítios

**Pergunta que responde:** quem pode entrar em qual área e sobre os dados de qual sítio?

**Como funciona:** `App.tsx` lê a URL, mantém a aba selecionada e troca o sítio no estado compartilhado. `comPropriedade()` anexa o cabeçalho do sítio nas chamadas. No servidor, `app.ts` monta `authMiddleware`, depois aplica `exigeArea` por prefixo de rota. Services recebem o escopo resolvido em vez de confiar no ID enviado pelo cliente.

**Arquivos de leitura, nesta ordem:**

1. `client/src/router.ts` — mapa de URL para abas e subrotas.
2. `client/src/App.tsx` — sessão, sítio ativo, deep-links e conteúdo renderizado.
3. `client/src/propriedadeScope.ts` e `client/src/lib/areas.ts` — headers e visibilidade.
4. `server/src/app.ts` — ordem real dos gates.
5. `server/src/middleware/auth.ts` e `server/src/middleware/permissao.ts` — sessão, área e flags.
6. `server/src/routes/propriedade.ts` e `server/src/services/propriedade.ts` — resolução de escopo.
7. `client/src/App.auth.test.tsx`, `server/src/middleware/auth.test.ts` e `server/src/middleware/permissao.test.ts`.

- [ ] Acessar uma tela protegida sem sessão e conferir o redirecionamento a `/signin` com retorno interno seguro.
- [ ] Entrar, abrir Financeiro, Pecuária, Agricultura e Equipe; anotar quais áreas aparecem para o perfil completo.
- [ ] Entrar com `qa249-consulta@example.test`; conferir que a consulta continua disponível e que ações de escrita somem ou são recusadas.
- [ ] Trocar de **QA249 Principal** para **QA249 Secundária** e voltar. Contas, saldo, operações e rebanho devem obedecer ao sítio selecionado; produtos, categorias e parceiros continuam no catálogo.
- [ ] Pelo DevTools ou por um teste de API, tentar chamar uma rota financeira com usuário sem a área Financeiro. O servidor deve recusar mesmo se a URL for conhecida.

**Checkpoint de código:** uma nova rota só é segura se seguir `rota → resolverEscopoLeitura/Escrita → service`, estiver atrás da área correta em `app.ts` e usar `exigePermissao("lancar")` para escrita quando aplicável.

### Tarefa 2: financeiro — operação como fato de negócio

**Pergunta que responde:** o que foi comprado, vendido, contratado ou transferido e quais efeitos isso produziu?

**Como funciona:** `Operacao` é o fato de negócio confirmado. Seus itens preservam descrição, categoria, centro de custo e classificação históricas. A confirmação pode criar `MovimentoEstoque`, `CompromissoFinanceiro`, `TransacaoFinanceira` e `MovimentoConta`. Tudo ocorre em transação; uma falha desfaz o conjunto inteiro.

**Arquivos de leitura, nesta ordem:**

1. `server/prisma/schema.prisma` — `Operacao`, `ItemOperacao`, `CompromissoFinanceiro`, `TransacaoFinanceira`, `MovimentoConta` e `AuditoriaFinanceira`.
2. `client/src/financeiro/FinanceiroContent.tsx` — roteamento interno do financeiro.
3. `client/src/financeiro/OperacoesFinanceiras.tsx`, `FormOperacao.tsx` e `OperacaoFinanceiraDetalhe.tsx`.
4. `client/src/financeiro/novo-api.ts` — contrato HTTP usado pelo cliente.
5. `server/src/routes/financeiro.ts` — rota fina e schemas de entrada.
6. `server/src/services/financeiro/operacoes.ts`, `regras.ts` e `schemas.ts` — confirmação, liquidação, estorno, Decimal e período fechado.
7. `server/src/services/financeiro/operacoes.estorno.test.ts` e `server/tests/financeiro/invariantes.test.ts`.

- [ ] Criar uma **compra para estoque à vista** de 10 kg × R$ 10. Confirmar operação, entrada física e saída de R$ 100 da conta.
- [ ] Criar a mesma compra **a prazo**. Confirmar entrada de estoque e compromisso de R$ 100, sem saída de dinheiro.
- [ ] Liquidar R$ 40 do compromisso. Conferir status parcial, movimento de conta e link entre compromisso, transação e extrato.
- [ ] Liquidar o restante. O status deve mudar para liquidado sem criar estoque novo.
- [ ] Criar uma **transferência financeira** entre contas. O saldo de cada conta muda, mas o consolidado não deve virar receita ou despesa.
- [ ] Cancelar uma operação. Conferir movimentos inversos, status CANCELADA, estoque neutralizado e auditoria; não deve haver exclusão dos fatos anteriores.
- [ ] Tentar escrever em mês fechado, pagar R$ 0 e pagar acima do saldo devido. Todos devem falhar sem efeito parcial.

**Checkpoint de código:** `exigirPeriodoAberto`, `exigirPositivo`, bloqueios de concorrência e `auditar` são invariantes. Não trate `Number` JavaScript como valor financeiro nem delete uma operação para “desfazer”.

### Tarefa 3: rascunhos, parcelas e documentos

**Pergunta que responde:** como lançar uma operação sem perder trabalho e sem gerar efeitos antes da confirmação?

**Como funciona:** `RascunhoOperacao` é único por usuário e sítio. Guarda JSON e versão para concorrência otimista, não mexe em caixa, estoque nem relatórios. Autosave atualiza o rascunho; confirmação promove documentos e cria os efeitos reais numa transação. Parcelas são geradas sob demanda e podem ser personalizadas.

**Arquivos de leitura, nesta ordem:**

1. `client/src/financeiro/rascunhoAtivo.ts` e `client/src/financeiro/lib/rascunho.ts`.
2. `client/src/financeiro/FormOperacao.tsx`, `FormOperacaoAnexo.test.tsx` e `lib/parcelas.ts`.
3. `client/src/components/AppSidebar.tsx` e `client/src/router.ts` — atalho Trabalho ativo.
4. `server/src/services/financeiro/rascunhos.ts`, `parcelas.calc.ts` e `documentos.ts`.
5. `server/src/lib/storage.ts` e `server/src/lib/uploads.ts`.
6. `server/src/services/financeiro/rascunhos.test.ts`, `parcelas.calc.test.ts` e `client/src/financeiro/FormOperacao.test.tsx`.

- [ ] Preencher uma Nova operação, aguardar o salvamento, navegar para outra tela e voltar. O formulário deve retomar o rascunho.
- [ ] Recarregar `/financeiro/operacoes/nova`; conferir que o conteúdo foi mantido e que saldo/estoque continuam iguais.
- [ ] Criar parcelas por **Gerar parcelas**, editar uma e tentar gerar novamente. A substituição precisa pedir confirmação.
- [ ] Tentar confirmar com parcela sem valor ou vencimento; o primeiro campo inválido deve ganhar foco e mensagem.
- [ ] Anexar um documento. Enquanto o upload estiver em curso, deve haver estado “Anexando” e a confirmação deve ficar bloqueada.
- [ ] Confirmar a operação e verificar que rascunho é consumido, documento é promovido e efeitos aparecem uma única vez.

**Checkpoint de código:** documentos dependem de R2/armazenamento configurado. Em produção Worker, `server/src/lib/dom-parser-polyfill.ts` prepara XML para respostas do SDK; o teste local não substitui a homologação do upload real.

### Tarefa 4: cadastros financeiros, classificação e relatórios

**Pergunta que responde:** para onde foi cada real, inclusive em uma nota com itens de áreas diferentes?

**Como funciona:** conta e parceiro são cadastros históricos; parceiro pode ter vários papéis. Categoria define classificação e uso; centro de custo pode vir do item ou da operação. Em compra mista, pagamento e estorno são rateados por item em centavos. Relatório financeiro persiste um snapshot e PDF: abrir um relatório antigo não recalcula números.

**Arquivos de leitura, nesta ordem:**

1. `client/src/financeiro/ConfiguracoesFinanceiras.tsx`, `FormConta.tsx`, `FormParceiro.tsx`, `FormProduto.tsx` e `CamposCadastro.tsx`.
2. `server/src/services/financeiro/contas.ts`, `parceiros.ts`, `classificacao.ts` e `cadastros-gerenciais.ts`.
3. `client/src/financeiro/NovoRelatorioFinanceiro.tsx`, `RelatoriosFinanceiros.tsx` e `RelatorioFinanceiroDetalhe.tsx`.
4. `server/src/routes/relatorios-financeiros.ts`, `server/src/services/financeiro/relatorios.ts`, `relatorios.calc.ts` e `relatorios.pdf.ts`.
5. `server/src/services/financeiro/classificacao.edge.test.ts`, `relatorios.calc.edge.test.ts` e `client/src/financeiro/NovoRelatorioFinanceiro.test.tsx`.

- [ ] Criar uma conta com saldo de abertura zero. Depois de registrar movimento, tentar alterar saldo/data de abertura; deve bloquear.
- [ ] Criar parceiro com papéis Cliente e Fornecedor. Usá-lo em compra e venda; desativá-lo e conferir preservação no histórico, mas bloqueio para novos lançamentos.
- [ ] Criar operação com dois itens: Silagem R$ 800 em Pecuária e Adubo R$ 200 em Agronomia. Liquidar metade e conferir rateio R$ 400/R$ 100 nas análises.
- [ ] Emitir relatório filtrado por categoria/centro/período, baixar PDF e abrir o detalhe.
- [ ] Inserir uma nova operação e reabrir o relatório anterior. O snapshot não muda; um novo relatório passa a refletir a nova operação.
- [ ] Executar os testes edge para garantir que Decimal do Worker não usa métodos exclusivos do runtime Node.

**Checkpoint de código:** o saldo de contas nunca é filtrado como se fosse relatório de categoria; saldo é extrato. `toDecimalPlaces` é usado nas rotinas que rodam no Worker, em vez de métodos indisponíveis nesse runtime.

### Tarefa 5: estoque único e produto universal

**Pergunta que responde:** quanto há de cada insumo no sítio, de onde veio e qual fato causou sua saída?

**Como funciona:** produto não carrega “controla estoque” nem preço fixo. O tipo da operação decide se gera movimento; custo de saída é média ponderada das entradas no sítio. `MovimentoEstoque` mantém origem, centro de custo e reversões. Estoque é compartilhado por Financeiro, Plantio e Pecuária, mas cada módulo só enxerga o que sua permissão permite.

**Arquivos de leitura, nesta ordem:**

1. `server/prisma/schema.prisma` — `Produto`, `ProdutoFornecedor`, `ProdutoCentroCusto`, `MovimentoEstoque`, `PartidaProduto` e `AlocacaoPartidaEstoque`.
2. `client/src/estoque/EstoqueContent.tsx`, `PartidasProduto.tsx`, `TransferirEstoque.tsx` e `api.ts`.
3. `server/src/routes/estoque.ts` e `server/src/routes/estoque-centros.ts`.
4. `server/src/services/estoque/estoque.ts`, `estoque.calc.ts`, `partidas.ts`, `transferencias.ts`, `produtos.ts` e `unidades.ts`.
5. `server/tests/financeiro/invariantes.test.ts`, `server/src/services/estoque/partidas.integration.test.ts` e `client/src/estoque/EstoqueContent.test.tsx`.

- [ ] Comprar 100 kg a R$ 10/kg e depois 100 kg a R$ 14/kg. Conferir custo médio de R$ 12/kg antes de outras saídas.
- [ ] Fazer compra para consumo direto. Conferir que cria efeito financeiro, mas não entrada física.
- [ ] Fazer compra para estoque. Conferir entrada física e rastreabilidade até a operação.
- [ ] Ajustar contagem com justificativa. Conferir delta, auditoria e ausência de pagamento criado pelo ajuste.
- [ ] Transferir estoque entre sítios, quando houver dados para isso. Conferir que quantidade não duplica no consolidado e que custo vai ao sítio de destino.
- [ ] Tentar estornar manualmente um movimento que veio de operação financeira ou aplicação operacional. Deve bloquear e indicar a origem correta para correção.

**Checkpoint de código:** a origem é tão importante quanto o saldo. `estornarMovimentoTx` cria movimento inverso e marca o original como REVERTIDO; nunca apaga o movimento que explica o estoque.

### Tarefa 6: Rebanho V1 — identidade, lote, movimentação, baixa e peso

**Pergunta que responde:** quais animais existem no sítio, onde estão, qual seu histórico e quais demandam uma ação de manejo?

**Como funciona:** `Animal` guarda identidade; fatos mutáveis viram eventos datados de localização, destino, baixa, movimentação e pesagem. A categoria é calculada a partir de regras da fazenda ou ajustada manualmente com motivo. Baixa e estorno preservam a linha do tempo; brinco é único entre animais ativos no mesmo sítio.

**Arquivos de leitura, nesta ordem:**

1. `docs/pecuaria/README.md` e `docs/pecuaria/artefatos/pecuaria-schema-map-v1.html`.
2. `server/prisma/schema.prisma` — modelos sob o schema `pecuaria`: `Animal`, `Lote`, `Movimentacao`, `BaixaAnimal`, `Pesagem` e `AuditoriaPecuaria`.
3. `client/src/pecuaria/rebanho/RebanhoContent.tsx` e `telas/NavRebanho.tsx`.
4. `client/src/pecuaria/rebanho/telas/{ListaAnimais,NovoAnimal,DetalheAnimal,ListaLotes,DetalheLote,Cadastros}.tsx`.
5. `server/src/routes/pecuaria/rebanho.ts`.
6. `server/src/services/pecuaria/rebanho/animais.ts`, `movimentacoes.ts`, `lotes.ts`, `categorias.ts`, `peso.calc.ts`, `baixa.calc.ts` e `auditoria.calc.ts`.
7. Testes `rebanho.integration.test.ts`, `brinco.calc.test.ts`, `peso.calc.test.ts`, `baixa.calc.test.ts` e `cadastros.travas.test.ts`.

- [ ] Rodar a massa demonstrativa e abrir `/pecuaria/rebanho`.

  ```bash
  pnpm --filter rionovo-server run seed:rebanho
  ```

- [ ] Cadastrar animal e tentar repetir o brinco em outro ativo no mesmo sítio. Conferir bloqueio.
- [ ] Movimentar o animal para outro lote e conferir localização atual, histórico e auditoria.
- [ ] Registrar pesagens de 300 kg e 330 kg em datas separadas por 30 dias; conferir GMD aproximado de 1 kg/dia no período selecionado.
- [ ] Dar baixa com tipo, motivo e data; conferir remoção da lista ativa e preservação no histórico. Estornar e conferir retorno consistente.
- [ ] Criar regras de categoria sobrepostas; o servidor deve recusar novas sobreposições. Conferir categoria calculada versus categoria manual na ficha.

**Checkpoint de código:** não há produção, reprodução ou sanidade do legado dentro da V1. Não use tabelas ou telas removidas como referência de contrato atual.

### Tarefa 7: Genética V2

**Pergunta que responde:** quem são os pais, qual a composição racial e quais materiais genéticos estão disponíveis para os domínios seguintes?

**Como funciona:** mãe e pai podem ser animais internos ou genitores externos, mas cada lado aceita uma fonte por vez. A migration contém CHECKs; o service valida sexo, data de nascimento, ciclos ancestrais e avisos de idade/intervalo. Composição pode ser informada ou calculada pelos genitores, sem sobrescrever informação manual silenciosamente. Sêmen e embrião são produtos do estoque único; seu consumo vem na V4.

**Arquivos de leitura, nesta ordem:**

1. `docs/pecuaria/artefatos/pecuaria-v2-genetica.html`.
2. `server/prisma/migrations/20260926120000_pecuaria_v2_genetica/migration.sql`.
3. `client/src/pecuaria/rebanho/forms/FormFiliacao.tsx`, `FormComposicao.tsx`, `cadastros/FormGenitor.tsx` e `FormMaterialGenetico.tsx`.
4. `server/src/services/pecuaria/rebanho/genetica.calc.ts`, `genitores.ts`, `materialGenetico.ts` e `composicao.calc.ts`.
5. `server/src/services/pecuaria/rebanho/genetica.calc.test.ts`, `genetica.integration.test.ts` e `materialGenetico.integration.test.ts`.

- [ ] Cadastrar mãe e pai compatíveis e criar filho; conferir filiação e descendência nas fichas.
- [ ] Tentar selecionar pai fêmea, mãe macho, o próprio animal como pai/mãe e um genitor interno nascido depois do filho. Conferir recusa com erro no campo.
- [ ] Calcular composição pelos genitores; depois registrar composição informada e confirmar que o cálculo não a substitui sem aceite.
- [ ] Cadastrar genitor externo e material genético. Fazer compra do material pelo Financeiro/Estoque e conferir o vínculo 1:1 Produto–MaterialGenetico.
- [ ] Rodar `validar:pecuaria` depois de importação demonstrativa. A carga real IDEAGRI continua uma homologação pendente e deve ser executada separadamente com o dump real.

**Checkpoint de código:** receptora gesta, mas não transmite genética; ciclo ancestral não é permitido; composição usa frações de 64 avos.

### Tarefa 8: V3 da pecuária — sanidade, manejo/peso e nutrição (em desenvolvimento)

**Estado:** a implementação existe na branch atual, mas o [PR #308](https://github.com/somosvira/fazendinha/pull/308) está em rascunho. Estude e teste como contrato em homologação, não como funcionalidade liberada na `main`.

**Como funciona:** Sanidade registra cadastros, ocorrências, protocolos, aplicações, exames, carência e rateio de serviço. Manejo registra fatos e anulações auditáveis. Nutrição versiona dietas, aplica vigências por lote, confere consumo, fecha períodos e estorna consumo de estoque quando necessário.

**Arquivos de leitura, nesta ordem:**

1. `docs/pecuaria/artefatos/pecuaria-v3-sanidade-peso-nutricao.html`.
2. `docs/pecuaria/artefatos/roteiro-testes-rebanho-v1-v2.html` — grupos V3.
3. `server/src/routes/pecuaria/{sanidade,manejo,nutricao}.ts` e montagem em `routes/pecuaria/rebanho.ts`.
4. `server/src/services/pecuaria/sanidade/`, `manejo/` e `nutricao/`.
5. `client/src/pecuaria/rebanho/{sanidade,manejo,nutricao}/`.
6. As integrações `aplicacoes.integration.test.ts`, `protocolos.integration.test.ts`, `manejo.integration.test.ts`, `consumo.integration.test.ts` e `interface.integration.test.ts`.

- [ ] Preparar o cenário V3 somente depois da base Rebanho.

  ```bash
  pnpm --filter rionovo-server run seed:rebanho
  pnpm --filter rionovo-server run seed:pecuaria-v3
  ```

- [ ] Registrar aplicação sanitária individual e coletiva; conferir idempotência, estoque, carência e histórico do animal/lote.
- [ ] Registrar exame, corrigir resultado e conferir auditoria; tentar repetir requisição coletiva para confirmar que não duplica fatos.
- [ ] Fazer pesagem coletiva, executar manejo e anular o manejo; conferir preservação da história.
- [ ] Criar e publicar dieta, atribuir vigência a lote, simular conferência e fechamento. Conferir consumo, custo e estorno quando aplicável.
- [ ] Executar os grupos obrigatórios do roteiro V3; marcar não executado como pendente, não aprovado.

**Checkpoint de código:** a V3 só é considerada pronta quando CI, PostgreSQL, roteiro manual, permissões, concorrência e conferência 1180/720 px estiverem homologados. A documentação declara explicitamente esses limites.

### Tarefa 9: Plantio e agricultura

**Pergunta que responde:** o que foi feito em cada talhão, quais tarefas/inspeções exigem ação e qual o efeito financeiro e físico da lavoura?

**Como funciona:** Talhão é a unidade operacional. Operações agrícolas, inspeções, colheita, tarefas e apontamentos formam a linha do tempo; aplicação com produto de estoque gera saída física proporcional à dose × área e edição/exclusão cria reversão. Custos podem apontar para operação financeira, mantendo domínio agrícola como dono do fato técnico.

**Arquivos de leitura, nesta ordem:**

1. `client/src/plantio/PlantioContent.tsx` e `client/src/plantio/nav.ts`.
2. Componentes `TalhaoCockpit.tsx`, `TalhaoTab.tsx`, `FitossanidadeTab.tsx`, `NutricaoTab.tsx`, `ColheitaTab.tsx`, `PlanejamentoTab.tsx` e `OperacaoForm.tsx`.
3. `server/src/routes/plantio/`.
4. `server/src/services/plantio/talhoes.ts`, `timeline.ts`, `aplicacao-estoque.calc.ts`, `custo.ts`, `colheita.ts`, `planejamento.ts` e `ia.*`.
5. Testes `aplicacao-estoque.calc.test.ts`, `timeline.test.ts`, `custo.test.ts` e `planejamento.calc.test.ts`.

- [ ] Criar ou abrir um talhão e percorrer o cockpit e a linha do tempo.
- [ ] Registrar uma aplicação com produto que já possui entrada no sítio; conferir saída correspondente no estoque e centro de atividade Agricultura.
- [ ] Editar ou excluir o fato agrícola; conferir reversão, não exclusão do movimento de estoque original.
- [ ] Registrar inspeção, tarefa e colheita; conferir que cada uma aparece no contexto do talhão correto.
- [ ] Consultar custo por talhão/safra e abrir sua origem financeira quando houver vínculo.

**Checkpoint de código:** o Plantio possui componentes de IA, mas a qualidade da resposta depende de configuração OpenAI e dos dados da propriedade; teste a regra local e o fallback antes de julgar a resposta do modelo.

### Tarefa 10: Milho e silos

**Pergunta que responde:** como está cada safra de milho, quanto custou, quanto produziu e o que entrou/saiu dos silos?

**Como funciona:** `SafraCultivo` organiza áreas, custos, produção e silos. O módulo de cliente escolhe uma subaba; rotas específicas delegam à camada de cultivo. Custos continuam distintos do financeiro, mas podem se vincular a ele quando aplicável.

**Arquivos de leitura, nesta ordem:**

1. `client/src/cultivo/CultivoContent.tsx`.
2. `client/src/cultivo/components/{SafrasTab,CustosTab,ProducaoTab,SilosTab,CustoTab,DashboardView}.tsx`.
3. `client/src/cultivo/api.ts` e `types.ts`.
4. `server/src/routes/cultivo/`.
5. `server/src/services/cultivo/` e os testes associados.

- [ ] Criar ou selecionar safra e área.
- [ ] Registrar custo, produção e movimento de silo.
- [ ] Conferir os indicadores no dashboard e a segregação por safra.
- [ ] Verificar que uma alteração não aparece em outra propriedade selecionada.

**Checkpoint de código:** antes de alterar cálculos do milho, localizar o cálculo puro correspondente e seu teste; não colocar aritmética na rota ou no componente.

### Tarefa 11: equipe e ponto

**Pergunta que responde:** quem trabalha na fazenda, qual jornada foi registrada e qual é o custo de mão de obra que alimenta a análise?

**Como funciona:** Funcionário, RegistroPonto e folha vivem no módulo Ponto. O dashboard agrega dados; folha e custo por setor são services próprios. A área Equipe é um gate separado e valores podem depender de flags de salário.

**Arquivos de leitura, nesta ordem:**

1. `client/src/equipe/EquipeContent.tsx`.
2. `client/src/equipe/components/{FuncionariosTab,PontoTab,FolhaTab,DashboardView,FuncionarioForm}.tsx`.
3. `server/src/routes/ponto/index.ts` e `dashboard.ts`.
4. `server/src/services/ponto/{funcionarios,pontos,folha,folha.service,dashboard.agg,custoMOSetor}.ts`.
5. Testes `funcionarios.test.ts`, `pontos.test.ts`, `folha.test.ts`, `folha.service.test.ts` e `dashboard.agg.test.ts`.

- [ ] Cadastrar funcionário e conferir presença no dashboard.
- [ ] Registrar ponto e validar a jornada agregada.
- [ ] Abrir folha e conferir que valores seguem as permissões do perfil.
- [ ] Alterar o sítio e confirmar que os fatos operacionais obedecem ao escopo.

### Tarefa 12: busca, IA, WhatsApp e anexos externos

**Pergunta que responde:** como o sistema oferece consulta assistida sem permitir que um modelo altere ou consulte dados livremente?

**Como funciona:** busca encontra entidades internas; o bot usa function calling para chamar ferramentas estruturadas. O modelo não produz SQL. WhatsApp valida a assinatura Meta, confere allowlist, persiste conversa e encaminha para o agente. Atualmente o assistente web e suas rotas estão desativados por feature flag.

**Arquivos de leitura, nesta ordem:**

1. `server/src/featureFlags.ts`, `client/src/featureFlags.ts` e `server/src/app.ts` — estado real da flag.
2. `server/src/routes/busca.ts`, `server/src/services/busca.ts` e `client/src/components/CommandPalette.tsx`.
3. `server/src/services/consulta/{tradutor,validacao,motor,agregador}.ts`.
4. `server/src/services/bot/{agent,tools,tools-consulta,navegacao,conversa,serialize}.ts`.
5. `server/src/routes/whatsapp.ts` e `server/src/services/whatsapp/{verify,handler,client}.ts`.
6. Testes de `services/consulta`, `services/bot` e `services/whatsapp`.

- [ ] Usar a paleta de comandos para encontrar entidade e abrir seu destino interno.
- [ ] Confirmar que `ASSISTENTE_ATIVO` está falso: chat web não deve ser apresentado e chamadas para sua rota devem retornar 503 controlado.
- [ ] Ler as ferramentas do bot e confirmar que os argumentos passam por validação antes de chegar ao motor de consulta.
- [ ] Em ambiente de integração autorizado, testar webhook Meta com assinatura válida e inválida; a inválida deve ser recusada antes de processar mensagem.
- [ ] Não enviar mensagens reais nem mudar allowlist durante o estudo sem autorização explícita do responsável.

**Checkpoint de código:** nunca trocar ferramentas estruturadas por SQL gerado pelo LLM; todo deep-link deve passar pelo roteador do cliente e respeitar permissões.

---

## Validação transversal

### Tarefa 13: executar a pirâmide de testes

- [ ] Rodar os testes do servidor e do cliente.

  ```bash
  pnpm --filter rionovo-server run test
  pnpm --filter rionovo-client run test
  ```

- [ ] Construir os dois workspaces.

  ```bash
  pnpm build
  ```

- [ ] Com banco local preparado, executar a bateria financeira. Ela cria e remove um banco temporário, preservando `fazendinha_local`.

  ```bash
  pnpm --filter rionovo-server run test:financeiro:integration
  ```

- [ ] Na branch V3, executar também as integrações de pecuária que requerem PostgreSQL conforme a documentação de cada teste.

- [ ] Para qualquer fluxo estudado, manter evidência mínima: dados de entrada, ação, tela/rota, resultado visível, resultado no histórico/auditoria e resultado depois de recarregar.

## Ordem recomendada de estudo

1. Tarefa 0 — ambiente e massa QA249.
2. Tarefa 1 — sessão, área e sítio.
3. Tarefas 2 a 5 — financeiro e estoque, nessa ordem.
4. Tarefas 6 e 7 — Rebanho e Genética.
5. Tarefa 8 — V3, apenas como homologação de PR.
6. Tarefas 9 a 11 — agricultura, milho e equipe.
7. Tarefa 12 — busca, IA e integrações externas.
8. Tarefa 13 — testes completos e registro de dúvidas.

---

## Índice dos 25 PRs de FellipeMTX

Os nove marcados como **mesclado por FellipeMTX** foram integrados por essa conta. Os demais são de autoria de FellipeMTX e foram mesclados por outro integrante. Esta tabela indica o que estudar, onde o efeito ficou e qual mudança posterior precisa ser considerada.

| # | Data | Situação | Entrega e leitura principal | Teste funcional | Estado atual / sucessão |
|---:|---|---|---|---|---|
| [243](https://github.com/somosvira/fazendinha/pull/243) | 07/09 | mesclado por FellipeMTX | Reconstrução financeira; `services/financeiro/operacoes.ts`, `client/src/financeiro/` | compra à vista, compra a prazo, liquidação, transferência e estorno | Base atual; formulário depois virou página no #250. |
| [250](https://github.com/somosvira/fazendinha/pull/250) | 07/09 | mesclado por FellipeMTX | Rascunho único; `rascunhos.ts`, `FormOperacao.tsx` | autosave, reload e confirmação atômica | Atalho lateral nos #271/#273. |
| [254](https://github.com/somosvira/fazendinha/pull/254) | 09/09 | mesclado por FellipeMTX | Login, convite e reset; `routes/auth.ts`, `services/auth/` | login, reset de uso único e revogação de sessão | Ajustes de UX no #266. |
| [255](https://github.com/somosvira/fazendinha/pull/255) | 09/09 | autor; mesclado por somosvira | Documentação de arquitetura/deploy | conferir docs contra schema e scripts atuais | Documento histórico; sempre conferir código e migrations atuais. |
| [256](https://github.com/somosvira/fazendinha/pull/256) | 09/09 | autor; mesclado por somosvira | Deep-links de IA; `services/bot/navegacao.ts` | pedir/abrir rota assistida em ambiente habilitado | Assistente está desligado por feature flag. |
| [261](https://github.com/somosvira/fazendinha/pull/261) | 10/09 | autor; mesclado por RubensRafael | Baseline de migrations | aplicar em banco vazio e comparar schema | Substituída pela consolidação posterior da #296. |
| [266](https://github.com/somosvira/fazendinha/pull/266) | 11/09 | autor; mesclado por somosvira | Retorno pós-login e convites; `App.tsx`, `Acessos.tsx` | retorno seguro e regeneração de convite | Produto integrado. |
| [259](https://github.com/somosvira/fazendinha/pull/259) | 12/09 | autor; mesclado por somosvira | Contas e parceiros; `contas.ts`, `parceiros.ts` | conta inativa/histórico e parceiro com papéis múltiplos | Produto integrado. |
| [267](https://github.com/somosvira/fazendinha/pull/267) | 14/09 | autor; mesclado por somosvira | Categoria/centro por item; `classificacao.ts` | nota mista e pagamento parcial rateado | Correções de invariantes chegaram em PRs posteriores. |
| [271](https://github.com/somosvira/fazendinha/pull/271) | 15/09 | mesclado por FellipeMTX | Trabalho ativo; `rascunhoAtivo.ts`, `AppSidebar.tsx` | retomar rascunho de outra tela | Refinado no #273. |
| [273](https://github.com/somosvira/fazendinha/pull/273) | 15/09 | mesclado por FellipeMTX | Atalho fino e seletor de sítio | sem rascunho, com rascunho e menu móvel | Produto integrado. |
| [275](https://github.com/somosvira/fazendinha/pull/275) | 15/09 | autor; mesclado por somosvira | Decimal no Worker; `classificacao.ts` | dashboard categorizado no ambiente edge | Coberto por teste edge. |
| [268](https://github.com/somosvira/fazendinha/pull/268) | 15/09 | mesclado por FellipeMTX | Relatório persistido/PDF; `relatorios.ts`, `relatorios.pdf.ts` | gerar, baixar e reabrir snapshot | UX melhorada no #276. |
| [276](https://github.com/somosvira/fazendinha/pull/276) | 15/09 | mesclado por FellipeMTX | Filtros e período dos relatórios | multiseleção, período e seed de relatórios | Produto integrado. |
| [270](https://github.com/somosvira/fazendinha/pull/270) | 16/09 | mesclado por FellipeMTX | Calendário e gráficos; `CalendarioCompromissos.tsx`, `charts.tsx` | compromissos por dia, gráficos e transferências | Refinamento visual no #290. |
| [283](https://github.com/somosvira/fazendinha/pull/283) | 17/09 | autor; mesclado por somosvira | Percentual de relatório no Worker; `relatorios.calc.ts` | gerar relatório com categorias no Worker | Coberto por teste edge. |
| [286](https://github.com/somosvira/fazendinha/pull/286) | 21/09 | autor; mesclado por somosvira | Parcelas, cancelamento, rastreabilidade | parcelas, estorno de liquidação e resumo de cancelamento | Modelo de parcelas ajustado no #288. |
| [288](https://github.com/somosvira/fazendinha/pull/288) | 21/09 | autor; mesclado por somosvira | Parcelas sob demanda e foco de erro | gerar parcelas, substituir e validar campo | Produto integrado. |
| [289](https://github.com/somosvira/fazendinha/pull/289) | 21/09 | autor; mesclado por somosvira | XML/R2 no Worker; `dom-parser-polyfill.ts` | upload e download de anexo em ambiente Worker | Requer R2 real para homologação completa. |
| [290](https://github.com/somosvira/fazendinha/pull/290) | 21/09 | autor; mesclado por somosvira | Visão geral e gráfico responsivo | período multi-mês em 1180/720 px | Produto integrado. |
| [291](https://github.com/somosvira/fazendinha/pull/291) | 22/09 | autor; mesclado por somosvira | Loading de anexo | anexo lento/falho e confirmação bloqueada | Produto integrado. |
| [278](https://github.com/somosvira/fazendinha/pull/278) | 22/09 | mesclado por FellipeMTX | Estoque unificado; `services/estoque/`, `EstoqueContent.tsx` | nota mista, aplicação agrícola e origem do movimento | Produto universal mudou no #297. |
| [297](https://github.com/somosvira/fazendinha/pull/297) | 23/09 | autor; mesclado por somosvira | Produto universal e custo médio; `produtos.ts`, `estoque.calc.ts` | compra para estoque versus consumo direto; custo médio | Rebanho legado removido no #296. |
| [296](https://github.com/somosvira/fazendinha/pull/296) | 25/09 | autor; mesclado por somosvira | Rebanho V1; `services/pecuaria/rebanho/` | animal, lote, peso, baixa, estorno e auditoria | Base vigente da pecuária. |
| [307](https://github.com/somosvira/fazendinha/pull/307) | 28/09 | autor; mesclado por somosvira | Contexto pecuário versionado | abrir os artefatos e seguir o roteiro | README local deve ser atualizado para refletir V2 mesclada. |

## Riscos e pontos que merecem revisão humana

1. **Branch versus `main`:** V3 tem código e testes na branch atual, mas não está homologada nem mesclada. Não apresentar como produto liberado.
2. **Migrations da pecuária:** `db push` não reproduz índices parciais e regras SQL da V1. Usar `prisma migrate deploy` em banco vazio/de estudo.
3. **Dados históricos:** operações, estoque, baixa animal e liquidações são históricos. A saída correta é reversão/estorno auditado, não `delete`.
4. **Integrações externas:** upload R2, e-mail Resend, Worker e WhatsApp só estão plenamente comprovados no ambiente com credenciais e provedores reais; não testar enviando dados para terceiros sem autorização.
5. **IA:** a flag está desligada; a qualidade do LLM não é garantia da regra de negócio. A fonte da verdade são services, schema, migrations e testes.

## Conclusão operacional

Ao terminar cada tarefa, registre: “entendi”, “testei”, “resultado esperado”, “diferença encontrada” e o arquivo/rota que explica a diferença. Isso cria uma trilha de estudo que depois pode virar QA, issue ou plano de correção sem perder o contexto técnico.
