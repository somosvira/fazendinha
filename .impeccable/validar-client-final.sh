#!/bin/bash
cd /home/mathe/fazendinha || exit 1
export PATH=/home/mathe/.local/share/mise/installs/node/24.13.0/bin:/home/mathe/.local/bin:$PATH
export TZ=America/Sao_Paulo
exec pnpm --filter rionovo-client exec vitest run --maxWorkers=2 --minWorkers=2 > .impeccable/entrega-client-testes.log 2>&1
