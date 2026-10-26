import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  tx: { laudoQualidadeLeite: { findUnique: vi.fn(), create: vi.fn(), findFirst: vi.fn() }, $executeRaw: vi.fn() },
  obterAmostra: vi.fn(), criarUpload: vi.fn(), lerIntent: vi.fn(), promover: vi.fn(), removerPromovido: vi.fn(), removerTemporario: vi.fn(), baixar: vi.fn(), auditar: vi.fn(),
}));
vi.mock("../../../db.js", () => ({ prisma: m.tx }));
vi.mock("../../../env.js", () => ({ env: { STORAGE_NAMESPACE: "test", R2_BUCKET_NOTAS: "bucket-test" } }));
vi.mock("../../../lib/storage.js", () => ({ getStorage: async () => ({ getSignedDownloadUrl: m.baixar }) }));
vi.mock("../../../lib/uploads.js", () => ({ criarUploadDireto: m.criarUpload, lerIntentUpload: m.lerIntent, promoverUploadDireto: m.promover, removerUploadPromovido: m.removerPromovido, removerUploadTemporario: m.removerTemporario, UploadInvalidoError: class extends Error {} }));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: async (f: (tx: typeof m.tx) => unknown) => f(m.tx) }));
vi.mock("./qualidade.js", () => ({ obterAmostraQualidadeTx: m.obterAmostra }));
vi.mock("../rebanho/regras.js", async original => ({ ...await original<typeof import("../rebanho/regras.js")>(), auditar: m.auditar }));
import { solicitarLaudoQualidade, confirmarLaudoQualidade, baixarLaudoQualidade } from "./qualidade.laudos.js";
const agora = new Date("2026-10-19"), sha256 = "a".repeat(64);
const intent = { contexto: "QUALIDADE_LEITE", amostraId: "amostra", propriedadeId: 1, usuarioId: 7, laudoId: "laudo", nome: "Laudo.pdf", extensao: "pdf", mimeType: "application/pdf", tamanhoBytes: 100, sha256, temporarioKey: "tmp/test/qualidade-leite/laudo.pdf" };
const laudo = { id: "laudo", amostraId: "amostra", nome: "Laudo.pdf", mimeType: "application/pdf", tamanhoBytes: 100, sha256, storageDriver: "r2", bucket: "bucket-test", storageKey: "test/pecuaria/leite/qualidade/1/amostra/laudo.pdf", criadoEm: agora, criadoPorId: 7 };
beforeEach(() => { vi.resetAllMocks(); m.obterAmostra.mockResolvedValue({ id: "amostra" }); m.lerIntent.mockReturnValue(intent); m.tx.laudoQualidadeLeite.create.mockResolvedValue(laudo); });
describe("laudos R2 privados e ligados à amostra", () => {
  it("reutiliza upload direto assinado com namespace, sítio, autor e amostra", async () => {
    await solicitarLaudoQualidade("amostra", 1, { propriedadeId: 1, nome: "Laudo.pdf", mimeType: "application/pdf", tamanhoBytes: 100, sha256 }, 7);
    expect(m.criarUpload).toHaveBeenCalledWith(expect.objectContaining({ temporarioKey: expect.stringMatching(/^tmp\/test\/qualidade-leite\/.+\.pdf$/), sha256, dados: expect.objectContaining({ contexto: "QUALIDADE_LEITE", propriedadeId: 1, usuarioId: 7, amostraId: "amostra" }) }));
  });
  it.each([
    { contexto: "OUTRO" }, { amostraId: "outra" }, { propriedadeId: 2 }, { usuarioId: 8 },
  ])("recusa usar token de contexto/destino/autor diferente %j", async alteracao => {
    m.lerIntent.mockReturnValue({ ...intent, ...alteracao });
    await expect(confirmarLaudoQualidade("amostra", 1, "token", 7)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect(m.promover).not.toHaveBeenCalled(); expect(m.tx.laudoQualidadeLeite.create).not.toHaveBeenCalled();
  });
  it("confere/preserva arquivo via helper compartilhado e não devolve chave privada", async () => {
    const r = await confirmarLaudoQualidade("amostra", 1, "token", 7);
    expect(m.promover).toHaveBeenCalledWith(intent, laudo.storageKey);
    expect(m.tx.laudoQualidadeLeite.create).toHaveBeenCalledWith({ data: expect.objectContaining({ storageDriver: "r2", bucket: "bucket-test", storageKey: laudo.storageKey, criadoPorId: 7 }) });
    expect(r).toEqual({ id: "laudo", nome: "Laudo.pdf", mimeType: "application/pdf", tamanhoBytes: 100, criadoEm: agora.toISOString(), criadoPorId: 7 });
    expect(m.removerTemporario).toHaveBeenCalledWith(intent.temporarioKey);
  });
  it("reenvio confirmado não promove nem cria outro documento", async () => {
    m.tx.laudoQualidadeLeite.findUnique.mockResolvedValue(laudo);
    expect((await confirmarLaudoQualidade("amostra", 1, "token", 7)).id).toBe("laudo");
    expect(m.promover).not.toHaveBeenCalled(); expect(m.tx.laudoQualidadeLeite.create).not.toHaveBeenCalled();
  });
  it("falha R2 não cria metadata; rollback DB remove apenas objeto novo sem vínculo", async () => {
    m.promover.mockRejectedValueOnce(new Error("R2 indisponível"));
    await expect(confirmarLaudoQualidade("amostra", 1, "token", 7)).rejects.toThrow("R2 indisponível");
    expect(m.tx.laudoQualidadeLeite.create).not.toHaveBeenCalled();
    m.tx.laudoQualidadeLeite.create.mockRejectedValueOnce(new Error("DB falhou"));
    await expect(confirmarLaudoQualidade("amostra", 1, "token", 7)).rejects.toThrow("DB falhou");
    expect(m.removerPromovido).toHaveBeenCalledWith(laudo.storageKey);
  });
  it("resposta DB perdida recupera vínculo confirmado sem apagar seu objeto", async () => {
    m.tx.laudoQualidadeLeite.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(laudo);
    m.tx.laudoQualidadeLeite.create.mockRejectedValueOnce(new Error("Resposta perdida"));
    expect((await confirmarLaudoQualidade("amostra", 1, "token", 7)).id).toBe("laudo");
    expect(m.removerPromovido).not.toHaveBeenCalled();
  });
  it("download exige sítio/amostra e URL curta sem expor storageKey", async () => {
    m.tx.laudoQualidadeLeite.findFirst.mockResolvedValue(null);
    await expect(baixarLaudoQualidade("amostra", "laudo", 2)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect(m.baixar).not.toHaveBeenCalled();
    m.tx.laudoQualidadeLeite.findFirst.mockResolvedValue(laudo); m.baixar.mockResolvedValue("https://signed.example/laudo");
    expect(await baixarLaudoQualidade("amostra", "laudo", 1)).toEqual({ url: "https://signed.example/laudo" });
    expect(m.baixar).toHaveBeenCalledWith({ key: laudo.storageKey, filename: "Laudo.pdf", ttlSeconds: 600 });
  });
  it("não emite upload para arquivo vazio, grande ou formato não permitido", async () => {
    for (const alteracao of [{ tamanhoBytes: 0 }, { tamanhoBytes: 11 * 1024 * 1024 }])
      await expect(solicitarLaudoQualidade("amostra", 1, { propriedadeId: 1, nome: "Laudo.pdf", mimeType: "application/pdf", sha256, ...alteracao }, 7)).rejects.toThrow();
    expect(m.criarUpload).not.toHaveBeenCalled();
  });
});
