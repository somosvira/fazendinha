# Análise de rotas — Fazenda Rio Novo

> Levantamento de completude de cada rota da sidebar + navegação por URL.
> Gerado em 30/jun/2026.

## Navegação por URL

A navegação passou a refletir o path na barra de endereço (sem `react-router` —
mantém a convenção `useState<Tab>`). Ver `client/src/router.ts` (mapa bidirecional
`Tab ↔ pathname`) ligado no `App.tsx` via History API + `popstate`. `client/vercel.json`
adiciona o rewrite SPA (senão deep-links dariam 404 em produção).

| Aba | URL |
|---|---|
| Dashboard | `/dashboard` |
| Gastos | `/gastos` |
| Lançar | `/lancar` |
| Categorias | `/categorias` |
| IA financeira | `/ia` |
| Relatório | `/relatorio` |
| Rebanho leiteiro | `/rebanho/{dashboard,animal,reproducao,sanidade,nutricao,producao,estoque,custo,ia}` |
| Cadastros | `/cadastros` |
| Configurações | `/configuracoes` |
| Acessos | `/acessos` |

---

## Completude por rota

**Notas (0–10):** 0–3 = *mockup* (UI pronta, dados mock, sem persistência) · 4–6 =
*parcial* (conectado com lacunas) · 7–10 = *conectado + validação + persistência*.

**Dados:** 🟢 API real · 🟡 misto · 🔴 mock. **Persiste:** ✅ grava na API · 🟡 parcial · ❌ não grava.

### Bloco Financeiro

| Rota | Conteúdo | Forms | Dados | Persiste | Nota |
|---|---|:---:|:---:|:---:|:---:|
| `/dashboard` | KPIs, donut, timeline 23m, DRE, inconsistências | — | 🟢 | 🟡 | **7** |
| `/gastos` | Tabela de lançamentos + drawer de detalhe | filtros | 🔴 | ❌ | **3** |
| `/lancar` | Form de saída (NF, fornecedor, categoria) e entrada | ✅ validado | 🔴 | ❌ | **4** |
| `/categorias` | Árvore Grupo→Categoria→Sub, sugestões IA | modal validado | 🔴 | ❌ | **3** |
| `/ia` | Chat estruturado, memória, escopo de dados | composer | 🔴 | ❌ | **2** |
| `/relatorio` | Relatório editorial §I–VI | — | 🔴 | ❌ | **3** |
| `/acessos` | Usuários, papéis/abas/flags, convite | modal validado | 🔴 | ❌ | **3** |

**Ressalvas:**
- `/dashboard` — único plugado no Neon (`GET /api/dashboard`); grava só a reclassificação de categoria (`PATCH`). Projeção, ruptura, anomalias e orçamento ainda são mock.
- `/lancar` — forms completos com validação `canSubmit` e rascunho em `localStorage`, mas o submit só dá `toast`. UX pronta, falta fiação com a API.
- `/categorias` — criar só dá `toast`; export CSV funciona (client-side).
- `/ia` — respostas *canned* de `R.iaRespostas`; sem chamada de API.
- `/acessos` — *frontend-only*: o backend nem modela usuários. CRUD em estado local, bem validado, zero persistência.

**O que falta pra 10:**
- `/dashboard` **(7→10)** — endpoints reais para projeção/ruptura/anomalias/orçamento (hoje derivados/mock no `api.ts`); filtro de período aplicado server-side; remover os suplementos mock (`cockpitSupplements`, `projecao`, `ruptura`).
- `/gastos` **(3→10)** — `GET /api/lancamentos` (lista paginada + filtros); trocar `R.gastos` por fetch; drawer de detalhe e nota fiscal vindos da API.
- `/lancar` **(4→10)** — `POST /api/lancamentos` com validação Zod no server (respeitando `FechamentoMensal`); ligar o submit à API (hoje só `toast`); carregar fornecedores/categorias/contas via API em vez de `R`.
- `/categorias` **(3→10)** — CRUD real de `Categoria`/`GrupoCategoria` (`POST/PATCH/DELETE`) + subcategorias; persistir criação; sugestões da IA ligadas a dado real.
- `/ia` **(2→10)** — substituir respostas *canned* por chamada real (reaproveitar o agente do bot ou um `/api/ia/financeiro`) com contexto dos lançamentos; memória server-side.
- `/relatorio` **(3→10)** — alimentar com os agregados reais do dashboard; período funcional; export PDF.
- `/acessos` **(3→10)** — modelar usuários/papéis no backend + auth (JWT já tem placeholder); persistir convites/permissões via API.

### Bloco Operacional — Rebanho leiteiro 🟢

Parte mais madura do app: CRUD completo, validação nos forms, persistência POST/PATCH/DELETE.

