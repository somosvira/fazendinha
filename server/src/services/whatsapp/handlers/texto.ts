// Interpreta texto puro vindo de um número autorizado. Olha se há uma
// WhatsAppConfirmacaoPendente AGUARDANDO desse telefone e tenta casar com
// Confirmar/Cancelar/Ajustar. Outras palavras = orientação curta.

import type { WASocket } from "@whiskeysockets/baileys";
import { prisma } from "../../../db.js";
import { telefoneDeJid } from "../autorizacao.js";
import { confirmarECriarLancamento } from "../criarLancamento.js";
import {
  MSG_AGUARDANDO_RESPOSTA,
  MSG_AJUSTAR_INDISPONIVEL,
  MSG_CANCELADO,
  MSG_ERRO_INTERNO,
  MSG_SEM_SESSAO,
  msgLancado,
  msgMesFechado,
} from "../respostas.js";

const COMANDOS_CONFIRMAR = new Set(["1", "ok", "okay", "confirmar", "confirmo", "confirma", "sim", "s", "y", "yes"]);
const COMANDOS_CANCELAR = new Set(["2", "cancelar", "cancela", "nao", "não", "n", "no", "descartar", "descarta"]);
const COMANDOS_AJUSTAR = new Set(["3", "ajustar", "ajusta", "editar", "edita", "errado"]);

type Comando = "CONFIRMAR" | "CANCELAR" | "AJUSTAR" | "DESCONHECIDO";

function interpretarComando(texto: string): Comando {
  const t = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  if (!t) return "DESCONHECIDO";
  // emoji direto
  if (t.includes("👍") || t.includes("✅") || t.includes("✔")) return "CONFIRMAR";
  if (t.includes("❌") || t.includes("✖")) return "CANCELAR";
  if (COMANDOS_CONFIRMAR.has(t)) return "CONFIRMAR";
  if (COMANDOS_CANCELAR.has(t)) return "CANCELAR";
  if (COMANDOS_AJUSTAR.has(t)) return "AJUSTAR";
  return "DESCONHECIDO";
}

export async function processarTexto(
  sock: WASocket,
  args: { jid: string; texto: string },
): Promise<void> {
  const { jid, texto } = args;
  const telefone = telefoneDeJid(jid);

  const pendente = await prisma.whatsAppConfirmacaoPendente.findFirst({
    where: { telefone, status: "AGUARDANDO", expiraEm: { gt: new Date() } },
    orderBy: { criadoEm: "desc" },
  });

  if (!pendente) {
    // Sem sessão aberta. Não responde nada a textos aleatórios pra não virar chatbot;
    // só responde se o texto parece tentativa de comando.
    const cmd = interpretarComando(texto);
    if (cmd !== "DESCONHECIDO") {
      await sock.sendMessage(jid, { text: MSG_SEM_SESSAO });
    }
    return;
  }

  const cmd = interpretarComando(texto);

  if (cmd === "AJUSTAR") {
    await sock.sendMessage(jid, { text: MSG_AJUSTAR_INDISPONIVEL });
    return;
  }

  if (cmd === "CANCELAR") {
    // updateMany pra ficar idempotente — se duas confirmações chegarem em paralelo,
    // a segunda não derruba a primeira.
    const r = await prisma.whatsAppConfirmacaoPendente.updateMany({
      where: { id: pendente.id, status: "AGUARDANDO" },
      data: { status: "CANCELADA", decididoEm: new Date() },
    });
    if (r.count > 0) {
      await sock.sendMessage(jid, { text: MSG_CANCELADO });
    }
    return;
  }

  if (cmd === "CONFIRMAR") {
    // Trava otimista — se outra mensagem já tiver decidido essa confirmação,
    // updateMany retorna 0 e nada acontece.
    const trava = await prisma.whatsAppConfirmacaoPendente.updateMany({
      where: { id: pendente.id, status: "AGUARDANDO" },
      data: { decididoEm: new Date() },
    });
    if (trava.count === 0) return;

    // Recarrega o registro pós-trava (poderia usar o pendente mas o decididoEm muda).
    const lock = await prisma.whatsAppConfirmacaoPendente.findUnique({ where: { id: pendente.id } });
    if (!lock) return;

    const r = await confirmarECriarLancamento(lock);
    if (r.ok) {
      await sock.sendMessage(jid, { text: msgLancado(r.lancamentoId, r.valor, r.fornecedor) });
      return;
    }
    // Em falha, reverter para AGUARDANDO seria possível, mas pode confundir;
    // marcar como CANCELADA com motivo é mais limpo. Exceção: MES_FECHADO marca CANCELADA e responde com mensagem específica.
    await prisma.whatsAppConfirmacaoPendente.update({
      where: { id: pendente.id },
      data: { status: "CANCELADA" },
    });
    if (r.codigo === "MES_FECHADO") {
      await sock.sendMessage(jid, { text: msgMesFechado(r.mesAno) });
    } else {
      await sock.sendMessage(jid, { text: MSG_ERRO_INTERNO });
    }
    return;
  }

  // Texto que não bateu com nenhum comando, mas tem sessão pendente
  await sock.sendMessage(jid, { text: MSG_AGUARDANDO_RESPOSTA });
}
