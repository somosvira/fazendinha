#!/usr/bin/env bash
# Extrai o rebanho da Pecuária v1 do Ideagri (Firebird) e gera server/prisma/pecuaria_v1.json.
#
# Roda nesta máquina WSL+Windows (o Ideagri é um app Windows; o isql.exe é Windows).
# Depois de rodar: `importador da Pecuária v1 (F6)`.
#
# Filtro (sem o antigo OR EXISTS COLETA — doadoras DB01–DB06 ficam p/ a v2) em pecuaria-dump.sql
# (TIPOANIMAL='A' AND ANIMALREBANHO=1 → ~631). Encoding tratado no builder (sem iconv).
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
cp "$HERE/pecuaria-dump.sql" "$SCRATCH/pecuaria-dump.sql"
DUMP="$SCRATCH/pecuaria-dump.txt"
# erros do isql vão p/ log (não p/ /dev/null) — o SU$APPENDBLOBTOFILE é ruído inócuo.
"$ISQL" -user SYSDBA -password masterkey "$SCRATCH_WIN\\DADOS777_x.FDB" \
  -i "$SCRATCH_WIN\\pecuaria-dump.sql" 2>"$SCRATCH/isql-pecuaria.err" | tr -d '\r' > "$DUMP"

A=$(awk '/^@A@/{c++} END{print c+0}' "$DUMP")
echo "  linhas @A@ = $A (esperado 631)"
# guard: aborta antes de sobrescrever o JSON se o dump veio vazio/quebrado (isql falhou).
if [ "$A" -lt 100 ]; then
  echo "ERRO: dump com $A animais (<100) — isql provavelmente falhou. JSON NÃO foi tocado." >&2
  grep -v 'SU\$APPENDBLOBTOFILE\|^$' "$SCRATCH/isql-pecuaria.err" | head >&2 || true
  exit 1
fi
if [ "$A" -ne 631 ]; then
  echo "AVISO: contagem de animais (@A@=$A) ≠ 631 — os dados do Ideagri podem ter mudado. Conferir antes de importar." >&2
fi

# --- 3. transforma em pecuaria_v1.json -------------------------------------
echo "→ montando server/prisma/pecuaria_v1.json…"
node "$HERE/build-pecuaria-json.mjs" "$DUMP" "$(date +%F)"

echo "✓ pronto. Próximo passo: importador da Pecuária v1 (F6)"
