# Design — Multi-propriedade (A1)

**Status:** ✅ **IMPLEMENTADO e mergeado** — Fatias 0–4 (PRs #98–#104, jul/2026). As seções 1–7 abaixo são o design original (preservado como registro); a **seção 8** documenta o que foi de fato construído e as decisões tomadas, e a **seção 9** as pegadinhas operacionais de migration/deploy. **É a feature mais estratégica do backlog** e a de maior superfície (toca quase todos os módulos) — por isso tem doc próprio.
**Gatilho concreto:** a 2ª propriedade da Rio Novo (60 cabeças de recria entre matrizes/novilhas + trabalho com receptoras) precisa aparecer sem misturar rebanho, custo e estoque com a sede.
**Lente de revenda (memória de produto):** o sistema será revendido; construir **configurável, com default = propriedade única invisível**. Fazenda de 1 sítio não pode nem perceber a camada.

---

## 1. Multi-PROPRIEDADE ≠ multi-TENANT (o que este doc cobre)

Distinção que precisa ficar cristalina, porque muda o design:

| | Multi-**propriedade** (ESTE doc) | Multi-**tenant** (futuro) |
|---|---|---|
| O que separa | N sítios da **mesma** fazenda-cliente | N **fazendas-cliente** distintas |
| Dono / login | mesmo dono, mesmos usuários | donos diferentes, dados 100% isolados |
| Plano de contas, categorias | **compartilhados** (consolida o financeiro) | separados por cliente |
| Relatórios | consolidado **ou** por propriedade (o dono quer os dois) | nunca cruzam clientes |
| Isolamento exigido | lógico (filtro), não de segurança | forte (um cliente não vê o outro) |

**Este doc entrega multi-propriedade.** Mas o mecanismo — uma FK de escopo (`propriedadeId`) em cada fato + resolução de escopo por request — é **exatamente o mesmo seam** que um `Organizacao`/`tenantId` vai reusar depois. Fazer propriedade direito é construir o esqueleto do multi-tenant sem pagar o custo dele agora. A relação: `Organizacao (tenant) 1—N Propriedade 1—N fatos`. Hoje há 1 tenant implícito e 1 propriedade implícita; multi-propriedade torna a 2ª camada explícita, multi-tenant torna a 1ª.

---

## 2. Objetivo e princípio de migração

**Objetivo v1:** a recria/receptoras da 2ª propriedade tem rebanho, estoque e custo **próprios**, e o dono vê o rebanho filtrado por propriedade ou consolidado — sem quebrar nada da sede que hoje roda como propriedade única.

**Princípio-chave (não quebrar o de 1 sítio):**
1. Criar `Propriedade` e **semear uma linha** (id=1, "Fazenda Rio Novo") na migration.
2. Cada fato ganha `propriedadeId Int?` **nullable**, com **backfill = 1** no mesmo migration. Nullable evita travar a migration e permite rollout módulo a módulo; a resolução de default vive na aplicação.
3. O filtro de propriedade **só aparece na UI quando `count(Propriedade) > 1`**. Uma propriedade = camada invisível (requisito de revenda).
4. Toda criação de fato resolve a propriedade do contexto (filtro ativo → aquela; sem filtro/1 propriedade → a default). Nada de `propriedadeId` obrigatório no payload em v1.

---

## 3. Modelo de dados proposto

### 3.1 Entidade `Propriedade` (NOVO)

```prisma
// PROPOSTO — sítio físico da fazenda-cliente. Default single-tenant: 1 linha.
model Propriedade {
  id         Int      @id @default(autoincrement())
  nome       String   @unique
  apelido    String?  // rótulo curto p/ o seletor do shell ("Sede", "Recria")
  cidade     String?
  uf         String?
  principal  Boolean  @default(false) // a default quando não há filtro
  ativo      Boolean  @default(true)
  ordem      Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  // relações inversas adicionadas fato a fato conforme o faseamento
}
```

### 3.2 Quais fatos ganham `propriedadeId` (e quais NÃO)

Regra: **fato físico/operacional** (vive num lugar) → ganha escopo. **Dimensão de catálogo compartilhada** (plano de contas, cadastros de referência) → **não** ganha, fica no tenant. Isso preserva o financeiro consolidado.

**Ganham `propriedadeId Int?` (fatos escopados):**

| Módulo | Models |
|---|---|
| Rebanho | `Animal`, `Grupo` (leiteiro) — o resto (`EventoReprodutivo`, `Sanitario`, `Pesagem`, `Lactacao`, `ControleLeiteiro`, `ResumoAnimal`) **herda via `animalId`**, não precisa de FK própria |
| Corte | `LoteCorte`, `Piquete` |
| Plantio | `Talhao`, `Lavoura` (o resto herda via `talhaoId`/`safraId`) |
| Cultivo | `SafraCultivo`, `Silo` |
| Estoque | `MovimentoEstoque` (o estoque físico é por sítio) |
| Equipe | `Funcionario` |
| Caixinha | `Caixinha` |

**NÃO ganham (compartilhados no nível tenant — consolidam o financeiro):**

`GrupoCategoria`, `Categoria`, `CentroCusto`, `ContaBancaria`, `ClienteFornecedor`, `Produto` (catálogo; o *saldo* é por propriedade via `MovimentoEstoque`), `Configuracao`, `ParametroManejo`, `Raca`, `VariedadeCafe`, `PlanoAdubacao`, `Dieta`.

**`Lancamento` — decisão explícita (ver §6):** manter **sem** `propriedadeId` em v1 e derivar a propriedade pelo `centroCusto`/movimento de origem, **ou** adicionar `propriedadeId?` para partição direta. Recomendo **adicionar `propriedadeId?` nullable** (default=principal) — é barato e o dono pediu custo por propriedade; mas manter o plano de contas compartilhado para o consolidado sair de graça.

Exemplo do padrão aplicado (repetido por model):

```prisma
model Animal {
  // … campos existentes …
  propriedade   Propriedade? @relation(fields: [propriedadeId], references: [id]) // PROPOSTO
  propriedadeId Int?                                                              // PROPOSTO
  @@index([propriedadeId]) // PROPOSTO
}
```

### 3.3 `Configuracao` / `ParametroManejo` por propriedade?

Hoje `Configuracao` é singleton (`@id @default(1)`) e `ParametroManejo` é key/value global. A 2ª propriedade (recria/receptora) pode ter tempo de gestação/preço diferentes. **v1:** deixar global (uma config). **Evolução (casa com A5 — parâmetros configuráveis):** trocar o singleton por `@@unique([propriedadeId, chave])`. Fora do escopo desta fatia, mas anotado para não desenhar A5 sem lembrar disto.

---

## 4. Resolução de escopo (aplicação)

Ponto único de resolução, para não espalhar lógica:

- **Contexto do request:** o shell manda a propriedade ativa (header `X-Propriedade-Id` ou query `?propriedadeId=`). Um middleware Hono resolve `propriedadeAtiva`:
  - explícita no request → usa ela;
  - ausente **e** só há 1 propriedade → a principal (invisível);
  - ausente **e** N propriedades → "consolidado" (sem filtro) nos GETs; nas criações, **exigir** escolha (não deixar criar animal sem sítio quando há vários).
- **Leitura:** cada service adiciona `where: { propriedadeId }` quando há filtro; sem filtro = consolidado. Central helper `escopoPropriedade(ctx)` evita repetição.
- **Escrita:** `propriedadeId` vem do contexto, não do payload do usuário (menos erro, e o payload não muda em fazendas de 1 sítio).

Isso mantém **retrocompatibilidade total**: cliente de 1 propriedade nunca manda `propriedadeId`, o middleware resolve para a principal, tudo funciona como hoje.

---

## 5. Faseamento (agressivo — menor incremento que já entrega valor)

**Fatia 0 — Fundação invisível.** Migration: model `Propriedade` + seed 1 linha (`principal=true`) + `propriedadeId Int?` **só em `Animal` e `Grupo`** com backfill=1. Middleware `escopoPropriedade`. **Zero mudança de UI** (1 propriedade → filtro escondido). Nada quebra; nada aparece. Base pronta.

**Fatia 1 — A 2ª propriedade no rebanho (o valor pedido).** UI: cadastro de propriedade + seletor no shell (visível só com ≥2). Rebanho passa a filtrar por propriedade. Cadastrar a propriedade "Recria" e mover/criar as 60 cabeças nela. **Aqui a dor original está resolvida:** recria/receptoras não misturam com o leite da sede. Dashboards de rebanho ganham toggle consolidado × por propriedade.

**Fatia 2 — Estoque e custo por propriedade.** `propriedadeId?` em `MovimentoEstoque`; saldos e custo/vaca-dia por sítio. Estoque da recria separado do da sede.

**Fatia 3 — Financeiro com recorte por propriedade.** `propriedadeId?` em `Lancamento` (default=principal); relatórios do financeiro ganham o mesmo toggle consolidado × por propriedade, **reusando o plano de contas compartilhado**. O consolidado (visão atual) continua sendo o default.

**Fatia 4 — Demais módulos.** Corte (`LoteCorte`/`Piquete`), Plantio (`Talhao`/`Lavoura`), Cultivo (`SafraCultivo`/`Silo`), Equipe (`Funcionario`), Caixinha — cada um repete o padrão da Fatia 1/2. Independentes entre si → paralelizáveis.

**Fatia 5 (futuro, fora deste doc) — camada tenant.** `Organizacao` acima de `Propriedade`, login por tenant, isolamento forte. O `propriedadeId` já provou o padrão; o `tenantId` sobe um nível.

Cada fatia é entregável e reversível: enquanto `propriedadeId` for nullable com backfill, dá para mergear módulo a módulo sem big-bang.

---

## 6. Decisões em aberto (o dono precisa responder)

1. **`Lancamento` escopado ou derivado?** Adicionar `propriedadeId?` (partição direta, custo por propriedade fácil — recomendado) vs derivar do centro de custo/movimento (menos schema, mais lógica). Impacta a Fatia 3.
2. **Plano de contas: compartilhado ou por propriedade?** Recomendo **compartilhado** (o dono quer consolidar e as duas propriedades são da mesma pessoa). Se algum dia uma propriedade tiver contabilidade separada, vira decisão de multi-tenant.
3. **Cadastros de referência compartilhados?** `Produto`, `ClienteFornecedor`, `CentroCusto`, `Raca` — compartilhar (recomendado, evita recadastro) ou isolar por propriedade? Compartilhar mantém o catálogo único e o saldo por sítio via movimento.
4. **`FechamentoMensal` por propriedade?** Fechar o mês é por propriedade ou global? Se o financeiro consolida, provavelmente **global** em v1 (não adicionar `propriedadeId` aqui). Confirmar.
5. **Funcionários entre propriedades:** um funcionário pode trabalhar nos dois sítios? Se sim, `Funcionario.propriedadeId` é "lotação principal", não exclusividade — ou o ponto precisa de propriedade por dia. v1: lotação principal.
6. **Config/parâmetros por propriedade** (liga com A5): a recria tem parâmetros zootécnicos próprios? v1 global; decidir se A5 já nasce com `@@unique([propriedadeId, chave])`.
7. **Nome do seletor e default:** "consolidado" como default de leitura com ≥2 propriedades, ou sempre forçar escolher uma? Recomendo consolidado como default (o dono pensa "a fazenda toda").

---

## 7. Riscos

- **Superfície enorme:** toca schema em ~6 módulos. Mitigado pelo faseamento (nullable + backfill + módulo a módulo) — nunca um big-bang. O maior perigo é uma fatia que esquece o `where propriedadeId` e vaza dados entre sítios num relatório → cobrir com o helper central `escopoPropriedade` e testes por módulo.
- **Migrações Neon:** `prisma migrate dev` precisa de shadow DB e falha via pooler (ver CLAUDE.md) — cada fatia adiciona colunas nullable, então `migrate deploy` via pooler basta; usar `DIRECT_URL` só se criar migration nova.
- **Retrocompat de rotas:** clientes de 1 propriedade não podem ver o payload/rotas mudarem. Garantido por: FK nullable, resolução por middleware, filtro escondido. Testar explicitamente o caminho "sem propriedadeId no request".
- **Vazamento consolidado × isolado:** enquanto for multi-propriedade (mesmo dono), consolidar é OK. Se alguém usar isto como multi-tenant improvisado (fazendas diferentes na mesma base), o isolamento é só lógico e **não é seguro** — deixar explícito que multi-tenant real é a Fatia 5, não este doc.
- **`ResumoAnimal`/`Resumo*` read-models:** herdam propriedade via pai; recomputes não mudam, mas dashboards agregados precisam do filtro no join. Revisar os `*.recompute.ts` e `dashboard.agg.ts` ao aplicar cada módulo.

---

## 8. Implementação — estado final (concluído)

Entregue exatamente no faseamento da seção 5, um PR por fatia. Tudo **aditivo**: fazenda de 1 sítio não percebe a camada (a principal é resolvida invisivelmente).

### 8.1 Mapa de fatias × PRs × fatos escopados

| Fatia | Módulo | Fatos com `propriedadeId` | PR |
|---|---|---|---|
| 0 | Fundação | `Propriedade` (nova) + escopo central | #98 |
| 1 | Rebanho | `Animal`, `Grupo` | #99/#100 |
| 2 | Estoque | `MovimentoEstoque` | #101 |
| 3 | Financeiro | `Lancamento` | #102 |
| 4A | Corte | `LoteCorte`, `Piquete` | #103 |
| 4B | Plantio (café) | `Talhao`, `Lavoura` | #104 |
| 4C | Cultivo (grãos) + Equipe + Caixinha | `SafraCultivo`, `Silo`, `Funcionario`, `Caixinha` | #104 |

### 8.2 O padrão repetível como construído (copiar ao escopar um fato novo)

1. **Schema:** `propriedade Propriedade? @relation(...)` + `propriedadeId Int?` + `@@index([propriedadeId])`; relação inversa `X[]` em `Propriedade`.
2. **Migration aditiva:** `ADD COLUMN` nullable → `UPDATE SET = 1` (principal) → `CREATE INDEX` → FK `ON DELETE SET NULL`.
3. **Backfill de boot:** `prisma.<model>.updateMany({ where:{propriedadeId:null}, data:{propriedadeId:pid} })` em `garantirFundacaoPropriedade` (`server/src/services/propriedade.ts`). **Obrigatório** porque prod sincroniza via `db push`, que NÃO roda o SQL de seed/backfill da migration (ver §9).
4. **Escrita:** a rota resolve `resolverEscopoEscrita(c)` e passa ao service `criar*`.
5. **Leitura:** a rota resolve `resolverEscopoLeitura(c)` (`null` = consolidado) e o service aplica `where.propriedadeId` só quando não-null. **Cobrir TODAS as leituras do fato** (lista + agregações/dashboard) para não vazar entre sítios.
6. **Front:** a fetch-layer do módulo (`client/src/<mod>/api.ts`) injeta o header `X-Propriedade-Id` via `comPropriedade()` (`client/src/propriedadeScope.ts`). O seletor no shell governa tudo; com 1 sítio nunca envia o header (retrocompat).

Helpers centrais (Fatia 0): `resolverEscopoLeitura` (explícito → id; ausente+1 sítio → principal; ausente+N → `null` consolidado), `resolverEscopoEscrita` (explícito → header/query → principal), `propriedadePrincipalId` (cache de processo), `garantirFundacaoPropriedade` (idempotente, cria a principal + backfill no boot).

### 8.3 O que escopa vs. o que fica farm-wide

**Escopado por sítio** (leituras cobertas): listas dos fatos (animais, lançamentos, talhões, lavouras, lotes, piquetes, safras de cultivo, silos, funcionários, caixinhas) + agregações/dashboards (custo/vaca-dia, folha `apurarFolha`, `custoMOPorSetor`, colheita/passadas via `talhao.propriedadeId`, estoque de insumos, IA da lavoura). Escrita herda o sítio ativo. Leituras por-pai (RegistroPonto por funcionário, Area/Custo/Producao por safra, MovimentoSilo por silo, MovimentoCaixinha por caixinha, timeline por talhão) herdam o escopo do pai — não precisam de coluna própria.

**Farm-wide de propósito** (decisão, não esquecimento):
- **Cadastros de referência compartilhados:** `Produto`, `ClienteFornecedor`, `CentroCusto`, `Categoria`/`GrupoCategoria`, `Raca`, `VariedadeCafe`, `PlanoAdubacao`, `Dieta` — catálogo único; o saldo/uso por sítio vem via os movimentos/fatos, não do cadastro.
- **`FechamentoMensal`** — global (o financeiro consolida).
- **Ponte de custo financeiro do café** (`agregarCustoPlantio`) — segue o precedente do `rebanho/custo-producao`, que também não escopa. Follow-up se virar por-sítio.
- **Camada Ideagri do plantio** (`Safra`/`TarefaAgricola`/`ApontamentoMaquina`) — safra é janela de tempo da operação; não escopada nesta v1.

### 8.4 Decisões tomadas (fecha as pendências da seção 6)

1. `Lancamento` **escopado** com `propriedadeId?` (partição direta) — não derivado.
2. Plano de contas **compartilhado**.
3. Cadastros de referência **compartilhados** (ver 8.3).
4. `FechamentoMensal` **global** (sem `propriedadeId`).
5. `Funcionario.propriedadeId` = **lotação principal** (não exclusividade); ponto não é por-sítio-por-dia na v1.
6. Parâmetros por propriedade: **global** por enquanto.
7. Seletor: default **consolidado** com ≥2 sítios; 1 sítio → escondido.

---

## 9. Pegadinhas operacionais (migration & deploy)

**O mecanismo real de sync é `prisma db push`, não `migrate deploy`.** O `start:prod` roda `prisma db push --skip-generate` — é ele que materializa o schema no Neon. Os arquivos em `prisma/migrations/` são registro/histórico e funcionam via `migrate deploy` **apenas onde as tabelas já existem** (no Neon já foram db-push'adas). Consequências:

- **`db push` não roda o SQL de backfill das migrations.** Por isso o backfill dos históricos (`propriedadeId NULL → principal`) vive no **boot** (`garantirFundacaoPropriedade`), não só na migration. Sem isso, num deploy por `db push` as colunas nasceriam e ficariam NULL → a leitura filtraria pela principal e o módulo "sumiria".
- **`Caixinha`/`MovimentoCaixinha` não têm migration de `CREATE TABLE`** — essas tabelas só nascem via `db push` a partir do schema (diferente de `Silo`/`SafraCultivo`, criados em `20260701120000_cultivo_milho`, e `Funcionario`, em `20260706120000_add_equipe_ponto`). Efeito: `migrate deploy` do zero (ou num banco onde a Caixinha ainda não foi db-push'ada) **quebra** no `ALTER TABLE "Caixinha"` da migration `20260706190000` com `P3018 / relation "Caixinha" does not exist`.
  - **Recuperação** (banco local que travou nesse ponto): `prisma migrate resolve --rolled-back 20260706190000_cultivo_equipe_caixinha_propriedade` → `prisma db push` (cria a Caixinha + a coluna). O rollback da migration é atômico (nada fica pela metade).
  - **Follow-up recomendado:** escrever a migration de `CREATE TABLE` que falta para `Caixinha`/`MovimentoCaixinha` (com o enum `TipoMovimentoCaixinha`) **antes** da `20260706190000`, deixando o histórico consistente para `migrate deploy` do zero. Enquanto isso, o caminho de deploy suportado é `db push`.
- **`import.ts` (histórico real) não seta `propriedadeId`** — quem carimba os históricos na principal é o backfill de boot. Vale atualizar o import um dia.
- **Neon pooled × direct:** cada fatia só adiciona coluna nullable, então `migrate deploy`/`db push` via pooler bastam; `DIRECT_URL` (shadow DB) só é necessário para `migrate dev` ao criar migration nova (ver CLAUDE.md).
