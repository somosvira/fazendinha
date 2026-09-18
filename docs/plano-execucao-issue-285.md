# Plano de execução — issue #285

Issue: https://github.com/somosvira/fazendinha/issues/285

Preparado para execução sequencial por Terra, esforço medium. A execução foi iniciada na branch `feat/285-operacoes-rastreabilidade`; os checkpoints ao final deste arquivo são a fonte de verdade do estado atual.

## 1. Contrato de execução

Execute as etapas na ordem abaixo. Termine cada etapa com os testes específicos, registre um checkpoint neste arquivo e continue. Não replaneje toda a issue a cada etapa. Se a sessão acabar, retome do primeiro checkpoint incompleto, conferindo o diff existente.

- Leia `AGENTS.md`, `CLAUDE.md`, este plano e a issue atual antes de implementar.
- Leia as seções financeiras de `ARCHITECTURE.md`, `DOMAIN.md`, `docs/financeiro-rebuild-contrato.md` e os modelos envolvidos no schema. Para UI, consulte `DESIGN.md` e `COMPONENTS.md`.
- Preserve alterações do usuário. Não execute reset, checkout destrutivo, seed, migration ou testes contra produção. O script `dev:server` executa `db push`: não o use sem conferir o destino do banco.
- Use uma branch de trabalho para a #285 se estiver na branch principal e o estado local permitir. Não inclua alterações alheias nos commits. Não faça merge ou deploy por consequência deste plano.
- Não implemente #284 nem as telas próprias de #274; reutilize as bases compartilhadas dessas issues se já estiverem presentes. Confira isso uma vez na preparação.
- Os IDs no checkout inspecionado são `Int`; se a #264 já estiver aplicada na execução, siga os tipos reais e adapte as fixtures. Não faça migração de IDs nesta issue.
- Não adicionar dependências de UI, calendário, gráficos ou roteamento. Não introduzir `any`, casts de campos fictícios, hexadecimais ou tipografia inline.
- Fazer cálculos financeiros de domínio no servidor com `Prisma.Decimal`/`dinheiro()`. Não importar Prisma no bundle do client.
- Uma fase bloqueada por decisão de produto não impede avançar nas fases independentes. Relate a pendência explicitamente e não declare a issue integralmente concluída.

## 2. Achados que precisam orientar a implementação

| Local | Situação observada | Consequência |
| --- | --- | --- |
| `client/src/financeiro/OperacoesFinanceiras.tsx` | `filtradas` é renderizado inteiro | Paginar depois dos filtros, sem alterar a API |
| `financeiro-ui.tsx`, `TabelaFinanceira` | Tabela em `md+`; cartões abaixo de 768 px | Corrigir a rolagem intermediária sem mudar todas as tabelas implicitamente |
| `FinanceiroContent.tsx` | `podeLancar` não é repassado a Operações | Propagar permissão até formulário, detalhe e ações |
| `OperacaoFinanceiraDetalhe.tsx` | Contagem de transações, parcelas sem modal e totais com `Number` | Obter DTO de detalhe com valores calculados no servidor |
| `server/src/services/financeiro/operacoes.ts` | `estornarTransacaoTx` executa `liquidacao.delete` | Corrigir antes de expor histórico de estornos |
| Mesmo serviço | Cancelamento já usa uma única transação e ignora originais revertidos | Preservar a atomicidade existente e não duplicar estornos |
| Mesmo serviço | `obterOperacao` não aplica os valores derivados de `listarCompromissos` | Não assumir que `saldoPendente` existe no JSON do detalhe só porque está no tipo do client |
| `server/src/routes/financeiro.ts` | Rotas de estorno passam somente ID, motivo e autor ao serviço | Verificar gates efetivos e adicionar escopo de propriedade ao acesso por ID |
| `ContasFinanceiras.tsx` | Usa `#movimento-<id>` e `data-ancora`, com foco na linha | Reutilizar links reais; testar também conta inativa e movimento antigo |
| `FormOperacao.tsx` | Parcela e saldo calculados com `number`; resumo possui `xl:max-h-screen`; erro no início | Resolver precisão, altura e mensagem junto da ação |
| Schema `Operacao` | Tem `corrigeOperacaoId`, não tem relação de devolução | Não reutilizar correção como vínculo de devolução |

