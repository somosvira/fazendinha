# Fazendinha

Aplicação de gestão rural com Financeiro, Estoque compartilhado e Pecuária. A documentação descreve a árvore atual do repositório; disponibilidade em um ambiente depende do código e das migrations aplicados nele.

O deploy usa exclusivamente **Cloudflare Workers**, servindo interface e API no mesmo Worker, com banco Neon e arquivos R2. O servidor Node atende o desenvolvimento local. Configuração e fluxo de publicação estão em [DEPLOY.md](DEPLOY.md).

## Funcionalidades atuais

- **Financeiro:** operações e rascunhos, compromissos, liquidações, contas/extratos, transferências, estornos, documentos, relatórios e cadastros gerenciais.
- **Estoque:** produtos, usos genético/sanitário/nutricional, saldos por sítio, lotes do produto com validade, ajustes, transferências, perdas e rastreabilidade.
- **Pecuária V1–V3:** animais e lotes, movimentações, categorias, baixas, genética, pesagens/manejos, sanidade e nutrição.
- **Administração:** sítios, usuários, sessões e permissões por área/ação.

Agricultura, Cultivo e Equipe/Ponto foram retirados. Reprodução operacional e produção de leite não fazem parte da implementação atual. O assistente/WhatsApp conserva infraestrutura, mas está suspenso pelas flags do cliente e servidor.

## Desenvolvimento local

Requer Node **22+** e pnpm **10.7.1**. Workspaces: `rionovo-client` e `rionovo-server`.

```bash
pnpm install
cp server/.env.example server/.env
pnpm db:local:up
```

Configure `DATABASE_URL` e `DIRECT_URL` no `server/.env`. Para o PostgreSQL do Docker Compose, ambas podem usar `postgresql://fazendinha:fazendinha@localhost:54332/fazendinha_seedatev3`. Um volume existente mantém seus bancos; `POSTGRES_DB` não renomeia nem recria um banco já inicializado.

O servidor exige as quatro variáveis `R2_*` e `STORAGE_NAMESPACE` mesmo em desenvolvimento. Use credenciais autorizadas e namespace `dev`; os valores de exemplo precisam ser substituídos. Consulte [dados de desenvolvimento](docs/desenvolvimento.md) antes de popular um banco.

```bash
pnpm dev
```

A interface abre em `http://localhost:41875`; a API usa `http://localhost:41873`. `dev:server` aplica migrations antes de iniciar. O Vite encaminha `/api` para o servidor. O dono inicial é criado pelo comando manual `bootstrap:dono`, com `AUTH_BOOTSTRAP_EMAIL` configurado; iniciar o servidor não cria essa conta. Mantenha essa variável ausente quando não for usá-la: valor vazio não é um e-mail válido para o validador de ambiente.

## Comandos principais

| Comando | Uso |
|---|---|
| `pnpm dev:server` / `pnpm dev:client` | Iniciar um workspace |
| `pnpm build` | Compilar servidor e interface |
| `pnpm cf:build` / `pnpm cf:dev` | Compilar a interface / iniciar o Worker local |
| `pnpm prisma:generate` | Gerar Prisma Client |
| `pnpm prisma:migrate` | Criar migration em desenvolvimento |
| `pnpm --filter rionovo-server exec prisma migrate deploy` | Aplicar migrations existentes |
| `pnpm --filter rionovo-server run seed` | Cenário unificado local até V3 |
| `pnpm --filter rionovo-server run seedatev3 --verificar` | Conferir o cenário sem escrever |
| `pnpm --filter rionovo-server run seedatev3:typecheck` | Conferir tipos do seed |
| `pnpm --filter rionovo-server run test` | Testes do servidor |
| `pnpm --filter rionovo-client run test` | Testes da interface |
| `node --test scripts/*.test.mjs` | Testes da transformação da carga IDEAGRI |

Para testes unitários do servidor sem banco:

```bash
NODE_ENV=test DATABASE_URL=postgresql://test:test@127.0.0.1:1/fazendinha_unit \
  AUTH_DB_INTEGRATION=0 PECUARIA_DB_INTEGRATION=0 FINANCE_DB_INTEGRATION=0 \
  pnpm --filter rionovo-server run test
```

O setup de testes fornece configurações inertes de R2. As integrações exigem banco descartável com migrations; veja [arquitetura](ARCHITECTURE.md#testes).

## Contexto para contribuir

Comece por [AGENTS.md](AGENTS.md) e pelo [índice da documentação](docs/README.md). [CLAUDE.md](CLAUDE.md) encaminha o Claude Code às mesmas regras. Documentos de features novas devem distinguir proposta, implementação e validação, e atualizar o contrato vigente quando concluídos.

Software proprietário.
