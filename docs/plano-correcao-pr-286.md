# Plano de correção — PR #286 / issue #285

PR: https://github.com/somosvira/fazendinha/pull/286
Issue: https://github.com/somosvira/fazendinha/issues/285
Plano original: `docs/plano-execucao-issue-285.md`.

Preparado para execução sequencial por Terra, esforço medium. Base inspecionada: `565bcde`, branch `feat/285-operacoes-rastreabilidade`. Este documento contém planejamento; nenhuma correção de código nem nova validação funcional foi executada ao escrevê-lo.

## 1. Contrato de execução

- Continue na branch do PR #286, conferindo o head remoto antes de editar. Não abra outro PR para as mesmas correções. Preserve alterações alheias; no checkout inspecionado, `.claude/worktrees/` e `AGENTS.md` estavam não rastreados e devem continuar fora dos commits.
- Leia `AGENTS.md`, `CLAUDE.md`, este plano, o contrato financeiro e as seções pertinentes de `ARCHITECTURE.md`, `DOMAIN.md`, `DESIGN.md`, `COMPONENTS.md` e do schema antes de alterar código.
- Este plano complementa o inicial e corrige seu registro de conclusão. Os checkpoints B–I assinalados na execução anterior não significam que todos os critérios dessas fases foram atendidos.
- Execute C0–C8 em ordem. Uma pendência de ambiente ou a decisão de devolução não impede fases independentes. Registre exatamente o que ficou implementado, testado e pendente.
- Não reimplemente o que já atende: paginação básica, navegação para contas, preservação de `Liquidacao`, propagação de permissão e expansão vertical do resumo. Acrescente regressões relevantes e corrija somente os problemas encontrados.
- Não implemente #284 nem as telas próprias da #274. Alterações compartilhadas precisam de testes dos consumidores afetados.
- Não adicione bibliotecas de UI, cálculo ou roteamento. Backend usa Decimal/dinheiro; imports relativos terminam em `.js`. Client usa componentes existentes e `comPropriedade()` em requests.
- Cada etapa termina com validação focalizada e checkpoint. Não rode todas as suítes a cada alteração nem faça loops de investigação sem hipótese concreta.
- Ao executar as correções, commits e push para atualizar o PR existente estão no escopo já autorizado. Não fazer merge, deploy ou fechar a issue manualmente. Manter draft enquanto houver critério obrigatório pendente.

## 2. Problemas confirmados e resultado esperado

| ID | Problema atual | Resultado exigido |
| --- | --- | --- |
| R1 / P1 | Formulário soma itens com ponto flutuante e arredonda ao final; backend arredonda cada item com Decimal | Simulação, resumo e confirmação concordam em centavos, incluindo quantidades fracionadas |
| R2 / P1 | `gerar()` substitui imediatamente todas as parcelas; configuração só vive no filho | Personalizações preservadas, substituição confirmada e configuração restaurada do rascunho |
| R3 / P1 | Cancelamento usa contagens/totais que incluem transações já revertidas | Revisão individualizada dos efeitos elegíveis, pagamentos anteriores e impacto inverso por conta |
| R4 / P2 | Estorno por liquidação não bloqueia requests concorrentes na UI | Uma request por confirmação em curso, feedback de processamento e recuperação de erro |
| R5 / P2 | Compromisso cancelado apresenta o valor original como “Restante” exigível | Histórico intacto e cancelamento explícito, sem aparentar dívida ativa |
| R6 | Critérios do plano inicial foram marcados como concluídos sem implementação/validação completa | Checkpoints verificáveis, regressões financeiras e limitações documentadas |

Pendências adicionais ligadas ao aceite original: erro de cancelamento aparece atrás do modal; `ApiError.campo` é descartado; relações de reversão recebidas não são identificadas individualmente na UI; rolagem superior depende da barra nativa e usa largura mínima em vez da largura real; tipos de resposta confundem lista, detalhe e mutações. Tratar nas etapas abaixo sem ampliar o produto.

## 3. C0 — preparação e correção do registro de progresso

Inspeção limitada:

```bash
git status --short
git branch --show-current
git log -1 --oneline
gh pr view 286 --json headRefName,headRefOid,baseRefName,isDraft,body
gh issue view 285 --json body
git diff main...HEAD --stat
```

