# Handoff — Sprint Pré-Teste (2026-07-06)

Plano executado: `/root/.claude/plans/aparentemente-meu-s-cio-memoized-wadler.md`.
Auditoria referenciada: `AUDITORIA-2026-07-06.md` (na raiz).

Nada foi commitado / pushado (memória `Sem Git sem pedir`). Diff está na working tree pra você revisar.

---

## O que rodou

| Bloco | Descrição | Status |
|---|---|---|
| 0 | Preparação (snapshot Neon, PR#95) | ✅ snapshot criada; **PR#95 não mergeada** (deixei pra você) |
| 1 | Reconciliação schema Neon (B1/B2/B3) | ✅ `prisma db push` na branch main — todos os endpoints deixaram de 500 |
| 2 | `postinstall: prisma generate` (B8) | ✅ `server/package.json` |
| 3 | Data "hoje" real (B6) | ✅ 5 componentes + 5 `HOJE.ts` centralizados em `client/src/lib/hoje.ts` |
| 4 | Esconder mocks (B7) | ✅ `WhatsappMock` e entry-tabs "Pelo WhatsApp · Sandra" removidos. RupturaCaixa já estava gated por `SECOES_SEM_DADO=false` — falso positivo da auditoria |
| 5 | Auth mínima (B5) | ✅ middleware server + `<Login/>` client + Sair no UserPicker |
| 6 | Alerts → Toast/Modal (S1, opcional) | ⏭️ pulado (nice-to-have) |
| 7 | Comentário TE (B4) | ✅ comentário em `reproducao.concepcao.ts` — B4 era falso positivo |
| Val | Build + tests + curl smoke | ✅ **426 tests / 55 files** · **11/11 endpoints 200** |

**Todos os bloqueadores de teste com o dono foram resolvidos.**

---

## Neon — o que mudou

- **Projeto:** `Fazendinha` (id `red-cherry-28672142`), region sa-east-1.
- **Branch snapshot criada:** `backup-pre-migration-2026-07-06` (id `br-super-paper-aconsijx`). Rollback via `mcp__Neon__reset_from_parent` na branch `production` (ou console Neon).
- **Ação aplicada em `production`:** `prisma db push --skip-generate` — aditivo (Prisma se recusa a destrutivo sem `--accept-data-loss`). Isso é exatamente o que `start:prod` faz em cada deploy no Render.
- **Boot backfill idempotente** (`garantirFundacaoPropriedade` em `server/src/index.ts:129`) populou `propriedadeId=1` em Animal/Grupo/MovimentoEstoque/Lancamento antes órfãos.

### Débito de migrations não resolvido
Não editei arquivos de migration; só apliquei o estado do schema.prisma via `db push`. O drift entre `_prisma_migrations` do Neon e a pasta local **continua registrado**:

- 8 migrations locais ainda aparecem como "não aplicadas" no `prisma migrate status` (o `db push` não atualiza `_prisma_migrations`).
- 1 migration no Neon (`add_equipe_ponto`) sem versão no repo — PR#96 aberta pra tampar (SQL incompleto conforme corpo da PR).

Isso não bloqueia teste (Neon está em sync com o schema). Vira débito pra sprint 2: gerar uma migration de baseline consolidada.

---

## Sprint pré-teste — arquivos alterados

25 arquivos, 239 insertions / 152 deletions. Grupos:

**Server (5 arquivos):**
- `server/package.json` — postinstall `prisma generate`
- `server/src/env.ts` — `SHARED_ACCESS_TOKEN` opcional (mínimo 16 chars)
- `server/src/index.ts` — warn se CORS/token vazios em prod + middleware `/api/*`
- `server/src/middleware/auth.ts` **(novo)** — bearer + timingSafeEqual + isenções `/api/health` e `/api/whatsapp/*`
- `server/src/services/rebanho/reproducao.concepcao.ts` — comentário TE (B4 não é bug)

**Client (18 arquivos):**
- `client/src/lib/hoje.ts` **(novo)** — `getHoje()` real, override via `VITE_HOJE_ISO`
- `client/src/lib/auth.ts` **(novo)** — get/set/clear token + `comAuth()`
- `client/src/components/Login.tsx` **(novo)** — tela de entrada
- `client/src/propriedadeScope.ts` — compõe `comAuth` (fonte única do envelope de headers)
- Módulos que agora usam `comPropriedade` no `req`: `plantio/api.ts`, `cultivo/api.ts`, `corte/api.ts`, `equipe/api.ts`
- Fetches raw que passaram a mandar auth: `api.ts` (askBot, reclassificarCategoria), `financeiro/api.ts` (cadastros, upload/cancelar NF), `CommandPalette.tsx` (busca)
- `App.tsx` — split em `App` (guard de auth) + `AutenticadoApp` (todo o resto). Passa `onSair` pro Header.
- `Header.tsx` — item "Sair" no UserPicker
- 5 `HOJE.ts` (rebanho/corte/cultivo/financeiro/plantio) → todos delegam ao `lib/hoje.ts`
- 5 componentes de data (DateRangePicker, Dashboard, Gastos, Lancar, Relatorio) → `getHoje()`
- `Lancar.tsx` — deletou `WhatsappMock()`, entry-tabs, state `entryMode`, seção "Mockup — também pode lançar pelo WhatsApp"
- `styles/base.css` — 78 linhas de CSS do Login (usa as vars existentes)

**Docs (1 arquivo):**
- `AUDITORIA-2026-07-06.md` **(novo)** — o relatório completo original

---

## Como habilitar auth em produção

Pra ativar quando for entregar o link pro dono:

1. Gerar um token: `openssl rand -hex 24` (48 chars — bem acima do mínimo 16).
2. No Render: setar `SHARED_ACCESS_TOKEN=<valor>` no service. Redeploy.
3. Setar `CORS_ORIGIN=https://<dominio-do-frontend>` (ou lista separada por vírgula).
4. Entregar a senha pro dono via canal seguro (WhatsApp direto).

**Modo dev local:** enquanto `SHARED_ACCESS_TOKEN` estiver vazio, o middleware libera acesso — não perturba o fluxo de desenvolvimento. O `<Login/>` ainda aparece na primeira visita, mas aceita qualquer valor.

Boot em produção sem token seta:
```
[auth] SHARED_ACCESS_TOKEN vazio em produção — API está aberta a qualquer requisição.
```
Também tem warn análogo pra `CORS_ORIGIN` vazio.

---

## PRs de terceiros — o que decidir

- **PR#95** (`onlyBuiltDependencies` sharp+tesseract) — merge; baixo risco. Ficou pra você porque o Sem Git sem pedir se aplica.
- **PR#96** (`add_equipe_ponto` migration) — corpo da PR admite que o SQL está incompleto. Não merge sem reescrever o SQL (incluir também Caixinha/MovimentoCaixinha que também foram adicionadas via `db push`). Alternativa: gerar migration de baseline consolidada abrangendo todas as pendências (sprint 2).

---

## Como rodar / validar aqui

```
cd /root/fazendinha
pnpm build           # server tsc + client vite (deve passar limpo)
pnpm test            # 426 tests

# Server dev (já iniciei um; ver ss -tlnp | grep 41873)
pnpm dev:server      # se precisar reiniciar

# Smoke suite
for path in health propriedades rebanho/animais cultivo/safras caixinhas \
            "busca?q=ca" dashboard vencimentos plantio/talhoes corte/lotes \
            ponto/funcionarios cadastros; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:41873/api/$path")
  echo "$code  /api/$path"
done
# Meta: 12/12 = 200
```

Testar login no navegador (`http://localhost:41875`): sem token no server, qualquer senha entra. Botão "Sair" agora vive no UserPicker do Header.

Testar `VITE_HOJE_ISO`:
```
VITE_HOJE_ISO=2026-05-28 pnpm dev:client   # datas voltam ao mock antigo
pnpm dev:client                             # hoje real
```

---

## Sprint 2 (do relatório original, não fiz agora)

Bugs sérios que sobraram (referências em `AUDITORIA-2026-07-06.md`):
- S2 divs interativas com role="button" (a11y)
- S3 fetch sem AbortController (race conditions)
- S4 confirmação faltando em "Dar baixa" de animal
- S5 UNIQUE em `Animal.brincoEletronico`
- S6 vencimentos POST sem zValidator
- S7 `Funcionario.setor` string livre → enum
- S8 EquipeContent com callback não usado
- S9 OperacaoForm concatenando NPK em observação
- S10 parseValorBR passa por Number IEEE754
- S11 Dashboard Plantio 100% mock
- S12 Dashboard Cultivo inexistente

Amadorismos (A1–A15) e sugestões (§5) idem.

Fatia 4 multi-propriedade (Corte/Plantio/Cultivo/Equipe/Caixinha) e A3 OCR folhas continuam no backlog.

**Bom teste com o dono. 👊**
