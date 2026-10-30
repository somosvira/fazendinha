# Fazendinha

Aplicação de gestão rural com Financeiro, Estoque compartilhado e Pecuária. A documentação descreve a árvore atual do repositório; disponibilidade em um ambiente depende do código e das migrations aplicados nele.

O deploy usa exclusivamente **Cloudflare Workers**, servindo interface e API no mesmo Worker, com banco Neon e arquivos R2. O servidor Node atende o desenvolvimento local. Configuração e fluxo de publicação estão em [DEPLOY.md](DEPLOY.md).

## Funcionalidades atuais

- **Financeiro:** operações e rascunhos, compromissos, liquidações, contas/extratos, transferências, estornos, documentos, relatórios e cadastros gerenciais.
- **Estoque:** produtos, usos genético/sanitário/nutricional, saldos por sítio, lotes do produto com validade, ajustes, transferências, perdas e rastreabilidade.
- **Pecuária — Rebanho, Reprodução, Sanidade e Nutrição:** animais e lotes, movimentações, categorias, baixas, genética, pesagens/manejos, sanidade, nutrição, reprodução, visitas veterinárias e IATF.
- **Produção de leite V5:** produção geral por parcela/recipiente e controle individual, origens e destinos do leite, qualidade versionada, coletas antes do preço, comercialização e custos com cobertura. Aplicação das migrations e homologação do ambiente permanecem necessárias; consulte o [contrato](docs/pecuaria/leite.md).
- **Administração:** sítios, usuários, sessões e permissões por área/ação.

Agricultura, Cultivo e Equipe/Ponto foram retirados. Produção e qualidade do leite V5 estão integradas à base operacional, com contratos próprios e vínculos à Reprodução. Laboratório/FIV continuam fora do escopo. O [assistente de consulta](docs/assistente-consulta.md) oferece leitura financeira e ajuda de uso; perguntas livres exigem configuração OpenAI. O bot antigo, `/ia` e WhatsApp continuam suspensos pelas flags do cliente e servidor.

## Entender o produto

O [manual por eixos](docs/guia/README.md) explica Financeiro (Operações e Estoque) e Pecuária (Rebanho, Reprodução, Produção, Sanidade e Nutrição). Abra o [HTML navegável](docs/guia/index.html) para ler o ciclo da vaca, estados simultâneos, exemplos, diagramas e lacunas. O [system design](docs/system-design.md) descreve a integração e o [modelo de estados do animal](docs/pecuaria/estados-animal.md) identifica fatos, transições e desconhecimento.

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
| `pnpm --filter rionovo-server run seed` | Cenário integrado V5: três sítios, rebanho, financeiro, estoque e leite |
| `pnpm --filter rionovo-server run seed --preflight` | Conferir destino e baseline sem escrever |
| `pnpm --filter rionovo-server run seed --verificar` | Conferir o cenário sem escrever |
| `pnpm --filter rionovo-server run seed:typecheck` | Conferir tipos da seed única |
| `pnpm --filter rionovo-server run test` | Testes do servidor |
| `pnpm --filter rionovo-client run test` | Testes da interface |
| `node --test scripts/*.test.mjs` | Testes da transformação da carga IDEAGRI |

Para testes unitários do servidor sem banco:

```bash
NODE_ENV=test DATABASE_URL=postgresql://test:test@127.0.0.1:1/fazendinha_unit \
  AUTH_DB_INTEGRATION=0 PECUARIA_DB_INTEGRATION=0 FINANCE_DB_INTEGRATION=0 \
  pnpm --filter rionovo-server run test
```

O setup de testes fornece configurações inertes de R2. O único banco local é `fazendinha_seedatev3`; não crie bancos temporários ou clones para validação. Integrações locais exigem revisão das fixtures e da limpeza para preservar os dados existentes; casos que recriam banco ficam no CI externo. Veja [arquitetura](ARCHITECTURE.md#testes).

## Contexto para contribuir

Para organização, hierarquia e simplificação das telas, comece pelo [README do frontend](client/README.md), apoiado na [pesquisa de interfaces agro](docs/design/pesquisa-interfaces-agro.md). O guia distingue a direção proposta da interface já implementada e define a revisão de espaçamento, entrada direta, telas estreitas e modais.

Comece por [AGENTS.md](AGENTS.md) e pelo [índice da documentação](docs/README.md). [CLAUDE.md](CLAUDE.md) encaminha o Claude Code às mesmas regras. Documentos de features novas devem distinguir proposta, implementação e validação, e atualizar o contrato vigente quando concluídos.

Software proprietário.
