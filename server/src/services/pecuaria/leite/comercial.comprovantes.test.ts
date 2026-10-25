import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  tx: { comprovanteEntregaLeite: { findUnique: vi.fn(), create: vi.fn(), findFirst: vi.fn() }, $executeRaw: vi.fn() },
  obterAmostra: vi.fn(), criarUpload: vi.fn(), lerIntent: vi.fn(), promover: vi.fn(), removerPromovido: vi.fn(), removerTemporario: vi.fn(), baixar: vi.fn(), auditar: vi.fn(),
}));
vi.mock("../../../db.js", () => ({ prisma: m.tx }));
vi.mock("../../../env.js", () => ({ env: { STORAGE_NAMESPACE: "test", R2_BUCKET_NOTAS: "bucket-test" } }));
vi.mock("../../../lib/storage.js", () => ({ getStorage: async () => ({ getSignedDownloadUrl: m.baixar }) }));
vi.mock("../../../lib/uploads.js", () => ({ criarUploadDireto: m.criarUpload, lerIntentUpload: m.lerIntent, promoverUploadDireto: m.promover, removerUploadPromovido: m.removerPromovido, removerUploadTemporario: m.removerTemporario, UploadInvalidoError: class extends Error {} }));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: async (f: (tx: typeof m.tx) => unknown) => f(m.tx) }));
vi.mock("./comercial.js", () => ({ obterEntregaLeiteTx: m.obterAmostra }));
vi.mock("../rebanho/regras.js", async original => ({ ...await original<typeof import("../rebanho/regras.js")>(), auditar: m.auditar }));
import { solicitarComprovanteEntregaLeite, confirmarComprovanteEntregaLeite, baixarComprovanteEntregaLeite } from "./comercial.comprovantes.js";
const agora = new Date("2026-10-19"), sha256 = "a".repeat(64);
const intent = { contexto: "ENTREGA_LEITE", entregaId: "amostra", propriedadeId: 1, usuarioId: 7, comprovanteId: "laudo", nome: "Laudo.pdf", extensao: "pdf", mimeType: "application/pdf", tamanhoBytes: 100, sha256, temporarioKey: "tmp/test/entrega-leite/laudo.pdf" };
const laudo = { id: "laudo", entregaId: "amostra", nome: "Laudo.pdf", mimeType: "application/pdf", tamanhoBytes: 100, sha256, storageKey: "test/pecuaria/leite/entregas/1/amostra/laudo.pdf", criadoEm: agora, criadoPorId: 7 };
beforeEach(() => { vi.resetAllMocks(); m.obterAmostra.mockResolvedValue({ id: "amostra" }); m.lerIntent.mockReturnValue(intent); m.tx.comprovanteEntregaLeite.create.mockResolvedValue(laudo); });
describe("laudos R2 privados e ligados à amostra", () => {
  it("reutiliza upload direto assinado com namespace, sítio, autor e amostra", async () => {
    await solicitarComprovanteEntregaLeite("amostra", 1, { propriedadeId: 1, nome: "Laudo.pdf", mimeType: "application/pdf", tamanhoBytes: 100, sha256 }, 7);
    expect(m.criarUpload).toHaveBeenCalledWith(expect.objectContaining({ temporarioKey: expect.stringMatching(/^tmp\/test\/entrega-leite\/.+\.pdf$/), sha256, dados: expect.objectContaining({ contexto: "ENTREGA_LEITE", propriedadeId: 1, usuarioId: 7, entregaId: "amostra" }) }));
  });
  it.each([
    { contexto: "OUTRO" }, { entregaId: "outra" }, { propriedadeId: 2 }, { usuarioId: 8 },
  ])("recusa usar token de contexto/destino/autor diferente %j", async alteracao => {
    m.lerIntent.mockReturnValue({ ...intent, ...alteracao });
    await expect(confirmarComprovanteEntregaLeite("amostra", 1, "token", 7)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect(m.promover).not.toHaveBeenCalled(); expect(m.tx.comprovanteEntregaLeite.create).not.toHaveBeenCalled();
  });
  it("confere/preserva arquivo via helper compartilhado e não devolve chave privada", async () => {
    const r = await confirmarComprovanteEntregaLeite("amostra", 1, "token", 7);
    expect(m.promover).toHaveBeenCalledWith(intent, laudo.storageKey);
    expect(m.tx.comprovanteEntregaLeite.create).toHaveBeenCalledWith({ data: expect.objectContaining({ storageKey: laudo.storageKey, criadoPorId: 7 }) });
    expect(r).toEqual({ id: "laudo", nome: "Laudo.pdf", mimeType: "application/pdf", tamanhoBytes: 100, criadoEm: agora.toISOString(), criadoPorId: 7 });
    expect(m.removerTemporario).toHaveBeenCalledWith(intent.temporarioKey);
  });
  it("reenvio confirmado não promove nem cria outro documento", async () => {
    m.tx.comprovanteEntregaLeite.findUnique.mockResolvedValue(laudo);
    expect((await confirmarComprovanteEntregaLeite("amostra", 1, "token", 7)).id).toBe("laudo");
    expect(m.promover).not.toHaveBeenCalled(); expect(m.tx.comprovanteEntregaLeite.create).not.toHaveBeenCalled();
  });
  it("falha R2 não cria metadata; rollback DB remove apenas objeto novo sem vínculo", async () => {
    m.promover.mockRejectedValueOnce(new Error("R2 indisponível"));
    await expect(confirmarComprovanteEntregaLeite("amostra", 1, "token", 7)).rejects.toThrow("R2 indisponível");
    expect(m.tx.comprovanteEntregaLeite.create).not.toHaveBeenCalled();
    m.tx.comprovanteEntregaLeite.create.mockRejectedValueOnce(new Error("DB falhou"));
    await expect(confirmarComprovanteEntregaLeite("amostra", 1, "token", 7)).rejects.toThrow("DB falhou");
    expect(m.removerPromovido).toHaveBeenCalledWith(laudo.storageKey);
  });
  it("resposta DB perdida recupera vínculo confirmado sem apagar seu objeto", async () => {
    m.tx.comprovanteEntregaLeite.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(laudo);
    m.tx.comprovanteEntregaLeite.create.mockRejectedValueOnce(new Error("Resposta perdida"));
    expect((await confirmarComprovanteEntregaLeite("amostra", 1, "token", 7)).id).toBe("laudo");
    expect(m.removerPromovido).not.toHaveBeenCalled();
  });
  it("download exige sítio/amostra e URL curta sem expor storageKey", async () => {
    m.tx.comprovanteEntregaLeite.findFirst.mockResolvedValue(null);
    await expect(baixarComprovanteEntregaLeite("amostra", "laudo", 2)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect(m.baixar).not.toHaveBeenCalled();
    m.tx.comprovanteEntregaLeite.findFirst.mockResolvedValue(laudo); m.baixar.mockResolvedValue("https://signed.example/laudo");
    expect(await baixarComprovanteEntregaLeite("amostra", "laudo", 1)).toEqual({ url: "https://signed.example/laudo" });
    expect(m.baixar).toHaveBeenCalledWith({ key: laudo.storageKey, filename: "Laudo.pdf", ttlSeconds: 600 });
  });
  it("não emite upload para arquivo vazio, grande ou formato não permitido", async () => {
    for (const alteracao of [{ tamanhoBytes: 0 }, { tamanhoBytes: 11 * 1024 * 1024 }])
      await expect(solicitarComprovanteEntregaLeite("amostra", 1, { propriedadeId: 1, nome: "Laudo.pdf", mimeType: "application/pdf", sha256, ...alteracao }, 7)).rejects.toThrow();
    expect(m.criarUpload).not.toHaveBeenCalled();
  });
});