Leia os arquivos listados nas etapas seguintes, seus testes existentes e `server/scripts/qa-financeiro.mjs`. Não repetir pesquisas globais em todas as fases.

Atualize o registro de execução do plano original: preparação concluída; histórico/permissões implementados com validação incompleta; cancelamento, parcelamento, erros e aceite final parciais. Preserve o histórico, mas retire marcações que impliquem conclusão integral dessas fases. Acrescente referência a este plano.

**Saída:** branch/head e estado local registrados; cada problema R1–R6 mapeado a uma etapa. Não tomar o número total de testes anteriormente verdes como evidência dos fluxos novos.

## 4. C1 — cálculo monetário canônico e simulação de parcelas

Arquivos principais:

- `server/src/services/financeiro/operacoes.ts`, `schemas.ts`, `regras.ts`.
- Novos helpers puros `operacoes.calc.ts` e `parcelas.calc.ts`, com testes ao lado, se não houver equivalentes no head atual.
- `server/src/routes/financeiro.ts`.
- `client/src/financeiro/FormOperacao.tsx`, `novo-api.ts`, `lib/parcelas.ts`, `lib/parceiros.ts`.

### C1.1 — contrato de precisão

1. Extraia a regra monetária da criação para helper puro reutilizável: quantidade decimal × unitário decimal; `dinheiro()` por item; soma Decimal dos itens já arredondados. Preserve o comportamento atual da confirmação.
2. Simulação e criação devem chamar esse mesmo helper. Não copie a regra em dois serviços e não envie ao simulador um total já calculado com `number` no navegador.
3. Para valores digitados, aceite strings decimais validadas nos campos financeiros afetados; mantenha compatibilidade com payloads numéricos existentes. Não passar strings por `z.coerce.number()` antes de Decimal. IDs continuam com os tipos atuais.
4. Diferencie quantidade (escala do schema), unitário (escala do schema) e moeda (duas casas). Não reduza quantidade/unitário a centavos antes de multiplicar. Valide limites representáveis no banco e valores finitos.
5. O modo “valor total do item” precisa entrar no cálculo sem divisão em ponto flutuante no client. Use um discriminador/opção aditiva no payload de item, preservando o payload antigo. O backend normaliza quantidade, total e unitário com Decimal. Garanta que o valor monetário confirmado nesse modo seja o total informado e que o mesmo contrato seja usado pelo simulador. Não sobrescreva os campos de entrada durante uma simulação.
6. Confira todos os consumidores dos schemas/tipos alterados por busca dirigida. Adapte o mínimo necessário, incluindo rascunhos e sugestão de parceiro; não faça uma migração geral dos demais módulos.

### C1.2 — simulador sem escrita

Adicionar `POST /financeiro/operacoes/simulacao-parcelas` antes das rotas dinâmicas pertinentes, com gate financeiro/lancar e resolução do escopo. A request não cria operação, rascunho, movimento nem auditoria de escrita. O cálculo puro não precisa consultar o banco.

Contrato sugerido, fixado para esta execução:

- Entrada: itens monetários com modo, quantidade e unitário/total, ou valor total de serviço; condição a prazo/parcial; valor pago agora; quantidade de parcelas; frequência semanal/mensal; primeiro vencimento civil ISO.
- Saída: `totalOperacao`, `valorPagoAgora`, `saldoAPrazo` e valores por item como strings; `parcelas: { valor: string, vencimento: string }[]`.
- Use os valores brutos do formulário e a mesma normalização da confirmação. Não exigir conta/parceiro preenchidos apenas para simular valores.
- Personalizado é modo de edição da UI: não criar uma frequência de calendário indefinida no servidor.
- Validar quantidade inteira positiva. Definir limite técnico explícito de 360 parcelas no gerador, documentado e validado também no client; não limitar retroativamente rascunhos manuais existentes sem necessidade. Rejeitar quantidade maior que centavos disponíveis e datas civis inexistentes.
- Semanal: +7 dias por índice. Mensal: mês de destino e dia original limitado ao último dia do mês. Não propagar a redução de fevereiro para março.
- Dividir centavos com Decimal/inteiros exatos; sobras nas primeiras parcelas. Retornar mensagem e campo legíveis em erros de validação.

