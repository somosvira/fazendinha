import { createHash } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("../../../db.js", () => ({
  prisma: { $transaction: mocks.transaction, $queryRaw: mocks.query },
}));
import { gravarMeta, listarMetas, apresentarMeta } from "./servico.js";
import type { ContextoAssistente } from "../tipos.js";
const id = "10000000-0000-4000-8000-000000000001",
  operacaoId = "20000000-0000-4000-8000-000000000001";
const definicao = {
  titulo: "Produção",
  indicadorId: "leite_volume",
  indicadorVersao: 1 as const,
  tipo: "minimo" as const,
  minimo: 3600,
  maximo: null,
  periodo: "diario" as const,
  prazo: null,
  fonte: "manual" as const,
  observacao: "",
};
const ctx: ContextoAssistente = {
  usuario: {
    id: 1,
    nome: "A",
    email: "a@example.com",
    papel: "personalizado",
    dono: false,
    areas: ["pecuaria"],
    abas: [],
    flags: ["lancar"],
    status: "ATIVO",
  },
  propriedadeId: 1,
  nomeEscopo: "Fazenda",
  agora: new Date("2026-11-03T12:00:00Z"),
};
const evento = () => ({
  metaId: id,
  revisao: 1,
  operacaoId,
  hashPedido: "",
  propriedadeId: 1,
  usuarioId: 1,
  dominio: "pecuaria",
  tipo: "definicao" as const,
  conteudo: definicao,
  criadoEm: ctx.agora,
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (fn) =>
    fn({ $queryRaw: mocks.query, $executeRaw: mocks.execute }),
  );
  mocks.query.mockResolvedValue([]);
  mocks.execute.mockResolvedValue(1);
});
describe("metas — autorização, concorrência e histórico", () => {
  it("leitor não grava nem consulta o banco para escrever", async () => {
    await expect(
      gravarMeta(id, {}, "definicao", {
        ...ctx,
        usuario: { ...ctx.usuario, flags: [] },
      }),
    ).rejects.toThrow("permissão");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("sem domínios retorna vazio sem contagem ou acesso ao banco", async () => {
    expect(
      await listarMetas({ ...ctx, usuario: { ...ctx.usuario, areas: [] } }),
    ).toEqual({ metas: [], podeEditar: false, limite: 100 });
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("fazenda consolidada não é destino de escrita", async () => {
    await expect(
      gravarMeta(id, {}, "definicao", { ...ctx, propriedadeId: null }),
    ).rejects.toThrow("Selecione");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("área negada não lê nem grava banco mesmo com lançar", async () => {
    await expect(
      gravarMeta(id, { operacaoId, versaoBase: 0, definicao }, "definicao", {
        ...ctx,
        usuario: { ...ctx.usuario, areas: [] },
      }),
    ).rejects.toThrow("indisponível");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("insert atribui autoria e sítio da sessão, sem aceitar entrada do cliente", async () => {
    const resultado = await gravarMeta(
      id,
      { operacaoId, versaoBase: 0, definicao },
      "definicao",
      ctx,
    );
    expect(resultado.propriedadeId).toBe(1);
    expect(resultado.historico[0]!.usuarioId).toBe(1);
    expect(mocks.execute).toHaveBeenCalledOnce();
    const argumentos = mocks.execute.mock.calls[0]!;
    expect(argumentos).toContain(1);
    expect(resultado.definicao).toEqual(definicao);
  });
  it("CAS recusa revisão desatualizada sem inserir evento", async () => {
    mocks.query.mockResolvedValueOnce([]).mockResolvedValueOnce([evento()]);
    await expect(
      gravarMeta(
        id,
        {
          operacaoId: "20000000-0000-4000-8000-000000000002",
          versaoBase: 0,
          definicao,
        },
        "definicao",
        ctx,
      ),
    ).rejects.toThrow("outra aba");
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("outra fazenda é recusada antes de retornar conteúdo", async () => {
    mocks.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...evento(), propriedadeId: 2 }]);
    await expect(
      gravarMeta(
        id,
        { operacaoId, versaoBase: 1, definicao },
        "definicao",
        ctx,
      ),
    ).rejects.toThrow("indisponível");
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("reenvio idêntico devolve revisão original sem duplicar", async () => {
    const input = { operacaoId, versaoBase: 0, definicao };
    const e = evento();
    e.hashPedido = createHash("sha256")
      .update(JSON.stringify([id, "definicao", input, 1, 1]))
      .digest("hex");
    mocks.query.mockResolvedValueOnce([]).mockResolvedValueOnce([e]);
    expect((await gravarMeta(id, input, "definicao", ctx)).revisao).toBe(1);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("reuso da operação em outra meta retorna conflito amigável", async () => {
    mocks.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ metaId: "outra" }]);
    await expect(
      gravarMeta(
        id,
        { operacaoId, versaoBase: 0, definicao },
        "definicao",
        ctx,
      ),
    ).rejects.toMatchObject({ code: "CONFLITO" });
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("data operacional futura é recusada após 21h no Brasil", async () => {
    mocks.query.mockResolvedValueOnce([]).mockResolvedValueOnce([evento()]);
    await expect(
      gravarMeta(
        id,
        {
          operacaoId: "20000000-0000-4000-8000-000000000002",
          versaoBase: 1,
          data: "2026-11-04",
          valor: 3600,
          concluido: null,
          observacao: "Leitura diária",
        },
        "medicao",
        { ...ctx, agora: new Date("2026-11-04T01:00:00Z") },
      ),
    ).rejects.toThrow("futura");
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("preserva etapas concluídas na medição com autoria e gate de escrita", async () => {
    const etapa = {
      id: "30000000-0000-4000-8000-000000000001",
      titulo: "Instalação",
    };
    const e = {
      ...evento(),
      conteudo: {
        ...definicao,
        tipo: "marco" as const,
        indicadorId: "marco_operacional",
        minimo: null,
        prazo: "2027-01-01",
        etapas: [etapa],
      },
    };
    const input = {
      operacaoId: "20000000-0000-4000-8000-000000000002",
      versaoBase: 1,
      data: "2026-11-03",
      valor: null,
      concluido: true,
      observacao: "Instalação conferida",
      etapasConcluidas: [etapa.id],
    };
    await expect(
      gravarMeta(id, input, "medicao", {
        ...ctx,
        usuario: { ...ctx.usuario, flags: [] },
      }),
    ).rejects.toThrow("permissão");
    expect(mocks.transaction).not.toHaveBeenCalled();
    mocks.query.mockResolvedValueOnce([]).mockResolvedValueOnce([e]);
    const meta = await gravarMeta(id, input, "medicao", ctx);
    expect(meta.medicoes[0]!.etapasConcluidas).toEqual([etapa.id]);
    expect(meta.historico.at(-1)!.usuarioId).toBe(ctx.usuario.id);
    expect(meta.historico.at(-1)!.conteudo).toMatchObject({
      etapasConcluidas: [etapa.id],
    });
  });
  it("nova definição não reaproveita evolução anterior", () => {
    const inicial = evento();
    const medicao = {
      ...inicial,
      tipo: "medicao" as const,
      revisao: 2,
      conteudo: {
        data: "2026-11-02",
        valor: 3600,
        concluido: null,
        observacao: "Leitura",
      },
    };
    const nova = {
      ...inicial,
      revisao: 3,
      conteudo: { ...definicao, minimo: 5000 },
    };
    const meta = apresentarMeta([inicial, medicao, nova]);
    expect(meta.medicoes).toEqual([]);
    expect(meta.situacao).toBe("sem_medicao");
    expect(meta.historico).toHaveLength(3);
  });
});
