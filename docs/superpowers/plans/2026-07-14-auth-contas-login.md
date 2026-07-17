# Sistema de Contas, Login e Acesso — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a senha compartilhada única por contas reais (e-mail + senha, sessão via token opaco no Postgres), ligar a tela de Acessos ao backend, e enforçar as permissões no servidor — para **uma fazenda** (sem multi-tenant).

**Architecture:** Auth próprio no backend Hono/Prisma. Cores puros e testáveis (`services/auth/{hash,token,permissoes}.ts`) separados dos wrappers Prisma (`services/auth/{usuarios,sessao,contas}.ts`), no split `.calc`/I-O do repo. O `authMiddleware` passa a resolver `Bearer <token>` → `Sessao` → `Usuario` e injeta `c.set("usuario", …)`. Um `exigePermissao(flag)` barra rotas sensíveis. No front, `lib/auth.ts` guarda token+usuário, `Login` vira e-mail+senha, `Acessos` chama a API, e uma tela "Definir senha" consome os links de convite/reset.

**Tech Stack:** Hono, Prisma 6, Zod, `@hono/zod-validator`, Vitest. Hashing de senha via **Node `crypto.scrypt`** (built-in — zero dependência nova, sem módulo nativo pra compilar no deploy). React 18 + Vite no front.

## Global Constraints

- **Hashing de senha:** `crypto.scrypt` (built-in). Refina o spec, que citava argon2id — scrypt é o KDF de senha nativo do Node e evita adicionar dependência/módulo nativo (o app roda em Render/Neon). É um KDF adequado; mantemos os demais requisitos de segurança do spec.
- **ESM no server:** todo import relativo `.ts` termina em `.js` (ex.: `import { env } from "../env.js"`).
- **Nunca persistir token cru:** só o hash SHA-256. Tokens (sessão/convite/reset) = 32 bytes aleatórios entregues **uma vez**.
- **Env:** importar de `server/src/env.ts` (Zod), nunca `process.env` direto.
- **Escrita de `Lancamento`** continua respeitando `FechamentoMensal` **além** da flag `lancar`.
- **Prisma em prod** aplica schema via `prisma db push` (não `migrate deploy`) — nada de backfill dependente de SQL de migration.
- **Dev sem config:** porta aberta continua funcionando (sem usuários + sem env de auth → libera).
- **Mensagens ao usuário em PT-BR.** Identificadores em português (padrão do repo).
- **Front:** imports relativos sem extensão; usar `comPropriedade()`/`comAuth()` existentes; cores de atividade e estilo via tokens já existentes.
- **Expirações:** convite 7d · reset 1h · sessão 30d (sliding).

---

## File Structure

**Backend — criar:**
- `server/src/services/auth/hash.ts` — hash/verify de senha (puro).
- `server/src/services/auth/hash.test.ts`
- `server/src/services/auth/token.ts` — gerar/hashear/expirar token (puro).
- `server/src/services/auth/token.test.ts`
- `server/src/services/auth/papeis.ts` — ABAS/FLAGS/PAPEIS + `aplicarPreset`/`temPermissao` (puro).
- `server/src/services/auth/papeis.test.ts`
- `server/src/services/auth/usuarios.ts` — CRUD Prisma + bootstrap do dono (I/O).
- `server/src/services/auth/sessao.ts` — criar/resolver/revogar sessão (I/O).
- `server/src/services/auth/contas.ts` — orquestra login/convite/reset + geração de link (I/O).
- `server/src/routes/auth.ts` — rotas públicas + me/logout.
- `server/src/routes/usuarios.ts` — admin (guardado por `gerenciarAcessos`).
- `server/src/middleware/permissao.ts` — `exigePermissao(flag)` + `getUsuario(c)`.

**Backend — modificar:**
- `server/prisma/schema.prisma` — models `Usuario`/`Sessao`/`TokenAcesso` + enums.
- `server/src/env.ts` — `AUTH_BOOTSTRAP_EMAIL`, `AUTH_BOOTSTRAP_NOME`, `APP_BASE_URL`, `AUTH_SESSAO_DIAS`.
- `server/src/middleware/auth.ts` — resolução de sessão (reescrita).
- `server/src/index.ts` — montar `authRouter`/`usuariosRouter`, isentar `/api/auth/*`, bootstrap do dono no boot, gates de enforcement.
- `server/src/routes/lancamentos.ts` — `exigePermissao("lancar")` nas escritas.
- `server/src/routes/ponto/*` (folha/salário) — `exigePermissao("verSalarios")`.
- `server/.env.example` — novas envs.

**Frontend — criar:**
- `client/src/api/auth.ts` — client de auth + admin de usuários.
- `client/src/components/DefinirSenha.tsx` — tela de convite/reset.

**Frontend — modificar:**
- `client/src/lib/auth.ts` — token + usuário em cache.
- `client/src/components/Login.tsx` — e-mail + senha.
- `client/src/App.tsx` — gate real, hidratar usuário de `/api/auth/me`, rota de convite/reset.
- `client/src/components/Acessos.tsx` — API real + link copiável.

---

## Task 1: Schema Prisma — Usuario, Sessao, TokenAcesso

**Files:**
- Modify: `server/prisma/schema.prisma` (append ao final)

**Interfaces:**
- Produces: models `Usuario`, `Sessao`, `TokenAcesso`; enums `StatusUsuario`, `TipoToken`.

- [ ] **Step 1: Adicionar os models ao schema**

Append ao final de `server/prisma/schema.prisma`:

```prisma
enum StatusUsuario {
  PENDENTE
  ATIVO
  INATIVO
}

enum TipoToken {
  CONVITE
  RESET
}

model Usuario {
  id           Int           @id @default(autoincrement())
  nome         String
  email        String        @unique
  senhaHash    String?
  papel        String
  abas         String[]
  flags        String[]
  status       StatusUsuario @default(PENDENTE)
  dono         Boolean       @default(false)
  ultimoAcesso DateTime?
  sessoes      Sessao[]
  tokens       TokenAcesso[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}

model Sessao {
  id        String   @id @default(cuid())
  usuarioId Int
  tokenHash String   @unique
  expiraEm  DateTime
  ultimoUso DateTime @default(now())
  userAgent String?
  criadaEm  DateTime @default(now())
  usuario   Usuario  @relation(fields: [usuarioId], references: [id], onDelete: Cascade)

  @@index([usuarioId])
}

model TokenAcesso {
  id        String    @id @default(cuid())
  usuarioId Int
  tipo      TipoToken
  tokenHash String    @unique
  expiraEm  DateTime
  usadoEm   DateTime?
  criadoEm  DateTime  @default(now())
  usuario   Usuario   @relation(fields: [usuarioId], references: [id], onDelete: Cascade)

  @@index([usuarioId])
}
```

- [ ] **Step 2: Validar o schema**

Run: `pnpm --filter rionovo-server exec prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 3: Sincronizar o banco e regenerar o client**

Run: `pnpm --filter rionovo-server run db:push`
Expected: cria as 3 tabelas; termina com `Your database is now in sync with your Prisma schema.` e regenera o client.

- [ ] **Step 4: Commit**

```bash
git add server/prisma/schema.prisma
git commit -m "feat(auth): schema Usuario/Sessao/TokenAcesso"
```

---

## Task 2: Core puro — hash de senha (scrypt)

**Files:**
- Create: `server/src/services/auth/hash.ts`
- Test: `server/src/services/auth/hash.test.ts`

**Interfaces:**
- Produces:
  - `hashSenha(senha: string): string` — devolve string codificada `scrypt$N$r$p$saltB64$hashB64`.
  - `verificarSenha(senha: string, codificado: string): boolean` — timing-safe; `false` se formato inválido.

- [ ] **Step 1: Escrever o teste que falha**

`server/src/services/auth/hash.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hashSenha, verificarSenha } from "./hash.js";

