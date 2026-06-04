// Rotas de Nota Fiscal — upload em proxy (browser → backend → storage).
// O backend roda validação síncrona ANTES de subir ao storage e dispara a
// validação assíncrona (OCR) DEPOIS, sem bloquear o response.

import { Hono } from "hono";
import { prisma } from "../db.js";
import { getStorage, verifyLocalToken } from "../lib/storage.js";
import { uploadArquivoNotaFiscalHttp } from "../services/notaFiscal/uploadArquivo.js";
import { assertMesAberto, FechamentoMensalError } from "../services/fechamento.js";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// ─── Helpers de serialização ─────────────────────────────────────────────

function serializeArquivo(a: {
  id: number;
  lancamentoId: number;
  mimeType: string;
  tamanhoBytes: number;
  statusValidacao: string;
  mensagemValidacao: string | null;
  cnpjEmissor: string | null;
  chaveAcessoNfe: string | null;
  ocrTexto: string | null;
  criadoEm: Date;
  validadoEm: Date | null;
}) {
  return {
    id: a.id,
    lancamentoId: a.lancamentoId,
    mimeType: a.mimeType,
    tamanhoBytes: a.tamanhoBytes,
    statusValidacao: a.statusValidacao,
    mensagemValidacao: a.mensagemValidacao,
    cnpjEmissor: a.cnpjEmissor,
    chaveAcessoNfe: a.chaveAcessoNfe,
    // ocrTexto pode ser grande — só os primeiros 500 chars no GET principal
    ocrPreview: a.ocrTexto ? a.ocrTexto.slice(0, 500) : null,
    criadoEm: a.criadoEm.toISOString(),
    validadoEm: a.validadoEm?.toISOString() ?? null,
  };
}

// ─── Router ──────────────────────────────────────────────────────────────

