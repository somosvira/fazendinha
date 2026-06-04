// Whitelist por número de telefone. CSV em env.WHATSAPP_NUMEROS_AUTORIZADOS,
// formato E.164 sem "+" (ex.: "5532991234567"). Comparação após normalização.

import { env } from "../../env.js";

function soDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

function carregarAutorizados(): Set<string> {
  return new Set(
    env.WHATSAPP_NUMEROS_AUTORIZADOS.split(",")
      .map((s) => soDigitos(s))
      .filter((s) => s.length > 0),
  );
}

let cache: Set<string> | null = null;
function autorizados(): Set<string> {
  if (!cache) cache = carregarAutorizados();
  return cache;
}

// Aceita tanto JID completo ("5511999...@s.whatsapp.net") quanto só o número.
export function isNumeroAutorizado(jidOuTelefone: string): boolean {
  const numero = soDigitos(jidOuTelefone.split("@")[0] ?? "");
  if (!numero) return false;
  return autorizados().has(numero);
}

// Extrai o telefone (E.164 sem +) a partir do JID.
export function telefoneDeJid(jid: string): string {
  return soDigitos(jid.split("@")[0] ?? "");
}
