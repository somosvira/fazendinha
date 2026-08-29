# Notas — Rebanho > Sanidade + Produção-tanque

Untracked, rascunho de trabalho. Próxima fatia do rollout offline depois do
Corte (#235), conforme `docs/design/offline/OFFLINE_STRATEGY.md`.

Convenção: `[aberto]` = decisão pendente sua. `[ok]` = decidido/confirmado.
`[fechado]` = implementado.

---

## 1. Design do `aplicar` (fábrica `useOfflineMutation`)

**Resumo**: hoje a fábrica tem `queryKeys` (lista de `QueryKey`, todas recebem
o mesmo `op`/`match`/`criarOtimista`) + `queryKeysRelacionadas` (só invalida,
sem patch). Proposta: unificar num array só de entradas
`{ queryKey, aplicar? }` — cada entrada tem seu próprio JSDoc curto dizendo o
que aquela query representa — onde `aplicar: (atual: T | undefined) => T`
recebe o valor atual do cache e devolve o novo. Substitui `op`+`match`+
`criarOtimista` pra quem quer patch; `aplicar` ausente = comportamento antigo
do `queryKeysRelacionadas` (só invalida depois do sync). `data`/`atual` é
sempre anotado na mão no `aplicar` (`(data: SaldoDTO[]) => ...`) — sem
wrapper genérico. Helpers (`appendItemToCacheList`, `deleteItemFromCacheList`,
`mergeInCacheList` etc.) são funções **diretas**, não curried — recebem
`atual` (já tipado pela anotação) + os extras que precisarem, devolvem o
resultado na hora, chamadas de dentro do `aplicar`, iguais a `data.map(...)`.

### Decisões
- [ok] `op` só é relevante pra lógica otimista hoje — não aparece em `fila.ts`,
  não afeta a requisição real (`path`/`method`/`body` são independentes).
- [ok] Anotação manual (`aplicar: (data: SaldoDTO[]) => ...`) é o padrão —
  não precisa de wrapper (`entrada<T>()`) — só de um `interface`
  (`EntradaPatch<T>`) pra checar o formato do literal.
- [ok] Helpers são funções diretas, **não** curried/não devolvem função —
  `appendItemToCacheList<T>(atual: T[] | undefined, item: T): T[]`, chamado
  de dentro do `aplicar` já anotado (`data => appendItemToCacheList(data, item)`),
  em vez de `appendItemToCacheList(item)` devolvendo a função pronta. Mais
  simples de ler e testar isolado — o tipo já vem da anotação manual, não
  precisa que o helper monte a inferência sozinho.
- [ok] JSDoc curto (não verboso) em cada entrada da lista, explicando o que
  aquela `queryKey` representa — só isso, sem repetir o óbvio.
- [ok] "Só invalidar" (antigo `queryKeysRelacionadas`) vira a mesma lista
  com `aplicar` ausente.
- [ok] `aplicar` **nunca** devolve `undefined`, mesmo recebendo `atual:
  T | undefined` (queryKey nunca visitada offline — ver seção 2, discussão
  do exame de quarto). Regra: sempre normalizar `atual ?? VAZIO` como
  primeira linha, igual já é feito pra lista (`anterior ?? []`) — não é
  "inventar dado", é o estado honesto de "nada conhecido ainda". Bloquear a
  escrita nesse caso seria errado: a escrita tem efeito real (vai pra fila,
  cria linha no banco no sync) independente do que dá pra mostrar
  otimista. O tipo de retorno (`T`, sem união com `undefined`) força quem
  escreve `aplicar` a resolver isso, sem precisar inventar um caminho de
  bloqueio à parte.
- [ok] Helpers seguem a mesma regra — aceitam `T | undefined` na entrada,
  retorno sempre `T` (`appendItemToCacheList<T>(atual: T[] | undefined,
  item: T): T[]` já normaliza `atual ?? []` por dentro). Todo helper novo é
  obrigado a decidir seu próprio "vazio".
- [ok] Reconciliação de id temporário, **resolvido pra 1 item**: separar
  "criar o item" de "aplicar o item em cada query" — `criarOtimista` volta a
  ser um campo único, nomeado, fora da lista (igual hoje); cada `aplicar`
  recebe o item pronto como **2º argumento**, nunca gera o seu próprio:

  ```ts
  interface UseOfflineMutationConfig<TInput, TItem> {
    criarOtimista?: (input: TInput) => TItem;
    queryKeys: (input: TInput, itemOtimista: TItem | undefined) => EntradaPatch<any>[];
  }
  interface EntradaPatch<T> {
    queryKey: QueryKey;
    aplicar?: (atual: T, itemOtimista: TItem | undefined) => T;
  }
  ```

  Isso mata os dois problemas de uma vez: id não diverge entre entradas
  (`criarOtimista` roda uma vez só) e não tem ambiguidade de "quem criou"
  (é sempre esse campo, nunca escondido dentro de um `aplicar`). Id é um só,
  sempre registrado quando a escrita cria algo — sem distinção entre "id de
  exibição" e "id reconciliável" (registrar sem uso real depois é seguro e
  barato, o replace do `substituirIdNaFila` só não acha nada).
