# Sistema de contas, login e acesso — design

**Data:** 2026-07-14
**Branch:** `feat/auth-contas-login`
**Escopo desta fatia:** login real para **uma fazenda** (Rio Novo), reaproveitando o modelo de papéis/permissões que já está desenhado na tela de Acessos, com o **backend enforçando**. Sem isolamento de dados por fazenda (multi-tenant) nesta fatia — mas desenhado para não travá-lo depois.

## 1. Contexto e problema

Hoje a autenticação é uma **senha compartilhada única** (`SHARED_ACCESS_TOKEN`), checada em `server/src/middleware/auth.ts`, guardada no `localStorage` do cliente (`client/src/lib/auth.ts`) e enviada como `Authorization: Bearer <token>` em toda request. **Não há** modelo de usuário, papel, sessão nem senha no banco.

Em paralelo, a tela de **Acessos** (`client/src/components/Acessos.tsx` + `client/src/data/acessos.ts`) já desenha, **como mock em `useState`**, todo o modelo de autorização:

- **5 papéis** (presets): `proprietario`, `secretaria`, `contador`, `gestor`, `consulta` — mais `personalizado` quando as permissões divergem de um preset.
- **Abas** (visibilidade de navegação): dashboard, gastos, lancar, caixinha, plano, ia, relatorio.
- **Flags** (permissões sensíveis): `verValores`, `verInvestimento`, `verSalarios`, `lancar`, `exportar`, `gerenciarAcessos`.
- Fluxo de **convite** (status pendente/ativo/inativo) e **"ver como"** (preview).

O objetivo desta fatia é **substituir a senha única por contas reais**, ligar a tela de Acessos a um backend de verdade, e fazer o servidor **enforçar** as permissões que hoje só existem no front — mantendo o formato `Bearer <token>` para minimizar mudança no cliente.

### Decisões de escopo (definidas na fase de brainstorming)

1. **Alvo:** uma fazenda, login real (não multi-tenant agora). Alinhado com a direção de produto (YAGNI no multi-tenant — ver `product-direction-resale-multitenant`).
2. **Autenticação:** própria, **e-mail + senha**, sessão via **token opaco no Postgres** (não JWT). Mantém `Authorization: Bearer <token>`.
3. **Convite/reset:** **link copiável** (sem infra de e-mail). O mesmo mecanismo de token serve para plugar e-mail depois sem retrabalho.

## 2. Modelo de dados (Prisma)

Três models novos + dois enums. As permissões ficam **direto no `Usuario`** (espelhando `data/acessos.ts`), em vez de tabelas normalizadas de papel/permissão — mais simples e faz a tela de Acessos plugar quase direto. Os presets de papel continuam **em código** (`PAPEIS`); aplicar um preset só grava `abas`/`flags`.

```prisma
model Usuario {
  id           Int           @id @default(autoincrement())
  nome         String
  email        String        @unique          // normalizado lowercase
  senhaHash    String?                          // null enquanto convite pendente
  papel        String                           // chave de PAPEIS ou "personalizado"
  abas         String[]                          // visibilidade de abas (modelo Acessos)
  flags        String[]                          // permissões sensíveis
  status       StatusUsuario @default(PENDENTE)  // PENDENTE | ATIVO | INATIVO
  dono         Boolean       @default(false)     // proprietário: total e irrevogável
  ultimoAcesso DateTime?
  sessoes      Sessao[]
  tokens       TokenAcesso[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}

model Sessao {
  id        String   @id @default(cuid())
  usuarioId Int
  tokenHash String   @unique                    // guardamos só o HASH do token de sessão
  expiraEm  DateTime
  ultimoUso DateTime @default(now())
  userAgent String?
  criadaEm  DateTime @default(now())
  usuario   Usuario  @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  @@index([usuarioId])
}

model TokenAcesso {                              // convite + reset (mesmo mecanismo)
  id        String    @id @default(cuid())
  usuarioId Int
  tipo      TipoToken                            // CONVITE | RESET
  tokenHash String    @unique
  expiraEm  DateTime
  usadoEm   DateTime?
  criadoEm  DateTime  @default(now())
  usuario   Usuario   @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  @@index([usuarioId])
}

enum StatusUsuario { PENDENTE ATIVO INATIVO }
enum TipoToken     { CONVITE RESET }
```

