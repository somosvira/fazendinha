/**
 * Assistente financeiro web. WhatsApp continua bloqueado separadamente no app.
 * Esta chave também impede chamadas diretas à API quando desligada.
 */
export const ASSISTENTE_ATIVO = true;

export function rotaDoAssistente(pathname: string) {
  return /^\/api\/bot(?:\/|$)/.test(pathname);
}
