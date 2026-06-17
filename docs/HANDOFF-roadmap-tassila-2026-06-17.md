# Roadmap & decisões — features da conversa com a Tássila (2026-06-17)

> Você foi malhar e me deixou seguir autônomo com **todas** as features que saíram do WhatsApp com a Tássila. Este doc é o catálogo: o que estou fazendo, as **decisões de produto que tomei sozinho** (você pediu pra eu seguir o recomendado e catalogar) e o que precisa de você. Vou atualizando conforme avanço.

## A lista da Tássila (mapeada)
| Aba sugerida | Situação |
|---|---|
| Animal · Reprodução · Sanidade · Nutrição | ✅ prontas (Fatias 1–4) |
| Dashboard · IA · Relatório (IA monta texto) · Gestão (= app financeiro) | ✅ prontas |
| **Produção** | 🔄 **Fatia 7 em andamento** (backend pronto; client em execução) |
| **Cadastros (Produto + Fornecedor)** — aba "Fazenda" no Ideagri | ⏳ Fatia 8 (próxima) |
| **Estoque** (insumos → custo vaca/dia) | ⏳ Fatia 9 |
| **Integrações** (ordenhadeira) | 🅿️ deferido (ver decisão abaixo) |

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
- **Fatia 9 — Estoque + custo vaca/dia:** 🔄 **em andamento** (o **norte** da Tássila). Decisões: (10) `MovimentoEstoque` ENTRADA/SAIDA/AJUSTE; **saldo computado** (não armazenado); (11) **custo vaca/dia (MVP)** = Σ saídas valorizadas no período ÷ (vacas em lactação × dias) — função pura TDD, período 30d; (12) aba **Estoque no grupo REBANHO**. **Deferido (catalogado):** compra gerar `Lancamento` financeiro automático (link Estoque↔financeiro completo); alocação por centro de custo; importação NOTA/XML; validade/FEFO. Spec/plano em `docs/superpowers/{specs,plans}/2026-06-17-rebanho-real-fatia9-estoque*`.

## ⚠️ Precisa de você (sem isso eu não fecho 100%)
- **IA modo real:** ainda depende de `ANTHROPIC_API_KEY` no `server/.env` (a aba IA funciona em modo demo sem ela). Já documentado em `docs/HANDOFF-noturno-2026-06-17.md`.
- **Banco/Neon + migrations + multi-tenant:** continua tudo em Postgres local com `db push`. Antes de produção/revenda: apontar pro Neon, migrations formais e o escopo por fazenda (decisão 3).
- **Validação de domínio:** os números/curvas (ex.: projeção 305 dias linear) são MVP — vale a Tássila revisar quando estiver pronto.

## Notas técnicas
- Tudo segue o padrão: Hono router→service + Prisma (`db push`) + Zod; React + fetchers/hooks + drawers; motor de recálculo puro testado (TDD). Cada fatia: spec → plano → subagente (backend, depois client) → review (spec+qualidade) → PR. Decisões de produto tomo sozinho e anoto aqui.
- Base no Ideagri lida do Firebird local (`DADOS777.FDB`) — ver memória `ideagri-data-access`.
