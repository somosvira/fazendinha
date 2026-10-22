/**
 * Suspende bot/WhatsApp legados. O canal novo /api/assistente tem configuração
 * e autorização próprias; esta chave não deve liberá-lo nem reativar o legado.
 */
export const ASSISTENTE_ATIVO = false;

export function rotaDoAssistente(pathname: string) {
  return /^\/api\/(?:bot(?:\/|$)|whatsapp(?:\/|$))/.test(pathname);
}