**Regra de ouro de segurança:** nunca persistir o token cru — só o hash (SHA-256). Vazamento de banco não entrega sessão viva nem link de convite utilizável.

### Sync de schema

Seguir a pegadinha de deploy do projeto: prod roda `prisma db push` (não `migrate deploy`). Migration aditiva para dev; nada de backfill que dependa do SQL da migration em prod. Como são tabelas novas (sem `ALTER` em tabela existente crítica), o `db push` cria direto.

## 3. Backend — autenticação

Router fino `server/src/routes/auth.ts` → `server/src/services/auth/`, com cálculo puro isolado e testável (`hash.ts`, `token.ts`) separado do I/O Prisma (`services/auth/*.ts`), no padrão do repo.

| Rota | Corpo | Efeito |
|---|---|---|
| `POST /api/auth/login` | `{email, senha}` | valida credenciais → cria `Sessao` → devolve `{usuario, token}` |
| `POST /api/auth/logout` | — | revoga a sessão atual (apaga a `Sessao`) |
| `GET  /api/auth/me` | — | devolve o usuário da sessão (o front hidrata daqui no boot) |
| `GET  /api/auth/convite/:token` | — | valida convite; devolve nome/e-mail p/ a tela de definir senha |
| `POST /api/auth/convite/aceitar` | `{token, senha}` | grava `senhaHash`, `status=ATIVO`, marca token usado, cria sessão |
| `POST /api/auth/senha/redefinir` | `{token, senha}` | valida token RESET, grava nova senha, marca usado, revoga sessões antigas |

Rotas de auth ficam **isentas** do gate de sessão (montadas antes, como `health`/`whatsapp` hoje).

### Middleware

`authMiddleware` evolui de "comparar `Bearer` com senha única" para:

1. Extrai `Bearer <token>`; se ausente → 401.
2. Hasheia o token, busca `Sessao` por `tokenHash` não expirada.
3. Carrega o `Usuario` (status `ATIVO`); atualiza `ultimoUso`/`ultimoAcesso`.
4. `c.set("usuario", usuario)` para as rotas a jusante.

**Dev local sem config continua porta aberta** (mantém atrito baixo): se não houver `Usuario` nenhum e nenhuma env de auth setada, libera. `SHARED_ACCESS_TOKEN` permanece aceita como **ponte de transição** enquanto as contas reais não estão de pé; removida depois.

## 4. Backend — autorização (enforcement)

Helper `exigePermissao(flag)` (middleware) lê `c.get("usuario")` e barra com 403 se a flag faltar. O que **realmente** vira gate no servidor (confidencialidade ou escrita); as `abas` continuam guiando o front mas **não** são fronteira de segurança:

| Flag | Barra no backend |
|---|---|
| `lancar` | criar/editar/excluir `Lancamento` (respeitando também `FechamentoMensal`) |
| `exportar` | rotas de export / PDF / CSV |
| `gerenciarAcessos` | todo o `/api/usuarios/*` |
| `verSalarios` | rotas de folha/salário do módulo ponto |

`verValores` / `verInvestimento` seguem como **ocultação no front** (não são dados isolados por rota nesta fatia). `dono=true` implica todas as flags e é irrevogável.

### Admin de usuários

Router `server/src/routes/usuarios.ts`, todo protegido por `exigePermissao("gerenciarAcessos")`:

| Rota | Efeito |
|---|---|
| `GET  /api/usuarios` | lista usuários (com status, papel, contadores) |
| `POST /api/usuarios` | `{nome, email, papel}` → cria `PENDENTE` + token `CONVITE`; devolve o **link copiável** |
| `PATCH /api/usuarios/:id` | atualiza `papel`/`abas`/`flags`/`status` |
| `POST /api/usuarios/:id/convite` | regera link de convite (equivale a "reenviar") |
| `POST /api/usuarios/:id/reset` | gera link de reset de senha |
| `DELETE /api/usuarios/:id` | revoga (na prática `status=INATIVO` + apaga sessões); **dono é irrevogável** |

## 5. Frontend

