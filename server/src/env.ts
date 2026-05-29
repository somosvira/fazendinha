import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL ausente ou inválida — copie de server/.env.example"),
  PORT: z.coerce.number().int().positive().default(41873),
  JWT_SECRET: z.string().min(8).default("dev-secret-trocar-em-producao"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("[env] configuração inválida:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
