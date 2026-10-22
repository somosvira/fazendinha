#!/bin/bash
cd /home/mathe/fazendinha || exit 1
export PATH=/home/mathe/.local/share/mise/installs/node/24.13.0/bin:/home/mathe/.local/bin:$PATH
export TZ=America/Sao_Paulo
pnpm --filter rionovo-client run build > .impeccable/validacao-local-build.log 2>&1 || exit 1
exec pnpm --filter rionovo-client exec vitest run --maxWorkers=2 --minWorkers=2 > .impeccable/validacao-local-client-completo.log 2>&1