Importante para saldos: `contas.ts` soma o movimento original e seu evento inverso. Não filtrar o original revertido para fora do cálculo do saldo mantendo a reversão, pois isso produz saldo incorreto. Para o valor pago da parcela, por outro lado, somar somente liquidações cuja transação continua confirmada.

## 3. Decisões fechadas para a execução

1. **Paginação:** 15 registros, ordenação existente, filtros antes de `slice`; anterior/próxima e seletor de número da página. Zero resultados mostra estado vazio sem “página 1 de 0”.
2. **Rolagem:** adicionar opção opt-in à `TabelaFinanceira` para barra horizontal superior sincronizada com a inferior, ativa somente na lista de Operações. Usar `ResizeObserver` para medir conteúdo/contêiner, atualizar ao redimensionar/sidebar e remover listeners no cleanup. Evitar recursão comparando `scrollLeft` antes de atribuir. Manter cartões mobile. Quando o sistema operacional esconder barras, fornecer indicação e botões acessíveis para rolar lateralmente; não depender apenas da barra nativa.
3. **DTOs:** decimais serializados como strings; conta histórica mínima `{ id, nome }`; relações de reversão rasas, sem recursão. As contas inativas continuam identificáveis no histórico.
4. **Resumo:** fundo e borda do `aside` estendidos até a base do formulário, sem `max-h-screen` cortando conteúdo. Nesta entrega, dispensar sticky é aceitável e mais simples; confirmação no final do resumo com `mt-auto`.
5. **Parcelamento:** ação explícita “Gerar parcelas”, frequência mensal inicial, quantidade inicial 1; edição de valor/vencimento troca o modo para personalizado. Regeração sobre parcelas editadas exige confirmação. Cancelar a confirmação preserva tudo.
6. **Datas:** semanal = primeiro vencimento + 7 × índice dias. Mensal = mês de destino e dia original limitado ao último dia daquele mês. Exemplo: 31/jan → 28/fev → 31/mar; não somar um mês à data já reduzida de fevereiro. Datas civis ISO, sem deslocamento por fuso.
7. **Centavos:** dividir pelo número de parcelas, atribuindo centavos restantes às primeiras. R$ 100 em 3 = 33,34 + 33,33 + 33,33. Total R$ 100 com entrada R$ 25 em 3 = 25,00 cada. Rejeitar quantidade não inteira/zero e quantidade maior que centavos disponíveis, evitando parcelas de zero.
8. **Erros:** erro de submissão imediatamente acima do botão, `role="alert"`, foco programático e associação ao campo se `ApiError.campo` vier preenchido. Erros de anexo após confirmação bem-sucedida são avisos de anexo; não oferecer reenviar a operação inteira como se a confirmação tivesse falhado.

## 4. Etapa A — preparação limitada

Faça uma rodada de inspeção: `git status --short`, branch atual, #285, #274 e #284. Confira somente os arquivos listados neste plano e as implementações análogas pertinentes. Identifique se a correção de histórico/estorno da #274 já existe. Não repetir pesquisas globais durante todas as fases.

Leia os testes existentes: `OperacoesFinanceiras.test.tsx`, `OperacaoFinanceiraDetalhe.test.tsx`, `FormOperacao.test.tsx`, `ContasFinanceiras.test.tsx`, `responsivo.test.tsx`, `server/tests/financeiro/invariantes.test.ts`.

Saída: registrar branch/base, mudanças preexistentes que devem ser preservadas e eventuais diferenças reais em relação à tabela de achados.

## 5. Etapa B — backend de histórico, valores e autorização

Arquivos: `server/src/services/financeiro/operacoes.ts`, `server/src/routes/financeiro.ts`, `client/src/financeiro/novo-api.ts`; novo helper `compromissos.calc.ts` somente se não houver equivalente.

