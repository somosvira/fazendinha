#!/bin/bash
cd /home/mathe/fazendinha || exit 1
export PATH=/home/mathe/.local/share/mise/installs/node/24.13.0/bin:/home/mathe/.local/bin:$PATH
exec pnpm --filter rionovo-client exec vite --host 0.0.0.0 --port 41875 --strictPort > .impeccable/client-local.log 2>&1