No client, substituir o motor monetário local pelo simulador. Helpers locais ficam responsáveis somente por parsing/soma/formatação exatos de valores já monetários, preferencialmente `bigint` internamente e strings no JSON. Campo inválido deve retornar erro de validação; não converter parcela inválida silenciosamente em zero.

O total do resumo, saldo futuro e validação das parcelas precisam usar o resultado canônico referente aos inputs atuais. Invalidar a simulação quando os inputs relevantes mudarem; impedir confirmação com resultado antigo ou request pendente. Conversão para `number` pode existir somente na apresentação, nunca para decidir igualdade/divisão/arredondamento financeiro.

**Testes mínimos e esperados:**

| Cenário | Resultado |
| --- | --- |
| Dois itens: quantidade `0.335` × unitário `1.00` cada | Total `0.68`, tanto na simulação como na confirmação |
| `100.00` em três parcelas | `33.34`, `33.33`, `33.33` |
| Total `100.00`, entrada `25.00`, três parcelas | Três de `25.00` |
| Item total `100.00`, quantidade `3` | Total informado preservado no modo total, sem deriva por divisão |
| 31/jan/2026 e 31/jan/2028, mensal | Fevereiro 28/29 e março 31 |
| Semanal atravessando dezembro | Datas do ano seguinte sem deslocamento de fuso |
| Entrada igual/maior que total, zero, negativo, quantidade fracionada, 361, data inexistente | Erro legível; nenhuma escrita |

**Checkpoint C1:** helpers compartilhados, rota, tipos e regressão que compara simulação/criação aprovados. Não concluir com testes apenas do rateio isolado.

## 5. C2 — personalização, requests obsoletas e rascunho

Arquivos: `FormOperacao.tsx`, `lib/parcelas.ts`, `lib/rascunho.ts` se necessário, `FormOperacao.test.tsx`; reutilizar `components/ConfirmDialog.tsx`.

1. Suba para `EstadoFormulario` a configuração do gerador: versão dos metadados, modo `GERADO | PERSONALIZADO`, quantidade, frequência, primeiro vencimento e a assinatura dos inputs usados na última geração aplicada. Persista em `dados.formulario` pelo autosave existente; não criar outra store nem migration.
2. Rascunho antigo com parcelas e sem metadados abre como personalizado. Operação de correção com parcelas também começa personalizada. Nunca substituir parcelas na montagem.
3. Campo/seletor explícito de modo personalizado. Editar valor, vencimento, adicionar ou remover parcela ativa esse modo. Não mudar o modo silenciosamente ao carregar dados.
4. Em modo gerado, alterações de total, entrada, quantidade, frequência ou primeiro vencimento atualizam a sugestão; antes da primeira aplicação, usar “Gerar parcelas”. Depois de aplicada uma geração, recalcular automaticamente somente enquanto continuar em modo gerado.
5. Em modo personalizado, preservar parcelas em todas essas mudanças. Atualizar apenas total/restante e validade. “Gerar parcelas” abre `ConfirmDialog` explicando a substituição. Cancelar preserva campos, valores, datas e modo. Confirmar aplica a sugestão atual e volta a gerado.
6. Use sequência/assinatura das requests para descartar respostas obsoletas. Se o usuário editar enquanto a simulação estiver em curso, a resposta não pode sobrescrever a edição. Mudanças durante o diálogo invalidam a sugestão anterior e exigem resultado atual antes de aplicar.
7. Exibir falha da simulação junto do gerador, manter dados e permitir nova tentativa. Evitar requests por render: dependências estáveis, debounce curto somente para inputs e cleanup. Trocar para à vista/sem efeito cancela/ignora resposta pendente e exclui parcelas do payload financeiro.
8. Mantenha “Total das parcelas anotadas”, “Restante para distribuir” e “Excedente” exatos. Zero, vazio, negativo, vencimento inválido, falta ou excesso impedem confirmação.
9. Sugestão do parceiro também exige a confirmação já existente e participa do estado personalizado/gerado; não deixar um caminho alternativo recalcular dinheiro com ponto flutuante.

