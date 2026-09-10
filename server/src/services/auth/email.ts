import { env } from "../../env.js";
import { RESET_TOKEN_TTL_MINUTES } from "./token.js";

export type EmailRecuperacao = {
  destinatario: string;
  link: string;
  idempotencyKey: string;
};

export function canalRecuperacaoConfigurado(): boolean {
  if (env.NODE_ENV !== "production" && (!env.AUTH_EMAIL_PROVIDER || env.AUTH_EMAIL_PROVIDER === "log")) return true;
  return env.AUTH_EMAIL_PROVIDER === "resend" && !!env.RESEND_API_KEY && !!env.AUTH_EMAIL_FROM && !!env.APP_BASE_URL;
}

export async function enviarLinkRecuperacao({ destinatario, link, idempotencyKey }: EmailRecuperacao): Promise<void> {
  if (!canalRecuperacaoConfigurado()) throw new Error("canal de recuperação de senha não configurado");
  if (env.AUTH_EMAIL_PROVIDER !== "resend") {
    console.info(`[auth] recuperação para ${destinatario}: ${link}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
      "idempotency-key": `password-reset/${idempotencyKey}`,
      "user-agent": "terrano-auth/1.0",
    },
    body: JSON.stringify({
      from: env.AUTH_EMAIL_FROM,
      to: [destinatario],
      subject: "Redefinição de senha do Terrano",
      text: `Recebemos uma solicitação para redefinir sua senha no Terrano.\n\nUse este link em até ${RESET_TOKEN_TTL_MINUTES} minutos:\n${link}\n\nSe você não fez esta solicitação, ignore esta mensagem.`,
      html: `<p>Recebemos uma solicitação para redefinir sua senha no Terrano.</p><p><a href="${link}">Redefinir minha senha</a></p><p>O link expira em ${RESET_TOKEN_TTL_MINUTES} minutos e só pode ser usado uma vez.</p><p>Se você não fez esta solicitação, ignore esta mensagem.</p>`,
    }),
  });

  if (!response.ok) {
    const detalhe = await response.text().catch(() => "");
    throw new Error(`provedor de e-mail recusou a mensagem (${response.status})${detalhe ? `: ${detalhe.slice(0, 300)}` : ""}`);
  }
}
