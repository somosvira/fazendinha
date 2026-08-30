# Notas — Rebanho > Sanidade + Produção

Rascunho de trabalho. Próxima fatia do rollout offline depois do Corte
(#235), conforme `docs/design/offline/OFFLINE_STRATEGY.md`.

Convenção: `[aberto]` = decisão pendente sua. `[ok]` = decidido/confirmado.
`[fechado]` = implementado.

**Status**: implementado na branch `offline/rebanho-sanidade-producao`. As
3 sub-features de escrita estão `[fechado]` — testadas com suíte
automatizada e manualmente no navegador com rede offline real (CDP
`Network.emulateNetworkConditions`). Exame de quarto e Produção nunca
tiveram editar/excluir em lugar nenhum do app, então create é 100% da
feature nos dois casos. **Evento sanitário tem create+editar+excluir
offline** (achado numa revisão pós-#237: a primeira versão só cobria
create — ver "Convenção obrigatória: cobrir toda operação da feature, não
só create" em `OFFLINE_STRATEGY.md`). Editar reusa `montarPayloadSanidade`
e o mesmo `useSalvarOffline`; a timeline recebe um patch otimista real
(`updateItemInCacheList`), mas saldo/movimentos de estoque ficam
invalidate-only no editar (trocar produtoId/quantidade num evento já
existente exigiria conhecer o vínculo anterior pra reverter+reaplicar —
não valeu a complexidade extra; corrige no refetch pós-sync). Excluir
devolve a quantidade consumida ao saldo do produto na hora (dado já vem no
`dadosEdicao` da timeline, sem precisar reconsultar nada) e remove o
evento da timeline; o movimento de estoque vinculado só some da lista
depois do sync (sem id client-side pra removê-lo antes). Desvios do que
estava planejado nesta página, descobertos durante a implementação:
- `EventoForm.tsx` foi dividido em `EventoForm.sanidade.tsx` (campos +
  `montarPayloadSanidade` + hook de escrita), mas não virou um modal
  `SanidadeForm` independente — o modal único Reprodução+Sanidade (com
  troca de domínio inline) continua o mesmo, só a apresentação e a escrita
  de Sanidade saíram do arquivo.
- `useAnimais`/`useGrupos`/`useProducao` (agregado) **não** foram migrados
  pra `useQuery` — não alimentam nenhuma das 3 escritas cobertas, só
  `useAnimal` (singular), `useTimeline`, `useSaudeUbere`, `useProdutos`,
  `useSaldos`/`useMovimentos` migraram de verdade.
- `producaoLoteSchema` **não** foi movido pra `packages/shared` (só
  `criarEventoSanitarioSchema`, `registrarExameQuartoSchema`,
  `controleSchema`) — modo `TANQUE_LOTE` segue fora de escopo.
- Achado extra corrigido nesta mesma branch: `BaixaEstoqueCard` era código
  morto (ver sub-feature de estoque abaixo) — removido, junto com um bug
  de UX real no `EventoForm` (produto do estoque não era exigido no
  client, resultando em 400 sem explicação).
- Achado extra corrigido: `reb-animal` não estava em `TABS_OFFLINE`
  (`App.tsx`) — a feature inteira ficava inalcançável offline sem essa
  entrada. Indicador de "N pendente(s)" adicionado ao `AnimalCockpit`
  (mesmo padrão do `PesagemTab` do Corte).

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

## 2. Feature: Sanidade + Produção

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
- [ok] `EventoForm.tsx` é compartilhado com Reprodução (577 linhas, um
  modal só pros dois domínios) — **decidido: extrair `SanidadeForm`
  dedicado**, menor, só com os campos de Sanidade. Segue o padrão já usado
  no Corte (`ManejoForm` é próprio, não compartilhado com Reprodução).
- [ok] `producaoModo` só afeta a sub-feature Produção (qual tela grava o
  volume de leite). Evento sanitário, Exame de quarto e Movimentação de
  estoque são inteiramente independentes dele — mesma tabela, mesmo fluxo,
  não importa o modo da fazenda.

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
- `EstoqueTab.tsx` lê duas caches diferentes pro mesmo `MovimentoEstoque`
  novo — cada uma com o formato de `aplicar` certo pro seu caso:
  - `useSaldos` (`SaldoDTO[]`, agregado por produto) — `aplicar` de
    **delta** num item **já existente** (`saldo -= quantidadeUsada`,
    `valor -= quantidadeUsada*custoUnitario`), casado por `produtoId` (já
    conhecido, não gerado agora). Não precisa de `criarOtimista`/id
    temporário pra essa entrada — não é um item novo na lista, é uma
    correção num que já está lá.
  - `useMovimentos`/`listarMovimentos` (`MovimentoDTO[]`, extrato completo)
    — item novo na lista, precisa de `id: criarIdTemporario()` +
    `appendItemToCacheList` só como React key (não é o `idTemporarioGerado`
    da mutation — quem reconcilia é o `EventoTimeline` da Sanidade, que é
    o `criarOtimista` desta config). **Esse item de movimento NÃO é
    reconciliado com o id real** — fica com id temporário até o
    `invalidateQueries` pós-sync trazer a lista real do servidor e
    substituir a linha inteira. Sem problema prático: `excluirMovimento`
    já bloqueia server-side qualquer exclusão de movimento com
    `origem === "SANIDADE"` (`estoque.ts:184-185`, regra de negócio
    preexistente, nada a ver com offline) — ninguém consegue (nem devia)
    excluir essa linha antes do sync de qualquer forma, então não ter
    reconciliação de id aqui não é uma lacuna real.
- Não passa pela ponte financeiro (`gerarLancamento`) nem por
  `FechamentoMensal` — isso só existe pra **entrada** (compra); Sanidade só
  gera **saída**.
- [fechado] `BaixaEstoqueCard` — **achado durante esta fatia: código morto,
  não é uma decisão de escopo**. O schema do servidor
  (`eventos-sanidade.schemas.ts:5`, desde o commit `9a81458` "integra eventos
  sanitarios ao estoque") tornou `produtoId`+`quantidadeUsada` **obrigatórios**
  em toda `APLICACAO`/`VACINA` — mas `EventoForm.tsx:239` só abre o
  `BaixaEstoqueCard` quando `usaEstoque` é **falso** (ou seja, quando
  `produtoId` NÃO foi enviado). Como `registrarEventoSanidade` já lança 400
  antes de chegar nessa linha nesse caso, o branch nunca é alcançado —
  `BaixaEstoqueCard` não tem nenhum outro caller no repo (só esse). Não é
  possível hoje, nem online, "digitar produto sem vincular ao estoque" pra
  Aplicação/Vacina — o campo de texto livre "Produto\*" é puramente
  decorativo (o próprio código já copia o nome do produto do dropdown pra
  ele, `EventoForm.tsx:536,563`); não existe (nunca existiu) lógica de
  "criar produto no estoque a partir do texto digitado" — `registrarSanidade`
  (`eventos-sanidade.ts:41-42`) só faz `produto.findUnique` e lança erro se
  não achar.
  **Decidido: cleanup faz parte desta fatia** (bug de UX real, não é
  offline, mas gate a decisão de escopo desta sub-feature) — nesta mesma
  branch: tirar o campo de texto livre "Produto" pra Aplicação/Vacina,
  tornar "Produto do estoque" obrigatório de fato no client (bloquear
  "Salvar" antes do POST, no padrão que `MovimentoForm.tsx:46-47` já usa),
  apagar o branch morto (`baixaCtx`/`setBaixaCtx`, linhas 238-249 e
  275-289) e apagar `BaixaEstoqueCard.tsx` inteiro (sem caller depois do
  cleanup). Resultado: a baixa de estoque ligada à Sanidade fica 100%
  coberta pelo POST único e atômico de `registrarEventoSanidade` — não
  sobra nenhuma escrita separada de estoque pra cobrir offline nesta
  sub-feature (o `useSaldos`/`useMovimentos` de `EstoqueTab.tsx` ainda
  precisam de `aplicar` pra refletir esse `MovimentoEstoque` criado de
  tabela, mas isso é leitura/patch de cache reagindo a uma escrita já
  coberta pela config da Sanidade — não é uma segunda mutation).
- [aberto, fora de escopo] **Caso anotado pra depois, fora desta fatia**:
  existe um `MovimentoForm.tsx` genérico (botão "+ Novo movimento" em
  `EstoqueTab.tsx:265`), independente de qualquer evento — e dentro dele um
  "+ novo produto" (`ProdutoForm.tsx`) que cria um `Produto` novo e
  recarrega o dropdown já selecionando o criado
  (`MovimentoForm.tsx:177-182`). Nenhum dos dois está no escopo desta fatia
  (não é Sanidade/Produção/Exame de quarto) — mas registrando aqui pra não
  perder: se um dia `useProdutos` virar `useQuery` (é o caso já, nesta
  fatia, mas só leitura) e a criação de produto for coberta por
  `useOfflineMutation` com um `aplicar` que faz `appendItemToCacheList`, o
  produto novo (id temporário) apareceria no dropdown do `MovimentoForm` na
  hora, ainda offline — é o valor real do `aplicar` vs. invalidate-only.
  Só que se o usuário then **selecionar esse produto recém-criado e
  submeter um movimento pra ele**, ainda offline, isso encadeia duas
  escritas na fila: create Produto (id temporário) → create Movimento
  referenciando esse id — o mesmo tipo de dependência de
  `substituirIdNaFila` do caso create+delete acima, só que create→create.
  **Pegadinha a mais aqui que o caso do `MovimentoDTO.id` não tem**:
  `produtoId` no schema do servidor é `z.number().int()` **sem coerção**
  (`estoque.ts:22`), e `substituirIdNaFila`/`substituir` (`fila.ts:144-155`)
  faz troca **string→string** (`idReal = String(resposta.id)`) — o corpo
  reescrito chegaria com `produtoId: "77"` (string), que um `z.number()`
  estrito rejeita. Pra esse encadeamento funcionar de verdade precisaria de
  `z.coerce.number()` (ou equivalente) nesse campo — não existe hoje. Não é
  bloqueio de nada, só fica anotado: se essa escrita (criar produto) entrar
  em escopo numa fatia futura, essa reconciliação precisa desse ajuste de
  schema antes de funcionar.

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
- [ok] A dependência da feature `aplicar` (seção 1) caiu — implementada no
  [PR #236](https://github.com/piubellofelipe/fazendinha/pull/236),
  `aplicar` já suporta cache-objeto-agregado (não-lista) sem mecanismo
  extra. Nada bloqueado aqui.

### Sub-feature: Produção (modo tanque/lote vs. por vaca)
- `producaoModo` (`Configuracao.producaoModo`, enum `ORDENHA | TOTAL_DIARIO
  | TANQUE_LOTE`) é um **toggle único pra fazenda inteira** (não por
  evento nem por animal) — decide qual das duas telas é a usada de
  verdade:
  - `ORDENHA`/`TOTAL_DIARIO` → `ControleForm` (modal por vaca, na ficha do
    animal) grava em `ControleLeiteiro` (peso1/2/3 por ordenha, ou
    pesoTotal).
  - `TANQUE_LOTE` → o `LoteForm` embutido em `ProducaoTab.tsx` (grupo/tanque
    + litros do dia) grava em `ProducaoLote`, com rateio por vaca depois.
  Schema default é `ORDENHA`; o rollout chamou essa fatia de
  "Produção-tanque" assumindo `TANQUE_LOTE`.
- Endpoints — **tabela e rota são diferentes por modo**, só a leitura
  agregada é compartilhada:
  - `ORDENHA`: `POST /rebanho/animais/:id/producao` (`registrarControle`) +
    `DELETE /rebanho/producao/:id` (`excluirControle`) → grava em
    `ControleLeiteiro`. **É esse par que essa fatia cobre offline.**
  - `TANQUE_LOTE`: `POST /rebanho/producao-lote` (`registrarProducaoLote`) +
    `DELETE /rebanho/producao-lote/:id` (`excluirProducaoLote`) → grava em
    `ProducaoLote`. Fora de escopo (modo não usado na Rio Novo).
  - Compartilhado pelos dois: `GET /rebanho/producao` (`agregarProducao`,
    formato de resposta muda por modo — ver acima) e o recompute
    (`recomputarProducaoDoAnimal`), que escreve no mesmo `ResumoAnimal`
    pros dois, só com fórmula diferente por dentro.
- [ok] **Confirmado por dado real**: `server/prisma/rebanho_real.json` (a
  importação real da Rio Novo, mesmo padrão do `rio_novo.json`
  financeiro) tem **1.722 linhas em `controles`** (formato
  `numero+data+peso1/2/3+pesoTotal` — exatamente `ControleLeiteiro`,
  por vaca) e **nenhuma** linha de produção por lote/tanque em lugar
  nenhum do arquivo. A fazenda usa `ORDENHA` de verdade — a tela
  prioritária é `ControleForm` (por vaca), não `ProducaoTab`→`LoteForm`
  (tanque/lote). Precisa remapear essa sub-feature em cima de
  `ControleForm` antes de implementar — o que foi escrito acima sobre
  `LoteForm`/`ProducaoLote` fica só como referência de um modo que a
  fazenda não usa hoje.
- Recompute: tanto `registrarControle` quanto `registrarProducaoLote`
  disparam `recomputarProducaoDoAnimal` — invalidate-only, independente do
  modo.
- [ok] `producaoModo` **não é só UI** — muda a lógica de cálculo no
  servidor (`server/src/services/rebanho/producao.ts:23-53,96-145`):
  em `ORDENHA`, `producaoMediaDia` vem direto do `ControleLeiteiro` do
  próprio animal (medição real); em `TANQUE_LOTE`, vem de **rateio**
  (`litros do grupo ÷ vacas em lactação do grupo` — estimativa, não
  medição por vaca). `agregarProducao` também devolve formato diferente
  por modo (`lotes` agregados vs. `ranking` por vaca) — e o cálculo de
  **carência** (janela de leite não vendável após aplicação com
  `carencia > 0`) só roda no branch não-tanque; `TANQUE_LOTE` não tem
  carência por vaca nenhuma hoje. Reforça que `ORDENHA` (confirmado pelo
  dado real acima) é o modo certo pra essa fatia — em `TANQUE_LOTE`
  faltaria construir a carência do zero, fora do que foi mapeado aqui.