1. Remover a exclusão de `Liquidacao` no estorno. Manter o vínculo com a transação original revertida. Não tentar reconstruir automaticamente vínculos históricos que já foram apagados.
2. Centralizar cálculo Decimal de valor liquidado e saldo pendente e usá-lo em `listarCompromissos` e `obterOperacao`. Incluir todas as liquidações no histórico, mas excluir as revertidas do pago. Compromisso cancelado continua CANCELADO; apresentar cancelamento sem voltar a mostrar dívida exigível por engano.
3. Incluir movimentos e conta mínima tanto nas transações diretas como nas transações de liquidações do detalhe. Incluir `reversaoDe`/`revertidaPor` com IDs e dados necessários à exibição. Ordenar histórico por data e desempate estável.
4. Calcular no servidor resumo de cancelamento: transações originais confirmadas, parcelas pagas/parciais, saldo pendente de compromissos ativos, movimentos de estoque elegíveis e impacto inverso por conta. Não somar uma transferência duas vezes como volume de pagamento. Uma estrutura derivada no DTO é suficiente; não exige persistência.
5. Proteger os endpoints de estorno de operação/transação com `lancar` e propriedade resolvida no servidor. Consultar o registro com ID + propriedade dentro da transação, antes de criar qualquer efeito. Atualizar chamadas e testes afetados. Conferir também confirmação/criação usadas nesta entrega.
6. Manter a verificação de período na data do evento inverso, conforme a implementação e `ARCHITECTURE.md`; não inventar bloqueio pelo mês original. Tratar conflito/repetição sem criar novo evento. A restrição única de reversão deve continuar protegendo contra duplicidade.
7. Tipar o JSON real no client. Se lista e detalhe retornarem estruturas diferentes, usar tipos distintos, não tornar dados obrigatórios fictícios nem mascarar ausência com casts.

Testes obrigatórios: parcela 100 paga 70 → pago 70/restante 30; estornar → histórico preservado, pago 0/restante 100; liquidar novamente → não contar pagamento revertido; segunda tentativa de estorno não cria movimento; usuário sem permissão/registro de outro sítio não escreve; período atual fechado bloqueia; resumo de cancelamento ignora transação já revertida.

## 6. Etapa C — lista e rolagem

Arquivos: `OperacoesFinanceiras.tsx`, `financeiro-ui.tsx` e testes correspondentes.

1. Criar `pagina`, constante 15, total de páginas e página efetiva limitada aos resultados atuais. Renderizar somente a fatia.
2. Alterar handlers de busca/período/tipo/efeito/status para voltar à primeira página; tratar redução dos resultados após recarga. Manter a ordem original e o clique da linha.
3. Renderizar controles de paginação acessíveis próximos da tabela; mostrar faixa de resultados e total filtrado.
4. Implementar a opção de rolagem superior descrita na seção 3. Não alterar comportamento dos outros consumidores de `TabelaFinanceira` por padrão.

Testar 0, 1, 15, 16 e 31 itens; filtro aplicado na página 3; redução da última página; cartões usando a mesma fatia; acesso por teclado. Verificação de layout real fica para a etapa J: JSDOM não comprova dimensões/rolagem.

## 7. Etapa D — detalhe, contas e modal de parcela

Arquivos: `FinanceiroContent.tsx`, `OperacoesFinanceiras.tsx`, `OperacaoFinanceiraDetalhe.tsx`, `novo-api.ts`, `ContasFinanceiras.tsx` se necessário. Procurar componente compartilhado de liquidação antes de criar `HistoricoLiquidacoes`/`DetalheCompromissoModal`.

1. Propagar `podeLancar` por toda a cadeia, incluindo acessos diretos ao formulário. Manter leitura para quem tem acesso e ocultar ações de escrita.
2. Renderizar transações com data, valor, tipo, forma, estado e movimentos por conta. Em transferência, duas pontas identificadas; em estorno, mostrar relação com original.
3. Usar navegação existente que troca a aba e a URL, ou links `href` canônicos. Não usar apenas `pushState` sem atualizar a aba. O destino é `/financeiro/contas/${contaId}#movimento-${movimentoId}`.
4. Garantir que um link para conta inativa e um movimento antigo consiga carregar o registro e posicionar o foco. Não remover acesso ao movimento original revertido: ele é parte do histórico.
5. Tornar parcela acionável por botão com nome acessível. Modal mostra original/pago/restante, status e histórico completo; pendente mostra estado vazio; liquidado continua clicável.
6. Após estorno, refazer a consulta do detalhe e atualizar também o modal aberto a partir do ID da parcela, evitando objeto antigo em estado.

Testar múltiplos pagamentos em contas distintas, parcela pendente/parcial/liquidada, histórico revertido, transferência, link sem ID indisponível, voltar do extrato e leitor sem permissão de escrita.

