# Contexto para Claude Code

As regras compartilhadas do projeto estão em [AGENTS.md](AGENTS.md). Leia esse arquivo e o [README](README.md) antes de alterar o código, e siga o contrato do domínio listado em [docs/README.md](docs/README.md).

A estrutura técnica está em [ARCHITECTURE.md](ARCHITECTURE.md) e os procedimentos de ambiente em [DEPLOY.md](DEPLOY.md) e [docs/desenvolvimento.md](docs/desenvolvimento.md). O visual atual não define a direção visual futura; siga o escopo da tarefa e as orientações compartilhadas.

Deploy exclusivamente em Cloudflare Workers, com interface e API no mesmo Worker. Node é o runtime do desenvolvimento local.

Use schema, migrations, serviços e testes para conferir a implementação. Este arquivo não mantém uma segunda descrição do produto nem substitui os contratos de Financeiro/Pecuária.
