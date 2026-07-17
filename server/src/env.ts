import { z } from "zod";

const envSchema = z
  .object({
    DATABASE_URL: z.string().url("DATABASE_URL ausente ou inválida — copie de server/.env.example"),
    PORT: z.coerce.number().int().positive().default(41873),
    JWT_SECRET: z.string().min(8).default("dev-secret-trocar-em-producao"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    // Lista separada por vírgula de origens permitidas (ex.: https://rionovo.pages.dev,https://rionovo.com.br).
    // Vazio = libera tudo (útil em dev). Em prod sempre setar.
    CORS_ORIGIN: z.string().optional(),

    // Auth mínima para a fase de teste com o dono. Se setado, todas as rotas
    // (exceto /api/health e /api/whatsapp/*) exigem `Authorization: Bearer <token>`.
    // Se vazio (dev local), o middleware libera acesso. Não é sistema de usuários —
    // é uma senha compartilhada de porta de entrada. Trocar por auth real (JWT/OAuth)
    // quando escalar além do piloto. Mínimo 16 chars para evitar brute force trivial.
    SHARED_ACCESS_TOKEN: z.string().min(16).optional(),

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

    // Dashboard — quantos meses COMPLETOS entram na média da "queima mensal"
    // (fôlego/ruptura de caixa). Default 6.
    DASHBOARD_MESES_QUEIMA: z.coerce.number().int().positive().default(6),

    // Storage de notas fiscais. "local" guarda em server/.uploads/ (dev sem nuvem).
    // "r2" exige as R2_* abaixo (Cloudflare R2 — S3-compatible).
    STORAGE_DRIVER: z.enum(["local", "r2"]).default("local"),
    LOCAL_STORAGE_DIR: z.string().default(".uploads"),
    LOCAL_DOWNLOAD_SECRET: z.string().min(16).default("dev-local-download-secret-trocar"),

    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET_NOTAS: z.string().optional(),

    // OCR via Tesseract.js (gratuito, roda em Node). Em dev/teste deixe "false" para
    // boot mais rápido (sem download dos ~70MB de language data português).
    OCR_ENABLED: z.coerce.boolean().default(false),

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
  })
  .superRefine((v, ctx) => {
    if (v.STORAGE_DRIVER === "r2") {
      if (!v.R2_ACCOUNT_ID)
        ctx.addIssue({ code: "custom", path: ["R2_ACCOUNT_ID"], message: "obrigatório quando STORAGE_DRIVER=r2" });
      if (!v.R2_ACCESS_KEY_ID)
        ctx.addIssue({ code: "custom", path: ["R2_ACCESS_KEY_ID"], message: "obrigatório quando STORAGE_DRIVER=r2" });
      if (!v.R2_SECRET_ACCESS_KEY)
        ctx.addIssue({ code: "custom", path: ["R2_SECRET_ACCESS_KEY"], message: "obrigatório quando STORAGE_DRIVER=r2" });
      if (!v.R2_BUCKET_NOTAS)
        ctx.addIssue({ code: "custom", path: ["R2_BUCKET_NOTAS"], message: "obrigatório quando STORAGE_DRIVER=r2" });
    }
  });

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("[env] configuração inválida:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
