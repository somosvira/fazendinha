#!/bin/sh

# Roda como "Deploy command" no Cloudflare Workers Builds (Settings > Builds),
# substituindo o default `npx wrangler deploy`. Baseado no scripts/deploy.sh
# do kumon (~/dev/kumon), adaptado pro monorepo (schema/migrations vivem em
# server/, não na raiz) e pra fazendinha não ter as vars BACKEND_*/FRONTEND_*.
#
# Sem `set -e` de propósito: com `set -e`, `OUTPUT=$(cmd)` aborta o script na
# hora se `cmd` falhar, antes de chegar no echo/case abaixo — perderia
# justamente a mensagem de diagnóstico que este script existe pra mostrar.
# Cada passo abaixo checa o próprio exit code manualmente.
#
# Pegadinha conhecida deste repo (ver DEPLOY.md §1.4): o Neon de produção foi
# sincronizado historicamente por `db push`, não por `migrate deploy` — então
# a tabela _prisma_migrations pode ter drift (migrations que "criam" tabela já
# existente falham com "already exists"). Da PRIMEIRA vez que este script
# rodar contra esse banco, ele pode abortar aqui — resolver uma vez com
# `prisma migrate resolve --applied <migration>` (mesmo passo documentado pro
# fluxo do Render) antes de reter. Não é bug do script: é o mesmo estado que
# bloquearia um `migrate deploy` manual.
OUTPUT=$(cd server && npx prisma migrate deploy 2>&1)
STATUS=$?
echo "$OUTPUT"

if [ "$STATUS" -ne 0 ]; then
  echo "--- prisma migrate deploy saiu com exit code $STATUS. Abortando antes do wrangler deploy. ---"
  exit 1
fi

# `migrate deploy` normalmente já sai com exit code != 0 quando algo dá errado,
# mas sem migration em transação explícita o Postgres pode já ter commitado
# parte de uma migration multi-instrução antes do erro — essa checagem de
# texto é uma segunda trava, exigindo uma das duas mensagens de sucesso que o
# CLI imprime hoje. Se a mensagem mudar numa versão futura do Prisma, este
# script para de reconhecer sucesso e o deploy fica bloqueado até o texto ser
# atualizado — proposital: falhar fechado, nunca destravar sozinho.
case "$OUTPUT" in
  *"All migrations have been successfully applied."*|*"No pending migrations to apply."*)
    echo "--- migrations em dia, seguindo para o wrangler deploy ---"
    ;;
  *)
    echo "--- prisma migrate deploy saiu com exit 0 mas sem a mensagem de sucesso esperada. Abortando por segurança. ---"
    exit 1
    ;;
esac

# --var repassa as vars de build que a própria Cloudflare injeta
# (WORKERS_CI_COMMIT_SHA/WORKERS_CI_BUILD_UUID, ver docs de Workers Builds)
# pro runtime do Worker, sem precisar declará-las no wrangler.jsonc — é o
# GET /api/health que devolve elas de volta, pra confirmar depois qual commit
# está de fato no ar (server/src/routes/health.ts).
#
# Capturado (em vez de deixar correr direto pro terminal) porque a saída do
# `wrangler deploy` imprime a URL workers.dev do Worker — serve de fallback
# pra achar onde bater o health check no PRIMEIRO deploy, antes de existir
# um APP_BASE_URL setado (ver abaixo). `echo` logo depois preserva a saída
# nos logs do build normalmente.
OUTPUT=$(npx wrangler deploy \
  --var WORKERS_CI_COMMIT_SHA:"$WORKERS_CI_COMMIT_SHA" \
  --var WORKERS_CI_BUILD_UUID:"$WORKERS_CI_BUILD_UUID" 2>&1)
DEPLOY_STATUS=$?
echo "$OUTPUT"

if [ "$DEPLOY_STATUS" -ne 0 ]; then
  echo "--- wrangler deploy saiu com exit code $DEPLOY_STATUS. ---"
  exit 1
fi

# Prefere APP_BASE_URL (mesma env de server/src/env.ts, já usada pros links de
# convite/reset — DEPLOY.md §1.2) em vez de inventar uma env só pra isso: no
# Worker único, front e back são o mesmo host, então a URL pública do app já É
# a base do health check. Setar em Build variables assim que souber a URL
# definitiva do Worker (custom domain, se tiver um).
#
# Sem ela (tipicamente só no primeiro deploy, antes de existir uma URL pra
# configurar), cai pro workers.dev que o próprio `wrangler deploy` acabou de
# imprimir acima — assim o build já verifica envs/config mesmo nesse deploy
# inicial, em vez de simplesmente pular a checagem.
DEPLOYED_URL=$(printf '%s' "$OUTPUT" | grep -oE 'https://[a-zA-Z0-9.-]+\.workers\.dev' | head -1)
BASE_URL="${APP_BASE_URL:-$DEPLOYED_URL}"

if [ -z "$BASE_URL" ]; then
  echo "--- Nem APP_BASE_URL setada nem uma URL workers.dev na saída do wrangler deploy (ex.: workers_dev desativado + sem custom domain) — pulando a checagem pós-deploy. ---"
  exit 0
fi

WORKER_HEALTH_URL="${BASE_URL%/}/api/health"

TENTATIVAS=5
ESPERA_INICIAL=6
ESPERA_ENTRE_TENTATIVAS=4

echo "--- aguardando ${ESPERA_INICIAL}s antes do primeiro health check (propagação do deploy) ---"
sleep "$ESPERA_INICIAL"

i=1
while [ "$i" -le "$TENTATIVAS" ]; do
  echo "--- health check, tentativa $i/$TENTATIVAS: $WORKER_HEALTH_URL ---"
  BODY=$(curl -fsS --max-time 10 "$WORKER_HEALTH_URL" 2>&1)
  CURL_STATUS=$?

  if [ "$CURL_STATUS" -eq 0 ]; then
    COMMIT_NO_AR=$(printf '%s' "$BODY" | grep -o '"commit":"[^"]*"' | head -1 | cut -d'"' -f4)

    # Sem WORKERS_CI_COMMIT_SHA (ex.: rodando isso fora do Workers Builds) não
    # há o que comparar — HTTP 200 sozinho já basta nesse caso.
    if [ -z "$WORKERS_CI_COMMIT_SHA" ] || [ "$COMMIT_NO_AR" = "$WORKERS_CI_COMMIT_SHA" ]; then
      echo "--- health ok. Commit no ar: ${COMMIT_NO_AR:-desconhecido} ---"
      exit 0
    fi

    echo "--- health respondeu 200, mas o commit no ar ($COMMIT_NO_AR) ainda não é o que acabou de subir ($WORKERS_CI_COMMIT_SHA) — provavelmente propagação em andamento ---"
  else
    echo "--- health check falhou (curl exit $CURL_STATUS): $BODY ---"
  fi

  i=$((i + 1))
  if [ "$i" -le "$TENTATIVAS" ]; then
    sleep "$ESPERA_ENTRE_TENTATIVAS"
  fi
done

echo "--- depois de $TENTATIVAS tentativas, o /api/health não confirmou o commit novo no ar. Build marcado como falho — o wrangler deploy já rodou, isso só avisa, não desfaz. Confira /api/health e os Logs do Worker no dashboard. ---"
exit 1