**Testes:** gerar → editar → regerar/cancelar preserva tudo; confirmar substitui; resposta antiga não aplica; editar durante request preserva; mudar entrada em modo gerado redistribui somente saldo; modo personalizado só atualiza diferença; autosave/remontagem restaura semanal, quantidade, datas e modo; rascunho antigo não muda; geração inválida não perde parcelas.

**Checkpoint C2:** testes de comportamento, inclusive requests controladas por promises, aprovados. Testar restauração por remount com payload salvo, não somente presença dos novos campos no tipo.

## 6. C3 — compromissos cancelados e contrato real dos DTOs

Arquivos: `operacoes.ts`, novo `compromissos.calc.ts` se necessário, `novo-api.ts`, `OperacaoFinanceiraDetalhe.tsx`; confira consumidores de `saldoPendente`.

Decisão: preservar `saldoPendente = valorOriginal - valorLiquidado` como diferença aritmética histórica para não alterar silenciosamente todos os consumidores. Acrescentar campo derivado `saldoExigivel`: zero se CANCELADO; igual ao saldo pendente nos estados ativos. Campo derivado não exige migration.

1. Calcular valor liquidado apenas com transações confirmadas. Histórico mantém todas as liquidações. Não alterar o cálculo de saldo de conta, que considera movimento original mais inverso.
2. Expor os campos coerentemente em listagem de compromissos e detalhe de operação. No modal e na linha de parcela cancelada, mostrar “Cancelado — sem valor a pagar/receber”, status e restante exigível zero. Se mostrar diferença histórica, rotular explicitamente como valor cancelado, nunca como dívida.
3. Resumo de cancelamento usa somente compromissos ativos e saldo exigível. Estorno individual nunca deve reabrir um compromisso CANCELADO; adicionar guard de status ao recomputar.
4. Separar tipos de lista, detalhe e retorno de mutações na API client quando necessário. `Compromisso` do detalhe não inclui necessariamente `operacao`/`parceiro`; confirmação/estorno não retorna necessariamente movimentos com conta enriquecida. Não simular campos por `as never`, `any` ou opcionais usados sem tratamento. Tipar retorno mínimo quando só o ID for consumido e buscar o detalhe após mutação.

**Testes:** 100 pago 70 → liquidado 70, exigível 30; estorno individual → histórico preservado, exigível 100; cancelamento → exigível 0 e diferença histórica mantida; novo pagamento após estorno individual ignora original revertido; cancelado não reabre. Validar JSON/DTO além do cálculo puro.

## 7. C4 — revisão individualizada de cancelamento

Arquivos: `operacoes.ts`, helper puro sugerido `cancelamento.calc.ts`, `novo-api.ts`, `OperacaoFinanceiraDetalhe.tsx` e testes.

1. Criar `resumoCancelamento` derivado no detalhe, calculado no servidor com Decimal. Não persistir e não aceitar valores de impacto enviados pelo client.
2. Reutilizar os critérios de elegibilidade do comando real: transações originais CONFIRMADAS, sem reversão já vinculada; movimentos de estoque CONFIRMADOS que não sejam reversões nem tenham sido revertidos; compromissos não cancelados. Revalidar tudo dentro da transação de escrita, mesmo que a revisão seja anterior.
3. Incluir IDs e dados suficientes para listar: compromisso/parcela, estado, original/pago/exigível; transação original, data, tipo e valor; cada movimento com conta histórica e direção inversa; estoque com produto/quantidade/unidade quando disponíveis no modelo.
4. Deduplicar transações por ID ao combinar relações diretas e liquidações. Uma transferência conta como uma transação; exibir duas pontas de conta e impacto geral zero, sem chamar o dobro do valor de “pagamento”.
5. Agregar impacto inverso por conta: saída original gera entrada; entrada original gera saída. Os valores são strings monetárias; o client apenas formata.
6. Modal usa esse DTO e enumera efeitos antes da confirmação. Mostrar pagamentos já realizados, quais serão estornados, compromissos cancelados e estoque revertido. Documentos/histórico preservados continuam explícitos.
7. Erro de cancelamento fica dentro do modal junto ao botão; motivo é preservado. Se dados mudarem no servidor, exibir conflito e recarregar revisão antes de nova confirmação. Nunca fechar o modal como sucesso após uma rejeição.
8. Na leitura das transações, identificar a relação com original/reversão pelos IDs já retornados. Verificar no extrato descrição/motivo e link de retorno à operação; corrigir somente se estiver faltando.

