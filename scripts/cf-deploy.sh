#!/bin/sh
# Publicação explícita por ambiente; nunca executar seed ou reset neste fluxo.
set -u
DEPLOY_TARGET="${1:-}"
export DEPLOY_TARGET
case "$DEPLOY_TARGET" in
  staging) BASE_URL="https://fazendinha-stg.somosvirasudo.workers.dev" ;;
  producao) BASE_URL="https://fazendinha-producao.somosvirasudo.workers.dev" ;;
  *) echo "Uso: sh scripts/cf-deploy.sh staging|producao" >&2; exit 1 ;;
esac

# Valida o destino antes de qualquer escrita. Nunca imprimir as conexões.
node --input-type=module <<'JS'
import { execFileSync } from 'node:child_process';
const fail = (message) => { console.error(message); process.exit(1); };
const target = process.env.DEPLOY_TARGET;
const branch = target === 'staging' ? 'staging' : 'main';
const host = target === 'staging'
  ? 'ep-green-recipe-acyjvbqp.sa-east-1.aws.neon.tech'
  : 'ep-calm-frog-acks64ue.sa-east-1.aws.neon.tech';
if (process.env.CLOUDFLARE_ACCOUNT_ID !== '1148b69b1e1518155a8dd0cf91929ebf') fail('Conta Cloudflare diferente do destino autorizado.');
if (!process.env.CLOUDFLARE_API_TOKEN) fail('CLOUDFLARE_API_TOKEN ausente.');
if (process.env.GITHUB_ACTIONS === 'true' && (process.env.GITHUB_REF !== `refs/heads/${branch}` || process.env.GITHUB_EVENT_NAME !== 'push')) fail('Branch/evento incompatível com o ambiente.');
const sha = process.env.WORKERS_CI_COMMIT_SHA;
if (!sha || !/^[a-f0-9]{40}$/.test(sha) || sha !== execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()) fail('SHA de publicação ausente ou diferente do checkout.');
if (!process.env.WORKERS_CI_BUILD_UUID) fail('Identificador de publicação ausente.');
for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
  let url;
  try { url = new URL(process.env[key]); } catch { fail(`${key} ausente ou inválida.`); }
  const allowed = key === 'DIRECT_URL' ? [host] : [host, host.replace('.', '-pooler.')];
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !allowed.includes(url.hostname) || url.pathname !== '/neondb' || !url.username || !url.password || !['require', 'verify-full'].includes(url.searchParams.get('sslmode'))) fail(`${key} não corresponde ao banco ${target} com TLS obrigatório.`);
}
JS
if [ "$?" -ne 0 ]; then exit 1; fi

OUTPUT=$(cd server && pnpm exec prisma migrate deploy 2>&1)
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

# O workflow fornece o SHA exato e o identificador da execução ao runtime.
OUTPUT=$(pnpm exec wrangler deploy --env "$DEPLOY_TARGET" \
  --var WORKERS_CI_COMMIT_SHA:"$WORKERS_CI_COMMIT_SHA" \
  --var WORKERS_CI_BUILD_UUID:"$WORKERS_CI_BUILD_UUID" 2>&1)
DEPLOY_STATUS=$?
echo "$OUTPUT"

if [ "$DEPLOY_STATUS" -ne 0 ]; then
  echo "--- wrangler deploy saiu com exit code $DEPLOY_STATUS. ---"
  exit 1
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
    if printf '%s' "$BODY" | node --input-type=module -e '
      let raw = "";
      for await (const part of process.stdin) raw += part;
      try {
        const h = JSON.parse(raw);
        process.exit(h.status === "ok" && h.database?.connected === true && h.config?.ok === true && h.migrations?.upToDate === true && h.commit === process.env.WORKERS_CI_COMMIT_SHA ? 0 : 1);
      } catch { process.exit(1); }
    '; then
      echo "--- health ok. Commit no ar: $WORKERS_CI_COMMIT_SHA ---"
      exit 0
    fi
    echo "--- health ainda não confirmou configuração, banco, migrations e SHA esperado ---"
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
