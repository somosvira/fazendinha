#!/usr/bin/env bash
# Captura a fonte de verdade da paridade reprodutiva do IDEAGRI.
#
# Roda somente contra uma CÓPIA do DADOS777.FDB. A saída contém metadados,
# dicionários e contagens agregadas — não contém animais nem dados pessoais.
# Uso:
#   bash scripts/extract-ideagri-repro-inventory.sh
set -euo pipefail

IDEAGRI_DB='/mnt/c/Program Files (x86)/Rúmina/Ideagri/dados/DADOS777.FDB'
ISQL='/mnt/c/Program Files (x86)/Rúmina/Ideagri/FBCVT/isql.exe'
SCRATCH='/mnt/c/Users/Public/idr_scratch'
SCRATCH_WIN='C:\Users\Public\idr_scratch'
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:-$SCRATCH/ideagri-repro-inventory.txt}"

mkdir -p "$SCRATCH"
echo '→ copiando DADOS777.FDB para o scratch…'
cp "$IDEAGRI_DB" "$SCRATCH/DADOS777_repro_inventory.FDB"
cp "$HERE/ideagri-repro-inventory.sql" "$SCRATCH/ideagri-repro-inventory.sql"

echo '→ capturando telas, funções, contagens e dicionários…'
"$ISQL" -user SYSDBA -password masterkey "$SCRATCH_WIN\DADOS777_repro_inventory.FDB" \
  -i "$SCRATCH_WIN\ideagri-repro-inventory.sql" \
  2>"$SCRATCH/ideagri-repro-inventory.err" \
  | tr -d '\r' \
  | awk '{$1=$1; print}' \
  | grep -a '^@' \
  | iconv -f WINDOWS-1252 -t UTF-8 > "$OUT"

TELAS=$(grep -c '^@TELA@' "$OUT" || true)
FUNCOES=$(grep -c '^@FUNCAO@' "$OUT" || true)
CONTAGENS=$(grep -c '^@COUNT@' "$OUT" || true)
COLUNAS=$(grep -c '^@COL@' "$OUT" || true)
TIPOS=$(grep -c '^@TIPOREPRO@' "$OUT" || true)

if [ "$TELAS" -lt 16 ] || [ "$FUNCOES" -lt 22 ] || [ "$CONTAGENS" -lt 23 ] || [ "$COLUNAS" -lt 300 ] || [ "$TIPOS" -lt 5 ]; then
  echo "ERRO: inventário incompleto (telas=$TELAS, funções=$FUNCOES, contagens=$CONTAGENS, colunas=$COLUNAS, tipos=$TIPOS)." >&2
  grep -v 'SU\$APPENDBLOBTOFILE\|^$' "$SCRATCH/ideagri-repro-inventory.err" >&2 || true
  exit 1
fi

printf '✓ inventário salvo em %s (telas=%s, funções=%s, contagens=%s, colunas=%s, tipos=%s)\n' \
  "$OUT" "$TELAS" "$FUNCOES" "$CONTAGENS" "$COLUNAS" "$TIPOS"