**Teste decisivo:** operação a prazo 100, pagamento 70 estornado individualmente e novo pagamento 40. Revisão lista apenas o pagamento confirmado de 40 para estorno, compromisso com 60 exigíveis e entrada inversa de 40 na conta correta. Cancelar restaura o saldo e preserva ambas as liquidações.

Outros testes: transferência com duas contas; duas liquidações em contas distintas; estoque já revertido não entra; operação sem efeitos; erro por período fechado permanece visível no modal. Dados de resumo devem corresponder aos efeitos efetivamente escritos.

## 8. C5 — envio único de estorno, modal atualizado e erros de confirmação

Arquivos: `OperacaoFinanceiraDetalhe.tsx`, `FormOperacao.tsx`, `novo-api.ts`, `rascunhos.ts`, testes respectivos.

1. Adicionar `processando` ao estorno de liquidação e um guard síncrono (`useRef` ou equivalente) antes do primeiro `await`, para bloquear inclusive dois acionamentos no mesmo ciclo. Liberar no `finally`.
2. Durante request, desabilitar confirmação, motivo e fechamento/cancelamento; exibir “Estornando…”. Reutilizar confirmação acessível existente ou primitivas de diálogo existentes, com foco contido e ordem de sobreposição coerente.
3. Sucesso: recarregar detalhe e derivar a parcela aberta pelo ID, mantendo o histórico atualizado. Falha na recarga após escrita bem-sucedida é erro de atualização, não convite para repetir a escrita. Falha da escrita preserva motivo e mostra erro no próprio modal.
4. Backend continua responsável por unicidade e transação. Conferir que segunda reversão/conflito não gera outro movimento e retorna erro de domínio legível. O bloqueio de botão não substitui essa garantia.
5. Separar erro de confirmação de erro de autosave/anexo. Atualmente qualquer erro dispara foco no resumo; autosave falhando enquanto se digita não deve roubar foco. Apenas submissão falha deve focar o alerta junto à ação.
6. Preservar `ApiError.campo`; marcar o input existente com `aria-invalid`/`aria-describedby` e mensagem apropriada. Campo desconhecido mantém alerta geral. Em `rascunhos.ts`, converter o primeiro path Zod para um campo compreensível em vez de perder o path na conversão para `FinanceiroError`.
7. Antes de oferecer retry após timeout de confirmação, conferir o mecanismo atual de rascunho/resultado. Não recriar e reenviar automaticamente um rascunho ausente após resposta ambígua. Se o servidor não oferece vínculo suficiente para provar o resultado, apresentar estado de resultado desconhecido e permitir consulta à lista; não prometer idempotência nem selecionar uma operação por descrição/valor.

**Testes:** duas confirmações com promise pendente fazem uma chamada; sucesso atualiza histórico; rejeição reabilita e preserva motivo; fechamento bloqueado em curso; recarga falha não oferece segundo estorno; leitor sem `lancar` não vê ações; autosave falha sem mover foco; `ApiError.campo` destaca campo; falha atômica conserva rascunho; anexo falha após sucesso não reenvia operação.

## 9. C6 — completar lista/rolagem e regressões de navegação

Arquivos: `financeiro-ui.tsx`, `OperacoesFinanceiras.test.tsx`, `responsivo.test.tsx`, `ContasFinanceiras.test.tsx`, teste do detalhe.

1. Medir o `scrollWidth` real, não apenas soma de larguras mínimas. Manter dimensão da barra superior sincronizada com tabela/conteúdo, inclusive redimensionamento e sidebar. Cleanup dos observers/listeners e fallback sem `ResizeObserver` continuam necessários.
2. Fornecer indicação e botões “Rolar tabela para a esquerda/direita” quando houver overflow, habilitados conforme posição. Assim a rolagem permanece perceptível com barras nativas ocultas. Opt-in apenas na lista de operações; preservar cartões abaixo de 768 px.
3. Completar paginação com cenários 0, 1, 15, 16 e 31; filtro na página 3 retorna à 1; redução da última página limita índice; tabela/cartões recebem mesma fatia. Fixtures devem satisfazer tipos reais, sem `as never`.
4. Testar link para movimento de conta inativa/antigo, duas pontas de transferência, histórico revertido e retorno do extrato. Testar navegação real via router, não só string construída.

