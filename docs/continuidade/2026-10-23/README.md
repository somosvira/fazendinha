# Continuidade da sessão de compactação dos cartões

Registro solicitado pelo usuário para retomar o trabalho em outra máquina. Data: 23/10/2026, America/Sao_Paulo. Branch: `codex/consultas-visuais-complementares`. PR: [#326](https://github.com/somosvira/fazendinha/pull/326). O ponto de partida desta sessão foi `0bae72b1`.

## Objetivo e decisões aprovadas

O usuário primeiro pediu para executar a branch localmente. Depois apontou excesso de espaço vazio nos cartões de Animais e Lotes e a aparência nativa dos checkboxes de seleção. Pediu uma redução simples, preservando a interface existente. Foram gerados e apresentados mockups com as skills `impeccable` e `frontend-design`; o usuário respondeu “perfeito, pode seguir”.

A direção aprovada mantém Terrano, as cores e os cabeçalhos atuais. A mudança concentra-se na densidade dos cartões: cinco animais e quatro lotes por linha em desktop amplo, com menos colunas conforme a largura disponível. Não é uma nova direção visual para todo o produto. A preferência expressa nesta sessão foi diminuir padding, gráficos e espaços vazios, mantendo leitura e ações.

- Animais: ícone grande removido, categoria no cabeçalho, informações e métricas próximas, ações compactas. Checkbox petróleo com estados desmarcado, marcado e parcial; seleção também destaca o cartão.
- Lotes: gráfico de composição reduzido, espaços menores, peso médio, janela de GMD e cobertura preservados. Edição, ativação/desativação e abertura continuam disponíveis.
- Filtros, ordenação, paginação, permissões e a alternativa de tabela permanecem nos fluxos existentes.

O contrato vigente está em [Pecuária](../../pecuaria/README.md), especialmente “Consultas visuais de animais e fatos registrados”. Esta nota registra a continuidade da sessão, sem substituir esse contrato.

## Implementação que deve ser continuada

- `client/src/pecuaria/rebanho/telas/ListaAnimais.tsx`: classes locais para a grade/cartão, categoria no cabeçalho e estado parcial do checkbox de seleção da página. A seleção permanece no mesmo estado e nos mesmos handlers usados pela tabela.
- `client/src/pecuaria/rebanho/telas/lista-animais.css`: apresentação compacta e checkbox nativo estilizado, com foco visível e retorno à aparência nativa em cores forçadas. Categorias manuais podem ter dois marcadores e precisam quebrar linha sem sobrepor a identificação.
- `client/src/pecuaria/rebanho/telas/CartoesLotes.tsx`: classe específica para a grade de lotes.
- `client/src/pecuaria/rebanho/telas/lotes-visuais.css`: dimensões compactas do gráfico, composição e rodapé.
- `docs/pecuaria/README.md`: documentação do comportamento visual atual.

A grade usa `auto-fill` com largura mínima de 265 px para animais e 320 px para lotes, limitada à largura do contêiner. Cinco/quatro colunas são referências de desktop amplo, não uma contagem fixa em qualquer tela. Não houve alteração de API, schema, migration ou regra de negócio.

## Ambiente local e o que foi aprendido

O checkout desta máquina está em `/home/mathe/fazendinha`. Node observado: 24.13.0; pnpm: 10.7.1. O projeto requer Node 22+.

O `server/.env` encontrado inicialmente era antigo: apontava para Neon e tinha variáveis de armazenamento local já removidas do código. Não tinha as variáveis R2 exigidas pelo `env.ts` desta branch. O usuário informou que já havia configurado essas variáveis e forneceu a configuração para restaurá-las. O arquivo local foi atualizado, sem versionar seus valores.

Docker estava indisponível nesta distribuição WSL até o usuário abrir o Docker Desktop. Depois disso, `fazendinha-postgres-1` estava saudável e expunha PostgreSQL em **54332**. A configuração enviada pelo usuário mencionava **55432**, mas foi usada a porta realmente publicada pelo container. Os PostgreSQL que respondiam em 5432/5544 não aceitaram as credenciais padrão; não foram modificados.

Somente o banco **`fazendinha_seedatev3`** foi usado. `DATABASE_URL` e `DIRECT_URL` foram ajustadas para esse banco no Docker em `localhost:54332`, com `schema=public`. As migrations existentes já estavam aplicadas; o comando de desenvolvimento não encontrou migrations pendentes. Nenhum seed, reset, clone ou limpeza de banco foi executado.

A API exige `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NOTAS` e `STORAGE_NAMESPACE`. O namespace local é `dev`. A configuração fornecida descrevia os dados como placeholders para permitir o boot: **o health aprovado não comprova upload/download real em R2**. Não copiar credenciais para Git nem para esta nota; transferir o `.env` por canal privado e autorizado.

Ao final da implementação, a interface estava em `http://localhost:41875` e a API em `http://localhost:41873`. Vite encaminha `/api` para a API. Esses processos pertencem a esta máquina e não acompanham um `git pull`.

## Retomada em outra máquina

1. Buscar o remoto e abrir `codex/consultas-visuais-complementares`, preservando alterações locais existentes.
2. Ler `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `docs/README.md` e `docs/desenvolvimento.md`. Para mudanças pecuárias, ler também o contrato do domínio.
3. Executar `pnpm install` se necessário. Configurar `server/.env` fora do Git, com as variáveis exigidas pelo `server/src/env.ts`.
4. Abrir Docker e conferir o container, a porta publicada e a existência do banco autorizado. Não criar outro banco nem executar seeds para fazer a aplicação subir. O Compose deste checkout publica 54332.
5. Iniciar `pnpm dev` ou separar `pnpm dev:client` e `pnpm dev:server`. O script do servidor executa `prisma migrate deploy` antes de iniciar.
6. Conferir `/api/health` e `/api/health/db`, preferencialmente também pelo proxy em 41875.
7. Abrir `/pecuaria/rebanho/animais?visualAnimais=visual` e `/pecuaria/rebanho/lotes?visualLotes=visual`.

Os acessos fictícios do seed estão em `docs/desenvolvimento.md`. Não foi criado nem redefinido usuário nesta sessão. A conta demonstrativa de dono foi usada para a inspeção no navegador.

## Validação e limites

- Build da interface concluído com sucesso: `pnpm --filter rionovo-client build`.
- Testes específicos concluídos: **51 testes aprovados em três arquivos**. Comando correto:

  ```bash
  pnpm --filter rionovo-client exec vitest run \
    src/pecuaria/rebanho/telas/ListaAnimais.test.tsx \
    src/pecuaria/rebanho/telas/ListaLotes.test.tsx \
    src/pecuaria/rebanho/telas/CartoesLotes.test.tsx
  ```

- Uma execução anterior com `pnpm ... test -- ...` acabou iniciando a suíte inteira e terminou com SIGTERM. Não considerar a suíte completa aprovada nesta sessão; os testes específicos foram executados depois, com sucesso.
- Navegador Chromium via Playwright: telas em 1920×1080 e 390×844, sem overflow horizontal. Seleção individual, seleção parcial da página, seleção dos 20 animais e limpeza de seleção verificadas.
- Health: configuração válida, conexão local ativa e migrations sem pendências.
- Detector Impeccable: avisos consultivos de tokens/estilos; não substitui a inspeção visual. `git diff --check` passou.
- As capturas mostram a versão conferida durante a implementação; um ajuste final de quebra de linha nos marcadores de categoria foi feito depois da captura desktop. Dados das capturas são demonstrativos e podem mudar conforme o banco local.
- Não houve homologação operacional completa, teste real de R2, deploy, merge ou alteração de ambiente remoto nesta sessão.

## Imagens e arquivos que não viajam pelo Git

Referências aprovadas: [Animais](mockup-animais.png) e [Lotes](mockup-lotes.png). Mockups têm dados ilustrativos e não autorizam substituir dados reais.

Capturas da implementação: [Animais desktop](animais-desktop.png), [Animais celular](animais-mobile.png), [Lotes desktop](lotes-desktop.png) e [Lotes celular](lotes-mobile.png).

Antes desta conversa já havia críticas, capturas e arquivos de revisão não rastreados em `.impeccable/`, `client/.impeccable/` e `output/`. Foram preservados nesta máquina; não são mudanças produzidas por esta sessão. Os scripts temporários de inspeção e logs em `output/cards-compactos/` também ficam locais. As referências e capturas necessárias à continuidade foram copiadas para esta pasta.

Git transporta código e esta documentação, mas não o processo em execução, banco, `.env`, manifestos locais do seed, preferências do navegador ou o histórico nativo desta conversa no aplicativo. Este documento permite retomar o contexto com um novo agente; não garante que a mesma conversa apareça na outra máquina. Não há pendência de implementação solicitada após a compactação; o pedido atual é registrar e enviar o trabalho ao PR.