## 8. Etapa E — ações de estorno e cancelamento

1. Adicionar cliente de `POST /financeiro/transacoes/:id/estorno` usando `req`/`comPropriedade` existentes. Reutilizar se #274 já criou.
2. Ação por liquidação original confirmada, motivo conforme `estornoSchema`, confirmação, estado processando e bloqueio de duplo clique.
3. Cancelamento da operação usa resumo da etapa B, especificando pagamentos já ocorridos, contas, valores e efeito inverso. Erro permanece dentro do modal, junto da confirmação, sem fechar ou perder motivo.
4. Sucesso recarrega detalhe; operação CANCELADA perde ações incompatíveis. Cancelar diálogo não faz request.
5. Extrato preserva descrição/motivo do cancelamento e link da operação. Se já atender ao critério, apenas testar.

Integração real obrigatória: saldo inicial 1.000, operação 100 a prazo, parcela liquidada 70 → saldo 930; cancelar operação → saldo 1.000, compromisso CANCELADO, liquidação histórica preservada, uma reversão. Repetir cancelamento não muda nada. Induzir falha depois do primeiro efeito dentro da transação e verificar que todos os estados financeiros e físicos voltam ao estado anterior.

## 9. Etapa F — devolução: decisão de domínio necessária

Este é o único trecho que não está totalmente definido pelo feedback. O pedido original fala em “devolução e estorno na parcela paga”; a redação da issue interpretou devolução como comercial/física. Essa interpretação ainda não foi confirmada pelo usuário.

Evidência: `DEVOLUCAO` atual retira estoque e cria recebimento/compromisso a receber; não distingue devolução de venda nem possui vínculo com operação original. `corrigeOperacaoId` exige original CANCELADA e não pode ser usado para esse fim.

Ao executar, perguntar uma única vez: “A ação Devolução na parcela paga deve registrar dinheiro devolvido, devolução de mercadoria ao fornecedor, ou ambos?” Continuar etapas G–J enquanto aguarda. Não bloquear toda a entrega, mas não encerrar #285 sem resolver este critério.

- Se for dinheiro devolvido para desfazer registro incorreto: verificar se o estorno existente já expressa a intenção. Não criar uma segunda ação que duplique o mesmo efeito sem uma decisão explícita.
- Se for restituição real ou devolução comercial: definir vínculo, valor/quantidade devolvível, conta/data do evento e tratamento de saldo pendente antes de codificar. Uma parcela não identifica automaticamente quais mercadorias retornaram.
- Para devolução comercial vinculada, será necessária relação própria com operação/item original e migration aditiva se o schema ainda não a possuir. Validar propriedade, tipos, limites cumulativos de devolução, efeitos já revertidos e concorrência. Não gerar devolução automática da operação inteira ao clicar numa parcela.
- Se a decisão não vier, registrar a fase como pendente com o motivo. Não esconder o botão para todos os cenários e declarar o aceite cumprido.

## 10. Etapa G — motor de parcelas e integração com rascunho

Arquivos: `FormOperacao.tsx`, `lib/parceiros.ts`, `lib/rascunho.ts` se aplicável; `server/src/services/financeiro/schemas.ts`, `rascunhos.ts`, `routes/financeiro.ts`.

Para respeitar a regra monetária do repositório, preferir serviço de simulação sem escrita:

1. Criar cálculo puro `parcelas.calc.ts` no servidor com Decimal. Entrada: total a distribuir, quantidade, frequência semanal/mensal e primeiro vencimento. Saída: parcelas com valor string de duas casas e vencimento ISO. Implementar regras da seção 3 e testes antes da UI.
2. Expor `POST /financeiro/operacoes/simulacao-parcelas` protegido, sem criar fatos/rascunhos/auditoria de escrita. Validar Zod e retornar erros padronizados. Usar nomes distintos de rotas dinâmicas; registrar antes delas. Reusar API equivalente se já existir.
3. UI envia o saldo a prazo correto e aplica a sugestão somente após ação explícita. Descartar respostas obsoletas se o total/entrada/configuração mudar durante a request. Botão de simulação com `type="button"`.
4. Revisar a obtenção do total: multiplicação quantidade × unitário deve preservar a mesma precisão/arredondamento por item do backend. Não transformar um total impreciso em “correto” só passando sua string ao serviço. Se necessário, receber itens e condição no simulador para derivar total e saldo com a mesma regra da confirmação.
5. Para total anotado/restante no client, usar representação decimal exata já disponível. Se não houver, helpers pequenos de strings e inteiros `bigint` em centavos, com limites e testes, sem nova biblioteca e sem Prisma no client. Não usar tolerância `Math.abs(...) < 0.01` como validação de soma. A validação final do servidor continua obrigatória.
6. Modo personalizado mantém texto atual e mostra “Total das parcelas anotadas” e “Restante para distribuir” ou “Excedente”. Impedir confirmação com parcela vazia/zero/negativa, data inválida, falta ou excesso.
7. Persistir configuração do gerador e modo no JSON de rascunho. Rascunhos antigos com parcelas e sem metadados abrem como personalizados, sem recálculo destrutivo.
8. Reaproveitar divisão/data da sugestão de parceiro quando possível, sem mudar o contrato de aplicação explícita. Trocar para condição à vista/sem efeito não pode enviar parcelas antigas no payload.

Testes: centavos do exemplo; 31/jan em ano normal e bissexto; semanal atravessando ano; entrada maior/igual ao total; quantidade inválida; edição manual → personalizado; geração cancelada preserva parcelas; autosave/reload preserva modo; mudança de total exige nova geração ou ajuste; resposta atrasada não sobrescreve campos novos; confirmação final bate exatamente com valores simulados.

## 11. Etapa H — resumo e erro de confirmação

Arquivos: `FormOperacao.tsx`, componente de revisão extraído se facilitar leitura, testes existentes.

1. Aplicar layout da seção 3 com tokens existentes, sem altura fixa em pixels. Garantir formulário longo e resumo longo sem corte.
2. Separar erro de submissão de erros de anexos/autosave quando necessário. Renderizar o alerta antes do botão de confirmar e focá-lo após falha.
3. Preservar `ApiError.campo` em vez de reduzir imediatamente tudo a string. Mapear campos existentes; para campo desconhecido, manter mensagem geral legível.
4. Padronizar erro Zod de confirmação se vier em formato incompatível com `req`. Não exibir apenas “Erro HTTP 400” para parcela inválida conhecida.
5. Desabilitar submissão durante request; preservar dados e versão de rascunho quando falhar. Não descartar rascunho numa falha de geração de compromisso.
6. Distinguir timeout de confirmação de rejeição definitiva: antes de reenviar, reconciliar o rascunho/resultado usando o mecanismo existente; não prometer retry seguro sem verificar se a operação já foi criada.

Testar erro de soma, período fechado, conflito de versão, falha de rede, campo inválido e anexo que falha depois da operação criada. Verificar foco e que o botão não fica permanentemente travado.

## 12. Etapa I — regressões financeiras e documentação

Reutilizar `server/tests/financeiro/invariantes.test.ts` para rollback real. Testes unitários com `$transaction` mockado não comprovam atomicidade.

Atualizar somente documentação correspondente às mudanças entregues: `COMPONENTS.md` para paginação/rolagem/histórico compartilhados; `DESIGN.md` se mudar regra visual; `ARCHITECTURE.md` para contrato de detalhe/estorno; `DOMAIN.md` e contrato financeiro se a decisão de devolução adicionar semântica. Não atualizar docs de funcionalidades ainda pendentes como se estivessem implementadas.

## 13. Etapa J — execução dos checks e aceite final

Durante cada fase, usar testes específicos, por exemplo:

```bash
pnpm --filter rionovo-client exec vitest run src/financeiro/OperacoesFinanceiras.test.tsx src/financeiro/OperacaoFinanceiraDetalhe.test.tsx
pnpm --filter rionovo-client exec vitest run src/financeiro/FormOperacao.test.tsx src/financeiro/ContasFinanceiras.test.tsx
pnpm --filter rionovo-server exec vitest run src/services/financeiro/parcelas.calc.test.ts
```

O terceiro comando pressupõe que o teste proposto foi criado. Acrescentar os arquivos novos de histórico/estorno/autorização efetivamente criados. Ao final, uma rodada:

