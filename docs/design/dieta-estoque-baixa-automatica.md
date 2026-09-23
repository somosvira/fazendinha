# Design — Dieta ↔ Estoque com baixa automática (TODO #1)

**Status:** proposta para aprovação. Nada implementado.
**Escopo:** dar composição de produtos à `Dieta`, gerar consumo esperado por lote e baixar do estoque automaticamente, refletindo no custo de produção já existente.
**Lente de revenda:** tudo configurável; fazenda que não usa nutrição por lote simplesmente não cadastra `DietaItem` e nada muda.

---

## 1. Contexto e objetivo

Hoje a cadeia nutrição→estoque→custo está **meio conectada**:

- `Dieta` (schema `Dieta`) só guarda macros: `pb` (% proteína bruta) e `edMcal` (energia). **Não existe composição** — não dá pra saber quantos kg de milho/farelo/mineral uma dieta consome.
- `Grupo` (o "lote") já tem `dietaId?`, `animais Animal[]` e `movimentosEstoque MovimentoEstoque[]`. `Animal.grupoId?` liga a cabeça ao lote; `Animal.status` (`ATIVO`/`BAIXADO`) diz quem está ativo.
- `MovimentoEstoque` já suporta `tipo=SAIDA` com `grupoId`, e o custo de produção **já lê essas saídas**: `calcularCustoVacaDia()` (`server/src/services/estoque/estoque.ts`) soma `movimentoEstoque` `tipo:"SAIDA"` no período ÷ (vacas × dias), e `agregarCustoProducao()` (`server/src/services/rebanho/custo-producao.ts`) usa esse número.

O elo que falta: **ninguém gera a SAIDA de consumo automaticamente**. Hoje ela seria digitada à mão (via `registrarMovimento`). O objetivo é: dada a composição da dieta × cabeças ativas × dias, o sistema calcula o consumo esperado e grava as SAIDAs — sem redigitação, e alimentando o custo/vaca-dia que já existe.

**Objetivo mensurável:** fechar um período (ex.: mês) de um lote e ver o estoque baixar e o custo/litro subir, sem lançar movimento a mão.

---

## 2. Modelo de dados proposto

### 2.1 `DietaItem` — a composição que falta (NOVO)

```prisma
// PROPOSTO — composição de uma dieta: quanto de cada produto por cabeça/dia.
model DietaItem {
  id              Int     @id @default(autoincrement())
  dieta           Dieta   @relation(fields: [dietaId], references: [id], onDelete: Cascade)
  dietaId         Int
  produto         Produto @relation(fields: [produtoId], references: [id])
  produtoId       Int
  // Quantidade por cabeça por dia, na unidade abaixo (default = Produto.unidade).
  qtdPorCabecaDia Decimal @db.Decimal(12, 4)
  unidade         String  // "kg", "g", "L" — informativa; conversão fica no serviço
  ordem           Int     @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([dietaId, produtoId])
}
```

Relações inversas a adicionar (NOVO, campos em models existentes):

```prisma
model Dieta   { /* … */ itens    DietaItem[] }   // + no model Dieta existente
model Produto { /* … */ dietaItens DietaItem[] } // + no model Produto existente
```

Decisão de unidade: `Decimal(12,4)` cobre gramas de mineral (ex.: `0.1200 kg`) sem perder precisão. A unidade é texto livre por simetria com `Produto.unidade` e `Suplementacao.consumoCabecaDiaG` (o corte já usa "g/cab/dia"). A conversão unidade-da-dieta → unidade-de-estoque fica no serviço (ver §5, decisão em aberto).

### 2.2 Marcar a origem do movimento (NOVO — campo + enum)

`MovimentoEstoque` **não tem** campo de origem hoje (só `observacao String?`). Para distinguir a SAIDA de consumo automático de uma SAIDA manual/perda — e para conseguir reprocessar/estornar um período — proponho espelhar o padrão que o cultivo já usa (`MovimentoSilo.origem OrigemMovimentoSilo`):

```prisma
// PROPOSTO — espelha OrigemMovimentoSilo (que já existe no módulo cultivo).
enum OrigemMovimentoEstoque {
  MANUAL      // digitado à mão (default → comportamento atual)
  NUTRICAO    // baixa gerada pelo motor de consumo de dieta
  PERDA
  AJUSTE_INVENTARIO
}

model MovimentoEstoque {
  // … campos existentes …
  origem              OrigemMovimentoEstoque @default(MANUAL) // PROPOSTO
  consumoPeriodo      ConsumoPeriodo? @relation(fields: [consumoPeriodoId], references: [id]) // PROPOSTO
  consumoPeriodoId    Int?                                                                     // PROPOSTO
}
```

`@default(MANUAL)` garante que todas as linhas atuais e todo o fluxo de `registrarMovimento` continuam idênticos — não quebra nada.

### 2.3 `ConsumoPeriodo` — idempotência e estorno (NOVO)

O "fechar consumo do período" precisa ser idempotente (rodar 2× não duplica baixa) e reversível (reabrir mês → apagar as SAIDAs geradas). Um registro-cabeçalho por (lote, período) resolve os dois:

