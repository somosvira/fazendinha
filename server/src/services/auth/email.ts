import { env } from "../../env.js";

export type EmailRecuperacao = {
  destinatario: string;
  link: string;
  idempotencyKey: string;
};

export function canalRecuperacaoConfigurado(): boolean {
  return env.AUTH_EMAIL_PROVIDER === "resend" && !!env.RESEND_API_KEY && !!env.AUTH_EMAIL_FROM && !!env.APP_BASE_URL;
}

export async function enviarLinkRecuperacao({ destinatario, link, idempotencyKey }: EmailRecuperacao): Promise<void> {
  if (!canalRecuperacaoConfigurado()) throw new Error("canal de recuperação de senha não configurado");

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
      text: `Recebemos uma solicitação para redefinir sua senha no Terrano.\n\nUse este link em até 1 hora:\n${link}\n\nSe você não fez esta solicitação, ignore esta mensagem.`,
      html: `<p>Recebemos uma solicitação para redefinir sua senha no Terrano.</p><p><a href="${link}">Redefinir minha senha</a></p><p>O link expira em 1 hora e só pode ser usado uma vez.</p><p>Se você não fez esta solicitação, ignore esta mensagem.</p>`,
    }),
  });

  if (!response.ok) {
    const detalhe = await response.text().catch(() => "");
    throw new Error(`provedor de e-mail recusou a mensagem (${response.status})${detalhe ? `: ${detalhe.slice(0, 300)}` : ""}`);
  }
}
