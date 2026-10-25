import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  tx: {
    retiradaOperacaoLeite: { findFirst: vi.fn() },
    comprovanteRetiradaOperacaoLeite: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    $executeRaw: vi.fn(),
  },
  obterAmostra: vi.fn(),
  criarUpload: vi.fn(),
  lerIntent: vi.fn(),
  promover: vi.fn(),
  removerPromovido: vi.fn(),
  removerTemporario: vi.fn(),
  baixar: vi.fn(),
  auditar: vi.fn(),
}));
vi.mock("../../../db.js", () => ({ prisma: m.tx }));
vi.mock("../../../env.js", () => ({
  env: { STORAGE_NAMESPACE: "test", R2_BUCKET_NOTAS: "bucket-test" },
}));
vi.mock("../../../lib/storage.js", () => ({
  getStorage: async () => ({ getSignedDownloadUrl: m.baixar }),
}));
vi.mock("../../../lib/uploads.js", () => ({
  criarUploadDireto: m.criarUpload,
  lerIntentUpload: m.lerIntent,
  promoverUploadDireto: m.promover,
  removerUploadPromovido: m.removerPromovido,
  removerUploadTemporario: m.removerTemporario,
  UploadInvalidoError: class extends Error {},
}));
vi.mock("../transacao.js", () => ({
  transacaoPecuaria: async (f: (tx: typeof m.tx) => unknown) => f(m.tx),
}));
vi.mock("../rebanho/regras.js", async (original) => ({
  ...(await original<typeof import("../rebanho/regras.js")>()),
  auditar: m.auditar,
}));
import {
  solicitarComprovanteRetiradaOperacaoLeite,
  confirmarComprovanteRetiradaOperacaoLeite,
  baixarComprovanteRetiradaOperacaoLeite,
} from "./comercial.operacoes.comprovantes.js";
const agora = new Date("2026-10-19"),
  sha256 = "a".repeat(64);
