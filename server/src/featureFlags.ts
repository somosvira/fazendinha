/**
 * Chave temporária para suspender todos os canais do assistente sem apagar
 * rotas ou serviços. Mantida no servidor para impedir chamadas diretas à API.
 */
export const ASSISTENTE_ATIVO = false;

export function rotaDoAssistente(pathname: string) {
  return /^\/api\/(?:bot(?:\/|$)|whatsapp(?:\/|$))/.test(pathname);
}