- [ok] Multiplicidade — **resolvido pra criação/aplicação**: `TItem` não
  precisa ser sempre array, é o tipo que a config declarar (objeto único ou
  array, conforme o caso — ver exemplo do exame de quarto). Nenhum `aplicar`
  precisa desembrulhar (`[0]`) nada — cada um já recebe o formato certo pro
  seu caso.
- [ok] **Adiado de propósito**: a etapa de *reescrita* (`substituirIdNaFila`
  trocar N pares temp→real, não só 1) e o pré-requisito dela (o servidor
  precisaria devolver os N ids reais correlacionados à ordem enviada — hoje
  `SaudeUbereDTO` não devolve isso). Sem consumidor real (nada referencia
  esses ids numa escrita seguinte, nem aqui nem no Corte) — fica só como
  comentário no código, no ponto onde a resolução de 1 id acontece hoje
  (`processarFila`/`substituirIdNaFila`), não como mecanismo a construir
  agora.
- [ok] Rollback com múltiplas entradas na mesma escrita — **não é
  problema**. O `catch` de hoje já desfaz todas as `snapshots` (`for (const
  {queryKey, anterior} of snapshots) ...`), funciona igual pra 1 ou N
  entradas sem nenhuma mudança.

---

## 2. Feature: Sanidade + Produção-tanque

### Grupo geral
- Read hooks a migrar pra `useQuery`: `useAnimais`, `useProdutos`,
  `useGrupos`/`listarGrupos`, `useProducao`.
- Schemas a mover pra `packages/shared`: `criarEventoSanitarioSchema` (union
  discriminada por `tipo`, 5 variantes), `producaoLoteSchema`.
- Recompute: invalidate-only (mesmo padrão do Corte) — `ResumoAnimal` via
  `recomputarSanidade`/`recomputarProducaoDoAnimal`.
- Ordenação por id em `agregarProducao` (`[grupoId asc, data desc, id desc]`)
  já coberta pela decisão de manter `Int autoincrement` — nada a fazer, só
  reconfirmar no teste.
- [aberto] `EventoForm.tsx` é compartilhado com Reprodução (577 linhas, um
  modal só pros dois domínios). Extrair `SanidadeForm` dedicado (recomendo)
  ou reusar o modal grande com Reprodução bloqueada offline?

### Sub-feature: Evento sanitário (Ocorrência / Aplicação / Exame / Mastite / Vacina)
- Tabela única `EventoSanitario`, campo `tipo` decide quais colunas importam.
- Escrita simples, `create` only — mesmo padrão do Corte > Sanidade
  (`ManejoForm`) uma vez migrado.
- Vínculo opcional com estoque (`produtoId`+`quantidadeUsada`) — ver
  sub-feature de movimentação abaixo.

### Sub-feature: Movimentação de estoque (baixa automática pela Sanidade)
- Quando `APLICACAO`/`VACINA` vincula `produtoId`, servidor cria
  `EventoSanitario`+`MovimentoEstoque` numa `$transaction` atômica — client
  faz **um** POST só, sem escrita dupla.
- `useSaldos` não tem patch hoje — vira `aplicar` de delta
  (`saldo -= quantidadeUsada`, `valor -= quantidadeUsada*custoUnitario`,
  dados já disponíveis via `useProdutos`) ou fica invalidate-only, dependendo
  de como fechar a seção 1.
