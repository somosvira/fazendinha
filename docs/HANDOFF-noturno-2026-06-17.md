# Handoff noturno — fase real do módulo Rebanho (2026-06-17)

> Você foi dormir e me deixou rodando autônomo pra **deixar o sistema real e funcionando em todas as abas** (as que usamos o Ideagri como ideia): Animal, Reprodução, Sanidade, Nutrição, Dashboard e IA. Este doc é o que olhar quando acordar — vou atualizando conforme avanço.

## TL;DR (lê isto primeiro)
- **Como ver:** `pnpm dev` → http://localhost:41875 → aba **Rebanho** no topo. Os dados persistem no Postgres local.
- **O que pode precisar de você** (sem isso eu não consigo fechar 100%): veja a seção **"⚠️ Precisa de você"** no fim.
- **Status geral:** atualizado na seção **"Progresso"** abaixo.

## Plano (ordem de execução)
1. **Animal** — ✅ feito e mergeado (PRs #13 backend, #14 client) na fase anterior.
2. **Reprodução** — eventos (cio/IA/DG/parto/secagem) + motor de recálculo do resumo + timeline real + aba real.
3. **Sanidade** — doença/ocorrência, aplicação de produto (carência+lote), exame/CCS, mastite + resumo + timeline + aba.
4. **Nutrição** — dieta + ingredientes + arraçoamento por lote + alocação (nível de lote).
5. **Dashboard** — agregados reais do rebanho.
6. **IA** — chat sobre o contexto da fazenda (precisa de credencial de LLM — ver abaixo).

Cada frente: spec → plano → execução (subagente por task, com review) → PR → verificação. Decisões de produto eu tomo sozinho (como você pediu) e anoto aqui.

## Progresso
- [x] **Animal** — real (cadastro/edição/baixa). Verificado no navegador. PRs #13/#14.
- [x] **Reprodução** — real: eventos (cio/IA/DG/parto/secagem) + motor de recálculo (status/DEL/IEP/gestação…) + timeline real na ficha + "+ Registrar evento" + aba Reprodução real. PRs #15/#16.
- [ ] **Sanidade** — EM ANDAMENTO (doença/aplicação c/ carência+lote/exame+CCS/mastite → recálculo de CCS + timeline + aba). Inclui upgrade da timeline da ficha pra **unificada** (costura todos os domínios).
- [ ] **Nutrição** — pendente.
- [ ] **Dashboard real** — pendente.
- [ ] **IA real** — pendente (depende de credencial — ver abaixo).

## Decisões de produto que tomei (sem te perguntar, como combinado)
- **Modelo de evento:** uma tabela enxuta por domínio com `tipo` discriminado (em vez de 5 tabelas ou JSONB) — espelha o Ideagri (REPRODUCAO) mas com ~15 colunas.
- **`ResumoAnimal` é computado dos eventos** (não mais semeado): status reprodutivo, DEL, ordem de lactação, IEP, etc. saem de um motor de recálculo puro. Os valores podem diferir um pouco dos números "redondos" do mockup — porque agora são calculados de verdade.
- **`numPartosEntrada`** no Animal (igual ao `NUMPARTOENTRADA` do Ideagri) pra refletir partos anteriores ao registro (define a ordem de lactação).
- **Baixa ≠ delete** (mantém histórico).
- Constantes zootécnicas: PEV 60 dias, gestação 283 dias, secagem 60 dias antes do parto previsto.

## PRs (fase real)
- #13 — backend Animal · #14 — client Animal · (Reprodução/Sanidade/Nutrição/Dashboard: listo conforme abrir/merge).

## ⚠️ Precisa de você (credenciais / coisas que eu não consigo fazer)
- **IA real (aba IA):** pra a IA responder de verdade preciso de uma **credencial de LLM** no `server/.env` — `ANTHROPIC_API_KEY=...` (recomendo Claude). Sem ela, eu deixo a aba IA com a estrutura pronta (endpoint + UI + contexto do rebanho montado) **respondendo em modo demonstração** (respostas roteirizadas/placeholder), e é só você colar a chave e trocar uma flag.
- **Banco:** neste ambiente o `DATABASE_URL` aponta pra um **Postgres local** (db `rionovo`), não o Neon. Funciona pra dev. Se quiser que isso vá pra produção/Neon, precisa rodar `prisma db push`/migrations contra a URL do Neon (e idealmente trocar `db push` por migrations formais).
- (Anoto aqui qualquer outra coisa que aparecer durante a noite.)

## Notas técnicas
- Tudo segue o padrão do repo: Hono router→service + Prisma + Zod no backend; React + fetchers/hooks + drawers no client. Schema via `prisma db push`. Testes: vitest (lógica pura TDD) + smoke de API + verificação no navegador.
- Migrations formais continuam como dívida (uso `db push`). Anotado pra antes de produção.