describe("hashSenha / verificarSenha", () => {
  it("hash não é a senha em claro e tem o prefixo scrypt", () => {
    const h = hashSenha("segredo-forte-123");
    expect(h).not.toContain("segredo-forte-123");
    expect(h.startsWith("scrypt$")).toBe(true);
  });

  it("verifica a senha correta", () => {
    const h = hashSenha("senhaCorreta!");
    expect(verificarSenha("senhaCorreta!", h)).toBe(true);
  });

  it("rejeita senha errada", () => {
    const h = hashSenha("senhaCorreta!");
    expect(verificarSenha("outraCoisa", h)).toBe(false);
  });

  it("dois hashes da mesma senha diferem (salt aleatório)", () => {
    expect(hashSenha("igual")).not.toBe(hashSenha("igual"));
  });

  it("formato inválido → false, sem lançar", () => {
    expect(verificarSenha("x", "lixo")).toBe(false);
    expect(verificarSenha("x", "")).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter rionovo-server exec vitest run src/services/auth/hash.test.ts`
Expected: FAIL — `Cannot find module './hash.js'`.

- [ ] **Step 3: Implementar**

`server/src/services/auth/hash.ts`:

```ts
// Hash de senha com scrypt (KDF nativo do Node). Formato codificado:
// scrypt$N$r$p$<saltBase64>$<hashBase64>. Comparação timing-safe.
import crypto from "node:crypto";

const N = 16384; // custo CPU/memória
const R = 8;
const P = 1;
const KEYLEN = 64;

export function hashSenha(senha: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(senha, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verificarSenha(senha: string, codificado: string): boolean {
  const partes = codificado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = partes;
  try {
    const salt = Buffer.from(saltB64, "base64");
    const esperado = Buffer.from(hashB64, "base64");
    const derivado = crypto.scryptSync(senha, salt, esperado.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return derivado.length === esperado.length && crypto.timingSafeEqual(derivado, esperado);
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter rionovo-server exec vitest run src/services/auth/hash.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/auth/hash.ts server/src/services/auth/hash.test.ts
git commit -m "feat(auth): hash de senha com scrypt"
```

---

## Task 3: Core puro — geração e expiração de token

**Files:**
- Create: `server/src/services/auth/token.ts`
- Test: `server/src/services/auth/token.test.ts`

**Interfaces:**
- Produces:
  - `gerarToken(): { raw: string; hash: string }` — `raw` = 32 bytes hex; `hash` = sha256(raw) hex.
  - `hashToken(raw: string): string` — sha256 hex.
  - `tokenExpirado(expiraEm: Date, agora?: Date): boolean`.
  - `expiraConvite(agora?: Date): Date` (agora + 7d), `expiraReset(agora?: Date): Date` (agora + 1h).

- [ ] **Step 1: Escrever o teste que falha**

`server/src/services/auth/token.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { gerarToken, hashToken, tokenExpirado, expiraConvite, expiraReset } from "./token.js";

describe("token", () => {
  it("gerarToken devolve raw hex de 64 chars e hash consistente", () => {
    const { raw, hash } = gerarToken();
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashToken(raw));
    expect(hash).not.toBe(raw);
  });

  it("dois tokens diferem", () => {
    expect(gerarToken().raw).not.toBe(gerarToken().raw);
  });

  it("tokenExpirado: passado → true, futuro → false", () => {
    const agora = new Date("2026-07-14T12:00:00Z");
    expect(tokenExpirado(new Date("2026-07-14T11:00:00Z"), agora)).toBe(true);
    expect(tokenExpirado(new Date("2026-07-14T13:00:00Z"), agora)).toBe(false);
  });

  it("expiraConvite = +7 dias; expiraReset = +1 hora", () => {
    const agora = new Date("2026-07-14T12:00:00Z");
    expect(expiraConvite(agora).toISOString()).toBe("2026-07-21T12:00:00.000Z");
    expect(expiraReset(agora).toISOString()).toBe("2026-07-14T13:00:00.000Z");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter rionovo-server exec vitest run src/services/auth/token.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

`server/src/services/auth/token.ts`:

```ts
// Tokens opacos (sessão, convite, reset): 32 bytes aleatórios entregues crus
// UMA vez; no banco guardamos só o sha256. Helpers de expiração puros.
import crypto from "node:crypto";

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function gerarToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  return { raw, hash: hashToken(raw) };
}

export function tokenExpirado(expiraEm: Date, agora: Date = new Date()): boolean {
  return expiraEm.getTime() <= agora.getTime();
}

export function expiraConvite(agora: Date = new Date()): Date {
  return new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);
}

export function expiraReset(agora: Date = new Date()): Date {
  return new Date(agora.getTime() + 60 * 60 * 1000);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter rionovo-server exec vitest run src/services/auth/token.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/auth/token.ts server/src/services/auth/token.test.ts
git commit -m "feat(auth): tokens opacos + helpers de expiração"
```

---

## Task 4: Core puro — papéis, presets e permissões

**Files:**
- Create: `server/src/services/auth/papeis.ts`
- Test: `server/src/services/auth/papeis.test.ts`

**Interfaces:**
- Produces:
  - `ABAS_IDS: string[]`, `FLAGS_IDS: Flag[]`.
  - `type Flag = "verValores" | "verInvestimento" | "verSalarios" | "lancar" | "exportar" | "gerenciarAcessos"`.
  - `PAPEIS: Record<string, { abas: string[]; flags: Flag[] }>` (espelha `client/src/data/acessos.ts`).
  - `aplicarPreset(papel: string): { abas: string[]; flags: Flag[] }` — `{abas:[],flags:[]}` se papel desconhecido/"personalizado".
  - `temPermissao(u: { dono: boolean; flags: string[] }, flag: Flag): boolean` — `dono` ⇒ sempre `true`.

- [ ] **Step 1: Escrever o teste que falha**

`server/src/services/auth/papeis.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { PAPEIS, aplicarPreset, temPermissao } from "./papeis.js";

describe("papeis", () => {
  it("proprietario tem todas as flags", () => {
    expect(PAPEIS.proprietario.flags).toContain("gerenciarAcessos");
    expect(PAPEIS.proprietario.flags).toContain("verSalarios");
  });

  it("aplicarPreset devolve cópias (mutar o retorno não afeta o preset)", () => {
    const p = aplicarPreset("secretaria");
    p.abas.push("x");
    expect(PAPEIS.secretaria.abas).not.toContain("x");
  });

  it("aplicarPreset de papel desconhecido → vazio", () => {
    expect(aplicarPreset("personalizado")).toEqual({ abas: [], flags: [] });
  });

  it("temPermissao respeita a flag", () => {
    expect(temPermissao({ dono: false, flags: ["lancar"] }, "lancar")).toBe(true);
    expect(temPermissao({ dono: false, flags: ["lancar"] }, "exportar")).toBe(false);
  });

  it("dono implica qualquer permissão", () => {
    expect(temPermissao({ dono: true, flags: [] }, "gerenciarAcessos")).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter rionovo-server exec vitest run src/services/auth/papeis.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

`server/src/services/auth/papeis.ts` (valores idênticos aos de `client/src/data/acessos.ts`):

```ts
// Espelho server-side do modelo de Acessos do front (client/src/data/acessos.ts).
// Presets de papel + checagem de permissão. Puro e testável.
export type Flag =
  | "verValores"
  | "verInvestimento"
  | "verSalarios"
  | "lancar"
  | "exportar"
  | "gerenciarAcessos";

export const ABAS_IDS = ["dashboard", "gastos", "lancar", "caixinha", "plano", "ia", "relatorio"];
export const FLAGS_IDS: Flag[] = ["verValores", "verInvestimento", "verSalarios", "lancar", "exportar", "gerenciarAcessos"];

export const PAPEIS: Record<string, { abas: string[]; flags: Flag[] }> = {
  proprietario: {
    abas: ["dashboard", "gastos", "lancar", "caixinha", "plano", "ia", "relatorio"],
    flags: ["verValores", "verInvestimento", "verSalarios", "lancar", "exportar", "gerenciarAcessos"],
  },
  secretaria: {
    abas: ["gastos", "lancar", "caixinha", "plano", "ia"],
    flags: ["verValores", "verSalarios", "lancar"],
  },
  contador: {
    abas: ["dashboard", "gastos", "plano", "relatorio"],
    flags: ["verValores", "verInvestimento", "verSalarios", "exportar"],
  },
  gestor: {
    abas: ["dashboard", "gastos", "ia", "relatorio"],
    flags: ["verValores", "verInvestimento"],
  },
  consulta: {
    abas: ["dashboard", "relatorio"],
    flags: ["verValores", "verInvestimento"],
  },
};

export function aplicarPreset(papel: string): { abas: string[]; flags: Flag[] } {
  const p = PAPEIS[papel];
  return p ? { abas: [...p.abas], flags: [...p.flags] } : { abas: [], flags: [] };
}

export function temPermissao(u: { dono: boolean; flags: string[] }, flag: Flag): boolean {
  return u.dono || u.flags.includes(flag);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter rionovo-server exec vitest run src/services/auth/papeis.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/auth/papeis.ts server/src/services/auth/papeis.test.ts
git commit -m "feat(auth): papéis, presets e checagem de permissão (puro)"
```

---

## Task 5: Env + .env.example

**Files:**
- Modify: `server/src/env.ts` (dentro do `z.object`, após `OCR_ENABLED`, antes do `.superRefine`)
- Modify: `server/.env.example`

**Interfaces:**
- Produces: `env.AUTH_BOOTSTRAP_EMAIL?`, `env.AUTH_BOOTSTRAP_NOME`, `env.APP_BASE_URL`, `env.AUTH_SESSAO_DIAS`.

- [ ] **Step 1: Adicionar as envs ao schema Zod**

Em `server/src/env.ts`, dentro do `z.object({...})` (logo após `OCR_ENABLED`):

```ts
    // --- Contas / login (Fatia auth) ---
    // Se setado e a tabela Usuario estiver vazia, o boot cria o dono com este
    // e-mail (status PENDENTE) e loga um link de definir-senha uma vez.
    AUTH_BOOTSTRAP_EMAIL: z.string().email().optional(),
    AUTH_BOOTSTRAP_NOME: z.string().default("Proprietário"),
    // Base absoluta para montar links de convite/reset (ex.: https://rionovo.com.br).
    // Vazio → link relativo "/convite/<token>" (o dono prefixa o domínio).
    APP_BASE_URL: z.string().default(""),
    // Validade da sessão em dias (sliding).
    AUTH_SESSAO_DIAS: z.coerce.number().int().positive().default(30),
```

- [ ] **Step 2: Documentar no .env.example**

Append em `server/.env.example`:

```
# --- Contas / login ---
# Cria o dono no primeiro boot (tabela Usuario vazia). Deixe vazio depois de criado.
AUTH_BOOTSTRAP_EMAIL=
AUTH_BOOTSTRAP_NOME=Proprietário
# Base p/ links de convite/reset (vazio = link relativo)
APP_BASE_URL=
AUTH_SESSAO_DIAS=30
```

- [ ] **Step 3: Verificar que o typecheck passa (env válida)**

Run: `pnpm --filter rionovo-server exec tsc -p tsconfig.json --noEmit`
Expected: sem erros de tipo.

- [ ] **Step 4: Commit**

```bash
git add server/src/env.ts server/.env.example
git commit -m "feat(auth): envs de bootstrap/sessão/base-url"
```

---

## Task 6: Serviço de sessão (Prisma)

**Files:**
- Create: `server/src/services/auth/sessao.ts`

**Interfaces:**
- Consumes: `gerarToken`, `hashToken`, `tokenExpirado` (Task 3); `prisma` (`../../db.js`); `env.AUTH_SESSAO_DIAS`.
- Produces:
  - `type UsuarioContexto = { id: number; nome: string; email: string; papel: string; abas: string[]; flags: string[]; status: string; dono: boolean }`.
  - `criarSessao(usuarioId: number, userAgent?: string): Promise<string>` — devolve o token **cru**.
  - `resolverSessao(rawToken: string): Promise<UsuarioContexto | null>` — null se ausente/expirada/usuário não-ATIVO; atualiza `ultimoUso` e `Usuario.ultimoAcesso`, renova `expiraEm` (sliding).
  - `revogarSessao(rawToken: string): Promise<void>`.
  - `revogarSessoesDoUsuario(usuarioId: number): Promise<void>`.

- [ ] **Step 1: Implementar**

`server/src/services/auth/sessao.ts`:

```ts
import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { gerarToken, hashToken, tokenExpirado } from "./token.js";

export type UsuarioContexto = {
  id: number;
  nome: string;
  email: string;
  papel: string;
  abas: string[];
  flags: string[];
  status: string;
  dono: boolean;
};

function expiraSessao(agora: Date = new Date()): Date {
  return new Date(agora.getTime() + env.AUTH_SESSAO_DIAS * 24 * 60 * 60 * 1000);
}

export async function criarSessao(usuarioId: number, userAgent?: string): Promise<string> {
  const { raw, hash } = gerarToken();
  await prisma.sessao.create({
    data: { usuarioId, tokenHash: hash, expiraEm: expiraSessao(), userAgent: userAgent ?? null },
  });
  return raw;
}

export async function resolverSessao(rawToken: string): Promise<UsuarioContexto | null> {
  const hash = hashToken(rawToken);
  const s = await prisma.sessao.findUnique({ where: { tokenHash: hash }, include: { usuario: true } });
  if (!s) return null;
  if (tokenExpirado(s.expiraEm)) {
    await prisma.sessao.delete({ where: { id: s.id } }).catch(() => {});
    return null;
  }
  if (s.usuario.status !== "ATIVO") return null;
  const agora = new Date();
  await prisma.sessao.update({ where: { id: s.id }, data: { ultimoUso: agora, expiraEm: expiraSessao(agora) } });
  await prisma.usuario.update({ where: { id: s.usuarioId }, data: { ultimoAcesso: agora } });
  const u = s.usuario;
  return { id: u.id, nome: u.nome, email: u.email, papel: u.papel, abas: u.abas, flags: u.flags, status: u.status, dono: u.dono };
}

export async function revogarSessao(rawToken: string): Promise<void> {
  await prisma.sessao.deleteMany({ where: { tokenHash: hashToken(rawToken) } });
}

export async function revogarSessoesDoUsuario(usuarioId: number): Promise<void> {
  await prisma.sessao.deleteMany({ where: { usuarioId } });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter rionovo-server exec tsc -p tsconfig.json --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/auth/sessao.ts
git commit -m "feat(auth): serviço de sessão (criar/resolver/revogar)"
```

---

## Task 7: Serviço de usuários + bootstrap do dono (Prisma)

**Files:**
- Create: `server/src/services/auth/usuarios.ts`

**Interfaces:**
- Consumes: `prisma`, `aplicarPreset` (Task 4), `env` (`AUTH_BOOTSTRAP_EMAIL`, `AUTH_BOOTSTRAP_NOME`), `revogarSessoesDoUsuario` (Task 6), `gerarLinkConvite` (Task 8 — `./contas.js`).
- Produces:
  - `type UsuarioDTO = { id; nome; email; papel; abas; flags; status; dono; ultimoAcesso: string | null }` (sem `senhaHash`).
  - `usuarioDTO(u): UsuarioDTO`.
  - `class UsuarioError extends Error { code: "EMAIL_DUPLICADO" | "NAO_ENCONTRADO" | "DONO_IRREVOGAVEL" }`.
  - `listarUsuarios(): Promise<UsuarioDTO[]>`.
  - `criarUsuario(input: { nome: string; email: string; papel: string }): Promise<UsuarioDTO>`.
  - `atualizarUsuario(id: number, patch: { papel?: string; abas?: string[]; flags?: string[]; status?: "PENDENTE" | "ATIVO" | "INATIVO" }): Promise<UsuarioDTO>`.
  - `revogarUsuario(id: number): Promise<void>` — `status=INATIVO` + revoga sessões; lança se `dono`.
  - `garantirDonoBootstrap(): Promise<void>`.

- [ ] **Step 1: Implementar**

`server/src/services/auth/usuarios.ts`:

```ts
import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { aplicarPreset } from "./papeis.js";
import { revogarSessoesDoUsuario } from "./sessao.js";
import { gerarLinkConvite } from "./contas.js";

export type UsuarioDTO = {
  id: number;
  nome: string;
  email: string;
  papel: string;
  abas: string[];
  flags: string[];
  status: string;
  dono: boolean;
  ultimoAcesso: string | null;
};

export class UsuarioError extends Error {
  constructor(public code: "EMAIL_DUPLICADO" | "NAO_ENCONTRADO" | "DONO_IRREVOGAVEL", m: string) {
    super(m);
  }
}

export function usuarioDTO(u: {
  id: number; nome: string; email: string; papel: string; abas: string[]; flags: string[]; status: string; dono: boolean; ultimoAcesso: Date | null;
}): UsuarioDTO {
  return {
    id: u.id, nome: u.nome, email: u.email, papel: u.papel, abas: u.abas, flags: u.flags,
    status: u.status, dono: u.dono, ultimoAcesso: u.ultimoAcesso ? u.ultimoAcesso.toISOString() : null,
  };
}

export async function listarUsuarios(): Promise<UsuarioDTO[]> {
  const us = await prisma.usuario.findMany({ orderBy: [{ dono: "desc" }, { id: "asc" }] });
  return us.map(usuarioDTO);
}

export async function criarUsuario(input: { nome: string; email: string; papel: string }): Promise<UsuarioDTO> {
  const email = input.email.trim().toLowerCase();
  if (await prisma.usuario.findUnique({ where: { email } }))
    throw new UsuarioError("EMAIL_DUPLICADO", `já existe um acesso com o e-mail ${email}`);
  const preset = aplicarPreset(input.papel);
  const u = await prisma.usuario.create({
    data: { nome: input.nome.trim(), email, papel: input.papel, abas: preset.abas, flags: preset.flags, status: "PENDENTE" },
  });
  return usuarioDTO(u);
}

export async function atualizarUsuario(
  id: number,
  patch: { papel?: string; abas?: string[]; flags?: string[]; status?: "PENDENTE" | "ATIVO" | "INATIVO" },
): Promise<UsuarioDTO> {
  const atual = await prisma.usuario.findUnique({ where: { id } });
  if (!atual) throw new UsuarioError("NAO_ENCONTRADO", "usuário não encontrado");
  const u = await prisma.usuario.update({
    where: { id },
    data: {
      papel: patch.papel ?? undefined,
      abas: patch.abas ?? undefined,
      flags: patch.flags ?? undefined,
      status: patch.status ?? undefined,
    },
  });
  return usuarioDTO(u);
}

export async function revogarUsuario(id: number): Promise<void> {
  const u = await prisma.usuario.findUnique({ where: { id } });
  if (!u) throw new UsuarioError("NAO_ENCONTRADO", "usuário não encontrado");
  if (u.dono) throw new UsuarioError("DONO_IRREVOGAVEL", "o acesso do proprietário é irrevogável");
  await prisma.usuario.update({ where: { id }, data: { status: "INATIVO" } });
  await revogarSessoesDoUsuario(id);
}

export async function garantirDonoBootstrap(): Promise<void> {
  if (!env.AUTH_BOOTSTRAP_EMAIL) return;
  const total = await prisma.usuario.count();
  if (total > 0) return;
  const preset = aplicarPreset("proprietario");
  const dono = await prisma.usuario.create({
    data: {
      nome: env.AUTH_BOOTSTRAP_NOME,
      email: env.AUTH_BOOTSTRAP_EMAIL.toLowerCase(),
      papel: "proprietario",
      abas: preset.abas,
      flags: preset.flags,
      status: "PENDENTE",
      dono: true,
    },
  });
  const link = await gerarLinkConvite(dono.id);
  console.log(`\n[auth] Dono criado (${dono.email}). Link único para definir a senha:\n  ${link}\n`);
}
```

- [ ] **Step 2: Typecheck** (falhará até a Task 8 criar `./contas.js`)

Run: `pnpm --filter rionovo-server exec tsc -p tsconfig.json --noEmit`
Expected: erro `Cannot find module './contas.js'` — **esperado**; resolvido na Task 8. Fazer a Task 8 em seguida e commitar as duas juntas (Step 3 da Task 8).

---

## Task 8: Serviço de contas — login/convite/reset + links (Prisma)

**Files:**
- Create: `server/src/services/auth/contas.ts`

**Interfaces:**
- Consumes: `prisma`, `verificarSenha`/`hashSenha` (Task 2), `gerarToken`/`hashToken`/`tokenExpirado`/`expiraConvite`/`expiraReset` (Task 3), `criarSessao`/`revogarSessoesDoUsuario` (Task 6), `usuarioDTO`/`UsuarioDTO` (Task 7), `env.APP_BASE_URL`.
- Produces:
  - `autenticar(email: string, senha: string): Promise<UsuarioDTO | null>`.
  - `validarConvite(rawToken: string): Promise<{ nome: string; email: string } | null>`.
  - `aceitarConvite(rawToken: string, senha: string): Promise<UsuarioDTO | null>`.
  - `redefinirSenha(rawToken: string, senha: string): Promise<UsuarioDTO | null>`.
  - `gerarLinkConvite(usuarioId: number): Promise<string>`.
  - `gerarLinkReset(usuarioId: number): Promise<string>`.

- [ ] **Step 1: Implementar**

`server/src/services/auth/contas.ts`:

```ts
import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { hashSenha, verificarSenha } from "./hash.js";
import { gerarToken, hashToken, tokenExpirado, expiraConvite, expiraReset } from "./token.js";
import { criarSessao, revogarSessoesDoUsuario } from "./sessao.js";
import { usuarioDTO, type UsuarioDTO } from "./usuarios.js";

function montarLink(tipo: "convite" | "senha", raw: string): string {
  const base = env.APP_BASE_URL.replace(/\/$/, "");
  return `${base}/${tipo}/${raw}`;
}

async function novoToken(usuarioId: number, tipo: "CONVITE" | "RESET"): Promise<string> {
  const { raw, hash } = gerarToken();
  const expiraEm = tipo === "CONVITE" ? expiraConvite() : expiraReset();
  // um token vivo por tipo: invalida os anteriores não usados
  await prisma.tokenAcesso.deleteMany({ where: { usuarioId, tipo, usadoEm: null } });
  await prisma.tokenAcesso.create({ data: { usuarioId, tipo, tokenHash: hash, expiraEm } });
  return raw;
}

export async function gerarLinkConvite(usuarioId: number): Promise<string> {
  return montarLink("convite", await novoToken(usuarioId, "CONVITE"));
}

export async function gerarLinkReset(usuarioId: number): Promise<string> {
  return montarLink("senha", await novoToken(usuarioId, "RESET"));
}

export async function autenticar(email: string, senha: string): Promise<UsuarioDTO | null> {
  const u = await prisma.usuario.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!u || u.status !== "ATIVO" || !u.senhaHash) return null;
  if (!verificarSenha(senha, u.senhaHash)) return null;
  return usuarioDTO(u);
}

async function acharTokenValido(rawToken: string, tipo: "CONVITE" | "RESET") {
  const t = await prisma.tokenAcesso.findUnique({ where: { tokenHash: hashToken(rawToken) }, include: { usuario: true } });
  if (!t || t.tipo !== tipo || t.usadoEm || tokenExpirado(t.expiraEm)) return null;
  return t;
}

export async function validarConvite(rawToken: string): Promise<{ nome: string; email: string } | null> {
  const t = await acharTokenValido(rawToken, "CONVITE");
  return t ? { nome: t.usuario.nome, email: t.usuario.email } : null;
}

export async function aceitarConvite(rawToken: string, senha: string): Promise<UsuarioDTO | null> {
  const t = await acharTokenValido(rawToken, "CONVITE");
  if (!t) return null;
  const u = await prisma.usuario.update({
    where: { id: t.usuarioId },
    data: { senhaHash: hashSenha(senha), status: "ATIVO" },
  });
  await prisma.tokenAcesso.update({ where: { id: t.id }, data: { usadoEm: new Date() } });
  return usuarioDTO(u);
}

export async function redefinirSenha(rawToken: string, senha: string): Promise<UsuarioDTO | null> {
  const t = await acharTokenValido(rawToken, "RESET");
  if (!t) return null;
  const u = await prisma.usuario.update({
    where: { id: t.usuarioId },
    data: { senhaHash: hashSenha(senha), status: "ATIVO" },
  });
  await prisma.tokenAcesso.update({ where: { id: t.id }, data: { usadoEm: new Date() } });
  await revogarSessoesDoUsuario(t.usuarioId); // reset invalida sessões antigas
  return usuarioDTO(u);
}
```

> **Nota de ciclo de import:** `usuarios.ts` importa `gerarLinkConvite` de `contas.ts`, e `contas.ts` importa `usuarioDTO` de `usuarios.ts`. É um ciclo só de funções (nenhuma chama a outra em tempo de carga do módulo), que o ESM resolve por avaliação tardia. Se preferir eliminar o ciclo, extraia `usuarioDTO`/`UsuarioDTO` para um `dto.ts` e importe de lá nos dois. **Recomendado:** manter simples.

- [ ] **Step 2: Typecheck (Task 7 + 8 agora resolvem)**

Run: `pnpm --filter rionovo-server exec tsc -p tsconfig.json --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit (usuarios + contas juntos)**

```bash
git add server/src/services/auth/usuarios.ts server/src/services/auth/contas.ts
git commit -m "feat(auth): serviços de usuários e contas (login/convite/reset)"
```

---

## Task 9: Middleware — resolução de sessão + `exigePermissao`

**Files:**
- Modify: `server/src/middleware/auth.ts` (reescrita)
- Create: `server/src/middleware/permissao.ts`

**Interfaces:**
- Consumes: `resolverSessao`/`UsuarioContexto` (Task 6); `temPermissao`/`Flag`/`aplicarPreset` (Task 4); `env.SHARED_ACCESS_TOKEN`; `prisma`.
- Produces:
  - `authMiddleware` (resolve sessão → `c.set("usuario", …)`; dev porta aberta; ponte da senha compartilhada).
  - `getUsuario(c): UsuarioContexto | null`.
  - `exigePermissao(flag: Flag): MiddlewareHandler`.

- [ ] **Step 1: Reescrever `middleware/auth.ts`**

```ts
// Auth por sessão: resolve `Authorization: Bearer <token>` → Sessao → Usuario e
// injeta em c.set("usuario"). Rotas isentas (health, whatsapp, auth públicas)
// são montadas ANTES deste middleware no index.ts.
import type { MiddlewareHandler } from "hono";
import crypto from "node:crypto";
import { env } from "../env.js";
import { prisma } from "../db.js";
import { resolverSessao, type UsuarioContexto } from "../services/auth/sessao.js";
import { aplicarPreset } from "../services/auth/papeis.js";

function bearer(header: string | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : null;
}

function timingSafeMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

// Dono sintético para a ponte da senha compartilhada (rollout). Acesso total.
function donoSintetico(): UsuarioContexto {
  const preset = aplicarPreset("proprietario");
  return { id: 0, nome: "Proprietário", email: "", papel: "proprietario", abas: preset.abas, flags: preset.flags, status: "ATIVO", dono: true };
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const recebido = bearer(c.req.header("authorization"));

  // Ponte de transição: enquanto SHARED_ACCESS_TOKEN estiver setado, ele vale
  // como acesso de dono. Remover quando as contas reais estiverem de pé.
  if (env.SHARED_ACCESS_TOKEN && recebido && timingSafeMatch(recebido, env.SHARED_ACCESS_TOKEN)) {
    c.set("usuario", donoSintetico());
    return next();
  }

  if (recebido) {
    const usuario = await resolverSessao(recebido);
    if (usuario) {
      c.set("usuario", usuario);
      return next();
    }
  }

  // Dev local porta aberta: sem SHARED_ACCESS_TOKEN e sem nenhum usuário no banco.
  if (!env.SHARED_ACCESS_TOKEN) {
    const total = await prisma.usuario.count();
    if (total === 0) {
      c.set("usuario", donoSintetico());
      return next();
    }
  }

  return c.json({ error: "não autenticado" }, 401);
};
```

- [ ] **Step 2: Criar `middleware/permissao.ts`**

```ts
import type { Context, MiddlewareHandler } from "hono";
import { temPermissao, type Flag } from "../services/auth/papeis.js";
import type { UsuarioContexto } from "../services/auth/sessao.js";

export function getUsuario(c: Context): UsuarioContexto | null {
  return (c.get("usuario") as UsuarioContexto | undefined) ?? null;
}

export function exigePermissao(flag: Flag): MiddlewareHandler {
  return async (c, next) => {
    const u = getUsuario(c);
    if (!u) return c.json({ error: "não autenticado" }, 401);
    if (!temPermissao(u, flag)) return c.json({ error: "sem permissão" }, 403);
    return next();
  };
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter rionovo-server exec tsc -p tsconfig.json --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add server/src/middleware/auth.ts server/src/middleware/permissao.ts
git commit -m "feat(auth): middleware de sessão + exigePermissao"
```

---

## Task 10: Rotas de auth (login/logout/me/convite/reset)

**Files:**
- Create: `server/src/routes/auth.ts`

**Interfaces:**
- Consumes: `autenticar`/`validarConvite`/`aceitarConvite`/`redefinirSenha` (Task 8); `criarSessao`/`revogarSessao` (Task 6); `getUsuario` (Task 9).
- Produces:
  - `authPublicoRouter` — `POST /auth/login`, `GET /auth/convite/:token`, `POST /auth/convite/aceitar`, `POST /auth/senha/redefinir` (montado ANTES do gate).
  - `authPrivadoRouter` — `POST /auth/logout`, `GET /auth/me` (montado DEPOIS do gate).

- [ ] **Step 1: Implementar (dois routers: público e privado)**

`server/src/routes/auth.ts`:

```ts
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { autenticar, validarConvite, aceitarConvite, redefinirSenha } from "../services/auth/contas.js";
import { criarSessao, revogarSessao } from "../services/auth/sessao.js";
import { getUsuario } from "../middleware/permissao.js";

const loginSchema = z.object({ email: z.string().email(), senha: z.string().min(1) });
const senhaSchema = z.object({ token: z.string().min(1), senha: z.string().min(8, "mínimo 8 caracteres") });

function bearer(h: string | undefined): string | null {
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : null;
}

// Público — montado ANTES do authMiddleware (não exige sessão).
export const authPublicoRouter = new Hono()
  .post("/auth/login", zValidator("json", loginSchema), async (c) => {
    const { email, senha } = c.req.valid("json");
    const usuario = await autenticar(email, senha);
    if (!usuario) return c.json({ error: "e-mail ou senha inválidos" }, 401);
    const token = await criarSessao(usuario.id, c.req.header("user-agent"));
    return c.json({ token, usuario });
  })
  .get("/auth/convite/:token", async (c) => {
    const dados = await validarConvite(c.req.param("token"));
    if (!dados) return c.json({ error: "convite inválido ou expirado" }, 404);
    return c.json(dados);
  })
  .post("/auth/convite/aceitar", zValidator("json", senhaSchema), async (c) => {
    const { token, senha } = c.req.valid("json");
    const usuario = await aceitarConvite(token, senha);
    if (!usuario) return c.json({ error: "convite inválido ou expirado" }, 404);
    const sessao = await criarSessao(usuario.id, c.req.header("user-agent"));
    return c.json({ token: sessao, usuario });
  })
  .post("/auth/senha/redefinir", zValidator("json", senhaSchema), async (c) => {
    const { token, senha } = c.req.valid("json");
    const usuario = await redefinirSenha(token, senha);
    if (!usuario) return c.json({ error: "link inválido ou expirado" }, 404);
    const sessao = await criarSessao(usuario.id, c.req.header("user-agent"));
    return c.json({ token: sessao, usuario });
  });

// Privado — montado DEPOIS do authMiddleware (precisa de sessão resolvida).
export const authPrivadoRouter = new Hono()
  .post("/auth/logout", async (c) => {
    const raw = bearer(c.req.header("authorization"));
    if (raw) await revogarSessao(raw);
    return c.json({ ok: true });
  })
  .get("/auth/me", async (c) => {
    const u = getUsuario(c);
    if (!u) return c.json({ error: "não autenticado" }, 401);
    return c.json({ usuario: u });
  });
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter rionovo-server exec tsc -p tsconfig.json --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/auth.ts
git commit -m "feat(auth): rotas de login/logout/me/convite/reset"
```

---

## Task 11: Rotas admin de usuários

**Files:**
- Create: `server/src/routes/usuarios.ts`

**Interfaces:**
- Consumes: `listarUsuarios`/`criarUsuario`/`atualizarUsuario`/`revogarUsuario`/`UsuarioError` (Task 7); `gerarLinkConvite`/`gerarLinkReset` (Task 8); `exigePermissao` (Task 9).
- Produces: `usuariosRouter` (`GET/POST /usuarios`, `PATCH/DELETE /usuarios/:id`, `POST /usuarios/:id/convite`, `POST /usuarios/:id/reset`) — todo protegido por `gerenciarAcessos`.

- [ ] **Step 1: Implementar**

`server/src/routes/usuarios.ts`:

```ts
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { exigePermissao } from "../middleware/permissao.js";
import { listarUsuarios, criarUsuario, atualizarUsuario, revogarUsuario, UsuarioError } from "../services/auth/usuarios.js";
import { gerarLinkConvite, gerarLinkReset } from "../services/auth/contas.js";

const criarSchema = z.object({ nome: z.string().min(1), email: z.string().email(), papel: z.string().min(1) });
const patchSchema = z.object({
  papel: z.string().optional(),
  abas: z.array(z.string()).optional(),
  flags: z.array(z.string()).optional(),
  status: z.enum(["PENDENTE", "ATIVO", "INATIVO"]).optional(),
});

function erro(c: Context, e: unknown) {
  if (e instanceof UsuarioError) {
    const status = e.code === "NAO_ENCONTRADO" ? 404 : e.code === "EMAIL_DUPLICADO" ? 409 : 422;
    return c.json({ error: e.message, code: e.code }, status);
  }
  throw e;
}

export const usuariosRouter = new Hono()
  .use("/usuarios", exigePermissao("gerenciarAcessos"))
  .use("/usuarios/*", exigePermissao("gerenciarAcessos"))
  .get("/usuarios", async (c) => c.json({ usuarios: await listarUsuarios() }))
  .post("/usuarios", zValidator("json", criarSchema), async (c) => {
    try {
      const usuario = await criarUsuario(c.req.valid("json"));
      const conviteLink = await gerarLinkConvite(usuario.id);
      return c.json({ usuario, conviteLink }, 201);
    } catch (e) {
      return erro(c, e);
    }
  })
  .patch("/usuarios/:id", zValidator("json", patchSchema), async (c) => {
    try {
      const usuario = await atualizarUsuario(Number(c.req.param("id")), c.req.valid("json"));
      return c.json({ usuario });
    } catch (e) {
      return erro(c, e);
    }
  })
  .delete("/usuarios/:id", async (c) => {
    try {
      await revogarUsuario(Number(c.req.param("id")));
      return c.json({ ok: true });
    } catch (e) {
      return erro(c, e);
    }
  })
  .post("/usuarios/:id/convite", async (c) => {
    const conviteLink = await gerarLinkConvite(Number(c.req.param("id")));
    return c.json({ conviteLink });
  })
  .post("/usuarios/:id/reset", async (c) => {
    const resetLink = await gerarLinkReset(Number(c.req.param("id")));
    return c.json({ resetLink });
  });
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter rionovo-server exec tsc -p tsconfig.json --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/usuarios.ts
git commit -m "feat(auth): rotas admin de usuários (gerenciarAcessos)"
```

---

## Task 12: Montagem no index.ts + bootstrap no boot

**Files:**
- Modify: `server/src/index.ts` (imports, montagem, boot)

**Interfaces:**
- Consumes: `authPublicoRouter`/`authPrivadoRouter` (Task 10), `usuariosRouter` (Task 11), `garantirDonoBootstrap` (Task 7).

- [ ] **Step 1: Importar**

Após `import { healthRouter } from "./routes/health.js";` (linha 9) adicionar:

```ts
import { authPublicoRouter, authPrivadoRouter } from "./routes/auth.js";
import { usuariosRouter } from "./routes/usuarios.js";
import { garantirDonoBootstrap } from "./services/auth/usuarios.js";
```

- [ ] **Step 2: Reordenar a montagem — isentos ANTES do gate**

O bloco atual é (linhas ~77-79, e `whatsappRouter` está lá embaixo na ~123):

```ts
app.use("/api/*", authMiddleware);

app.route("/api", healthRouter);
app.route("/api", propriedadeRouter);
```

Substituir por:

```ts
// Isentos de sessão (montados ANTES do gate): health, whatsapp (valida por HMAC
// próprio) e as rotas públicas de auth (login/convite/reset).
app.route("/api", healthRouter);
app.route("/api", whatsappRouter);
app.route("/api", authPublicoRouter);

app.use("/api/*", authMiddleware);

// Protegidos (exigem sessão resolvida pelo authMiddleware):
app.route("/api", authPrivadoRouter);
app.route("/api", usuariosRouter);
app.route("/api", propriedadeRouter);
```

Depois, **remover** a linha `app.route("/api", whatsappRouter);` que já existia mais abaixo (≈123) para não montar duas vezes.

- [ ] **Step 3: Bootstrap do dono no boot**

No final do arquivo, após a linha `garantirFundacaoPropriedade().catch(...)` (≈137) adicionar:

```ts
// Cria o dono no primeiro boot (tabela Usuario vazia + AUTH_BOOTSTRAP_EMAIL).
garantirDonoBootstrap().catch((e) => console.error("[auth] falha no bootstrap do dono:", e));
```

- [ ] **Step 4: Typecheck + subir o server**

Run: `pnpm --filter rionovo-server exec tsc -p tsconfig.json --noEmit`
Expected: sem erros.

Run (com `.env` de dev, sem `SHARED_ACCESS_TOKEN`, tabela `Usuario` vazia): `pnpm dev:server`, e noutro terminal:
- `curl -s -o /dev/null -w "%{http_code}\n" localhost:41873/api/health` → `200`.
- `curl -s -o /dev/null -w "%{http_code}\n" localhost:41873/api/propriedades` → `200` (porta aberta dev).
- `curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:41873/api/auth/login -H "content-type: application/json" -d '{"email":"x@y.com","senha":"errada"}'` → `401`.

- [ ] **Step 5: Commit**

```bash
git add server/src/index.ts
git commit -m "feat(auth): montar rotas de auth + bootstrap do dono no boot"
```

---

## Task 13: Enforcement nas rotas sensíveis (lancar, verSalarios, exportar)

**Files:**
- Modify: `server/src/routes/lancamentos.ts` (escritas → `lancar`)
- Modify: rotas de folha/salário em `server/src/routes/ponto/` (leitura → `verSalarios`)
- Modify: rota(s) de export/PDF/CSV (→ `exportar`), se existirem como rota de servidor

**Interfaces:**
- Consumes: `exigePermissao` (Task 9).

- [ ] **Step 1: Localizar as escritas de lançamento**

Run: `grep -n "\.post(\|\.put(\|\.patch(\|\.delete(" server/src/routes/lancamentos.ts`
Expected: lista as rotas de escrita (criar/editar/excluir/estornar).

- [ ] **Step 2: Guardar as escritas com `exigePermissao("lancar")`**

No topo de `server/src/routes/lancamentos.ts`, importar:

```ts
import { exigePermissao } from "../middleware/permissao.js";
```

Adicionar o middleware como **primeiro** argumento de rota, em cada `post/put/patch/delete`. Padrão:

```ts
// antes:
lancamentosRouter.post("/lancamentos", zValidator("json", schema), async (c) => { … });
// depois:
lancamentosRouter.post("/lancamentos", exigePermissao("lancar"), zValidator("json", schema), async (c) => { … });
```

> A validação de `FechamentoMensal` existente permanece — o gate de permissão é **adicional**.

- [ ] **Step 3: Localizar e guardar as rotas de folha/salário**

Run: `grep -rn "folha\|salario\|salário\|pix\|cpf" server/src/routes/ponto/`
Expected: identifica as rotas que expõem salário/folha. Em cada uma, adicionar `exigePermissao("verSalarios")` como primeiro middleware (mesmo padrão do Step 2).

- [ ] **Step 4: Export (se houver rota de servidor)**

Run: `grep -rIn "pdf\|csv\|export" server/src/routes/`
Expected: se houver rota de export no servidor, guardar com `exigePermissao("exportar")`. Se o export for 100% client-side (html2pdf), **pular** este step e anotar no commit.

- [ ] **Step 5: Typecheck + verificação manual**

Run: `pnpm --filter rionovo-server exec tsc -p tsconfig.json --noEmit`
Expected: sem erros.

Verificação (server rodando; ter em mãos o token de sessão de um usuário ATIVO sem a flag `lancar`): `curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:41873/api/lancamentos -H "authorization: Bearer <token>" -H "content-type: application/json" -d '{}'`
Expected: `403`.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/lancamentos.ts server/src/routes/ponto/
git commit -m "feat(auth): enforcement de lancar/verSalarios/exportar nas rotas"
```

---

## Task 14: Frontend — `lib/auth.ts` guarda token + usuário

**Files:**
- Modify: `client/src/lib/auth.ts`

**Interfaces:**
- Produces:
  - `interface UsuarioSessao { id: number; nome: string; email: string; papel: string; abas: string[]; flags: string[]; status: string; dono: boolean }`.
  - `getUsuario(): UsuarioSessao | null`, `setSessao(token: string, u: UsuarioSessao): void`, `clearSessao(): void`.
  - mantém `getToken`/`setToken`/`clearToken`/`comAuth` (assinaturas inalteradas).

- [ ] **Step 1: Adicionar cache de usuário**

Append em `client/src/lib/auth.ts` (mantendo o que já existe):

```ts
const CHAVE_USER = "rionovo:usuario";

export interface UsuarioSessao {
  id: number;
  nome: string;
  email: string;
  papel: string;
  abas: string[];
  flags: string[];
  status: string;
  dono: boolean;
}

export function getUsuario(): UsuarioSessao | null {
  try {
    const raw = localStorage.getItem(CHAVE_USER);
    return raw ? (JSON.parse(raw) as UsuarioSessao) : null;
  } catch {
    return null;
  }
}

export function setSessao(token: string, u: UsuarioSessao): void {
  setToken(token);
  try {
    localStorage.setItem(CHAVE_USER, JSON.stringify(u));
  } catch {
    /* storage cheio */
  }
}

export function clearSessao(): void {
  clearToken();
  try {
    localStorage.removeItem(CHAVE_USER);
  } catch {
    /* ignore */
  }
}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter rionovo-client run build`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/auth.ts
git commit -m "feat(auth): lib/auth guarda usuário logado em cache"
```

---

## Task 15: Frontend — client de API de auth

**Files:**
- Create: `client/src/api/auth.ts`

**Interfaces:**
- Consumes: `comPropriedade` (`../propriedadeScope`), `UsuarioSessao` (Task 14).
- Produces: `login`, `logout`, `fetchMe`, `validarConvite`, `aceitarConvite`, `redefinirSenha`, `listarUsuarios`, `criarUsuario`, `atualizarUsuario`, `revogarUsuario`, `gerarConvite`, `gerarReset` (assinaturas no código abaixo).

- [ ] **Step 1: Confirmar a assinatura de `comPropriedade`**

Run: `grep -n "export function comPropriedade\|export const comPropriedade" client/src/propriedadeScope.ts`
Expected: ver se aceita um objeto de headers base. Se **não** aceitar argumento, no código abaixo troque cada `comPropriedade(JSON_H)` por `{ ...JSON_H, ...comPropriedade() }`.

- [ ] **Step 2: Implementar**

`client/src/api/auth.ts`:

```ts
import { comPropriedade } from "../propriedadeScope";
import type { UsuarioSessao } from "../lib/auth";

const JSON_H = { "content-type": "application/json" };

async function ler<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `erro ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function login(email: string, senha: string) {
  const res = await fetch("/api/auth/login", { method: "POST", headers: JSON_H, body: JSON.stringify({ email, senha }) });
  return ler<{ token: string; usuario: UsuarioSessao }>(res);
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", headers: comPropriedade() }).catch(() => {});
}

export async function fetchMe(): Promise<UsuarioSessao | null> {
  const res = await fetch("/api/auth/me", { headers: comPropriedade() });
  if (res.status === 401) return null;
  const body = await ler<{ usuario: UsuarioSessao }>(res);
  return body.usuario;
}

export async function validarConvite(token: string) {
  const res = await fetch(`/api/auth/convite/${token}`);
  return ler<{ nome: string; email: string }>(res);
}

export async function aceitarConvite(token: string, senha: string) {
  const res = await fetch("/api/auth/convite/aceitar", { method: "POST", headers: JSON_H, body: JSON.stringify({ token, senha }) });
  return ler<{ token: string; usuario: UsuarioSessao }>(res);
}

export async function redefinirSenha(token: string, senha: string) {
  const res = await fetch("/api/auth/senha/redefinir", { method: "POST", headers: JSON_H, body: JSON.stringify({ token, senha }) });
  return ler<{ token: string; usuario: UsuarioSessao }>(res);
}

export async function listarUsuarios(): Promise<UsuarioSessao[]> {
  const res = await fetch("/api/usuarios", { headers: comPropriedade() });
  const body = await ler<{ usuarios: UsuarioSessao[] }>(res);
  return body.usuarios;
}

export async function criarUsuario(nome: string, email: string, papel: string) {
  const res = await fetch("/api/usuarios", { method: "POST", headers: comPropriedade(JSON_H), body: JSON.stringify({ nome, email, papel }) });
  return ler<{ usuario: UsuarioSessao; conviteLink: string }>(res);
}

export async function atualizarUsuario(id: number, patch: { papel?: string; abas?: string[]; flags?: string[]; status?: string }) {
  const res = await fetch(`/api/usuarios/${id}`, { method: "PATCH", headers: comPropriedade(JSON_H), body: JSON.stringify(patch) });
  const body = await ler<{ usuario: UsuarioSessao }>(res);
  return body.usuario;
}

export async function revogarUsuario(id: number): Promise<void> {
  const res = await fetch(`/api/usuarios/${id}`, { method: "DELETE", headers: comPropriedade() });
  await ler<{ ok: true }>(res);
}

export async function gerarConvite(id: number): Promise<string> {
  const res = await fetch(`/api/usuarios/${id}/convite`, { method: "POST", headers: comPropriedade() });
  return (await ler<{ conviteLink: string }>(res)).conviteLink;
}

export async function gerarReset(id: number): Promise<string> {
  const res = await fetch(`/api/usuarios/${id}/reset`, { method: "POST", headers: comPropriedade() });
  return (await ler<{ resetLink: string }>(res)).resetLink;
}
```

- [ ] **Step 3: Build**

Run: `pnpm --filter rionovo-client run build`
Expected: build sem erros (ajustar `comPropriedade` conforme Step 1 se necessário).

- [ ] **Step 4: Commit**

```bash
git add client/src/api/auth.ts
git commit -m "feat(auth): client de API de auth + admin de usuários"
```

---

## Task 16: Frontend — Login vira e-mail + senha

**Files:**
- Modify: `client/src/components/Login.tsx`

**Interfaces:**
- Consumes: `login` (Task 15), `UsuarioSessao` (Task 14).
- Produces: `Login` com prop `onEntrar(token: string, usuario: UsuarioSessao): void` (muda de `(senha) => void`).

- [ ] **Step 1: Reescrever o formulário**

Substituir todo o corpo de `client/src/components/Login.tsx`:

```tsx
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "../api/auth";
import type { UsuarioSessao } from "../lib/auth";

export function Login({ onEntrar }: { onEntrar: (token: string, usuario: UsuarioSessao) => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [validando, setValidando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !senha || validando) return;
    setValidando(true);
    setErro(null);
    try {
      const { token, usuario } = await login(email.trim().toLowerCase(), senha);
      onEntrar(token, usuario);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha de rede.");
      setValidando(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <form
        onSubmit={submeter}
        className="flex w-full max-w-[380px] flex-col gap-2.5 rounded-[14px] border border-border bg-card px-[26px] py-7 shadow-[0_4px_20px_rgba(0,0,0,0.05)]"
      >
        <div className="font-serif text-[15px] tracking-[0.02em] text-ink-3">Fazenda Rio Novo</div>
        <div className="mb-1 font-serif text-[26px] leading-[1.1] text-foreground">Entrar</div>
        <Label htmlFor="login-email" className="mt-1 text-xs font-normal uppercase tracking-[0.05em] text-ink-3">E-mail</Label>
        <Input
          id="login-email" type="email" autoFocus autoComplete="username"
          value={email} disabled={validando} onChange={(e) => setEmail(e.target.value)}
          className="rounded-[8px] bg-background text-[15px] focus-visible:ring-atencao focus-visible:ring-offset-0"
        />
        <Label htmlFor="login-senha" className="mt-1 text-xs font-normal uppercase tracking-[0.05em] text-ink-3">Senha</Label>
        <Input
          id="login-senha" type="password" autoComplete="current-password"
          value={senha} disabled={validando} onChange={(e) => setSenha(e.target.value)}
          className="rounded-[8px] bg-background text-[15px] focus-visible:ring-atencao focus-visible:ring-offset-0"
        />
        {erro && <div className="text-[13px] text-destructive">{erro}</div>}
        <Button
          type="submit" disabled={!email || !senha || validando}
          className="mt-2 rounded-[8px] bg-foreground text-background hover:bg-foreground/90"
        >
          {validando ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Build** (vai quebrar em App.tsx — resolvido na Task 18)

Run: `pnpm --filter rionovo-client run build`
Expected: erro em `App.tsx` (chamada antiga de `onEntrar`) — esperado; corrigido na Task 18. Commit junto com a Task 18.

---

## Task 17: Frontend — tela "Definir senha" (convite/reset)

**Files:**
- Create: `client/src/components/DefinirSenha.tsx`

**Interfaces:**
- Consumes: `validarConvite`/`aceitarConvite`/`redefinirSenha` (Task 15), `UsuarioSessao` (Task 14).
- Produces: `DefinirSenha` com props `{ modo: "convite" | "senha"; token: string; onPronto(token: string, usuario: UsuarioSessao): void }`.

- [ ] **Step 1: Implementar**

`client/src/components/DefinirSenha.tsx`:

```tsx
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validarConvite, aceitarConvite, redefinirSenha } from "../api/auth";
import type { UsuarioSessao } from "../lib/auth";

export function DefinirSenha({
  modo,
  token,
  onPronto,
}: {
  modo: "convite" | "senha";
  token: string;
  onPronto: (token: string, usuario: UsuarioSessao) => void;
}) {
  const [nome, setNome] = useState<string | null>(null);
  const [invalido, setInvalido] = useState(false);
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (modo !== "convite") return;
    validarConvite(token)
      .then((d) => setNome(d.nome))
      .catch(() => setInvalido(true));
  }, [modo, token]);

  const podeEnviar = senha.length >= 8 && senha === senha2 && !enviando;

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (!podeEnviar) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = modo === "convite" ? await aceitarConvite(token, senha) : await redefinirSenha(token, senha);
      onPronto(r.token, r.usuario);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao definir a senha.");
      setEnviando(false);
    }
  };

  if (invalido) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6">
        <div className="max-w-[380px] text-center text-[15px] text-ink-3">
          Este link é inválido ou expirou. Peça um novo ao proprietário.
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <form onSubmit={submeter} className="flex w-full max-w-[380px] flex-col gap-2.5 rounded-[14px] border border-border bg-card px-[26px] py-7 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
        <div className="mb-1 font-serif text-[26px] leading-[1.1] text-foreground">
          {modo === "convite" ? "Criar sua senha" : "Redefinir senha"}
        </div>
        {modo === "convite" && nome && <div className="mb-2 text-[13px] text-ink-3">Bem-vindo, {nome.split(" ")[0]}.</div>}
        <Label htmlFor="ds-senha" className="mt-1 text-xs uppercase tracking-[0.05em] text-ink-3">Nova senha</Label>
        <Input id="ds-senha" type="password" autoFocus autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} className="rounded-[8px] bg-background text-[15px]" />
        <Label htmlFor="ds-senha2" className="mt-1 text-xs uppercase tracking-[0.05em] text-ink-3">Repita a senha</Label>
        <Input id="ds-senha2" type="password" autoComplete="new-password" value={senha2} onChange={(e) => setSenha2(e.target.value)} className="rounded-[8px] bg-background text-[15px]" />
        {senha && senha.length < 8 && <div className="text-[12px] text-ink-3">Mínimo 8 caracteres.</div>}
        {senha2 && senha !== senha2 && <div className="text-[12px] text-destructive">As senhas não coincidem.</div>}
        {erro && <div className="text-[13px] text-destructive">{erro}</div>}
        <Button type="submit" disabled={!podeEnviar} className="mt-2 rounded-[8px] bg-foreground text-background hover:bg-foreground/90">
          {enviando ? "Salvando…" : "Salvar e entrar"}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter rionovo-client run build`
Expected: erro persistente só em `App.tsx` (Task 16) — o novo componente em si compila. Corrigido na Task 18.

---

## Task 18: Frontend — App liga gate real, usuário real e rotas de convite/reset

**Files:**
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `getToken`/`getUsuario`/`setSessao`/`clearSessao`/`UsuarioSessao` (Task 14), `fetchMe`/`logout` (Task 15), `Login` (Task 16), `DefinirSenha` (Task 17).

- [ ] **Step 1: Ajustar imports no topo**

Trocar `import { getToken, setToken, clearToken } from "./lib/auth";` por:

```tsx
import { getToken, getUsuario, setSessao, clearSessao, type UsuarioSessao } from "./lib/auth";
import { fetchMe, logout } from "./api/auth";
import { DefinirSenha } from "./components/DefinirSenha";
```

Trocar `import { ABAS, PAPEIS, usuarios, type User } from "./data/acessos";` por (descarta o mock `usuarios` e o tipo `User`):

```tsx
import { ABAS, PAPEIS } from "./data/acessos";
```

> Se `PAPEIS`/`User` forem usados só no fluxo de "ver como" que será removido, remova-os também no fim da task. `ABAS` continua necessário para `visibleTabs`.

- [ ] **Step 2: Detectar rota de convite/reset (logo no início do componente App)**

Após a linha `export function App() {` (≈136), adicionar como primeira coisa:

```tsx
  // Deep-link de convite/reset: /convite/<token> ou /senha/<token>. Renderiza a
  // tela de definir senha independentemente do gate de login.
  const rotaSenha = (() => {
    if (typeof window === "undefined") return null;
    const m = /^\/(convite|senha)\/(.+)$/.exec(window.location.pathname);
    if (!m) return null;
    return { modo: (m[1] === "convite" ? "convite" : "senha") as "convite" | "senha", token: m[2] };
  })();
```

- [ ] **Step 3: Substituir estado de token/usuário e `entrar`/`onSair`**

Trocar as linhas ≈145-176 (`token`/`entrar`/`onSair`/`users`/`realUserId`/`viewAsId`) por:

```tsx
  const [token, setTokenState] = useState<string | null>(() =>
    typeof window === "undefined" ? null : getToken(),
  );
  const [usuario, setUsuario] = useState<UsuarioSessao | null>(() =>
    typeof window === "undefined" ? null : getUsuario(),
  );
```

E, mais abaixo (onde estavam `entrar`/`onSair`):

```tsx
  const entrar = (novoToken: string, u: UsuarioSessao) => {
    setSessao(novoToken, u);
    setTokenState(novoToken);
    setUsuario(u);
    setShowIntro(deveTocarIntro(tab));
  };

  const onSair = token
    ? () => {
        void logout();
        clearSessao();
        setTokenState(null);
        setUsuario(null);
        setShowIntro(false);
      }
    : undefined;
```

Remover `const [users, setUsers] = useState<User[]>(usuarios);`, `const realUserId = "marco";`, `const [viewAsId, setViewAsId] = useState<string | null>(null);` e a função `enterViewAs` (≈331-333).

- [ ] **Step 4: Hidratar o usuário real no boot**

Adicionar um `useEffect` junto aos outros:

```tsx
  // Revalida a sessão no backend quando há token: se caiu, desloga.
  useEffect(() => {
    if (!token) return;
    fetchMe()
      .then((u) => {
        if (u) {
          setUsuario(u);
          setSessao(token, u);
        } else {
          clearSessao();
          setTokenState(null);
          setUsuario(null);
        }
      })
      .catch(() => {});
  }, [token]);
```

- [ ] **Step 5: Derivar `effectiveUser` do usuário real**

Substituir o bloco `effectiveUser`/`isAdmin`/`canSeeFolha`/`visibleTabs` (≈296-313) por:

```tsx
  const effectiveUser = usuario;
  const isAdmin = !!effectiveUser?.flags.includes("gerenciarAcessos") || !!effectiveUser?.dono;
  const canSeeFolha = !!effectiveUser?.flags.includes("verSalarios") || !!effectiveUser?.dono;

  const visibleTabs = useMemo<NavTab[]>(() => {
    if (!effectiveUser) return [];
    return ABAS.filter((a) => effectiveUser.abas.includes(a.id)).map((a) => ({
      id: a.id as Tab,
      label: a.label,
    }));
  }, [effectiveUser]);
```

- [ ] **Step 6: Render — rota de senha + gate real**

Localizar o gate atual (≈399-404):

```tsx
  if (GATE_ATIVO && !token) {
    return <Login onEntrar={entrar} />;
  }
```

Substituir por:

```tsx
  if (rotaSenha) {
    return (
      <DefinirSenha
        modo={rotaSenha.modo}
        token={rotaSenha.token}
        onPronto={(t, u) => {
          entrar(t, u);
          window.history.replaceState(null, "", "/dashboard");
        }}
      />
    );
  }
  if (!token || !usuario) {
    return <Login onEntrar={entrar} />;
  }
```

Localizar a constante `GATE_ATIVO` (≈42): se não for mais referenciada em nenhum outro ponto (buscar `GATE_ATIVO` no arquivo), **remover** a constante e seu comentário. Se ainda for usada, defini-la como `true`.

- [ ] **Step 7: Limpar resíduos do "ver como" e do mock**

Buscar no arquivo por `viewAsId`, `realUserId`, `enterViewAs`, `onViewAs`, `setUsers`, `users` e o banner de "ver como" (≈444-453). Remover esses trechos (o "ver como" era cosmético e dependia do mock). Onde após o gate o código usava `effectiveUser` (garantidamente não-nulo após `if (!token || !usuario) return …`), pode usar `usuario` diretamente.

- [ ] **Step 8: Build + rodar**

Run: `pnpm --filter rionovo-client run build`
Expected: sem erros de tipo.

Run: `pnpm dev`; no browser (http://localhost:41875) com um usuário ATIVO no banco: login por e-mail+senha entra; as abas visíveis batem com `usuario.abas`; logout volta ao Login.

- [ ] **Step 9: Commit (Login + App juntos)**

```bash
git add client/src/App.tsx client/src/components/Login.tsx client/src/components/DefinirSenha.tsx
git commit -m "feat(auth): gate real de login + usuário do backend no App"
```

---

## Task 19: Frontend — Acessos ligado à API real

**Files:**
- Modify: `client/src/components/Acessos.tsx`
- Modify: `client/src/App.tsx` (passar `<Acessos />` sem props)

**Interfaces:**
- Consumes: `listarUsuarios`/`criarUsuario`/`atualizarUsuario`/`revogarUsuario`/`gerarConvite` (Task 15), `UsuarioSessao` (Task 14).

- [ ] **Step 1: Carregar a lista real dentro de Acessos**

Em `client/src/components/Acessos.tsx`, trocar a fonte de dados. O componente passa a carregar da API no mount (sem props `users`/`setUsers`). Novos imports e assinatura:

```tsx
import { useEffect, useState } from "react";
import { ABAS, FLAGS, PAPEIS } from "../data/acessos"; // mantém as CONSTANTES de UI
import { listarUsuarios, criarUsuario, atualizarUsuario, revogarUsuario, gerarConvite } from "../api/auth";
import type { UsuarioSessao } from "../lib/auth";
import { useToast } from "./Toast";
import { ConfirmDialog } from "./ConfirmDialog";

export function Acessos() {
  const toast = useToast();
  const [users, setUsers] = useState<UsuarioSessao[]>([]);
  const [selId, setSelId] = useState<number | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [revoking, setRevoking] = useState<UsuarioSessao | null>(null);
  const [conviteLink, setConviteLink] = useState<string | null>(null);

  useEffect(() => {
    listarUsuarios().then((us) => {
      setUsers(us);
      setSelId((cur) => cur ?? us[0]?.id ?? null);
    });
  }, []);

  const sel = users.find((u) => u.id === selId) ?? users[0] ?? null;
  // … resto do componente
}
```

> **Adaptações de shape** (o DTO difere do mock `User`):
> - `inicial` → derivar `u.nome.trim()[0]?.toUpperCase() ?? "?"`.
> - `status` agora é `"ATIVO" | "PENDENTE" | "INATIVO"` (maiúsculas). Ajustar `StatusBadge` para mapear esses valores (o mapa atual usa minúsculas — trocar as chaves).
> - `ultimoAcesso` é ISO string ou null → exibir formatado (ou "—").
> - `id` é `number` (não string) — ajustar `selId`, `key`, comparações.
> - `PermissionEditor`/`InviteModal` recebem `User` do mock; trocar o tipo para `UsuarioSessao` (campos `id/nome/email/papel/abas/flags/dono` existem em ambos).

- [ ] **Step 2: Trocar os handlers para chamar a API**

```tsx
  const invite = async ({ nome, email, papel }: { nome: string; email: string; papel: string }) => {
    try {
      const { usuario, conviteLink } = await criarUsuario(nome, email, papel);
      setUsers((us) => [...us, usuario]);
      setSelId(usuario.id);
      setShowInvite(false);
      setConviteLink(conviteLink);
      toast.success("Convite criado", "Copie o link e envie para a pessoa.");
    } catch (e) {
      toast.error("Não foi possível convidar", e instanceof Error ? e.message : "");
    }
  };

  const updateUser = async (next: UsuarioSessao) => {
    try {
      const salvo = await atualizarUsuario(next.id, { papel: next.papel, abas: next.abas, flags: next.flags });
      setUsers((us) => us.map((u) => (u.id === salvo.id ? salvo : u)));
    } catch (e) {
      toast.error("Não foi possível salvar", e instanceof Error ? e.message : "");
    }
  };

  const resendInvite = async (u: UsuarioSessao) => {
    try {
      const link = await gerarConvite(u.id);
      setConviteLink(link);
      toast.info("Novo link gerado", "Copie e reenvie.");
    } catch (e) {
      toast.error("Falha ao gerar link", e instanceof Error ? e.message : "");
    }
  };

  const doRevoke = async () => {
    if (!revoking) return;
    const alvo = revoking;
    try {
      await revogarUsuario(alvo.id);
      setUsers((us) => us.map((u) => (u.id === alvo.id ? { ...u, status: "INATIVO" } : u)));
      setRevoking(null);
      toast.success("Acesso revogado", `${alvo.nome.split(" ")[0]} não tem mais acesso.`);
    } catch (e) {
      toast.error("Não foi possível revogar", e instanceof Error ? e.message : "");
      setRevoking(null);
    }
  };
```

> O botão "Aplicar preset" no `PermissionEditor` deve chamar `updateUser` com `{...user, papel, abas, flags}` derivados de `PAPEIS[papel]` (mesma lógica que já existe no mock — só passa a persistir via API).

- [ ] **Step 3: Box de link copiável**

Renderizar, quando `conviteLink` existir (perto do topo da coluna direita ou logo abaixo do header do editor):

```tsx
{conviteLink && (
  <div className="mt-4 border border-[color:var(--rule)] bg-[color:var(--bg-card-2)] p-4">
    <div className="mb-2 text-[12px] uppercase tracking-[0.14em] text-ink-3">Link de acesso</div>
    <div className="flex gap-2">
      <input readOnly value={conviteLink} className="field-input flex-1 text-[13px]" onFocus={(e) => e.currentTarget.select()} />
      <button className="btn-secondary" onClick={() => { void navigator.clipboard.writeText(conviteLink); toast.info("Link copiado", ""); }}>
        Copiar
      </button>
    </div>
    <div className="caption mt-2" style={{ fontStyle: "italic" }}>Envie por WhatsApp ou como preferir. Válido por 7 dias.</div>
  </div>
)}
```

Remover a linha do `InviteModal` que promete e-mail ("A pessoa recebe um e-mail com link…") — trocar por "Você vai receber um link para enviar à pessoa."

- [ ] **Step 4: Atualizar o uso em App.tsx**

Onde `App.tsx` renderiza `<Acessos users={users} setUsers={setUsers} onViewAs={enterViewAs} />` (≈388-393), trocar por:

```tsx
<Acessos />
```

- [ ] **Step 5: Build**

Run: `pnpm --filter rionovo-client run build`
Expected: sem erros.

- [ ] **Step 6: Verificação manual (fluxo ponta-a-ponta)**

Server rodando, logado como dono:
1. Acessos → convidar uma pessoa → copiar o link.
2. Abrir o link em aba anônima → definir senha → entra no app com as abas do papel.
3. Logar como essa pessoa (sem `gerenciarAcessos`) → `GET /api/usuarios` responde 403; a UI não mostra Acessos (`isAdmin=false`).

- [ ] **Step 7: Commit**

```bash
git add client/src/components/Acessos.tsx client/src/App.tsx
git commit -m "feat(auth): Acessos ligado à API real com link copiável"
```

---

## Task 20: Verificação de ponta-a-ponta + PR

**Files:** —

- [ ] **Step 1: Rodar toda a suíte de testes do backend**

Run: `pnpm --filter rionovo-server run test`
Expected: verde, incluindo `hash.test.ts`, `token.test.ts`, `papeis.test.ts`.

- [ ] **Step 2: Rodar os testes do client**

Run: `pnpm --filter rionovo-client run test`
Expected: verde (smoke tests de render continuam passando).

- [ ] **Step 3: Build dos dois workspaces**

Run: `pnpm build`
Expected: build limpo.

- [ ] **Step 4: Checklist manual (server rodando; base com o dono já criado via AUTH_BOOTSTRAP_EMAIL)**

- Boot loga o link do dono → abrir → definir senha → entra.
- Logout → volta ao Login. Login por e-mail+senha → entra.
- Reset: em Acessos, gerar reset de um usuário → abrir `/senha/<token>` → nova senha → sessões antigas caem (o usuário é deslogado nas abas antigas ao próximo request).
- Usuário INATIVO não loga (401).
- Escrita de `Lancamento` por usuário sem `lancar` → 403; com `lancar` mas em mês fechado → bloqueio de `FechamentoMensal` (comportamento pré-existente).

- [ ] **Step 5: Abrir PR**

```bash
git push -u origin feat/auth-contas-login
gh pr create --title "feat: sistema de contas, login e acesso (fatia 1)" --body "$(cat <<'EOF'
Substitui a senha compartilhada por contas reais (e-mail+senha, sessão via token opaco no Postgres), liga a tela de Acessos ao backend e enforça permissões no servidor. Escopo: uma fazenda (sem multi-tenant).

Spec: docs/superpowers/specs/2026-07-14-auth-contas-login-design.md
Plano: docs/superpowers/plans/2026-07-14-auth-contas-login.md

Follow-ups conhecidos (fora desta fatia):
- Rate-limit no POST /api/auth/login (sem infra de rate-limit no repo hoje).
- Remover a ponte SHARED_ACCESS_TOKEN quando as contas estiverem de pé em prod.
- Multi-tenant (Fase 2).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review (feita pelo autor do plano)

**Cobertura do spec:**
- §2 Modelo de dados → Task 1. ✅
- §3 Autenticação (rotas + middleware) → Tasks 6, 8, 9, 10, 12. ✅
- §4 Autorização/enforcement → Tasks 9 (`exigePermissao`), 11 (admin), 13 (gates). ✅
- §5 Frontend (Login, Definir senha, App, Acessos, lib/auth) → Tasks 14–19. ✅
- §6 Bootstrap + aposentadoria da senha única → Tasks 7 (bootstrap), 12 (boot), 20 Step (nota de remoção no PR). ✅
- §7 Segurança (scrypt, tokens hasheados, expiração, timing-safe) → Tasks 2, 3, 6, 8, 9. Rate-limit: **gap conhecido abaixo.**
- §9 Testes → Tasks 2, 3, 4 (puros) + 20 (e2e/manual). ✅

**Gap conhecido — rate-limit no login (spec §7):** sem task dedicada; o repo não tem infraestrutura de rate-limit e o piloto é uma fazenda. **Decisão:** follow-up pós-piloto (middleware de contagem em memória por IP+e-mail em `POST /api/auth/login`), registrado no corpo do PR (Task 20). Não passa silencioso.

**Consistência de tipos:** `UsuarioContexto` (server, Task 6) e `UsuarioSessao` (client, Task 14) têm o mesmo shape (id/nome/email/papel/abas/flags/status/dono); `UsuarioDTO` (Task 7) acrescenta `ultimoAcesso`. `temPermissao`/`aplicarPreset`/`Flag` consistentes entre Tasks 4, 9, 13. Nomes de rota batem entre server (Tasks 10/11) e client (Task 15): `/auth/login`, `/auth/logout`, `/auth/me`, `/auth/convite/:token`, `/auth/convite/aceitar`, `/auth/senha/redefinir`, `/usuarios`, `/usuarios/:id`, `/usuarios/:id/convite`, `/usuarios/:id/reset`.

**Placeholders:** nenhum "TBD/TODO" com código faltando. Os passos de "confirmar assinatura de `comPropriedade`" e "localizar rotas de folha/export" são verificações com `grep` (a estrutura exata dessas rotas legadas varia), não lacunas de código do plano.
```