- Não passa pela ponte financeiro (`gerarLancamento`) nem por
  `FechamentoMensal` — isso só existe pra **entrada** (compra); Sanidade só
  gera **saída**.
- [aberto] Caminho de estoque manual (`BaixaEstoqueCard` — produto digitado
  sem vincular, dispara um **segundo** POST separado via
  `registrarMovimento`, sem referenciar o evento por id) — bloquear offline
  (só libera o caminho com dropdown vinculado) ou é usado com frequência
  real no curral?

### Sub-feature: Exame de quarto (CMT — saúde do úbere)
- Tabela separada `ExameQuarto`, **não é** um dos 5 tipos de
  `EventoSanitario` — fluxo/tela própria.
- Escrita em lote: uma sessão de exame = 4 quartos (AE/AD/PE/PD) numa
  chamada só (`{ data, quartos: [...] }`).
- Leitura não é lista simples — é objeto agregado (`SaudeUbereDTO`) com
  estado derivado por quarto (`SADIO`/`ATIVO`/`CRONICO`/`PERDIDO`), calculado
  numa janela de 12 meses (`recomputarQuartos` — função pura, sem I/O).
- [ok] O design novo do `aplicar` resolve isso sem mecanismo extra — `T` não
  precisa ser lista (`aplicar: (atual: SaudeUbereDTO | undefined) => ...`,
  acrescenta os 4 itens de uma vez no corpo da função). Não é mais um
  problema de arquitetura.
- [ok] Decidido: opção **(b)** — `recomputarQuartos` é pura (recebe
  `exames`+`hoje`, sem I/O) e os dois já estão disponíveis no client sem
  fetch extra (`atual.exames` do cache + `HOJE.ts`). Mover pra
  `packages/shared`, chamar também no client pra montar `porQuarto`/
  `quartosCronicos`/`quartosPerdidos` do jeito otimista.
- [ok] Como o cálculo (mesmo correto) pode rodar em cima de uma base
  incompleta (`exames` do cache pode não refletir exame registrado por outro
  dispositivo/usuário enquanto este estava offline), o componente que exibe
  `porQuarto`/`quartosCronicos` precisa avisar, quando offline, que o
  cálculo é baseado na última carga online — não é garantia de estar 100%
  atualizado.
- [ok] `atual` pode ser `undefined` (animal nunca visitado offline) —
  `aplicar` normaliza com `VAZIO = { exames: [], ...recomputarQuartos([], HOJE) }`
  antes de aplicar os 4 itens novos, igual ao padrão geral da seção 1. A
  escrita continua liberada mesmo nesse caso (efeito real vai pra fila de
  qualquer jeito) — só o otimista fica mais pobre (calculado só a partir dos
  4 itens que acabaram de ser digitados, sem histórico prévio).
- [aberto] Essa fatia depende da feature `aplicar` (seção 1) — usuário vai
  detalhar depois por quê.

### Sub-feature: Produção (modo tanque/lote)
- Tela `ProducaoTab` → `LoteForm` (hoje 100% hand-rolled, nem usa o hook
  `useGrupos` que já existe — chama `listarGrupos()` direto).
- Config `producaoModo` (**default `ORDENHA`** no schema e no seed) decide
  qual UI renderiza. `TANQUE_LOTE` é o modo que o rollout chamou de
  "Produção-tanque".
- Recompute: `registrarProducaoLote` dispara `recomputarProducaoDoAnimal`
  pra cada vaca do grupo — invalidate-only.
- [aberto] Confirmar modo real da fazenda — se for `ORDENHA`, a prioridade
  muda pra `ControleForm` (registro por vaca, na ficha do animal), fora do
  que foi mapeado até aqui.

### Sub-feature: TanquesSection (qualidade CCS/CBT do tanque físico)
- Diferente de "Produção-tanque" (que é sobre volume) — isso é qualidade do
  leite do tanque de resfriamento (`registrarAnaliseTanque`).
- Não citado explicitamente no rollout (`OFFLINE_AREAS.md`/`OFFLINE_STRATEGY.md`).
- [aberto] Incluir nessa fatia ou deixar de fora?
