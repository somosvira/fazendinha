# Arquitetura

## Organização

Monorepo pnpm com `client` (React 18, Vite 6, TypeScript) e `server` (Hono, Prisma 6, Zod, TypeScript). Node 22+; versões exatas estão nos manifests e no `pnpm-lock.yaml`.

| Responsabilidade | Fonte no repositório |
|---|---|
| Shell e navegação por URL | `client/src/App.tsx`, `client/src/router.ts`, `client/src/components/AppSidebar.tsx` |
| Sessão e sítio nas requests | `client/src/propriedadeScope.ts`, `client/src/api/auth.ts` |
| Interface financeira | `client/src/financeiro/` |
| Interface pecuária | `client/src/pecuaria/rebanho/` |
| App HTTP e gates | `server/src/app.ts`, `server/src/middleware/` |
| Rotas e regras de negócio | `server/src/routes/`, `server/src/services/` |
| Dados e integridade SQL | `server/prisma/schema.prisma`, `server/prisma/migrations/` |
| Configuração e armazenamento | `server/src/env.ts`, `server/src/lib/storage.ts`, `server/src/lib/uploads.ts` |

Rotas validam entradas e coordenam serviços; serviços orquestram banco e regras. Funções `*.calc.ts` isolam cálculos puros. DTOs/mappers devem conservar distinções como `null`, zero, pendente e desconhecido. O cliente usa Tailwind v4, primitivas Radix/shadcn-style e Recharts 3; componentes e estilos existentes descrevem a implementação, sem fixar uma direção visual futura.

## Runtimes e banco

O deploy usa exclusivamente Cloudflare Workers: interface e API compartilham o mesmo Worker, com Neon para banco e R2 para arquivos. `server/src/app.ts` constrói o Hono compartilhado. `index.ts` atende o desenvolvimento local em Node; `worker.ts` é o entrypoint de produção com assets do Vite definidos em `wrangler.jsonc`. O frontend usa `/api` relativo; o Vite faz proxy para 41873 em desenvolvimento.

`db.ts` usa `PrismaPg` em Node, compatível com PostgreSQL local ou Neon, e `PrismaNeon` no Worker. Em Node o client é reutilizado; no Worker `resetPrismaPorRequisicao()` prepara o client para a requisição antes das rotas. Preserve essa ordem e o tratamento do contexto de I/O.

O schema usa `public` para Financeiro/Estoque/Auth/Sítios e `pecuaria` para os fatos pecuários. IDs e relações seguem o schema, sem inferir um tipo global único de identificador. SQL das migrations acrescenta constraints, índices parciais e catálogos que o Prisma não representa integralmente. `migrate deploy` aplica a cadeia; `db push` não é equivalente.

Nenhum entrypoint executa automaticamente os bootstraps de propriedade/dono. São comandos explícitos em `server/src/scripts/`. Aplicação de migrations em dev vem do script `dev` do servidor, não de `app.ts`.

## Domínios e integrações

Financeiro separa operação, compromisso, transação, movimento de conta e efeito físico. Estoque é compartilhado com Pecuária; consumo operacional não cria uma segunda despesa. Confira [o contrato](docs/financeiro-rebuild-contrato.md).

Pecuária V1–V3 reúne rebanho, genética, sanidade, peso/manejo e nutrição, com auditoria e localização histórica. Confira [seu contrato](docs/pecuaria/README.md). Agricultura/Cultivo/Equipe não têm módulos operacionais atuais. Centros/categorias e origens físicas de atividades retiradas podem existir no histórico financeiro.

OpenAI, motor estruturado de consulta e WhatsApp conservam código. `ASSISTENTE_ATIVO=false` nos dois lados suspende os canais; o servidor devolve `FEATURE_DISABLED`/503. A configuração de credenciais não reativa a feature.

## Sessão, permissões e sítio

`app.ts` monta health, WhatsApp e auth pública antes de `authMiddleware`; WhatsApp tem validação própria e também está sujeito à suspensão do assistente. Rotas protegidas resolvem sessão/usuário e aplicam gates. Áreas válidas: `financeiro` e `pecuaria`; estoque aceita qualquer uma delas. Flags e presets ficam em `services/auth/papeis.ts`.

`SHARED_ACCESS_TOKEN` mantém um dono sintético de transição. Sem usuários e sem esse token, o middleware permite acesso com dono sintético somente fora de produção. Em `NODE_ENV=production`, esse caso responde 503 por bootstrap incompleto; quando há usuários e nenhuma sessão válida, responde 401.

`comPropriedade()` inclui sessão e `X-Propriedade-Id`. A seleção visual/consolidada não autoriza escrita global: use os resolvedores existentes de escopo e, em fatos pecuários, o sítio na data do evento. Permissões precisam ser conferidas também nos links de retorno, DTOs, agregados e exportações.

O mascaramento de valores não é uniforme nas operações financeiras atuais; veja a limitação e sua implementação no [contrato financeiro](docs/financeiro-rebuild-contrato.md#permissões-e-documentos).

## Armazenamento e configuração

`env.ts` valida configuração no carregamento. R2 é o armazenamento atual obrigatório: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NOTAS` e `STORAGE_NAMESPACE` (`dev`, `staging`, `prod`, `test`). Não existe seleção atual por `STORAGE_DRIVER` nem fallback de disco local.

Novos objetos são segregados por namespace; a leitura usa as chaves persistidas, incluindo arquivos anteriores. Preserve esses caminhos. Anexos e relatórios são objetos privados acessados pelos fluxos autorizados do servidor. Credenciais ficam fora do Git. `JWT_SECRET` também assina os intents de upload direto; as sessões de usuário são persistidas no banco, não JWTs. O exemplo completo está em `server/.env.example`.

## Testes

Vitest em ambos os workspaces; teste perto do código. O servidor inclui `src/**/*.test.ts` e `prisma/seedatev3/**/*.test.ts`. Seu setup fornece R2 inerte, sem acesso ao bucket; para unitários basta uma `DATABASE_URL` inerte. Testes de transformação IDEAGRI usam `node --test scripts/*.test.mjs`.

As flags `AUTH_DB_INTEGRATION=1`, `PECUARIA_DB_INTEGRATION=1` e `FINANCE_DB_INTEGRATION=1` habilitam casos com PostgreSQL real. Use exclusivamente banco descartável com todas as migrations. `test:financeiro:integration` cria e remove seu próprio banco temporário a partir de uma conexão local `fazendinha_local`; não depende de seed manual. Seus tipos podem ser conferidos por `tsc -p server/tsconfig.financeiro.json`.

`.github/workflows/staging.yml` compila os dois workspaces, testa o transformador e o servidor com banco efêmero, além de executar a bateria financeira separada. A suíte do cliente é comando explícito; não está nesse workflow. Testes unitários, integrações e homologação visual/manual são evidências distintas.

Configuração e fluxo de publicação em Cloudflare ficam em [DEPLOY.md](DEPLOY.md).