export const notaFiscalRouter = new Hono()
  // POST /api/lancamentos/:id/nota-fiscal  (multipart)
  .post("/lancamentos/:id/nota-fiscal", async (c) => {
    const lancamentoId = Number(c.req.param("id"));
    if (!Number.isInteger(lancamentoId) || lancamentoId <= 0) {
      return c.json({ erro: "id de lançamento inválido" }, 400);
    }

    // Rejeita antes de bufferizar quando o cliente diz que vai mandar mais que o teto
    const contentLength = Number(c.req.header("content-length") ?? 0);
    if (contentLength > MAX_UPLOAD_BYTES + 1024) {
      return c.json({ erro: `arquivo excede ${MAX_UPLOAD_BYTES / 1024 / 1024}MB` }, 413);
    }

    let form: FormData;
    try {
      form = await c.req.formData();
    } catch {
      return c.json({ erro: "multipart inválido" }, 400);
    }
    const file = form.get("arquivo");
    if (!(file instanceof File)) {
      return c.json({ erro: "campo 'arquivo' ausente no multipart" }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeTypeDeclarado = file.type || "application/octet-stream";

    const resultado = await uploadArquivoNotaFiscalHttp({ lancamentoId, buffer, mimeTypeDeclarado });
    if (!resultado.ok) {
      const payload: Record<string, unknown> = { erro: resultado.mensagem, codigo: resultado.codigo };
      if (resultado.duplicata) payload.arquivoExistente = resultado.duplicata;
      return c.json(payload, resultado.httpStatus);
    }
    return c.json({ arquivo: serializeArquivo(resultado.arquivo) }, 201);
  })

  // GET /api/lancamentos/:id/nota-fiscal  (lista + URLs assinadas)
  .get("/lancamentos/:id/nota-fiscal", async (c) => {
    const lancamentoId = Number(c.req.param("id"));
    if (!Number.isInteger(lancamentoId) || lancamentoId <= 0) {
      return c.json({ erro: "id de lançamento inválido" }, 400);
    }
    const arquivos = await prisma.notaFiscalArquivo.findMany({
      where: { lancamentoId },
      orderBy: { criadoEm: "desc" },
    });
    const storage = await getStorage();
    const enriched = await Promise.all(
      arquivos.map(async (a) => ({
        ...serializeArquivo(a),
        downloadUrl: await storage.getSignedDownloadUrl({ key: a.storageKey, ttlSeconds: 600 }),
      })),
    );
    return c.json({ arquivos: enriched });
  })

  // GET /api/nota-fiscal/arquivo/:arquivoId  (polling de status)
  .get("/nota-fiscal/arquivo/:arquivoId", async (c) => {
    const arquivoId = Number(c.req.param("arquivoId"));
    if (!Number.isInteger(arquivoId) || arquivoId <= 0) {
      return c.json({ erro: "id de arquivo inválido" }, 400);
    }
    const arq = await prisma.notaFiscalArquivo.findUnique({ where: { id: arquivoId } });
    if (!arq) return c.json({ erro: "arquivo não encontrado" }, 404);
    const storage = await getStorage();
    return c.json({
      arquivo: {
        ...serializeArquivo(arq),
        ocrTexto: arq.ocrTexto, // texto completo aqui
        downloadUrl: await storage.getSignedDownloadUrl({ key: arq.storageKey, ttlSeconds: 600 }),
      },
    });
  })

  // DELETE /api/lancamentos/:id/nota-fiscal/:arquivoId
  .delete("/lancamentos/:id/nota-fiscal/:arquivoId", async (c) => {
    const lancamentoId = Number(c.req.param("id"));
    const arquivoId = Number(c.req.param("arquivoId"));
    if (!Number.isInteger(lancamentoId) || !Number.isInteger(arquivoId)) {
      return c.json({ erro: "ids inválidos" }, 400);
    }
    const arq = await prisma.notaFiscalArquivo.findUnique({
      where: { id: arquivoId },
      include: { lancamento: true },
    });
    if (!arq || arq.lancamentoId !== lancamentoId) {
      return c.json({ erro: "arquivo não encontrado neste lançamento" }, 404);
    }

    const dataCaixa = arq.lancamento.dataLiquidacao ?? arq.lancamento.dataCompetencia;
    try {
      await assertMesAberto(dataCaixa);
    } catch (e) {
      if (e instanceof FechamentoMensalError) {
        return c.json({ erro: e.message, codigo: "MES_FECHADO" }, 423);
      }
      throw e;
    }

    const storage = await getStorage();
    await storage.deleteObject({ key: arq.storageKey });
    await prisma.notaFiscalArquivo.delete({ where: { id: arquivoId } });
    return c.json({ ok: true });
  })

  // GET /api/nota-fiscal/local-download  (driver local apenas — URL assinada por HMAC)
  .get("/nota-fiscal/local-download", async (c) => {
    const key = c.req.query("key");
    const expRaw = c.req.query("exp");
    const sig = c.req.query("sig");
    if (!key || !expRaw || !sig) return c.json({ erro: "parâmetros ausentes" }, 400);
    const exp = Number(expRaw);
    if (!Number.isInteger(exp) || exp <= 0) return c.json({ erro: "exp inválido" }, 400);
    if (!verifyLocalToken(key, exp, sig)) return c.json({ erro: "assinatura inválida ou expirada" }, 403);

    const storage = await getStorage();
    if (storage.driver !== "local") {
      return c.json({ erro: "endpoint só disponível com STORAGE_DRIVER=local" }, 404);
    }

    const arq = await prisma.notaFiscalArquivo.findUnique({ where: { storageKey: key } });
    if (!arq) return c.json({ erro: "arquivo não encontrado" }, 404);
    const buffer = await storage.getObjectBuffer({ key });
    c.header("Content-Type", arq.mimeType);
    c.header("Cache-Control", "private, max-age=300");
    return c.body(new Uint8Array(buffer));
  });
