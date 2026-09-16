// Storage único via Cloudflare R2 (S3-compatible), em todos os ambientes.

import { env } from "../env.js";

export type StorageDriver = "r2";

export type PutObjectArgs = { key: string; body: Buffer; contentType: string };
export type PutObjectResult = { storageDriver: StorageDriver; bucket: string | null; storageKey: string };
export type SignedUrlArgs = { key: string; ttlSeconds?: number; filename?: string };
export type SignedUploadArgs = { key: string; contentType: string; metadata: Record<string, string>; ttlSeconds?: number };
export type ObjectHead = { contentLength: number; contentType: string | undefined; metadata: Record<string, string> };

export interface Storage {
  driver: StorageDriver;
  putObject(args: PutObjectArgs): Promise<PutObjectResult>;
  getSignedUploadUrl(args: SignedUploadArgs): Promise<string>;
  getSignedDownloadUrl(args: SignedUrlArgs): Promise<string>;
  headObject(args: { key: string }): Promise<ObjectHead>;
  copyObject(args: { sourceKey: string; destinationKey: string; contentType: string; metadata: Record<string, string> }): Promise<void>;
  getObjectBuffer(args: { key: string }): Promise<Buffer>;
  deleteObject(args: { key: string }): Promise<void>;
  // R2 não tem tier ultra-frio como Glacier; mantemos a assinatura por simetria.
  // Retorna mensagem informativa.
  restoreFromArchive(args: { key: string }): Promise<{ enfileirado: boolean; mensagem: string }>;
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

  async getSignedUploadUrl({ key, contentType, metadata, ttlSeconds = 600 }: SignedUploadArgs): Promise<string> {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType, Metadata: metadata });
    // O presigner tende a "hoistar" x-amz-meta-* para a query string. R2
    // aceita a assinatura, mas não persiste esses metadados como headers de
    // objeto; mantê-los em SignedHeaders faz o navegador enviá-los e permite
    // conferência por HeadObject na confirmação.
    return this.presigner.getSignedUrl(this.client, cmd, {
      expiresIn: ttlSeconds,
      unhoistableHeaders: new Set(["content-type", ...Object.keys(metadata).map((key) => `x-amz-meta-${key}`)]),
    });
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

  async headObject({ key }: { key: string }): Promise<ObjectHead> {
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
    const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    return { contentLength: head.ContentLength ?? 0, contentType: head.ContentType, metadata: head.Metadata ?? {} };
  }

  async copyObject({ sourceKey, destinationKey, contentType, metadata }: { sourceKey: string; destinationKey: string; contentType: string; metadata: Record<string, string> }): Promise<void> {
    const { CopyObjectCommand } = await import("@aws-sdk/client-s3");
    await this.client.send(new CopyObjectCommand({
      Bucket: this.bucket,
      Key: destinationKey,
      CopySource: `${this.bucket}/${encodeURIComponent(sourceKey).replace(/%2F/g, "/")}`,
      ContentType: contentType,
      Metadata: metadata,
      MetadataDirective: "REPLACE",
    }));
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