const intent = {
  contexto: "RETIRADA_OPERACAO_LEITE",
  retiradaId: "amostra",
  propriedadeId: 1,
  usuarioId: 7,
  comprovanteId: "laudo",
  nome: "Laudo.pdf",
  extensao: "pdf",
  mimeType: "application/pdf",
  tamanhoBytes: 100,
  sha256,
  temporarioKey: "tmp/test/retirada-operacao-leite/laudo.pdf",
};
const laudo = {
  id: "laudo",
  retiradaId: "amostra",
  nome: "Laudo.pdf",
  mimeType: "application/pdf",
  tamanhoBytes: 100,
  sha256,
  storageKey: "test/pecuaria/leite/retiradas-operacao/1/amostra/laudo.pdf",
  criadoEm: agora,
  criadoPorId: 7,
};
beforeEach(() => {
  vi.resetAllMocks();
  m.tx.retiradaOperacaoLeite.findFirst.mockResolvedValue({ id: "amostra" });
  m.lerIntent.mockReturnValue(intent);
  m.tx.comprovanteRetiradaOperacaoLeite.create.mockResolvedValue(laudo);
});
describe("laudos R2 privados e ligados à amostra", () => {
  it("reutiliza upload direto assinado com namespace, sítio, autor e amostra", async () => {
    await solicitarComprovanteRetiradaOperacaoLeite(
      "amostra",
      1,
      {
        propriedadeId: 1,
        nome: "Laudo.pdf",
        mimeType: "application/pdf",
        tamanhoBytes: 100,
        sha256,
      },
      7,
    );
    expect(m.criarUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        temporarioKey: expect.stringMatching(
          /^tmp\/test\/retirada-operacao-leite\/.+\.pdf$/,
        ),
        sha256,
        dados: expect.objectContaining({
          contexto: "RETIRADA_OPERACAO_LEITE",
          propriedadeId: 1,
          usuarioId: 7,
          retiradaId: "amostra",
        }),
      }),
    );
  });
  it.each([
    { contexto: "OUTRO" },
    { retiradaId: "outra" },
    { propriedadeId: 2 },
    { usuarioId: 8 },
  ])(
    "recusa usar token de contexto/destino/autor diferente %j",
    async (alteracao) => {
      m.lerIntent.mockReturnValue({ ...intent, ...alteracao });
      await expect(
        confirmarComprovanteRetiradaOperacaoLeite("amostra", 1, "token", 7),
      ).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
      expect(m.promover).not.toHaveBeenCalled();
      expect(
        m.tx.comprovanteRetiradaOperacaoLeite.create,
      ).not.toHaveBeenCalled();
    },
  );
  it("confere/preserva arquivo via helper compartilhado e não devolve chave privada", async () => {
    const r = await confirmarComprovanteRetiradaOperacaoLeite(
      "amostra",
      1,
      "token",
      7,
    );
    expect(m.promover).toHaveBeenCalledWith(intent, laudo.storageKey);
    expect(m.tx.comprovanteRetiradaOperacaoLeite.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        storageKey: laudo.storageKey,
        criadoPorId: 7,
      }),
    });
    expect(r).toEqual({
      id: "laudo",
      nome: "Laudo.pdf",
      mimeType: "application/pdf",
      tamanhoBytes: 100,
      criadoEm: agora.toISOString(),
      criadoPorId: 7,
    });
    expect(m.removerTemporario).toHaveBeenCalledWith(intent.temporarioKey);
  });
  it("reenvio confirmado não promove nem cria outro documento", async () => {
    m.tx.comprovanteRetiradaOperacaoLeite.findUnique.mockResolvedValue(laudo);
    expect(
      (
        await confirmarComprovanteRetiradaOperacaoLeite(
          "amostra",
          1,
          "token",
          7,
        )
      ).id,
    ).toBe("laudo");
    expect(m.promover).not.toHaveBeenCalled();
    expect(m.tx.comprovanteRetiradaOperacaoLeite.create).not.toHaveBeenCalled();
  });
  it("falha R2 não cria metadata; rollback DB remove apenas objeto novo sem vínculo", async () => {
    m.promover.mockRejectedValueOnce(new Error("R2 indisponível"));
    await expect(
      confirmarComprovanteRetiradaOperacaoLeite("amostra", 1, "token", 7),
    ).rejects.toThrow("R2 indisponível");
    expect(m.tx.comprovanteRetiradaOperacaoLeite.create).not.toHaveBeenCalled();
    m.tx.comprovanteRetiradaOperacaoLeite.create.mockRejectedValueOnce(
      new Error("DB falhou"),
    );
    await expect(
      confirmarComprovanteRetiradaOperacaoLeite("amostra", 1, "token", 7),
    ).rejects.toThrow("DB falhou");
    expect(m.removerPromovido).toHaveBeenCalledWith(laudo.storageKey);
  });
  it("resposta DB perdida recupera vínculo confirmado sem apagar seu objeto", async () => {
    m.tx.comprovanteRetiradaOperacaoLeite.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(laudo);
    m.tx.comprovanteRetiradaOperacaoLeite.create.mockRejectedValueOnce(
      new Error("Resposta perdida"),
    );
    expect(
      (
        await confirmarComprovanteRetiradaOperacaoLeite(
          "amostra",
          1,
          "token",
          7,
        )
      ).id,
    ).toBe("laudo");
    expect(m.removerPromovido).not.toHaveBeenCalled();
  });
  it("download exige sítio/amostra e URL curta sem expor storageKey", async () => {
    m.tx.comprovanteRetiradaOperacaoLeite.findFirst.mockResolvedValue(null);
    await expect(
      baixarComprovanteRetiradaOperacaoLeite("amostra", "laudo", 2),
    ).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect(m.baixar).not.toHaveBeenCalled();
    m.tx.comprovanteRetiradaOperacaoLeite.findFirst.mockResolvedValue(laudo);
    m.baixar.mockResolvedValue("https://signed.example/laudo");
    expect(
      await baixarComprovanteRetiradaOperacaoLeite("amostra", "laudo", 1),
    ).toEqual({ url: "https://signed.example/laudo" });
    expect(m.baixar).toHaveBeenCalledWith({
      key: laudo.storageKey,
      filename: "Laudo.pdf",
      ttlSeconds: 600,
    });
  });
  it("não emite upload para arquivo vazio, grande ou formato não permitido", async () => {
    for (const alteracao of [
      { tamanhoBytes: 0 },
      { tamanhoBytes: 11 * 1024 * 1024 },
    ])
      await expect(
        solicitarComprovanteRetiradaOperacaoLeite(
          "amostra",
          1,
          {
            propriedadeId: 1,
            nome: "Laudo.pdf",
            mimeType: "application/pdf",
            sha256,
            ...alteracao,
          },
          7,
        ),
      ).rejects.toThrow();
    expect(m.criarUpload).not.toHaveBeenCalled();
  });
});
