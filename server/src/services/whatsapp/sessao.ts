// Wrapper de useMultiFileAuthState. O diretório vem de env.WHATSAPP_AUTH_DIR
// e é resolvido relativo ao cwd do server (mesmo padrão do LOCAL_STORAGE_DIR).
// Os arquivos gravados aqui SÃO a sessão WhatsApp pareada — equivalentes a uma
// senha. .gitignore na raiz exclui o diretório.

import path from "node:path";
import fs from "node:fs/promises";
import { useMultiFileAuthState } from "@whiskeysockets/baileys";
import type { AuthenticationState, SignalDataTypeMap } from "@whiskeysockets/baileys";
import { env } from "../../env.js";

export type AuthState = {
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
};

// Tipo auxiliar pra evitar `any` no helper de keys, caso seja útil em testes.
export type _SignalKeys = SignalDataTypeMap;

export async function carregarAuthState(): Promise<AuthState> {
  const dir = path.resolve(env.WHATSAPP_AUTH_DIR);
  await fs.mkdir(dir, { recursive: true });
  return useMultiFileAuthState(dir);
}
