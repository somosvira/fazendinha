// Memória de conversa do bot. A chave é o telefone (WhatsApp) ou um id de sessão
// (rota de teste) — ambos guardados no campo `telefone` de ConversaWhatsapp.
// Guardamos só o texto de cada turno (user/assistant); o suficiente para o modelo
// resolver follow-ups ("os quatro custos", "e no mês anterior?") sem reexecutar
// tudo do zero. Não persistimos as tool calls (mantém o histórico enxuto).

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { prisma } from "../../db.js";

const LIMITE_TURNOS = 20; // últimas N mensagens (≈10 trocas)

export async function carregarHistorico(chave: string): Promise<ChatCompletionMessageParam[]> {
  const conv = await prisma.conversaWhatsapp.findUnique({
    where: { telefone: chave },
    include: { mensagens: { orderBy: { id: "desc" }, take: LIMITE_TURNOS } },
  });
  if (!conv) return [];
  return conv.mensagens
    .reverse()
    .filter((m) => m.texto)
    .map((m) => ({
      role: m.direcao === "IN" ? "user" : "assistant",
      content: m.texto as string,
    }));
}

export interface OpcoesTroca {
  // ID da mensagem na Meta — UNIQUE garante dedupe. Se já existir, lança P2002.
  waMessageId?: string;
  usuarioId?: number;
}

export async function registrarTroca(
  chave: string,
  pergunta: string,
  resposta: string,
  opts: OpcoesTroca = {},
): Promise<void> {
  const conv = await prisma.conversaWhatsapp.upsert({
    where: { telefone: chave },
    create: { telefone: chave, usuarioId: opts.usuarioId },
    update: { ultimaAtividade: new Date(), ...(opts.usuarioId ? { usuarioId: opts.usuarioId } : {}) },
  });
  // Cria IN (com waMessageId p/ dedupe) e depois OUT; o id autoincrement preserva a ordem.
  // Se a mensagem IN já foi gravada (reentrega da Meta), o create lança P2002 — o chamador trata.
  await prisma.mensagemWhatsapp.create({
    data: { conversaId: conv.id, direcao: "IN", texto: pergunta, waMessageId: opts.waMessageId },
  });
  await prisma.mensagemWhatsapp.create({
    data: { conversaId: conv.id, direcao: "OUT", texto: resposta },
  });
}
