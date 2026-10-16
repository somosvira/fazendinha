#!/usr/bin/env bash
# Uso: scripts/extract-pecuaria-v4.sh <snapshot.FDB> <diretorio-saida>
# O argumento deve ser uma cópia local, nunca o arquivo em Ideagri/dados.
set -euo pipefail
SNAPSHOT="${1:?Informe o snapshot FDB explicitamente}"
SAIDA="${2:?Informe um diretório de saída fora do Git}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ISQL='/mnt/c/Program Files (x86)/Rúmina/Ideagri/FBCVT/isql.exe'
SNAPSHOT="$(realpath "$SNAPSHOT")"
case "${SNAPSHOT,,}" in */ideagri/dados/*) echo 'Arquivo vivo proibido. Informe uma cópia fora de Ideagri/dados.' >&2; exit 1;; esac
case "$SNAPSHOT" in /mnt/c/*) ;; *) echo 'Snapshot precisa ser acessível ao isql Windows em /mnt/c.' >&2; exit 1;; esac
mkdir -p "$SAIDA"
SAIDA="$(realpath "$SAIDA")"
case "$SAIDA" in /mnt/c/*) ;; *) echo 'Saída precisa estar em /mnt/c para o isql Windows.' >&2; exit 1;; esac
cp "$HERE/pecuaria-v4-dump.sql" "$SAIDA/pecuaria-v4-dump.sql"
DB_WIN="$(wslpath -w "$SNAPSHOT")"
SQL_WIN="$(wslpath -w "$SAIDA/pecuaria-v4-dump.sql")"
"$ISQL" -user SYSDBA -password masterkey "$DB_WIN" -i "$SQL_WIN" > "$SAIDA/v4-dump.txt" 2> "$SAIDA/v4-isql.err"
# Não mascarar falha SQL/UDF; o dump bruto permanece para inspeção, JSON anterior intacto.
if rg -i 'statement failed|sqlcode|error' "$SAIDA/v4-isql.err"; then
  echo 'Extração reportou erro SQL. Dump preservado; transformação automática cancelada. Conferir erro e completude antes de transformar manualmente.' >&2
  exit 1
fi
node "$HERE/build-pecuaria-v4-json.mjs" "$SAIDA/v4-dump.txt" "$SAIDA/pecuaria-v4.json"
