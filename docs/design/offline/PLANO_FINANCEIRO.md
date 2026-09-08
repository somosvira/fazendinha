# Offline — Financeiro

Plano da primeira fatia de feature sobre a fundação (`docs/design/offline/README.md`).
Registra o que entra, o que fica de fora e por quê, decidido **antes** de
implementar — e uma seção de decisões tomadas durante a implementação que não
estavam previstas aqui.

## Contexto

O Financeiro foi reconstruído do zero em `main` (`Operacao`/
`CompromissoFinanceiro`/`TransacaoFinanceira`/`MovimentoConta`/
`RascunhoOperacao` — ver `docs/financeiro-rebuild-contrato.md` e
`docs/handoff-design-novo-financeiro.md`) depois que a epic offline original
divergiu. `client/src/financeiro/novo-api.ts` está 100% no padrão antigo
(`fetch` cru, zero `useQuery`) — nada aqui foi tocado pela fundação ainda.

## Pré-requisito: `packages/shared` de volta

Recriado só com o necessário desta fatia (não uma cópia de tudo que a epic
original tinha):

- `operacaoSchema` (e schemas irmãos usados por escrita offline) movidos de
  `server/src/services/financeiro/schemas.ts` pra lá — fonte única de
  verdade Zod. O client pré-valida com o **mesmo** schema antes de
  enfileirar (convenção do README); o server importa de lá em vez de
  reimplementar.
- `preverEfeitosOperacao(input)` — a metade **pura** de `criarOperacaoTx`
  (`server/src/services/financeiro/operacoes.ts`): que efeitos nascem (itens,
  movimentos de estoque, compromissos, transação) a partir do `tipo` +
  `condicao`, sem tocar `tx.*`. Mesmo padrão do `rebanho.ponte.calc.ts`
  (`resolverLancamentoDaEntrada`). Dinheiro em `number` (não `Prisma.Decimal`
  — esse tipo não pode ir pro bundle do client), com arredondamento
  equivalente ao `dinheiro()` do server. O server passa a *chamar* essa
  função em vez de reimplementar inline — fecha de brinde o gap de teste
  (hoje não existe `operacoes.test.ts`).

## Prefixo de id otimista — dois tipos, dois prefixos

`lib/offline/useOfflineMutation.ts` já tem `criarIdTemporario()` /
`ID_TEMPORARIO_PREFIXO = "local:"`, elegível à reconciliação genérica da
fila (`substituirIdNaFila` — um id novo por mutation, referenciável por uma
escrita seguinte).

Uma `criarOperacao` com condição `A_PRAZO`/`PARCIAL` cria **N**
`CompromissoFinanceiro` de uma vez — não cabe no mecanismo de reconciliação
de 1 id (que resolveria só o id da própria Operação). Em vez de construir
reconciliação N-a-N sem nenhum caso de uso real pedindo isso, entra um
prefixo **separado**, deliberadamente **não elegível a reconciliação**:

```ts
export const ID_OTIMISTA_PREFIXO = "otimista:";
export function criarIdOtimista(): string { return `${ID_OTIMISTA_PREFIXO}${crypto.randomUUID()}`; }
export function idPendenteDeSync(id: string | number): boolean {
  return typeof id === "string" && (id.startsWith(ID_TEMPORARIO_PREFIXO) || id.startsWith(ID_OTIMISTA_PREFIXO));
}
```

`fila.ts` não muda — só conhece `local:`, então `otimista:` fica fora do
mecanismo automaticamente. Qualquer ação que dependa de id real (ex.:
"Liquidar" um compromisso) fica desabilitada via `idPendenteDeSync()`
enquanto o id for de um dos dois prefixos.

## O que ganha suporte offline, e o patch de cada efeito colateral

**`criarOperacao` (Nova operação)** — cobre os 9 tipos alcançáveis pelo
`FormOperacao` hoje (`COMPRA_ESTOQUE`, `COMPRA_CONSUMO_DIRETO`, `SERVICO`,
`VENDA`, `AJUSTE_ESTOQUE`, `INVENTARIO_INICIAL`, `BONIFICACAO`, `DEVOLUCAO`,
`PRODUCAO`):
- `ItemOperacao` (N) — embutido no otimista da Operação.
- `MovimentoEstoque` (0..N) — embutido no otimista da Operação; sem cache
  próprio (nenhuma tela financeira lista isso separado).