**Checkpoint C6:** testes focalizados aprovados. Não usar JSDOM para afirmar que largura, rolagem e altura estão visualmente corretas.

## 10. C7 — integração financeira e verificação visual

Depois dos testes focalizados de cada etapa, uma rodada completa:

```bash
pnpm --filter rionovo-server run test
pnpm --filter rionovo-client run test
pnpm build
git diff --check
```

Durante a implementação, exemplos de comandos focalizados (executar apenas quando os arquivos existirem):

```bash
pnpm --filter rionovo-server exec vitest run src/services/financeiro/operacoes.calc.test.ts src/services/financeiro/parcelas.calc.test.ts src/services/financeiro/cancelamento.calc.test.ts
pnpm --filter rionovo-client exec vitest run src/financeiro/FormOperacao.test.tsx src/financeiro/OperacaoFinanceiraDetalhe.test.tsx
pnpm --filter rionovo-client exec vitest run src/financeiro/OperacoesFinanceiras.test.tsx src/financeiro/ContasFinanceiras.test.tsx src/financeiro/responsivo.test.tsx
```

Integração: depois de ler o runner e confirmar banco local `fazendinha_local`, executar `pnpm --filter rionovo-server run test:financeiro:integration`. Nunca contornar o runner para apontar ao banco disponível no env. Não usar `dev:server` sem conferir destino: ele executa `db push`.

Acrescentar/reutilizar testes em `server/tests/financeiro/invariantes.test.ts`:

- Conta inicial 1.000; operação 100 a prazo; pagamento 70 → saldo 930; cancelamento → saldo 1.000, compromisso CANCELADO/exigível zero, liquidação preservada e uma reversão.
- Pagamento 70 → estorno → pagamento 40 → revisão/cancelamento corretos; transação antiga não recontada.
- Falha injetada depois de um efeito de reversão confirma rollback de dinheiro, estoque, compromissos, histórico e auditoria.
- Duas tentativas de estorno, inclusive concorrentes, deixam somente um inverso; rejeição de propriedade alheia e período atual fechado não escreve. Gate `lancar` deve ter teste HTTP, pois service isolado não demonstra autorização de rota.
- Simulação e confirmação reais concordam no exemplo fracionado e no modo total do item.

Se PostgreSQL/Docker continuarem indisponíveis, registrar comando, erro e “atomicidade não validada em banco real”; avançar nos demais checks. Não repetir tentativas sem mudança no ambiente.

Verificação visual: usar a skill de navegador aplicável e sua CLI. A falta de ferramenta MCP de browser não significa que a CLI esteja indisponível. Se precisar de fixtures de rede para renderizar a UI sem banco, registrá-las como simulação visual, nunca como integração real.

Validar 720, 1180 e 1440 px: 31 operações, sidebar aberta/recolhida, botões/barra superior, ausência de overflow da página, modal de liquidação/cancelamento, 12 parcelas, resumo longo e erro junto à confirmação. Registrar evidência e limitações; encerrar somente o servidor iniciado para essa verificação.

## 11. C8 — documentação e entrega do PR existente

1. Atualizar `COMPONENTS.md` (gerador, personalização, diálogos, rolagem), `ARCHITECTURE.md` (simulação sem escrita e resumo de cancelamento) e contrato/domínio somente onde o comportamento derivado exigir, em especial diferença histórica versus saldo exigível.
2. Corrigir checkpoints antigos com referência aos resultados reais. Não marcar fase completa com implementação parcial ou apenas testes de outro fluxo.
3. A decisão de devolução continua pendente. A pergunta já foi feita; conferir se houve resposta antes de repeti-la. Não inventar relação de devolução nem usar `corrigeOperacaoId`. A conclusão destas correções não resolve automaticamente esse critério da issue.
4. Revisar o diff, selecionar somente arquivos da tarefa, commitar em PT-BR e atualizar a branch do PR #286.
5. Reescrever descrição do PR em torno do comportamento final e das validações reais. O corpo atual contém `\\n` literais: usar arquivo temporário e `gh pr edit 286 --body-file <arquivo>` com quebras de linha reais. Não declarar que somente devolução está pendente se ainda houver testes/aceites não atendidos.
6. Preservar vínculo de fechamento `Closes #285`, mas manter draft enquanto houver critério obrigatório incompleto. Não fazer merge nem fechar a issue manualmente.

