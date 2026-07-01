import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL ausente ou inválida — copie de server/.env.example"),
  PORT: z.coerce.number().int().positive().default(41873),
  JWT_SECRET: z.string().min(8).default("dev-secret-trocar-em-producao"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // Lista separada por vírgula de origens permitidas (ex.: https://rionovo.pages.dev,https://rionovo.com.br).
  // Vazio = libera tudo (útil em dev). Em prod sempre setar.
  CORS_ORIGIN: z.string().optional(),

  // --- OpenAI (provider único do app) ---
  // Cérebro do bot E da IA do rebanho. Sem a chave: bot desligado e IA do rebanho
  // em "modo demonstração" (regras locais).
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o"),

  // Canal WhatsApp via Meta Cloud API. Todos necessários para o webhook funcionar.
  WHATSAPP_VERIFY_TOKEN: z.string().optional(), // string arbitrária p/ GET de verificação
  WHATSAPP_ACCESS_TOKEN: z.string().optional(), // token permanente da Meta
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(), // ID do número que envia
  WHATSAPP_APP_SECRET: z.string().optional(), // p/ validar X-Hub-Signature-256

  // Conexão somente-leitura (role com GRANT SELECT) para a ferramenta consulta_sql.
  // Sem ela, o escape hatch de SQL fica desabilitado (ferramentas curadas seguem funcionando).
  DATABASE_URL_READONLY: z.string().url().optional(),

  // Dashboard — quantos meses COMPLETOS entram na média da "queima mensal"
  // (fôlego/ruptura de caixa). Default 6.
  DASHBOARD_MESES_QUEIMA: z.coerce.number().int().positive().default(6),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("[env] configuração inválida:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