- `CompromissoFinanceiro` (0..N) — patch otimista na lista de Compromissos,
  id `otimista:`.
- `TransacaoFinanceira`+`MovimentoConta` (0 ou 1) — patch otimista no
  extrato da conta, se estiver em cache.
- Dashboard e saldo agregado de Conta: **sempre invalidate-only** (somas do
  servidor, não patcháveis sem duplicar a conta).

**`liquidarCompromisso`**
- Atualiza um `CompromissoFinanceiro` **já existente** (id real) — patch
  in-place na lista de Compromissos, fórmula determinística
  (`saldo zerou? LIQUIDADO : PARCIAL`).
- `TransacaoFinanceira`+`MovimentoConta` (1) — patch no extrato, se em cache.
- `Liquidacao` — sem cache próprio.

**`transferir`**
- `Operacao` (1, tipo fixo, sem itens) — patch na lista de Operações.
- `TransacaoFinanceira` (1) + `MovimentoConta` (2) — patch no extrato das
  duas contas, se em cache.

## O desvio do rascunho offline

`RascunhoOperacao` é autosave no **servidor** (`FormOperacao.tsx` dispara
`PUT /financeiro/operacoes/rascunho` a cada 800ms de digitação). Decisão:

- Offline, o autosave **pausa** — o estado do formulário continua vivo em
  memória React (não persiste em IndexedDB; se a aba fechar offline no meio
  do preenchimento, o rascunho se perde — limitação aceita e avisada, não
  escondida).
- Banner visível quando `!online`: autosave desligado, não fechar a aba.
- "Confirmar operação" offline **pula o rascunho inteiro** e enfileira
  direto `POST /financeiro/operacoes` — o mesmo caminho que a correção
  (`operacaoBase` setado) já usa hoje sem rascunho, mesma mutation de
  `criarOperacao` acima.
- Upload de documento fica bloqueado offline — anexa depois, já
  sincronizado.

## `TABS_OFFLINE` — ordem de desbloqueio

`dashboard`/`relatorio` (só leitura) → `gastos` (liquidar) → `caixinha`
(transferir) → `lancar` (Operações) **por último**, só depois do desvio do
rascunho estar pronto — não faz sentido destravar a aba principal com o
autosave ainda quebrando offline.

## Fora de escopo desta fatia, e por quê

- **Anexo de documento na fila** — exige ensinar `fila.ts` a guardar `Blob`,
  hoje só serializa `path/method/body` como JSON. Peça de infra nova, não
  cobertura.
- **`cadastros` (CRUD de conta/parceiro)** — baixa utilidade offline
  (trabalho de escritório), mesmo critério que a epic original usou pra
  excluir telas administrativas.
- **`estornarOperacao`/`estornarTransacao`** — no máximo um patch leve de
  `status: CANCELADA` na Operação; as N reversões (transação/estoque/
  compromisso) não valem a complexidade de reproduzir otimisticamente pra
  uma ação que normalmente não é feita no campo, sem sinal, com urgência.
- **`TRANSFERENCIA_ESTOQUE`, `APORTE`, `RETIRADA`, `estornarTransacao`
  avulsa** — sem UI/consumidor no client hoje (confirmado lendo
  `novo-api.ts` e todas as telas) — nada a cobrir offline porque nada
  alcança esse código hoje.
- **Fechamento de período (`PeriodoFinanceiro`)** — não existe rota pra
  isso ainda; `exigirPeriodoAberto` nunca bloqueia na prática hoje. Fora de
  escopo por não existir, não por decisão offline.
- **Reconciliação de id cross-mutation pra sub-entidades** (liquidar uma
  parcela recém-criada offline, ainda offline) — só entra se algum dia
  virar pedido real; hoje a ação fica bloqueada via `idPendenteDeSync()`.

## Decisões de implementação não planejadas

_(Preenchido durante a implementação — decisões tomadas no código que não
estavam detalhadas acima.)_