- **`lib/auth.ts`**: passa a guardar token de sessão **+ usuário logado** (cache do `/api/auth/me`). `comAuth()` e `comPropriedade()` mantêm a assinatura.
- **`Login.tsx`**: formulário e-mail + senha batendo em `/api/auth/login`; erro amigável em 401; guarda token e redireciona.
- **Tela nova "Definir senha"**: rotas `/convite/:token` e `/senha/:token`. Valida o token (`GET /api/auth/convite/:token`), pede nova senha, chama aceitar/redefinir, loga a pessoa.
- **`App.tsx`**: troca o mock `usuarios` + `realUserId` pelo usuário real de `/api/auth/me`. O **"ver como"** continua existindo, mas explicitamente como **preview cosmético do dono** (muda só o que a UI mostra; a permissão real no servidor continua a do dono). As abas visíveis e os gates de UI derivam de `usuario.abas`/`usuario.flags` reais.
- **`Acessos.tsx`**: troca `useState` por chamadas de API (listar / criar / atualizar / revogar). Ao convidar/regerar, exibe o **link copiável** (com botão "copiar") em vez do toast "convite enviado".

## 6. Bootstrap e aposentadoria da senha única

- **Bootstrap do dono:** no boot, se a tabela `Usuario` estiver vazia e `AUTH_BOOTSTRAP_EMAIL` estiver setado, cria o dono (`dono=true`, papel `proprietario`, status `PENDENTE`) + token `CONVITE`, e **loga uma vez** o link de definir senha. (Análogo ao `garantirFundacaoPropriedade()` no boot.)
- **Transição:** `SHARED_ACCESS_TOKEN` continua funcionando enquanto setada (break-glass durante o rollout), mapeando para um acesso de dono sintético; removida quando as contas reais estiverem ativas.
- **Dev:** sem nenhuma env de auth e sem usuários → porta aberta, como hoje.

## 7. Segurança

- Senhas: **argon2id** (fallback bcrypt se argon indisponível no runtime de deploy). Nunca em texto claro, nunca no cliente.
- Tokens (sessão, convite, reset): 32 bytes aleatórios (`crypto.randomBytes`), entregues crus **uma vez**, persistidos apenas como **hash SHA-256**.
- Expiração: convite 7d · reset 1h · sessão ~30d (sliding via `ultimoUso`). Tokens de convite/reset são **single-use** (`usadoEm`).
- Rate-limit no `POST /api/auth/login` (por e-mail + IP) para conter brute force.
- Comparações sensíveis com `crypto.timingSafeEqual` (reaproveita o utilitário atual).
- `FechamentoMensal` permanece intocado: qualquer escrita de `Lancamento` continua respeitando mês fechado **além** da flag `lancar`.

## 8. Prontidão para multi-tenant (fatia futura, fora deste escopo)

`Usuario` não ganha coluna de tenant agora. Quando a Fase 2 (multi-tenant) chegar: adicionar `contaId`/`fazendaId` em `Usuario` (+ demais fatos), escopar leituras/escritas, e um onboarding de conta. O desenho de sessão/token já isola por usuário; nada aqui bloqueia essa evolução. **Não construir agora.**

## 9. Testes

Vitest no padrão do repo (`*.test.ts` ao lado do código, cálculo puro isolado):

- `services/auth/hash.test.ts` — hash/verify de senha.
- `services/auth/token.test.ts` — geração, hashing, expiração e single-use de tokens.
- `services/auth/sessao.test.ts` — criação/resolução/expiração de sessão.
- `services/auth/permissoes.test.ts` — `exigePermissao` concede/barra conforme flags; `dono` implica tudo.
- Cobrir o fluxo de convite (criar → aceitar → login) e reset (gerar → redefinir → sessões antigas revogadas).

## 10. Fora de escopo (explicitamente)

- Multi-tenant / isolamento de dados por fazenda (Fase 2).
- Envio de e-mail (convite/reset por link copiável nesta fatia).
- Login social / OAuth (Google).
- 2FA.
- Impersonação real de sessão (o "ver como" continua cosmético).
- Permissão por propriedade (papel é global ao login; escopo de propriedade continua o de multi-propriedade atual).
