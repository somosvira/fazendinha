// Escape hatch de SQL para o bot: o LLM gera um SELECT e a gente roda numa
// conexão SOMENTE-LEITURA (role Neon com GRANT SELECT). Defesa em profundidade:
//   1. role read-only no banco (proteção real)
//   2. validação em app (rejeita não-SELECT, múltiplos statements, DDL/DML)
//   3. LIMIT forçado + timeout em JS
//
// `validarSqlReadonly` é PURA (sem rede) — testável isoladamente.

import { PrismaClient } from "@prisma/client";
import { env } from "../../env.js";
import { prisma } from "../../db.js";
import { jsonSafe } from "./serialize.js";

const LIMITE_PADRAO = 200;
const TIMEOUT_MS = 8000;

// Palavras que nunca podem aparecer numa consulta de leitura (word boundary).
const PROIBIDAS =
  /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|comment|copy|merge|call|do|vacuum|reindex|refresh|set|reset|lock|listen|notify|prepare|execute|begin|commit|rollback|savepoint)\b/i;

export type ValidacaoSql =
  | { ok: true; sql: string }
  | { ok: false; erro: string };

export function validarSqlReadonly(input: string): ValidacaoSql {
  let sql = input.trim();
  // remove um único ';' final (e espaços), mas rejeita múltiplos statements
  sql = sql.replace(/;\s*$/, "").trim();
  if (!sql) return { ok: false, erro: "Consulta vazia." };
  if (sql.includes(";"))
    return { ok: false, erro: "Apenas um comando SELECT é permitido (sem ';')." };
  if (!/^(select|with)\b/i.test(sql))
    return { ok: false, erro: "Apenas SELECT (ou WITH ... SELECT) é permitido." };
  if (PROIBIDAS.test(sql))
    return { ok: false, erro: "Comando contém palavra-chave não permitida (somente leitura)." };
  // força um LIMIT se não houver
  if (!/\blimit\b/i.test(sql)) sql = `${sql} LIMIT ${LIMITE_PADRAO}`;
  return { ok: true, sql };
}

// Cliente Prisma apontando para a conexão read-only (lazy singleton, HMR-safe).
const g = globalThis as unknown as { __roPrisma?: PrismaClient };
function clienteReadonly(): PrismaClient | null {
  if (!env.DATABASE_URL_READONLY) return null;
  if (!g.__roPrisma) {
    g.__roPrisma = new PrismaClient({
      datasources: { db: { url: env.DATABASE_URL_READONLY } },
    });
  }
  return g.__roPrisma;
}

export interface ResultadoSql {
  ok: boolean;
  erro?: string;
  linhas?: unknown[];
  total?: number;
  modo?: "readonly" | "fallback-dev";
}

export async function rodarSqlReadonly(input: string): Promise<ResultadoSql> {
  // Preferimos a conexão read-only (proteção real no banco). Sem ela, em dev,
  // caímos na conexão principal — a validação em app (só SELECT, 1 statement,
  // sem DDL/DML) segue valendo. PRODUÇÃO deve setar DATABASE_URL_READONLY.
  const ro = clienteReadonly();
  const cliente = ro ?? prisma;
  const modo: ResultadoSql["modo"] = ro ? "readonly" : "fallback-dev";

  const v = validarSqlReadonly(input);
  if (!v.ok) return { ok: false, erro: v.erro };

  try {
    const timeout = new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error("timeout")), TIMEOUT_MS),
    );
    const rows = (await Promise.race([
      cliente.$queryRawUnsafe(v.sql),
      timeout,
    ])) as unknown[];
    const linhas = jsonSafe(rows) as unknown[];
    return { ok: true, linhas, total: linhas.length, modo };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, erro: msg === "timeout" ? "Consulta excedeu o tempo limite." : msg };
  }
}