```bash
pnpm --filter rionovo-server run test
pnpm --filter rionovo-client run test
pnpm build
git diff --check
```

Integração: ler antes `server/scripts/qa-financeiro.mjs`; ele usa schema temporário e exige banco local `fazendinha_local`. Com esse destino confirmado e ambiente preparado:

```bash
pnpm --filter rionovo-server run test:financeiro:integration
```

Não executar diretamente a configuração Vitest de integração contornando as proteções do runner. Se banco local não estiver disponível, registrar explicitamente “atomicidade não validada em banco real”. Corrigir falhas introduzidas; separar falhas preexistentes com evidência. Não repetir suites inteiras sem nova alteração relevante.

Verificação visual com navegador e as skills aplicáveis quando iniciar o dev server, em ambiente local: 720, 1180 e 1440 px. Conferir lista com 31 itens, sidebar aberta/recolhida, rolagem superior, cartões, links para movimentos, modal liquidado, cancelamento com parcela paga, 12 parcelas, resumo maior que viewport e erro acima do botão. Prints são evidência de layout; testes de classes CSS não substituem essa conferência.

## 14. Checkpoints e entrega

- [ ] A — preparação e diferenças de base registradas.
- [ ] B — histórico preservado, DTOs e autorização verificados.
- [ ] C — paginação e rolagem concluídas.
- [ ] D — detalhe, links e modal concluídos.
- [ ] E — estorno/cancelamento concluídos.
- [ ] F — semântica de devolução confirmada e implementada/testada, ou pendência explicitamente registrada.
- [ ] G — parcelas exatas, datas e rascunhos concluídos.
- [ ] H — resumo e tratamento de erros concluídos.
- [ ] I — regressões e documentação atualizadas.
- [ ] J — testes, build, integração e navegador registrados.

Em cada checkpoint anotar arquivos alterados, comando executado/resultado e próxima ação. Na entrega final, mapear os oito pontos da issue para implementado, pendente ou não validado, com motivo. Informar a decisão de devolução e eventuais migrations. Não fazer merge ou deploy automaticamente.

### Registro da execução

#### 2026-09-18 — execução parcial

- [x] A — Base `main` em `e1e5004`; branch criada: `feat/285-operacoes-rastreabilidade`. Foram preservados `.claude/worktrees/` e `AGENTS.md`, ambos não rastreados e fora do commit.
- [x] B — Histórico de liquidações é preservado no estorno; detalhe inclui movimentos, contas e reversões; as rotas de estorno exigem `lancar` e recebem escopo de propriedade. Build do servidor passou. Atomicidade em PostgreSQL está pendente por banco local indisponível.
- [x] C — Lista pagina 15 itens após filtros, com faixa, controles e seletor de página. `TabelaFinanceira` recebeu rolagem superior opt-in. Cobertura adicionada para 16 itens e salto de página.
- [x] D — Detalhe exibe contas/movimentos, links ao extrato e modal acionável de parcelas com valores e histórico. Escritas respeitam `podeLancar`, inclusive por acesso direto ao formulário.
- [x] E — Estorno de liquidação confirmada recarrega o detalhe e mantém seu histórico. O cancelamento continua transacional; o resumo detalhado e cenários em banco real ainda requerem validação.
- [ ] F — Pendente de decisão: “Devolução” em parcela paga é devolução de dinheiro, mercadoria ao fornecedor, ou ambos? O schema não permite inferir essa semântica com segurança.
- [x] G — `lib/parcelas.ts` gera valores em centavos e datas civis semanais/mensais; a UI permite gerar, editar e mostra total anotado/restante. A validação final de criação permanece no servidor.
- [x] H — Resumo ocupa a altura do formulário; falhas de confirmação aparecem junto ao botão com alerta e foco.
- [x] I — `COMPONENTS.md` documenta tabela financeira, rolagem opt-in e paginação da lista.
- [ ] J — Passaram testes focalizados (45), suite completa do servidor (1.346 testes; 2 ignorados), suite completa do client (538 testes), builds client/server e `git diff --check`. O client iniciou e respondeu HTTP 200; a automação de navegador não está disponível nesta sessão, portanto a inspeção em 720/1180/1440 px segue pendente. A integração financeira não rodou: PostgreSQL em `localhost:54332` recusou conexão e Docker não está disponível no WSL.
