# Roadmap — Rio Novo: do mock para o real

Análise do que no produto já é **feature real** (ligada ao backend/Postgres) vs. o que
ainda é **mockado** no front, e o caminho para tornar tudo real.

> Snapshot de 29/05/2026. Backend = Hono + Prisma + Postgres em `server/`.
> Front = React + Vite + TS em `client/`.

---

## 1. Estado atual — real vs. mockado

| Área | UI | Dados | Escrita | Veredito |
|---|---|---|---|---|
| **Dashboard** (KPIs, donut, timeline, DRE, atividades, inconsistências) | ✅ | ✅ **real** — `GET /api/dashboard` agrega os 6.704 lançamentos do Postgres ao vivo | — (read-only) | **Real**, exceto `caixaHoje` (hardcoded R$ 184.420) e os títulos das inconsistências (curados; valores são calculados) |
| **Dashboard → drill** (subcategoria → lançamento → nota) | ✅ | ❌ **sintetizado** — `genLancamentos()` gera linhas com seed; subcategorias de `cockpitSupplements.ts` | — | **Mock** |
| **Relatório** (editorial) | ✅ | ✅ **real** — mesmos agregados do dashboard | — | **Real** |
| **Gastos** (tabela + filtros + drawer + nota) | ✅ | ❌ **15 linhas hardcoded** em `rionovo.ts` | filtros = só estado local | **Mock** (apesar de haver 6.704 lançamentos reais no banco) |
| **Lançar** (form + upload + "ler nota IA" + WhatsApp) | ✅ | ❌ cadastros estáticos | ❌ "Registrar gasto" **não salva**; upload não sobe; "Ler nota com IA" é `setTimeout` + valores fixos | **Mock total** |
| **Categorias** (árvore + nova categoria + sugestões IA) | ✅ | ❌ árvore estática | ❌ criar/editar/exportar = no-op; sugestões IA hardcoded | **Mock total** |
| **IA** (chat + componentes ricos) | ✅ | ❌ respostas por lookup de dicionário (string exata); pergunta nova → "me dê um instante" | ❌ sem LLM | **Mock total** |

---

## 2. Fundações que faltam (transversais — bloqueiam várias features)

1. **Nenhum endpoint de escrita.** Backend é 100% read-only: só `/api/health`,
   `/api/health/db`, `/api/dashboard`. Não há POST/PUT/DELETE.
2. **Sem autenticação.** `JWT_SECRET` existe no `.env` mas não há middleware/login.
   (O `CLAUDE.md` descreve um sistema Express+JWT que **não existe** no código — o real
   é um Hono minimalista; ver §5.)
3. **Sem upload/storage de arquivos** → nota fiscal não tem onde morar (schema sem
   campo de anexo; `rio_novo.json` não traz imagens).
4. **Schema não modela subcategorias** — só `GrupoCategoria → Categoria` (2 níveis).
   Todo o drill "Ração → ração de bezerro" é invenção do front.
5. **Sem integração LLM** (chat da IA, sugestões de plano de contas) nem **OCR** ("ler nota").
6. **`caixaHoje` hardcoded** — `ContaBancaria.saldoInicial` existe no schema mas não é usado.

**Boa notícia:** o schema Prisma já modela quase tudo (Lancamento, Categoria, CentroCusto,
ContaBancaria, ClienteFornecedor, FechamentoMensal, flag `ehInvestimento`). Grande parte do
trabalho é **expor endpoints**, não remodelar dados.

---

## 3. Roadmap por fases (ordenado por dependência + valor)

### Fase 1 — Gastos vira real · esforço **S**
Os 6.704 lançamentos já estão no banco; falta só lê-los.
- **Backend:** `GET /api/lancamentos` com filtros (período, atividade, categoria,
  fornecedor, conta) + paginação.
- **Front:** trocar `R.gastos` mock por `apiGet` em `client/src/components/Gastos.tsx`;
  ligar filtros ao query string.
- **Bônus:** a mesma fonte alimenta o drill do Dashboard com lançamentos **reais**
  (elimina a síntese de `genLancamentos`).

### Fase 2 — Cadastros + Lançar persiste · esforço **M**
- **Backend:** `GET/POST` de `categorias`, `centros-custo`, `contas`, `fornecedores`;
  `POST/PUT/DELETE /api/lancamentos` com guard de **fechamento mensal**
  (`garantirMesAberto`, já modelado).
- **Front:** `Lancar.tsx` faz POST real; autocomplete de fornecedor/categoria da API;
  `PlanoContas.tsx` cria/edita de verdade.
- **Auth single-user** (login + JWT) entra aqui, antes de abrir escrita.

### Fase 3 — `caixaHoje` real + Fechamento mensal · esforço **S/M**
- **Backend:** saldo por conta (`saldoInicial` + soma de lançamentos liquidados) no lugar
  do hardcode; endpoints de `FechamentoMensal` (listar/fechar/reabrir).
- **Front:** aba **Fechamento** (existe no design original, ainda não portada).

### Fase 4 — Subcategorias reais · esforço **L** (precisa decisão de modelagem)
- **Schema:** adicionar 3º nível (`Subcategoria` filha de `Categoria`) **ou** reinterpretar
  granularidade.
- **Migração:** os 6.704 lançamentos hoje têm 2 níveis — precisam ser **re-categorizados**
  (manual ou com IA). É o trabalho mais pesado e o que o cliente mais pediu ("ração de quê?").

### Fase 5 — Nota fiscal real (upload + OCR) · esforço **L**
- Storage (S3/R2/local) + campo de anexo no `Lancamento`.
- "Ler nota com IA" → OCR/LLM extraindo valor, fornecedor, data, itens (Claude vision).

### Fase 6 — IA conversacional real · esforço **L**
- `IA.tsx`: trocar lookup de dicionário por endpoint que dá ao Claude acesso ao contexto
  financeiro (tool-use sobre agregados/lançamentos) + conhecimento agro.

### Fase 7 — WhatsApp + Export .xlsx + extras · esforço **L**
- Bot WhatsApp (hoje mockup visual).
- Export do workbook 27-abas (o `CLAUDE.md` cita `exportXlsx.ts`/`exportWorkbook.ts` que
  **não existem**).

---

## 4. Caminho crítico

**Fases 1 e 2 destravam ~70% do valor** — Gastos e Lançar reais sobre dados que já existem.
Subcategorias, Nota Fiscal e IA são os três grandes investimentos (cada um é uma feature
por si só).

---

## 5. Divergência: `CLAUDE.md` vs. código real

O `CLAUDE.md` descreve um backend Express + JWT com `relatorio.ts`, `lancamentos.ts` (CRUD),
`exportXlsx.ts`, `exportWorkbook.ts`, auth e fechamento. **Nada disso existe no código.** O
backend real é um Hono com 3 rotas GET. Vale atualizar o `CLAUDE.md` para refletir o estado
atual e evitar suposições erradas em sessões futuras.
