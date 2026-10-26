# Configuração e deploy em Cloudflare

O único destino de deploy é **Cloudflare Workers**: interface e API no mesmo Worker, PostgreSQL no Neon e arquivos no R2. Node atende desenvolvimento local e testes; a ferramenta de build requer Node 22+. Este guia descreve a configuração do repositório; o commit e o schema aplicados em produção precisam ser conferidos no ambiente e nos logs de publicação.

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

Esse comando compila a interface e inicia o Worker local. Para Workers Builds, configure o build com instalação das dependências, geração do Prisma Client e `pnpm cf:build`; o deploy command é `sh scripts/cf-deploy.sh`. O script aplica migrations, aborta se falharem e publica com commit/build ID. Quando encontra `APP_BASE_URL` ou a URL retornada pelo Wrangler, confere `/api/health`; sem ambas, informa que pulou essa conferência. Configure `DATABASE_URL`/`DIRECT_URL` também no escopo de build; variáveis de build e runtime são escopos distintos.

A baseline contém `FinalidadeAnimal` e a view atualizável de compatibilidade `DestinoAnimal`; a renomeação e suas migrations aditivas são história da cadeia anterior. Não remover a view enquanto versões antigas puderem atender. Views IATF preservam leitura, mas não oferecem escrita paralela ao núcleo comum. Rollback exige verificar dados, valores de enum e compatibilidade das versões; não basta retornar o código após mudanças estruturais. A implantação de um banco anterior à baseline precisa do plano de reconciliação acima, não da execução isolada de nomes antigos.

`pnpm cf:deploy` chama Wrangler diretamente depois do build do client e **não** executa o script de migrations/health. Não trate esses comandos como equivalentes. O repositório não seleciona sozinho a branch conectada ao provedor.

## CI e conferência após publicação

`.github/workflows/staging.yml` faz build, testes do servidor e integração com PostgreSQL efêmero; não publica a aplicação. Seu nome não comprova um ambiente de staging ativo. O job principal executa também a suíte da interface e contratos de importação/seed; jobs separados cobrem invariantes financeiros e baseline/seed unificada.

Após publicação autorizada, confira carregamento da interface, `/api/health`, login/sessão, proteção de rotas, escopo por sítio e anexos/relatórios no namespace correto. Preserve backups e histórico; a conferência não autoriza reset de dados nem execução de seeds.

O health testa conexão e configuração e identifica migrations interrompidas. `migrations.upToDate=true` significa ausência de execução interrompida, não comparação de todas as migrations do repositório com o banco; `null` é inconclusivo e ainda pode acompanhar HTTP 200. Confira a aplicação da cadeia pelos comandos/logs do Prisma. `commit` e `buildId` dependem das variáveis injetadas pelo deploy e podem ser `null` em outros caminhos. HTTP 200 isolado não comprova schema atualizado nem homologação funcional.
