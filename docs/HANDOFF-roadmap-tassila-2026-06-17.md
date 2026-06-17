# Roadmap & decisões — features da conversa com a Tássila (2026-06-17)

> Você foi malhar e me deixou seguir autônomo com **todas** as features que saíram do WhatsApp com a Tássila. **Terminei tudo.** Este doc é o catálogo: o que fiz, as **decisões de produto que tomei sozinho** (você pediu pra eu seguir o recomendado e catalogar) e o que precisa de você.

## ✅ CONCLUÍDO — todas as features da Tássila estão na `main`
| Aba sugerida | Situação |
|---|---|
| Animal · Reprodução · Sanidade · Nutrição | ✅ prontas (Fatias 1–4) |
| Dashboard · IA · Relatório (IA monta texto) · Gestão (= app financeiro) | ✅ prontas |
| **Produção** (3 modos configuráveis) | ✅ **Fatia 7 — PR #23** |
| **Cadastros (Produto + Fornecedor)** — aba "Fazenda" no Ideagri | ✅ **Fatia 8 — PR #24** |
| **Estoque** (insumos → **custo vaca/dia**) | ✅ **Fatia 9 — PR #25** (custo vaca/dia R$ 10,03 no seed) |
| **Integrações** (ordenhadeira) | 🅿️ deferido de propósito (só o gancho `origem` pronto) — ver decisão 4 |

**Como ver:** `pnpm install` (deps novas) → `pnpm dev` → http://localhost:41875 → **REBANHO**. Novas abas: **Produção**, **Estoque** (grupo Rebanho) e **Cadastros**, **Configurações** (rodapé). O **custo vaca/dia** está no topo da aba Estoque.

## Decisões de produto que tomei sozinho (cataloghadas)
1. **Medição de leite é configurável** (você pediu): aba **Configurações** com `producaoModo` ∈ Controle leiteiro (ordenha) / Total diário / Tanque-lote. Motivo: revenda pra outras fazendas. → Fatia 7.
2. **Modo tanque/lote faz rateio** (litros do lote ÷ vacas em lactação) pra não esvaziar a produção por vaca no cockpit/dashboard. Espelha `PRODUCAOLEITERATEIO` do Ideagri.
3. **Multi-fazenda (multi-tenant) DEFERIDO**: a `Configuracao` é de **uma** fazenda por enquanto. A revenda de verdade (escopo por fazenda em todas as tabelas + auth) é um projeto próprio, a planejar **antes de produção**. Não silenciei — está aqui como a maior pendência arquitetural.
4. **Integrações (ordenhadeira) DEFERIDO**: o framework do Ideagri (CowManager/CowMed/DataMars/Lely/BouMatic) é grande e na fazenda 777 nem está ativo. Deixo só o **gancho** pronto (campo `origem` = manual/integração nos registros de produção). Construir conector é projeto à parte, quando houver o equipamento.
5. **Cadastros = modelo `Produto` unificado** (remédio + ração + insumo, como o Ideagri) + `Fornecedor`. Vou aproveitar pra transformar os campos `produto`/`loteProduto` (hoje texto livre na Sanidade) em referência real. → Fatia 8.
6. **Custo vaca/dia** (o norte da Tássila) = sairá da Fatia 9 (Estoque): consumo de insumo valorizado, alocado à atividade leiteira, ÷ (vacas × dias). Liga os módulos rebanho↔financeiro via `Produto→ContaGerencial` e `MovimentoEstoque→CentroCusto`. O lado de **consumo** é a parte nova/difícil (nem o Ideagri da 777 tem preenchido).

