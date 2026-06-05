// Upload "pendente" da NF — o arquivo vai para o storage com key
// notas/_pendente/<sha>.<ext>, mas NENHUM Lancamento ou NotaFiscalArquivo
// é criado ainda. Só quando o usuário preencher o form e clicar em "Registrar
// gasto" é que a pendente vira Lancamento + NotaFiscalArquivo (ver
// confirmarPendente.ts).
//
// Isso resolve o problema do upload órfão: se o usuário abandonar antes de
// confirmar, o cleanup hourly apaga o arquivo do storage e marca a pendente
// como EXPIRADO — nada de lixo permanente no banco.

import { prisma } from "../../db.js";
import { getStorage } from "../../lib/storage.js";
import { validarUploadSincrono } from "./validacaoSincrona.js";

const TTL_MS = 30 * 60 * 1000; // 30 minutos
const KEY_PREFIX = "notas/_pendente";

export type ResultadoUploadPendente =
  | {
      ok: true;
      // RETOMADA: já havia pendente AGUARDANDO com o mesmo sha — reaproveitamos
      // em vez de criar um segundo registro. Acontece quando o usuário recarrega
      // a aba ou tenta subir a mesma foto duas vezes antes de confirmar.
      retomada: boolean;
      pendente: {
        id: number;
        sha256: string;
        mimeType: string;
        tamanhoBytes: number;
        expiraEm: Date;
      };
    }
  | {
      ok: false;
      status: 400 | 409 | 413;
      codigo:
        | "VALIDACAO"
        | "DUPLICATA_DEFINITIVA"
        | "JA_EM_OUTRO_PROCESSO";
      mensagem: string;
      // DUPLICATA_DEFINITIVA: arquivo já virou Lancamento real.
      arquivoExistente?: { id: number; lancamentoId: number };
    };

export async function uploadPendenteNotaFiscal(args: {
  buffer: Buffer;
  mimeTypeDeclarado: string;
}): Promise<ResultadoUploadPendente> {
  const { buffer, mimeTypeDeclarado } = args;

  const validacao = await validarUploadSincrono({ buffer, mimeTypeDeclarado });
  if (!validacao.ok) {
    const status = validacao.codigo === "TAMANHO_GRANDE" ? 413 : 400;
    return { ok: false, status, codigo: "VALIDACAO", mensagem: validacao.mensagem };
  }
  const { sha256, mimeTypeReal, ext } = validacao;

  // Bloqueio mais forte: se essa foto já virou Lancamento real, não permitimos
  // subir de novo. Sinalizamos qual lançamento já contém pra UI mostrar.
  const definitiva = await prisma.notaFiscalArquivo.findUnique({
    where: { sha256 },
    select: { id: true, lancamentoId: true },
  });
  if (definitiva) {
    return {
      ok: false,
      status: 409,
      codigo: "DUPLICATA_DEFINITIVA",
      mensagem: "Esta nota já foi lançada antes.",
      arquivoExistente: { id: definitiva.id, lancamentoId: definitiva.lancamentoId },
    };
  }

  // Retomada: já existe pendente AGUARDANDO com esse sha — devolve o id em vez
  // de tentar criar outra. Não toca o storage (objeto já está lá).
  const agora = new Date();
  const pendenteExistente = await prisma.notaFiscalUploadPendente.findUnique({
    where: { sha256 },
  });
  if (pendenteExistente && pendenteExistente.status === "AGUARDANDO" && pendenteExistente.expiraEm > agora) {
    return {
      ok: true,
      retomada: true,
      pendente: {
        id: pendenteExistente.id,
        sha256: pendenteExistente.sha256,
        mimeType: pendenteExistente.mimeType,
        tamanhoBytes: pendenteExistente.tamanhoBytes,
        expiraEm: pendenteExistente.expiraEm,
      },
    };
  }
  // Se existe pendente decidido/expirado com mesmo sha → estamos no entremeio
  // (cleanup ainda não apagou o registro/objeto). Recusamos por enquanto pra
  // evitar inconsistência; quando o cleanup rodar, a chave libera.
  if (pendenteExistente) {
    return {
      ok: false,
      status: 409,
      codigo: "JA_EM_OUTRO_PROCESSO",
      mensagem: "Este arquivo foi enviado há pouco e está aguardando limpeza. Tente em alguns minutos.",
    };
  }

  const storage = await getStorage();
  const storageKey = `${KEY_PREFIX}/${sha256}.${ext}`;
  const put = await storage.putObject({ key: storageKey, body: buffer, contentType: mimeTypeReal });

  const novo = await prisma.notaFiscalUploadPendente.create({
    data: {
      storageDriver: put.storageDriver,
      bucket: put.bucket,
      storageKey: put.storageKey,
      sha256,
      mimeType: mimeTypeReal,
      tamanhoBytes: buffer.length,
      expiraEm: new Date(agora.getTime() + TTL_MS),
    },
  });

  return {
    ok: true,
    retomada: false,
    pendente: {
      id: novo.id,
      sha256: novo.sha256,
      mimeType: novo.mimeType,
      tamanhoBytes: novo.tamanhoBytes,
      expiraEm: novo.expiraEm,
    },
  };
}

// Marca pendente como CANCELADO. Não apaga storage aqui (o cleanup faz isso
// depois de 24h para dar uma janela de retomada por sha). Idempotente.
export async function cancelarPendente(id: number): Promise<boolean> {
  const r = await prisma.notaFiscalUploadPendente.updateMany({
    where: { id, status: "AGUARDANDO" },
    data: { status: "CANCELADO", decididoEm: new Date() },
  });
  return r.count > 0;
}
