# Configuração e deploy em Cloudflare

O único destino de deploy é **Cloudflare Workers**: interface e API no mesmo Worker, PostgreSQL no Neon e arquivos no R2. Node atende desenvolvimento local e testes; a ferramenta de build requer Node 22+. Este guia descreve a configuração do repositório; o commit e o schema aplicados em produção precisam ser conferidos no ambiente e nos logs de publicação.

## Configuração

A fonte é `server/src/env.ts`; exemplos em `server/.env.example`.

- `DATABASE_URL`: conexão do runtime. Node aceita PostgreSQL local/Neon; Worker usa o adapter Neon.
- `DIRECT_URL`: conexão usada pelo CLI Prisma. Em PostgreSQL local pode ser igual à de runtime; `migrate dev` exige suporte a shadow database.
- R2 obrigatório: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NOTAS`, `STORAGE_NAMESPACE`. Namespace explícito por ambiente: `dev`, `staging`, `prod`, `test`. Não há driver local atual.
- Sessões: `AUTH_SESSAO_DIAS`, `APP_BASE_URL`. `AUTH_BOOTSTRAP_EMAIL`/`AUTH_BOOTSTRAP_NOME` são consumidos pelo comando manual do dono. O e-mail opcional deve ficar ausente quando não usado, em vez de vazio. `SHARED_ACCESS_TOKEN` é uma ponte de dono sintético; não substitui contas reais. `JWT_SECRET` também assina intents de upload direto; configure um segredo próprio do ambiente.
- Recuperação pública de senha: em produção, `AUTH_EMAIL_PROVIDER=resend` exige `AUTH_EMAIL_FROM`, `RESEND_API_KEY` e `APP_BASE_URL`. Provider `log` é rejeitado em produção.
- `CORS_ORIGIN`: lista de origens separadas por vírgula; vazio permite qualquer origem. Configure no ambiente publicado.
- OpenAI/WhatsApp: configuração permanece no schema de ambiente, porém os canais estão suspensos pelas flags da aplicação.

Use secrets para credenciais. Não copie `server/.env`, backups ou manifestos privados para o Git. Scripts Node/tsx que precisam de configuração usam `--env-file=.env`; arquivos de secrets do Worker são separados dos do Node.

## Banco e bootstrap

Aplique migrations ao banco correto antes do código que depende delas:

```bash
pnpm --filter rionovo-server exec prisma migrate deploy
```

`dev:server` faz isso antes do watch local. O comando Node `start:prod` apenas inicia `dist/index.js`; não faz parte do deploy em Cloudflare, não aplica migrations nem cria dono/propriedades. Constraints e índices SQL não podem ser substituídos por `db push`.

A baseline de 25/09/2026 e as migrations seguintes permanecem integralmente no repositório. Banco com histórico anterior/materializado por `db push` precisa de reconciliação específica entre conteúdo e migrations. Não registre uma baseline como aplicada sem verificar equivalência e não apague schemas para resolver drift de um ambiente com dados.

Para a primeira implantação, confira a necessidade dos bootstraps manuais:

```bash
pnpm --filter rionovo-server run backfill:propriedade
pnpm --filter rionovo-server run backfill:cadastros-financeiros
pnpm --filter rionovo-server run bootstrap:dono
```

`bootstrap:dono` exige configuração do e-mail e tabela `Usuario` vazia; cria dono pendente e imprime link para definir senha. Sem usuários nem `SHARED_ACCESS_TOKEN`, produção responde 503 por autenticação não configurada, enquanto desenvolvimento permite acesso sintético. Esses comandos escrevem no banco configurado: use apenas no ambiente pretendido. Seeds demonstrativos locais não são bootstrap de produção.

## Cloudflare Worker com interface e API

`wrangler.jsonc` aponta para `server/src/worker.ts`, serve `client/dist`, prioriza `/api/*` no Worker e usa fallback de SPA. `keep_vars` preserva variáveis de texto configuradas no provedor. Em runtime, configure envs/secrets; para teste local, use `.dev.vars` na raiz, ignorado pelo Git.

```bash
pnpm cf:dev
```

Esse comando compila a interface e inicia o Worker local. Para Workers Builds, configure o build com instalação das dependências, geração do Prisma Client e `pnpm cf:build`; o deploy command é `sh scripts/cf-deploy.sh`. O script aplica migrations, aborta se falharem e publica com commit/build ID. Quando encontra `APP_BASE_URL` ou a URL retornada pelo Wrangler, confere `/api/health`; sem ambas, informa que pulou essa conferência. Configure `DATABASE_URL`/`DIRECT_URL` também no escopo de build; variáveis de build e runtime são escopos distintos.

`pnpm cf:deploy` chama Wrangler diretamente depois do build do client e **não** executa o script de migrations/health. Não trate esses comandos como equivalentes. O repositório não seleciona sozinho a branch conectada ao provedor.

## CI e conferência após publicação

`.github/workflows/staging.yml` faz build, testes do servidor e integração com PostgreSQL efêmero; não publica a aplicação. Seu nome não comprova um ambiente de staging ativo. O workflow não roda a suíte de testes da interface.

Após publicação autorizada, confira carregamento da interface, `/api/health`, login/sessão, proteção de rotas, escopo por sítio e anexos/relatórios no namespace correto. Preserve backups e histórico; a conferência não autoriza reset de dados nem execução de seeds.

O health testa conexão e configuração e identifica migrations interrompidas. `migrations.upToDate=true` significa ausência de execução interrompida, não comparação de todas as migrations do repositório com o banco; `null` é inconclusivo e ainda pode acompanhar HTTP 200. Confira a aplicação da cadeia pelos comandos/logs do Prisma. `commit` e `buildId` dependem das variáveis injetadas pelo deploy e podem ser `null` em outros caminhos. HTTP 200 isolado não comprova schema atualizado nem homologação funcional.
