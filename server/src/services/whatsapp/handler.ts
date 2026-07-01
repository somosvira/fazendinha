// Orquestração de uma mensagem recebida do WhatsApp:
//   1. dedupe (a Meta reentrega o webhook)
//   2. allowlist (UsuarioWhatsapp ativo)
//   3. roda o agente com a memória da conversa (chave = telefone)
//   4. persiste a troca e envia a resposta
//
// Roda em background a partir da rota (que responde 200 rápido pra Meta).

import { prisma } from "../../db.js";
import { perguntar, BotDesligadoError } from "../bot/agent.js";
import { carregarHistorico, registrarTroca } from "../bot/conversa.js";
import { enviarTexto } from "./client.js";
import type { MensagemRecebida } from "./webhook.js";

const ehP2002 = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

export async function processarMensagem(msg: MensagemRecebida): Promise<void> {
  const { from, waMessageId, type, text } = msg;

  // 1) dedupe — já processamos esta mensagem?
  if (waMessageId) {
    const existe = await prisma.mensagemWhatsapp.findUnique({ where: { waMessageId } });
    if (existe) return;
  }

  // 2) allowlist
  const usuario = await prisma.usuarioWhatsapp.findUnique({ where: { telefone: from } });
  if (!usuario || !usuario.ativo) {
    await enviarTexto(from, "Olá! Este número não tem acesso ao assistente da Fazenda Rio Novo.");
    return;
  }

  // por enquanto só texto (imagens/nota fiscal entram na Fase 4)
  if (type !== "text" || !text) {
    await enviarTexto(from, "Por ora eu só entendo mensagens de texto. Em breve dá pra mandar foto de nota fiscal. 🙂");
    return;
  }

  // 3) agente com memória
  const historico = await carregarHistorico(from);
  let resposta: string;
  try {
    resposta = (await perguntar(text, historico)).resposta;
  } catch (e) {
    resposta = e instanceof BotDesligadoError
      ? "Assistente temporariamente indisponível. Tente mais tarde."
      : "Tive um problema ao processar sua mensagem. Pode tentar de novo?";
  }

  // 4) persiste (dedupe forte: se outra reentrega gravou antes, P2002 → não reenvia)
  try {
    await registrarTroca(from, text, resposta, { waMessageId, usuarioId: usuario.id });
  } catch (e) {
    if (ehP2002(e)) return; // já tratada por uma reentrega concorrente
    throw e;
  }
  await enviarTexto(from, resposta);
}