## Status por fatia (atualizo conforme avança)
- **Fatia 7 — Configurações + Produção (3 modos):** ✅ **concluída, PR #23 mergeado, verificada no navegador** (ORDENHA → ranking real total 185 L/d; troca pra TANQUE/LOTE → registrar lote 900 L → rateio 225 L/d). Backend 57 testes, client 22, reviews aprovados.
- **Fatia 8 — Cadastros (Produto + Fornecedor):** ✅ **concluída, PR #24 mergeado, verificada** (5 produtos semeados com custo formatado; fornecedores reusando os ~409 do financeiro). Decisões: `Produto.tipo` funcional; Fornecedor estende `ClienteFornecedor`; aba Cadastros no rodapé. **Follow-up:** lista de fornecedores fica longa (409 do financeiro) → paginação/filtro padrão depois; Sanidade→FK de Produto.
- **Fatia 9 — Estoque + custo vaca/dia:** ✅ **concluída, PR #25 mergeado, verificada** (o **norte** da Tássila: aba Estoque com **custo vaca/dia R$ 10,03**, saldos com alerta de mínimo, movimentos entradas/saídas, drawer condicional). Decisões: `MovimentoEstoque` ENTRADA/SAIDA/AJUSTE; saldo computado; custo vaca/dia = Σ saídas valorizadas ÷ (vacas em lactação × dias) — função pura TDD. **Deferido (catalogado):** compra gerar `Lancamento` automático (link Estoque↔financeiro completo); alocação por centro de custo; NOTA/XML; validade/FEFO.

## ⚠️ Precisa de você (sem isso eu não fecho 100%)
- **IA modo real:** ainda depende de `ANTHROPIC_API_KEY` no `server/.env` (a aba IA funciona em modo demo sem ela). Já documentado em `docs/HANDOFF-noturno-2026-06-17.md`.
- **Banco/Neon + migrations + multi-tenant:** continua tudo em Postgres local com `db push`. Antes de produção/revenda: apontar pro Neon, migrations formais e o escopo por fazenda (decisão 3) — **a maior pendência arquitetural pra revenda**.
- **Validação de domínio:** os números/curvas (ex.: projeção 305d linear, custo vaca/dia MVP por consumo total) são MVP — vale a Tássila revisar.

## Follow-ups pequenos (não bloqueiam; catalogados)
- **Lista de Fornecedores longa** (reusa os ~409 `ClienteFornecedor` do financeiro) — em Cadastros e no form de movimento. Adicionar paginação/filtro padrão por tipo.
- **Link completo Estoque↔financeiro:** hoje a compra (ENTRADA) guarda fornecedor+valor mas não gera `Lancamento`. Próximo passo natural pra fechar o custo de ponta a ponta.
- **Sanidade/Nutrição → FK de `Produto`** (hoje `produto`/`loteProduto` são texto livre na Sanidade).
- **Custo vaca/dia** hoje soma todo consumo de saídas; refinar por categoria de insumo / alocação à atividade leiteira.

## Continuação — fechar o loop do custo (você escolheu este caminho)
Depois do roadmap da Tássila pronto, você pediu pra **ligar o Estoque (custo vaca/dia) ao financeiro (custo/litro)** — hoje vivem separados. Descoberta: o financeiro **agrega `Lancamento` real** (6.704 linhas, via `buildDashboard`), mas o custo/litro é mock e não há como *criar* lançamento pelo app. Dividido em 2 fatias:
- **Fatia 10 — Ponte (compra → lançamento):** 🔄 em andamento. `Produto` ganha `categoriaId`/`centroCustoId` (plano de contas); uma **ENTRADA** no Estoque gera um `Lancamento` real (DÉBITO, LIQUIDADO, categoria+centro do produto, fornecedor) que entra no fluxo de caixa. Respeita `FechamentoMensal` (hoje 0 → no-op). Nunca bloqueia o registro de estoque. Alvos reais: centro "Atividade Leiteira", categorias "Ração"/"Medicamento Animal". Spec/plano `…fatia10-ponte-financeiro*`.
- **Fatia 11 — Custo de Produção (custo/litro real):** ⏳ a seguir. Aba que calcula custo/litro = custeio do leite (`Lancamento`) ÷ litros produzidos (Produção) + custo vaca/dia + quebra por componente. Troca o mock R$ 11,82 por número real.

## Notas técnicas
- Tudo segue o padrão: Hono router→service + Prisma (`db push`) + Zod; React + fetchers/hooks + drawers; motor de recálculo puro testado (TDD). Cada fatia: spec → plano → subagente (backend, depois client) → review (spec+qualidade) → PR. Decisões de produto tomo sozinho e anoto aqui.
- Base no Ideagri lida do Firebird local (`DADOS777.FDB`) — ver memória `ideagri-data-access`.
