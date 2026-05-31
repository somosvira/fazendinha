// Pipeline assíncrono — roda DEPOIS do PUT no storage (via setImmediate).
// Objetivo: confirmar via OCR que o arquivo é mesmo uma nota fiscal, marcar status
// final e cachear o texto para busca futura. Quando Textract está desligado, o
// arquivo fica em ATENCAO até que um humano confirme — o lançamento não trava.

import { prisma } from "../../db.js";
import { getStorage } from "../../lib/storage.js";
import { detectText } from "../../lib/ocr.js";

const REGEX_CNPJ = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/;
const REGEX_CHAVE_NFE = /\b\d{44}\b/;
const REGEX_TERMOS_NF = /\b(NOTA FISCAL|DANFE|CFOP|EMITENTE|NF-?e)\b/i;

export async function validarAssincrono(arquivoId: number): Promise<void> {
  const arq = await prisma.notaFiscalArquivo.findUnique({ where: { id: arquivoId } });
  if (!arq) return;

  const storage = await getStorage();
  let buffer: Buffer;
  try {
    buffer = await storage.getObjectBuffer({ key: arq.storageKey });
  } catch (e: any) {
    await prisma.notaFiscalArquivo.update({
      where: { id: arquivoId },
      data: {
        statusValidacao: "ATENCAO",
        mensagemValidacao: `Não consegui ler o arquivo no storage: ${e?.message ?? e}`,
        validadoEm: new Date(),
      },
    });
    return;
  }

  const ocr = await detectText(buffer);

  if (ocr.texto === null) {
    // OCR indisponível — não dá pra confirmar mas também não rejeita
    const mensagem =
      ocr.modo === "disabled"
        ? "OCR (Tesseract) desligado neste ambiente. Validação manual necessária."
        : `OCR falhou: ${ocr.mensagem ?? "erro desconhecido"}`;
    await prisma.notaFiscalArquivo.update({
      where: { id: arquivoId },
      data: { statusValidacao: "ATENCAO", mensagemValidacao: mensagem, validadoEm: new Date() },
    });
    return;
  }

  const texto = ocr.texto;
  const cnpjMatch = texto.match(REGEX_CNPJ);
  const chaveMatch = texto.match(REGEX_CHAVE_NFE);
  const temTermos = REGEX_TERMOS_NF.test(texto);

  const criteriosBatidos = [cnpjMatch, chaveMatch, temTermos].filter(Boolean).length;

  let statusValidacao: "VALIDA" | "ATENCAO" | "REJEITADA";
  let mensagemValidacao: string;
  if (criteriosBatidos >= 2) {
    statusValidacao = "VALIDA";
    mensagemValidacao = "Documento reconhecido como nota fiscal (OCR + regex).";
  } else if (criteriosBatidos === 1) {
    statusValidacao = "ATENCAO";
    mensagemValidacao = "Apenas 1 critério batido — revise se é mesmo nota fiscal.";
  } else {
    statusValidacao = "REJEITADA";
    mensagemValidacao =
      "OCR não encontrou CNPJ, chave de acesso NFe nem termos típicos de nota fiscal.";
  }

  await prisma.notaFiscalArquivo.update({
    where: { id: arquivoId },
    data: {
      statusValidacao,
      mensagemValidacao,
      ocrTexto: texto,
      cnpjEmissor: cnpjMatch?.[0] ?? null,
      chaveAcessoNfe: chaveMatch?.[0] ?? null,
      validadoEm: new Date(),
    },
  });
}

// Dispara a validação em background sem bloquear a request.
// Erros são logados — não derrubam o processo.
export function agendarValidacaoAssincrona(arquivoId: number): void {
  setImmediate(() => {
    validarAssincrono(arquivoId).catch((e) => {
      console.error(`[validacaoAssincrona] arquivo ${arquivoId} falhou:`, e);
    });
  });
}
