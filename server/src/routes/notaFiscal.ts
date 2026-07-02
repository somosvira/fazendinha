// Rotas de Nota Fiscal.
// Fluxo correto: o upload entra como NotaFiscalUploadPendente (não amarrado
// a Lancamento). Só na confirmação do form, via POST /api/lancamentos, é
// que vira NotaFiscalArquivo definitivo. O upload "antigo" que criava
// NotaFiscalArquivo direto não existe mais.

import { Hono } from "hono";
import { prisma } from "../db.js";
import { getStorage, verifyLocalToken } from "../lib/storage.js";
import { assertMesAberto, FechamentoMensalError } from "../services/fechamento.js";
import { uploadPendenteNotaFiscal, cancelarPendente } from "../services/notaFiscal/uploadPendente.js";

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
  // POST /api/nota-fiscal/upload-pendente  (multipart) — NOVO fluxo
  // Sobe pra notas/_pendente/<sha>.<ext>; nada é amarrado a Lancamento.
  .post("/nota-fiscal/upload-pendente", async (c) => {
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

    const r = await uploadPendenteNotaFiscal({ buffer, mimeTypeDeclarado });
    if (!r.ok) {
      return c.json(
        {
          erro: r.mensagem,
          codigo: r.codigo,
          arquivoExistente: r.arquivoExistente,
        },
        r.status,
      );
    }
    return c.json(
      {
        pendente: {
          id: r.pendente.id,
          sha256: r.pendente.sha256,
          mimeType: r.pendente.mimeType,
          tamanhoBytes: r.pendente.tamanhoBytes,
          expiraEm: r.pendente.expiraEm.toISOString(),
        },
        retomada: r.retomada,
      },
      r.retomada ? 200 : 201,
    );
  })

  // GET /api/nota-fiscal/upload-pendente/:id
  .get("/nota-fiscal/upload-pendente/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ erro: "id inválido" }, 400);
    const p = await prisma.notaFiscalUploadPendente.findUnique({ where: { id } });
    if (!p) return c.json({ erro: "pendente não encontrado" }, 404);
    return c.json({
      pendente: {
        id: p.id,
        sha256: p.sha256,
        mimeType: p.mimeType,
        tamanhoBytes: p.tamanhoBytes,
        status: p.status,
        criadoEm: p.criadoEm.toISOString(),
        expiraEm: p.expiraEm.toISOString(),
        decididoEm: p.decididoEm?.toISOString() ?? null,
        lancamentoId: p.lancamentoId,
      },
    });
  })

  // DELETE /api/nota-fiscal/upload-pendente/:id
  // Marca CANCELADO. Storage é apagado depois pelo cleanup (24h) pra dar
  // janela de retomada caso o usuário reenvie a mesma foto.
  .delete("/nota-fiscal/upload-pendente/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ erro: "id inválido" }, 400);
    const ok = await cancelarPendente(id);
    return c.json({ ok });
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

    // Aceita tanto NotaFiscalArquivo (definitivo) quanto NotaFiscalUploadPendente
    // (preview do form antes de confirmar).
    const [arq, pend] = await Promise.all([
      prisma.notaFiscalArquivo.findUnique({ where: { storageKey: key } }),
      prisma.notaFiscalUploadPendente.findUnique({ where: { storageKey: key } }),
    ]);
    const meta = arq ?? pend;
    if (!meta) return c.json({ erro: "arquivo não encontrado" }, 404);
    const buffer = await storage.getObjectBuffer({ key });
    c.header("Content-Type", meta.mimeType);
    c.header("Cache-Control", "private, max-age=300");
    return c.body(new Uint8Array(buffer));
  });
