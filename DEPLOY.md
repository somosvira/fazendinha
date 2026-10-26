# Configuração e deploy em Cloudflare

O único destino de deploy é **Cloudflare Workers**: interface e API no mesmo Worker, PostgreSQL no Neon e arquivos no R2. Node atende desenvolvimento local e testes; a ferramenta de build requer Node 22+. Este guia descreve a configuração do repositório; o commit e o schema aplicados em produção precisam ser conferidos no ambiente e nos logs de publicação.

## Branches, ambientes e promoção

| Branch GitHub | Environment GitHub | Worker / URL | Branch Neon | Namespace R2 |
|---|---|---|---|---|
| `staging` | `staging` | [`fazendinha-stg`](https://fazendinha-stg.somosvirasudo.workers.dev) | `stg` (`br-proud-wind-ac6m6hq8`) | `staging` |
| `main` | `producao` | [`fazendinha-producao`](https://fazendinha-producao.somosvirasudo.workers.dev) | `producao` (`br-lively-forest-act9fg73`) | `prod` |

A conta Cloudflare é `1148b69b1e1518155a8dd0cf91929ebf`; o projeto Neon é `lucky-wildflower-03608013`. Os bancos são independentes: promover código não copia dados, usuários nem arquivos. Ambos os Workers usam `NODE_ENV=production`, incluindo STG. O rótulo `Production` no painel Cloudflare identifica o slot publicado do Worker, não o ambiente de negócio.

O fluxo é branch de trabalho → PR para `staging` → CI → deploy STG → homologação → PR de `staging` para `main` → CI → aprovação do environment `producao` → deploy produção. A aprovação humana atesta a homologação da versão promovida; mudanças posteriores exigem nova conferência. Correções urgentes na `main` devem voltar para `staging`. Prefira merge de promoção que preserve a ancestralidade entre as branches; não resete branches nem use force-push.

O job `deploy` do workflow `.github/workflows/staging.yml` depende dos três jobs de teste e só publica em eventos `push` de `staging`/`main`. PRs e `workflow_dispatch` executam somente CI. Execuções em branches publicadas não são canceladas por novos pushes, para não interromper migrations/publicação. A fila pode substituir uma execução ainda pendente pela mais recente; a versão executada sempre passa por seus próprios testes.

### Configuração administrativa necessária

Antes de integrar/ativar o fluxo, configurar no repositório `somosvira/fazendinha`:

- Proteger `main` e `staging`: exigir PR, resolver discussões, bloquear exclusão/force-push e exigir os checks `build + test`, `financeiro (bateria de invariantes, banco real)` e `baseline + seed unificada (retomada e idempotência)` antes do merge, com branch atualizada.
- Criar environments `staging` (somente branch `staging`) e `producao` (somente branch `main`). Em `producao`, exigir revisor autorizado para atestar homologação e impedir bypass administrativo do gate.
- Em **cada environment**, cadastrar secrets `CLOUDFLARE_API_TOKEN`, `DATABASE_URL` e `DIRECT_URL`. O token deve publicar Workers na conta acima; conexões são da respectiva branch Neon, com TLS. Nunca cadastrar os valores no código. O workflow não precisa de credenciais R2 ou JWT: os secrets existentes do runtime são preservados no Worker.
- Desativar Workers Builds automáticos nos dois Workers antes de ativar o novo fluxo; o GitHub Actions será o único gatilho automático. Não reativar o projeto Pages legado `terranoapp`.

Essas proteções e secrets vivem no GitHub/Cloudflare, não são criados pela presença do YAML. A alteração do código só está operacional após essa configuração e verificação de uma execução real. Sem secrets, o script falha antes das migrations.

## Configuração

A fonte é `server/src/env.ts`; exemplos em `server/.env.example`.

- `DATABASE_URL`: conexão do runtime. Node aceita PostgreSQL local/Neon; Worker usa o adapter Neon.
- `DIRECT_URL`: conexão usada pelo CLI Prisma. Em PostgreSQL local pode ser igual à de runtime; `migrate dev` exige suporte a shadow database.
- R2 obrigatório: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NOTAS`, `STORAGE_NAMESPACE`. Namespace explícito por ambiente: `dev`, `staging`, `prod`, `test`. Não há driver local atual.
- Identidade: configure `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWT_KEY` e `CLERK_AUTHORIZED_PARTIES` no Worker. `CLERK_AUTHORIZED_PARTIES` contém as origens públicas permitidas, separadas por vírgula. Configure também `VITE_CLERK_PUBLISHABLE_KEY` no ambiente de build da interface; essa chave é pública, enquanto as demais ficam como secrets. Habilite a conexão Google na mesma instância Clerk. `JWT_SECRET` continua assinando intents de upload direto.
- Autorização: o Clerk apenas autentica. Antes do primeiro login, a gestão deve criar um `Usuario` ativo com o e-mail Google da pessoa; o servidor o vincula ao `clerkUserId` na primeira sessão válida. Não há convite, senha local, reset de senha nem criação automática de usuários.
- `CORS_ORIGIN`: lista de origens separadas por vírgula; vazio permite qualquer origem. Configure no ambiente publicado.
- OpenAI: o assistente de consulta separado usa configuração e gates de `docs/assistente-consulta.md`. Bot legado, `/ia` e WhatsApp permanecem suspensos pelas flags; credenciais não os reativam.

Use secrets para credenciais. Não copie `server/.env`, backups ou manifestos privados para o Git. Scripts Node/tsx que precisam de configuração usam `--env-file=.env`; arquivos de secrets do Worker são separados dos do Node.

## Banco e bootstrap

Aplique migrations ao banco correto antes do código que depende delas:

```bash
pnpm --filter rionovo-server exec prisma migrate deploy
```

`dev:server` faz isso antes do watch local. O comando Node `start:prod` apenas inicia `dist/index.js`; não faz parte do deploy em Cloudflare, não aplica migrations nem cria dono/propriedades. Constraints e índices SQL não podem ser substituídos por `db push`.

A árvore atual contém a baseline `20261025000000_base_unificada`, consolidada com a V5; a cadeia anterior está no histórico Git. Banco novo autorizado usa essa baseline. Banco existente com migrations antigas ou estrutura materializada por `db push` exige plano específico de reconciliação, preservação e recuperação antes de qualquer publicação que a aplique. Não marcar a baseline como aplicada sem comprovar equivalência, não tentar recriar tabelas sobre dados existentes e não apagar schemas para resolver drift. A substituição histórica autorizada da base demonstrativa local não autoriza repetição em outro ambiente.

Para a primeira implantação, confira a necessidade dos bootstraps manuais:

```bash
pnpm --filter rionovo-server run backfill:propriedade
pnpm --filter rionovo-server run backfill:cadastros-financeiros
pnpm --filter rionovo-server run bootstrap:dono
```

`bootstrap:dono` exige configuração do e-mail e tabela `Usuario` vazia; cria o dono ativo. Depois, o dono entra com a conta Google cujo e-mail foi configurado e o servidor registra o vínculo Clerk. Sem uma sessão Clerk válida de usuário autorizado, as rotas protegidas respondem 401. Esses comandos escrevem no banco configurado: use apenas no ambiente pretendido. Seeds demonstrativos locais não são bootstrap de produção.

## Cloudflare Worker com interface e API

`wrangler.jsonc` aponta para `server/src/worker.ts`, serve `client/dist`, prioriza `/api/*` no Worker e usa fallback de SPA. `keep_vars` preserva variáveis de texto configuradas no provedor. Em runtime, configure envs/secrets; para teste local, use `.dev.vars` na raiz, ignorado pelo Git.

```bash
pnpm cf:dev
```

Esse comando compila a interface e inicia o Worker local. A publicação automática é executada pelo GitHub Actions: instala dependências com lockfile, gera Prisma Client, compila a interface e executa `sh scripts/cf-deploy.sh staging` ou `sh scripts/cf-deploy.sh producao`. O script valida conta Cloudflare, branch/evento (no CI), SHA do checkout e hosts Neon antes de escrever. Hosts fixos devem ser revisados no script se o endpoint Neon for substituído.

O script aplica migrations, aborta se falharem e publica via `wrangler deploy --env` no Worker definido em `wrangler.jsonc`, preservando secrets e variáveis existentes. Depois exige health com banco/configuração válidos, nenhuma migration interrompida e SHA exato. Uma falha no health marca a execução como falha, mas não desfaz código já publicado nem migrations. Recuperação exige análise de compatibilidade e ação explícita.

A baseline contém `FinalidadeAnimal` e a view atualizável de compatibilidade `DestinoAnimal`; a renomeação e suas migrations aditivas são história da cadeia anterior. Não remover a view enquanto versões antigas puderem atender. Views IATF preservam leitura, mas não oferecem escrita paralela ao núcleo comum. Rollback exige verificar dados, valores de enum e compatibilidade das versões; não basta retornar o código após mudanças estruturais. A implantação de um banco anterior à baseline precisa do plano de reconciliação acima, não da execução isolada de nomes antigos.

`pnpm cf:deploy staging` e `pnpm cf:deploy producao` usam o mesmo script de migrations/publicação/health e exigem build prévio, credenciais do destino, `WORKERS_CI_COMMIT_SHA` igual a `git rev-parse HEAD` e identificador `WORKERS_CI_BUILD_UUID`. São operações manuais excepcionais autorizadas, não substituem o fluxo normal com gates. Não execute `wrangler deploy` sem ambiente: o nome base genérico serve ao desenvolvimento.

## CI e conferência após publicação

`.github/workflows/staging.yml` testa PRs e pushes de `main` e `staging`, além do acionamento manual. O job principal compila servidor/interface, executa testes de transformação, interface, servidor e carga técnica V4. Jobs separados cobrem invariantes financeiros e baseline/seed unificada em PostgreSQL efêmero do runner. O job de deploy usa somente migrations; não executa seed em STG nem produção.

`node --test scripts/cf-deploy.test.mjs` verifica, com comandos simulados e sem banco/rede, a seleção dos ambientes, bloqueio de destino/SHA/credenciais incompatíveis, interrupção após falha de migration/deploy e exigência do health completo. Testes locais desse script não comprovam permissões do provedor nem publicação real.

Após publicação autorizada, confira carregamento da interface, `/api/health`, login/sessão, proteção de rotas, escopo por sítio e anexos/relatórios no namespace correto. Preserve backups e histórico; a conferência não autoriza reset de dados nem execução de seeds.

O health testa conexão e configuração e identifica migrations interrompidas. `migrations.upToDate=true` significa ausência de execução interrompida, não comparação de todas as migrations do repositório com o banco; `null` é inconclusivo e ainda pode acompanhar HTTP 200. Confira a aplicação da cadeia pelos comandos/logs do Prisma. `commit` e `buildId` dependem das variáveis injetadas pelo deploy e podem ser `null` em outros caminhos. HTTP 200 isolado não comprova schema atualizado nem homologação funcional.
