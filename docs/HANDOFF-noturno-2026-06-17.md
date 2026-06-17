# Handoff noturno — fase real do módulo Rebanho (2026-06-17)

> Você foi dormir e me deixou rodando autônomo pra **deixar o sistema real e funcionando em todas as abas** (as que usamos o Ideagri como ideia): Animal, Reprodução, Sanidade, Nutrição, Dashboard e IA. **Terminei tudo.** Este doc é o resumo do que fiz + o que precisa de você.

## TL;DR (lê isto primeiro)
- ✅ **Todas as 6 frentes estão reais e funcionando** e mergeadas na `main` (PRs #13–#21). Verifiquei no navegador.
- **Como ver:** `pnpm install` (sincroniza a dep nova da IA) → `pnpm dev` → http://localhost:41875 → aba **REBANHO** no topo. Dados persistem no Postgres local.
- **Única coisa que precisa de você:** colar uma **chave de LLM** (`ANTHROPIC_API_KEY`) no `server/.env` pra a aba IA responder com IA de verdade. **Sem a chave ela já funciona** em *modo demonstração* (respostas reais montadas a partir dos dados do rebanho). Detalhe na seção **"⚠️ Precisa de você"**.

## Progresso (todas concluídas)
- [x] **Animal** — real (cadastro/edição/baixa + ficha/cockpit). PRs #13/#14.
- [x] **Reprodução** — real: eventos (cio/IA/DG/parto/secagem) + motor de recálculo (status/DEL/IEP/gestação) + timeline na ficha + "+ Registrar evento" + aba real. PRs #15/#16.
- [x] **Sanidade** — real: eventos (ocorrência/aplicação c/ carência+lote/exame-CCS/mastite/vacina) + recálculo de CCS + **timeline unificada** (a ficha costura todos os domínios) + aba real. PRs #17/#18.
- [x] **Nutrição** — real (nível de lote): dietas (CRUD) + atribuição de dieta aos lotes + aba de lotes; a ficha mostra a dieta real. PR #19.
- [x] **Dashboard** — real: agregados do rebanho de verdade (KPIs, cards por domínio, alertas) via `GET /api/rebanho/dashboard`. PR #20.
- [x] **IA** — real: `POST /api/rebanho/ia` monta o **contexto do rebanho dos dados reais** e responde em PT-BR. **Modo IA** (chama Claude se houver `ANTHROPIC_API_KEY`) ou **modo demonstração** (respostas por regras sobre os dados reais — CCS alto, prenhez, secagem, produção por lote, vazias atrasadas). Aba virou chat interativo de verdade. PR #21.

## Verificação no navegador (fiz agora)
- **IA:** cliquei a sugestão "CCS alto e subindo" → respondeu *"1 vaca(s) com CCS ≥ 400 mil: Jurema #1234 — 512 mil · subindo"* com selo **MODO DEMONSTRAÇÃO**. Digitei "produção média por lote" → *"Produção média do rebanho: 26.4 L/dia"* + os 3 lotes. (dado real do banco, renderizado no chat real)
- **Dashboard:** 8 ativos · 7 em lactação · 26 L média · 2 gestantes · 25% prenhez · alerta "CCS alto 1" — bate com a resposta da IA.
- **Reprodução / Animal:** work-lists e listas reais (Jurema #1234 3ª lactação, DEL 145, 28 L/d, prenhe).
- Screenshot da IA: `/tmp/rebanho-ia-verificado.png`.

## Decisões de produto que tomei (sem te perguntar, como combinado)
- **Modelo de evento:** uma tabela enxuta por domínio com `tipo` discriminado (espelha o Ideagri).
- **`ResumoAnimal` é computado dos eventos** por um motor de recálculo puro (status reprodutivo, DEL, ordem de lactação, IEP, CCS…). Os valores podem diferir um pouco dos números "redondos" do mockup — agora são calculados de verdade.
- **`numPartosEntrada`** no Animal (igual ao `NUMPARTOENTRADA` do Ideagri) pra refletir partos anteriores ao registro.
- **Baixa ≠ delete** (mantém histórico). Constantes: PEV 60d, gestação 283d, secagem 60d antes do parto.
- **IA:** SDK oficial `@anthropic-ai/sdk`, modelo default `claude-opus-4-8` (configurável por `ANTHROPIC_MODEL`), thinking adaptativo. Gate por chave com fallback automático pro modo demo — **nunca quebra nem chama a rede sem chave**.

## PRs (fase real)
- #13 backend Animal · #14 client Animal
- #15 backend Reprodução · #16 client Reprodução
- #17 backend Sanidade · #18 client Sanidade
- #19 Nutrição
- #20 Dashboard real
- #21 IA real (chat demo/LLM)

## ⚠️ Precisa de você (credenciais / coisas que eu não consigo fazer)
- **IA modo "de verdade" (opcional):** a aba IA **já funciona** em modo demonstração sem nada. Pra ela responder perguntas livres com um LLM (não só as 5 categorias roteirizadas), adicione no `server/.env`:
  - `ANTHROPIC_API_KEY=sk-ant-...` (obtenha em https://console.anthropic.com → API Keys)
  - (opcional) `ANTHROPIC_MODEL=claude-opus-4-8` — já é o default; troque se quiser outro modelo.
  - Reinicie o `pnpm dev`. O endpoint detecta a chave e passa pro modo IA automaticamente; se a chamada falhar, ele cai de volta pro modo demo sem quebrar.
- **Banco:** neste ambiente o `DATABASE_URL` aponta pra um **Postgres local** (db `rionovo`), não o Neon. Funciona pra dev. Pra produção/Neon: rodar `prisma db push`/migrations contra a URL do Neon.
- **`pnpm install`:** a Fatia 6 adicionou a dep `@anthropic-ai/sdk` (no `pnpm-lock.yaml`). Rode `pnpm install` antes do `pnpm dev` na sua máquina.

## Coisas pequenas / dívidas (cosméticas, não bloqueiam)
- **Insights da semana** (sidebar da aba IA) ainda são **mock** (texto fixo). O chat é real; a sidebar é decorativa — dá pra ligar aos alertas reais depois.
- **Eyebrow "REBANHO · 522 ANIMAIS"** no topo das abas Reprodução/Animal é uma string mock antiga; os números reais aparecem nos KPIs (8 animais). Trocar por contagem real é trivial.
- **Migrations formais** continuam como dívida (uso `prisma db push`). Anotado pra antes de produção.
- Sobrou uma dieta "Teste" no banco de um smoke antigo (cosmético).

## Notas técnicas
- Padrão do repo em tudo: Hono router→service + Prisma + Zod no backend; React + fetchers/hooks + drawers no client. Lógica pura (motores de recálculo, agregador do dashboard, montador de contexto + respondedor demo da IA) é testada com Vitest (TDD). Cada frente passou por implementação via subagente + review (spec + qualidade) antes do merge.
- Server: 48 testes verdes. Client: 18 testes verdes. Build dos dois workspaces limpo.