```prisma
// PROPOSTO — um fechamento de consumo por lote por período.
model ConsumoPeriodo {
  id           Int      @id @default(autoincrement())
  grupo        Grupo    @relation(fields: [grupoId], references: [id])
  grupoId      Int
  dieta        Dieta?   @relation(fields: [dietaId], references: [id]) // snapshot de qual dieta valia
  dietaId      Int?
  dataInicio   DateTime @db.Date
  dataFim      DateTime @db.Date
  numCabecas   Int      // média/efetivo usado no cálculo (auditoria)
  diasBase     Int      // dias do período (auditoria)
  custoTotal   Decimal  @db.Decimal(14, 2) // soma das SAIDAs geradas
  observacao   String?
  movimentos   MovimentoEstoque[] // as SAIDAs geradas por este fechamento
  criadoEm     DateTime @default(now())

  @@unique([grupoId, dataInicio, dataFim]) // idempotência: mesmo lote+janela não fecha 2×
  @@index([grupoId])
}
```

Relação inversa em `Grupo` e `Dieta` (NOVO): `consumosPeriodo ConsumoPeriodo[]`.

**Por que um cabeçalho e não só uma flag na SAIDA?** Porque o consumo de um período gera N SAIDAs (uma por produto da dieta). Agrupá-las sob um `ConsumoPeriodo` dá: (a) unique key de idempotência, (b) desfazer o período inteiro numa transação, (c) auditoria do que valia (cabeças, dias, dieta) no momento do fechamento.

---

## 3. Motor de consumo (serviço puro + service Prisma)

Espelhar a arquitetura já usada no rebanho: **motor puro testável** (como `estoque.calc.ts` / `custo-producao.ts` `quebrarPorCategoria`) + **service** que persiste.

### 3.1 Motor puro (`nutricao.consumo.calc.ts`, NOVO — TDD)

```
consumoEsperado(itens: {produtoId, qtdPorCabecaDia}[], numCabecas, dias)
  → Array<{ produtoId, quantidade }>   // quantidade = qtd × cabeças × dias
```

Sem Prisma, sem datas — puro aritmético, fácil de testar (segue o padrão de `saldoProduto`/`custoVacaDia`).

### 3.2 Nº de cabeças no período (regra a decidir — ver §6)

O motor recebe `numCabecas` já resolvido. Como resolvê-lo é a decisão de maior peso:

- **v1 (simples):** cabeças ativas do lote **no momento do fechamento** (`prisma.animal.count({ where: { grupoId, status: "ATIVO" } })`). Barato, ignora entradas/saídas no meio do período.
- **v2 (preciso):** cabeças-dia = Σ dias que cada animal esteve no lote na janela. Exige histórico de entrada/saída do lote que **hoje não existe** (`Animal.grupoId` é estado atual, sem log). Ver risco em §7.

Recomendo v1 na primeira fatia e deixar v2 como evolução (depende de um log de movimentação de lote, fora deste escopo).

### 3.3 Service (`fecharConsumoPeriodo`, NOVO)

```
fecharConsumoPeriodo({ grupoId, dataInicio, dataFim }):
  1. carrega Grupo + dieta + itens (erro claro se dieta sem itens)
  2. numCabecas = count(animais ATIVO do grupo)   // v1
  3. dias = dataFim - dataInicio + 1
  4. para cada DietaItem: quantidade = qtd × cabeças × dias
  5. transação:
     a. assertMesAberto(dataFim)  // reusa server/src/services/fechamento.ts
     b. cria ConsumoPeriodo (unique (grupoId,dataInicio,dataFim) → P2002 = já fechado)
     c. para cada produto: cria MovimentoEstoque
        { tipo: SAIDA, origem: NUTRICAO, grupoId, produtoId, quantidade,
          custoUnitario: produto.custoUnitario ?? 0, valorTotal: qtd × custo,
          consumoPeriodoId, data: dataFim }
     d. custoTotal = Σ valorTotal → grava no ConsumoPeriodo
```

**Reuso máximo:** o cálculo de `valorTotal` (`Decimal.mul(...).toDecimalPlaces(2)`) e o custo unitário (`produto.custoUnitario ?? 0`) já vivem em `registrarMovimento` — extrair helper e reusar, ou chamar `registrarMovimento` em loop passando `gerarLancamento:false` (a SAIDA de consumo **não** gera Lançamento; o financeiro já contabilizou na compra/ENTRADA). Consumo é baixa física, não evento de caixa — não duplicar no `Lancamento`.

### 3.4 Estornar (`reabrirConsumoPeriodo`, NOVO)

Deleta o `ConsumoPeriodo` (cascade nas SAIDAs via `onDelete`, ou delete explícito das SAIDAs primeiro). Guardado pelo `assertMesAberto`.

---

## 4. Endpoints (router `nutricao`, já montado em `/api`)

Estender `server/src/routes/rebanho/nutricao.ts` (padrão Hono chained + `zValidator`):

