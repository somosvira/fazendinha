import crypto from "node:crypto";
import { env } from "../env.js";
import { getStorage } from "./storage.js";

const UPLOAD_TTL_SECONDS = 10 * 60;

type DadosUpload = Record<string, unknown>;

export class UploadInvalidoError extends Error {}

export type UploadIntent<T extends DadosUpload> = T & {
  temporarioKey: string;
  mimeType: string;
  tamanhoBytes: number;
  sha256: string;
  exp: number;
};

type CriarUploadDireto<T extends DadosUpload> = {
  dados: T;
  temporarioKey: string;
  mimeType: string;
  tamanhoBytes: number;
  sha256: string;
};

function assinarIntent<T extends DadosUpload>(intent: UploadIntent<T>) {
  const payload = Buffer.from(JSON.stringify(intent)).toString("base64url");
  const assinatura = crypto.createHmac("sha256", env.JWT_SECRET).update(payload).digest("base64url");
  return `${payload}.${assinatura}`;
}

export function lerIntentUpload<T extends DadosUpload>(token: string): UploadIntent<T> {
  const [payload, assinatura] = token.split(".");
  if (!payload || !assinatura) {
    throw new UploadInvalidoError("Upload inválido ou expirado");
  }

  const esperado = crypto.createHmac("sha256", env.JWT_SECRET).update(payload).digest("base64url");
  if (assinatura.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperado))) {
    throw new UploadInvalidoError("Upload inválido ou expirado");
  }

  try {
    const intent = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as UploadIntent<T>;
    if (intent.exp < Math.floor(Date.now() / 1000)) throw new Error("expirado");
    return intent;
  } catch {
    throw new UploadInvalidoError("Upload inválido ou expirado");
  }
}

export async function criarUploadDireto<T extends DadosUpload>({
  dados,
  temporarioKey,
  mimeType,
  tamanhoBytes,
  sha256,
}: CriarUploadDireto<T>) {
  const exp = Math.floor(Date.now() / 1000) + UPLOAD_TTL_SECONDS;
  const intent: UploadIntent<T> = { ...dados, temporarioKey, mimeType, tamanhoBytes, sha256, exp };
  const uploadUrl = await (await getStorage()).getSignedUploadUrl({
    key: temporarioKey,
    contentType: mimeType,
    metadata: { sha256 },
    ttlSeconds: UPLOAD_TTL_SECONDS,
  });

  return {
    uploadToken: assinarIntent(intent),
    uploadUrl,
    headers: { "Content-Type": mimeType, "x-amz-meta-sha256": sha256 },
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export async function promoverUploadDireto<T extends DadosUpload>(intent: UploadIntent<T>, destinoKey: string) {
  const storage = await getStorage();
  const head = await storage.headObject({ key: intent.temporarioKey });
  const confere =
    head.contentLength === intent.tamanhoBytes &&
    head.contentType === intent.mimeType &&
    head.metadata.sha256 === intent.sha256;

  if (!confere) {
    await storage.deleteObject({ key: intent.temporarioKey });
    throw new UploadInvalidoError("O arquivo enviado não confere com a solicitação");
  }

  await storage.copyObject({
    sourceKey: intent.temporarioKey,
    destinationKey: destinoKey,
    contentType: intent.mimeType,
    metadata: { sha256: intent.sha256 },
  });
}

export async function removerUploadTemporario(key: string) {
  await (await getStorage()).deleteObject({ key });
}

export async function removerUploadPromovido(key: string) {
  await (await getStorage()).deleteObject({ key });
}
