// Abstração de storage com dois drivers: "local" (dev sem nuvem) e "r2"
// (Cloudflare R2, S3-compatible). A interface é a mesma; o driver é escolhido
// por env.STORAGE_DRIVER.

import crypto from "node:crypto";
import path from "node:path";
import { env } from "../env.js";
import { isCloudflareWorkers } from "./runtime.js";

// `node:crypto` e `node:path` são só lógica pura (sem I/O de SO) e o
// `nodejs_compat` do Workers cobre os dois bem — import estático é seguro
// mesmo se este arquivo algum dia for bundlado num Worker. Já `node:fs`
// depende de filesystem real, que não existe lá: por isso ele é importado
// só dentro dos métodos do `LocalStorage`, nunca aqui no topo — um import
// estático rodaria no module-load do Worker mesmo que `LocalStorage` nunca
// fosse instanciado (ver `isCloudflareWorkers()` em `./runtime.js`),
// quebrando o boot inteiro em vez de só o caminho que usa disco.

export type StorageDriver = "local" | "r2";

export type PutObjectArgs = { key: string; body: Buffer; contentType: string };
export type PutObjectResult = { storageDriver: StorageDriver; bucket: string | null; storageKey: string };
export type SignedUrlArgs = { key: string; ttlSeconds?: number; filename?: string };

export interface Storage {
  driver: StorageDriver;
  putObject(args: PutObjectArgs): Promise<PutObjectResult>;
  getSignedDownloadUrl(args: SignedUrlArgs): Promise<string>;
  getObjectBuffer(args: { key: string }): Promise<Buffer>;
  deleteObject(args: { key: string }): Promise<void>;
  // R2 não tem tier ultra-frio como Glacier; mantemos a assinatura por simetria.
  // Retorna mensagem informativa.
  restoreFromArchive(args: { key: string }): Promise<{ enfileirado: boolean; mensagem: string }>;
}

// ───── Driver local ─────

class LocalStorage implements Storage {
  driver: StorageDriver = "local";
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir);
  }

  private absPath(key: string) {
    // proteção contra path traversal
    const normalized = path.posix.normalize(key);
    if (normalized.startsWith("..") || normalized.startsWith("/") || normalized.includes("\0")) {
      throw new Error(`storageKey inválido: ${key}`);
    }
    return path.join(this.baseDir, normalized);
  }

  async putObject({ key, body }: PutObjectArgs): Promise<PutObjectResult> {
    const fs = await import("node:fs/promises");
    const abs = this.absPath(key);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, body);
    return { storageDriver: "local", bucket: null, storageKey: key };
  }

  async getSignedDownloadUrl({ key, ttlSeconds = 600 }: SignedUrlArgs): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = signLocalToken(key, exp);
    const qs = new URLSearchParams({ key, exp: String(exp), sig });
    return `/api/nota-fiscal/local-download?${qs.toString()}`;
  }

  async getObjectBuffer({ key }: { key: string }): Promise<Buffer> {
    const fs = await import("node:fs/promises");
    return fs.readFile(this.absPath(key));
  }

  async deleteObject({ key }: { key: string }): Promise<void> {
    const fs = await import("node:fs/promises");
    try {
      await fs.unlink(this.absPath(key));
    } catch (e: any) {
      if (e?.code !== "ENOENT") throw e;
    }
  }

  async restoreFromArchive(): Promise<{ enfileirado: boolean; mensagem: string }> {
    return { enfileirado: false, mensagem: "Driver local não precisa restauração — arquivo já disponível." };
  }
}

// HMAC-SHA256 para assinar URLs de download local. Sem deps externas.
export function signLocalToken(key: string, exp: number): string {
  return crypto.createHmac("sha256", env.LOCAL_DOWNLOAD_SECRET).update(`${key}:${exp}`).digest("hex");
}

export function verifyLocalToken(key: string, exp: number, sig: string): boolean {
  const expected = signLocalToken(key, exp);
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  return Math.floor(Date.now() / 1000) < exp;
}

// ───── Driver Cloudflare R2 ─────

class R2Storage implements Storage {
  driver: StorageDriver = "r2";
  private bucket: string;
  private client: any; // S3Client (lazy-imported pra não pesar driver local)
  private presigner: typeof import("@aws-sdk/s3-request-presigner");

  constructor(bucket: string, client: any, presigner: typeof import("@aws-sdk/s3-request-presigner")) {
    this.bucket = bucket;
    this.client = client;
    this.presigner = presigner;
  }

  async putObject({ key, body, contentType }: PutObjectArgs): Promise<PutObjectResult> {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // R2 ignora ServerSideEncryption (já criptografa at-rest por default).
      }),
    );
    return { storageDriver: "r2", bucket: this.bucket, storageKey: key };
  }

  async getSignedDownloadUrl({ key, ttlSeconds = 600, filename }: SignedUrlArgs): Promise<string> {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: filename ? `attachment; filename="${filename}"` : undefined,
    });
    return this.presigner.getSignedUrl(this.client, cmd, { expiresIn: ttlSeconds });
  }

  async getObjectBuffer({ key }: { key: string }): Promise<Buffer> {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks: Buffer[] = [];
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async deleteObject({ key }: { key: string }): Promise<void> {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async restoreFromArchive(): Promise<{ enfileirado: boolean; mensagem: string }> {
    return {
      enfileirado: false,
      mensagem: "Cloudflare R2 não tem tier Glacier — arquivos em IA continuam acessíveis em milissegundos.",
    };
  }
}

// ───── Factory ─────

let cached: Storage | null = null;

export async function getStorage(): Promise<Storage> {
  if (cached) return cached;

  if (env.STORAGE_DRIVER === "local") {
    // Dentro de um Worker não existe filesystem — falha aqui, com mensagem clara,
    // em vez de deixar o primeiro putObject/getObjectBuffer estourar um erro
    // confuso de import lá na frente.
    if (isCloudflareWorkers()) {
      throw new Error("STORAGE_DRIVER=local não funciona dentro de um Cloudflare Worker (sem filesystem) — configure STORAGE_DRIVER=r2");
    }
    cached = new LocalStorage(env.LOCAL_STORAGE_DIR);
    return cached;
  }

  // R2
  const { S3Client } = await import("@aws-sdk/client-s3");
  const presigner = await import("@aws-sdk/s3-request-presigner");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    },
  });
  cached = new R2Storage(env.R2_BUCKET_NOTAS!, client, presigner);
  return cached;
}
