import { Hono } from "hono";
import { prisma } from "../db.js";
import { envSchema } from "../env.js";
import { isCloudflareWorkers } from "../lib/runtime.js";

// GET /api/health
//
// Único lugar do servidor que revalida a env e checa o estado de
// `_prisma_migrations` — em troca de nunca expor o detalhe de nenhuma das
// duas checagens pra fora, só pro console.error. Faz sentido sobretudo
// dentro de um Cloudflare Worker: não há um "boot" de processo pra falhar
// uma vez só (env.ts já falha no module-load, mas isso não avisa ninguém
// depois do deploy — aqui dá pra ver isso de fora, a qualquer momento,
// sem precisar reler logs de deploy).
//
// Além do "estou vivo", faz um SELECT 1 real no banco através do adapter
// configurado (db.ts) — prova que runtime, driver e banco estão
// conversando de ponta a ponta, não só que o processo subiu.
export const healthRouter = new Hono()
  .get("/health", async (c) => {
    const config = checkConfig();
    const database = await checkDatabase();
    const migrations = database.connected ? await checkMigrations() : { upToDate: null as boolean | null };

    const saudavel = config.ok && database.connected && migrations.upToDate !== false;

    return c.json(
      {
        status: saudavel ? "ok" : "degraded",
        runtime: isCloudflareWorkers() ? "cloudflare-workers" : "node",
        timestamp: new Date().toISOString(),
        database,
        config,
        migrations,
      },
      saudavel ? 200 : 503,
    );
  })
  .get("/health/db", async (c) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return c.json({ ok: true, db: "up" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "erro desconhecido";
      return c.json({ ok: false, db: "down", error: message }, 500);
    }
  });

function checkConfig(): { ok: boolean } {
  const parsed = envSchema.safeParse(process.env);
  if (parsed.success) return { ok: true };
  console.error("[health] configuração inválida:", parsed.error.flatten().fieldErrors);
  return { ok: false };
}

async function checkDatabase(): Promise<{ connected: boolean; latencyMs: number | null; error: string | null }> {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { connected: true, latencyMs: Date.now() - startedAt, error: null };
  } catch (error) {
    return {
      connected: false,
      latencyMs: null,
      error: error instanceof Error ? error.message : "erro desconhecido ao consultar o banco",
    };
  }
}

// `_prisma_migrations` pode nem existir (bancos materializados só via `db push`,
// que não usa histórico de migration — ver CLAUDE.md/DEPLOY.md) ou estar com
// drift. O catch trata isso como inconclusivo (`null`), não como degradado —
// só uma migration de fato travada (`upToDate: false`) marca o health como ruim.
async function checkMigrations(): Promise<{ upToDate: boolean | null }> {
  try {
    const travadas = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations"
      WHERE finished_at IS NULL AND rolled_back_at IS NULL
    `;
    if (travadas.length > 0) {
      console.error("[health] migration(s) travada(s), nunca terminaram nem foram revertidas:", travadas.map((m) => m.migration_name).join(", "));
      return { upToDate: false };
    }
    return { upToDate: true };
  } catch (error) {
    console.error("[health] erro ao checar _prisma_migrations:", error instanceof Error ? error.message : error);
    return { upToDate: null };
  }
}