| Sub-rota | Conteúdo | Forms | Dados | Persiste | Nota |
|---|---|:---:|:---:|:---:|:---:|
| `/rebanho/dashboard` | KPIs, cards por domínio, alertas | — | 🟢 | — | **7** |
| `/rebanho/animal` | Tabela de animais, filtros status/setor | AnimalForm | 🟢 | ✅ | **8** |
| `/rebanho/reproducao` | Animais c/ status reprodutivo | EventoForm | 🟡 | ✅ | **7** |
| `/rebanho/sanidade` | Animais c/ resumo sanitário | EventoForm | 🟡 | ✅ | **7** |
| `/rebanho/nutricao` | Lotes + dietas (PB, Mcal) | Lote/DietaForm | 🟢 | ✅ | **8** |
| `/rebanho/producao` | KPIs, ranking, modo tanque/ordenha | LoteForm | 🟢 | ✅ | **8** |
| `/rebanho/estoque` | Saldos, movimentos, custo vaca/dia | Movimento/ProdutoForm | 🟢 | ✅ | **8** |
| `/rebanho/custo` | Custo/litro, quebra por componente | — | 🟢 | — | **8** |
| `/rebanho/ia` | Chat + insights da semana | form chat | 🟡 | — | **7** |

**Ressalva:** reprodução/sanidade/ia têm os *insights* da lateral em mock; o resto (animais, eventos, chat) é API real.

**O que falta pra 10:**
- `/rebanho/dashboard` **(7→10)** — filtro de período e drill-down/ações a partir dos alertas.
- `/rebanho/animal` **(8→10)** — paginação server-side, tratamento de erro/loading e cobertura de testes.
- `/rebanho/reproducao` **(7→10)** — trocar o insight mock por insight real (API) + KPIs de reprodução.
- `/rebanho/sanidade` **(7→10)** — insight real + calendário/agenda sanitária.
- `/rebanho/nutricao` **(8→10)** — custo da dieta calculado e vínculo do consumo com o estoque.
- `/rebanho/producao` **(8→10)** — consolidar tanque × individual e bloquear datas em mês fechado.
- `/rebanho/estoque` **(8→10)** — alertas de mínimo automáticos e conciliação com o financeiro.
- `/rebanho/custo` **(8→10)** — incluir todos os componentes (mão de obra, depreciação) e export.
- `/rebanho/ia` **(7→10)** — insights reais (não mock) e memória de conversa.

### Administração

| Rota | Conteúdo | Forms | Dados | Persiste | Nota |
|---|---|:---:|:---:|:---:|:---:|
| `/cadastros` | Produtos e fornecedores (filtro + busca) | Produto/FornecedorForm | 🟢 | ✅ | **8** |
| `/configuracoes` | Modo de produção + preço do leite | input validado | 🟢 | ✅ | **7** |

**O que falta pra 10:**
- `/cadastros` **(8→10)** — exclusão real (hoje só ativar/desativar), validação de documento (CNPJ/CPF) e dedupe.
- `/configuracoes` **(7→10)** — mais parâmetros (metas, calendário), histórico de alterações e feedback de erro.

> **Transversal (vale pra tudo):** não há suíte de testes nem autenticação real
> (`JWT_SECRET` é placeholder) — ambos contam contra o "10" de qualquer rota que grave dados.

---

## Síntese

- **Rebanho + Cadastros + Configurações** (média ~7,7): produto real, conectado, validado.
- **Financeiro** (média ~3,6): protótipo navegável de alta fidelidade, mas só o
  **Dashboard** está plugado no banco. O resto lê `data/rionovo.ts` e os "salvar" não
  persistem.
- **Lacuna estrutural nº 1**: o financeiro tem backend só pra leitura agregada
  (`/dashboard`) — faltam rotas de `Lancamento`, `Categoria`, `ClienteFornecedor` (CRUD),
  exatamente o que o `CLAUDE.md` lista como "não implementado".
- **Lacuna nº 2**: `/acessos` não tem modelo de usuário no backend — é 100% local.

### Endpoints financeiros existentes hoje
- `GET /api/dashboard`
- `PATCH /api/categorias/:id/classificacao`
- `POST /api/bot/ask`

### Endpoints do rebanho consumidos pelo frontend
`animais` (CRUD + baixa + eventos + sanidade + producao + timeline + insights),
`dietas` (CRUD), `lotes` (CRUD + dieta), `producao` / `producao-lote`, `estoque`
(saldos/movimentos/custo-vaca-dia), `produtos` (CRUD), `fornecedores` (CRUD),
`custo-producao`, `custo-sanidade`, `config` (GET/PATCH), `dashboard`, `ia`,
`grupos`, `racas`, `setores`, `categorias`, `centros-custo`, `animais-disponiveis`.