| Método | Rota | Ação |
|---|---|---|
| `GET` | `/nutricao/dietas/:id/itens` | lista composição |
| `PUT` | `/nutricao/dietas/:id/itens` | substitui composição (array de itens) |
| `GET` | `/nutricao/lotes/:grupoId/consumo/previsao?dias=30` | preview do consumo (não grava) |
| `POST` | `/nutricao/lotes/:grupoId/consumo/fechar` | body `{dataInicio,dataFim}` → grava período |
| `DELETE` | `/nutricao/consumo/:id` | estorna período (respeita mês fechado) |

O preview (`GET …/previsao`) é o motor puro exposto — deixa o usuário ver "vai baixar X kg de milho, Y de mineral, custo R$ Z" **antes** de confirmar. Casa com a UI da fatia 1.

---

## 5. Reflexo no custo de produção (sem duplicar)

**Não precisa de código novo de custo.** `calcularCustoVacaDia()` já soma `MovimentoEstoque tipo:"SAIDA"` no período — então assim que o motor gravar SAIDAs `origem=NUTRICAO`, elas entram automaticamente no custo/vaca-dia e no custo/litro de `agregarCustoProducao()`. O elo "reflexo no custo" é **consequência**, não trabalho extra.

Cuidados para não duplicar:
- **Não** criar `Lancamento` na SAIDA de consumo (o caixa já saiu na compra). Confirmado: `agregarCustoProducao` separa duas contas — `custeioLeiteTotal` (vem de `Lancamento`) e `custoVacaDia` (vem de SAIDAs de estoque). São visões distintas; a SAIDA entra só na segunda.
- Filtro opcional na UI de custo: distinguir consumo real (`origem=NUTRICAO`) de saídas manuais, para o dono confiar no número.

---

## 6. Faseamento (fatias pequenas entregáveis)

**Fatia 1 — Composição da dieta.** Migration `DietaItem` + relações inversas. Service CRUD de itens + endpoints `GET/PUT …/itens`. UI: seção "Composição" na tela de dieta da aba Nutrição (add produto + qtd/cab/dia). Entrega valor sozinha: fica registrado o que cada dieta consome, mesmo sem baixa automática.

**Fatia 2 — Motor + baixa.** Migration `OrigemMovimentoEstoque` + `origem` em `MovimentoEstoque` + `ConsumoPeriodo`. Motor puro (TDD) + `fecharConsumoPeriodo`/`reabrir` + endpoints preview/fechar/estornar. UI: botão "Fechar consumo do mês" no lote, com preview e confirmação.

**Fatia 3 — Reflexo no custo.** Rótulo `origem` na aba Custo de Produção (separar consumo automático de manual) + linha "consumo de dieta" no breakdown. Majoritariamente frontend; o número já flui da Fatia 2.

---

## 7. Decisões em aberto (o dono precisa responder)

1. **Gatilho do consumo:** batch manual ("Fechar consumo do mês", recomendado v1) vs automático no fechamento mensal (`FechamentoMensal`) vs cron diário? Recomendo **batch manual por lote** — dá controle e preview antes de mexer no estoque.
2. **Cabeças que entram/saem no meio do período:** v1 usa o efetivo atual (aceita imprecisão). Precisão real (cabeças-dia) exige um **log de movimentação de lote** que hoje não existe — vale a pena? (fora deste escopo, seria feature própria).
3. **Saldo insuficiente:** ao baixar mais do que há em estoque, o quê? (a) permitir saldo negativo + alerta (recomendado — a vaca comeu, o dado reflete a realidade); (b) bloquear o fechamento; (c) baixar até zerar e avisar. `MovimentoEstoque` não valida saldo hoje, então (a) é o caminho de menor atrito.
4. **Sobra/falta vs consumo real:** a dieta é *teórica* (qtd/cab/dia planejado). Fazenda que pesa a sobra do cocho quer lançar o **consumido real**, não o planejado. v1 = teórico; permitir ajustar a quantidade no preview antes de confirmar cobre o caso sem modelo novo.
5. **Unidade dieta × unidade estoque:** se a dieta está em "g/cab/dia" e o produto em "kg", quem converte? Recomendo: exigir a mesma unidade do produto no `DietaItem` (validação no PUT) e deixar conversão para v2.

---

## 8. Riscos

- **Estoque negativo / custo distorcido:** sem validação de saldo, um `qtdPorCabecaDia` errado gera baixa gigante e explode o custo/vaca-dia. Mitigar com preview obrigatório + alerta de saldo.
- **Idempotência sob concorrência:** dois cliques em "fechar" → o `@@unique([grupoId,dataInicio,dataFim])` transforma o segundo em P2002 (tratar como "período já fechado", como o handler do WhatsApp já faz com P2002).
- **Mês fechado:** o estorno e o fechamento têm que respeitar `assertMesAberto` (já existe em `fechamento.ts`) senão viola a regra de caixa do sistema.
- **Migração de `origem`:** adicionar `origem @default(MANUAL)` é seguro (backfill implícito), mas revisar se algum relatório de estoque assume que toda SAIDA é manual.