## 12. Checkpoints obrigatórios

Marcar `[x]` apenas quando implementação e validações da etapa estiverem atendidas. Caso contrário, manter `[ ]` e detalhar parcial/bloqueado. Esta seção deve ser atualizada pelo executor.

- [ ] C0 — head/base, alterações alheias e checkpoints antigos corrigidos.
- [ ] C1 — cálculo canônico, simulador e paridade com confirmação.
- [ ] C2 — personalização, confirmação de substituição e rascunho.
- [ ] C3 — cancelados sem dívida exigível e DTOs coerentes.
- [ ] C4 — revisão de cancelamento fiel aos efeitos reais.
- [ ] C5 — estorno com envio único, erros/foco e resultado ambíguo tratados.
- [ ] C6 — rolagem, paginação e navegação cobertas.
- [ ] C7 — suites, build, banco real e navegador registrados.
- [ ] C8 — documentação, commits e PR atualizados com pendências explícitas.

Formato do registro por etapa:

```text
Etapa / status:
Arquivos e comportamento alterados:
Comando de validação / resultado:
Evidência do cenário de regressão:
Pendências e motivo:
Próxima etapa:
```

### Estado inicial deste plano

Execução retomada em 2026-09-19 na branch `feat/285-operacoes-rastreabilidade`. Os resultados abaixo pertencem às correções locais desta execução.

### Registro de execução

- [x] C0 — Confirmada a branch do PR e preservados `AGENTS.md` e `.claude/worktrees/` não rastreados. O plano original foi corrigido para não declarar como completas fases que não tinham aceite integral.
- [x] C1 — Criado `parcelas.calc.ts`, usado tanto pela confirmação quanto por `POST /financeiro/operacoes/simulacao-parcelas`. Itens aceitam total ou unitário sem cálculo monetário no cliente; testes cobrem arredondamento por item e rateio civil mensal.
- [ ] C2 — Metadados do gerador passam a integrar o rascunho, edição torna o modo personalizado e a substituição pede confirmação. Pendente: teste controlado de resposta obsoleta e recálculo automático em modo gerado após alteração de entrada.
- [x] C3 — DTO acrescenta `saldoExigivel`; compromisso cancelado mantém diferença histórica, mas não é apresentado como dívida, e estorno individual não o reabre.
- [ ] C4 — O detalhe recebeu `resumoCancelamento` derivado no servidor e o modal enumera transações, contas e compromissos elegíveis. Pendente teste de integração com banco para a sequência pagamento → estorno → novo pagamento.
- [x] C5 — Estorno de liquidação tem guarda síncrona, estado de processamento e erro no modal. Erro de cancelamento permanece junto à confirmação; erro de confirmação do formulário foi separado do autosave.
- [x] C6 — Paginação e barra superior sincronizada já presentes no PR foram revisadas pelos testes focalizados de operações. Não houve alteração adicional nesta etapa.
- [ ] C7 — `pnpm --filter rionovo-server run test` passou (1.348 testes, 2 skipped), os testes focais do cliente passaram (25) e `pnpm build` passou. A integração financeira não iniciou porque `127.0.0.1:54332` recusou conexão; o runner limpou o schema temporário e preservou os dados locais. A aplicação Vite respondeu em `127.0.0.1:4173`, mas a CLI `agent-browser` não está instalada neste ambiente, portanto não houve inspeção visual automatizada.
- [ ] C8 — Este documento e o plano original foram atualizados. Commit, push e corpo do PR serão feitos somente depois das validações finais; PR permanece draft por pendências C2/C4/C7 e decisão de devolução.
