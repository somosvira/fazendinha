#!/usr/bin/env bash
# Extrai o rebanho real do Ideagri (Firebird) e regenera server/prisma/rebanho_real.json.
#
# Roda nesta máquina WSL+Windows (o Ideagri é um app Windows; o isql.exe é Windows).
# Espelha o pipeline do financeiro (scripts/extract_rio_novo.py). Idempotente.
# Depois de rodar: `pnpm --filter rionovo-server run import:rebanho`.
#
# Causa-raiz que isto resolve: a 1ª extração foi ad-hoc e filtrou por STATUS=1
# (incluía embrião/sêmen/baixado → 824). O filtro correto está em rebanho-dump.sql
# (TIPOANIMAL='A' AND ANIMALREBANHO=1 → 631 = 522 ativos + 109 baixados).
set -euo pipefail

# --- caminhos (ajuste se a instalação mudar) --------------------------------
IDEAGRI_DB='/mnt/c/Program Files (x86)/Rúmina/Ideagri/dados/DADOS777.FDB'
ISQL='/mnt/c/Program Files (x86)/Rúmina/Ideagri/FBCVT/isql.exe'
SCRATCH='/mnt/c/Users/Public/idr_scratch'
SCRATCH_WIN='C:\Users\Public\idr_scratch'
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "$SCRATCH"

# --- 1. copia o FDB vivo para o scratch (nunca ler o vivo) -------------------
echo "→ copiando DADOS777.FDB para o scratch…"
cp "$IDEAGRI_DB" "$SCRATCH/DADOS777_x.FDB"

# --- 2. roda o dump SQL (stdout → arquivo WSL; -o no /mnt/c é flaky) ---------
echo "→ rodando o dump via isql…"
cp "$HERE/rebanho-dump.sql" "$SCRATCH/rebanho-dump.sql"
DUMP="$SCRATCH/dump.txt"
# erros do isql vão p/ log (não p/ /dev/null) — o SU$APPENDBLOBTOFILE é ruído inócuo.
"$ISQL" -user SYSDBA -password masterkey "$SCRATCH_WIN\\DADOS777_x.FDB" \
  -i "$SCRATCH_WIN\\rebanho-dump.sql" 2>"$SCRATCH/isql.err" | tr -d '\r' > "$DUMP"

A=$(awk '/^@A@/{c++} END{print c+0}' "$DUMP")
echo "  linhas @A@ = $A (esperado 631)"
# guard: aborta antes de sobrescrever o JSON se o dump veio vazio/quebrado (isql falhou).
if [ "$A" -lt 100 ]; then
  echo "ERRO: dump com $A animais (<100) — isql provavelmente falhou. JSON NÃO foi tocado." >&2
  grep -v 'SU\$APPENDBLOBTOFILE\|^$' "$SCRATCH/isql.err" | head >&2 || true
  exit 1
fi
if [ "$A" -ne 631 ]; then
  echo "AVISO: contagem de animais (@A@=$A) ≠ 631 — os dados do Ideagri podem ter mudado. Conferir antes de importar." >&2
fi

# --- 3. transforma em rebanho_real.json -------------------------------------
echo "→ montando server/prisma/rebanho_real.json…"
node "$HERE/build-rebanho-json.mjs" "$DUMP" "$(date +%F)"

echo "✓ pronto. Próximo passo: pnpm --filter rionovo-server run import:rebanho"
