import { describe, it, expect, vi, beforeEach } from "vitest";
const m = vi.hoisted(() => ({
  query: vi.fn(),
  txQuery: vi.fn(),
  txExecute: vi.fn(),
  apurar: vi.fn(),
  dias: vi.fn(),
}));
vi.mock("../../../db.js", () => ({
  prisma: {
    $queryRaw: m.query,
    $transaction: (f: (tx: object) => unknown) => f({ $queryRaw: m.txQuery, $executeRaw: m.txExecute }),
    diaProducaoLeite: { findMany: m.dias },
  },
}));
vi.mock("./leite.js", async (original) => ({
  ...(await original<typeof import("./leite.js")>()),
  apurarVolumeGeral: m.apurar,
}));
import { AssistenteError, type ContextoAssistente } from "../tipos.js";
import { apurarMetasAutomaticas, listarMetas } from "./servico.js";

const metaId = "10000000-0000-4000-8000-000000000001";
const agora = new Date("2026-11-03T15:00:00Z");
const definicao = {
  titulo: "Produção", indicadorId: "leite_volume", indicadorVersao: 1, tipo: "minimo", minimo: 900, maximo: null,
  periodo: "diario", prazo: null, fonte: "automatica", observacao: "",
};
const evento = (revisao: number, tipo: "definicao" | "medicao", conteudo: object) => ({
  metaId, revisao, operacaoId: `op-${revisao}`, hashPedido: "h", propriedadeId: 1, usuarioId: 7, dominio: "leite", tipo, conteudo, criadoEm: agora,
});
const eventos = [evento(1, "definicao", definicao), evento(2, "medicao", { data: "2026-11-02", valor: 950, concluido: null })];

beforeEach(() => { vi.clearAllMocks(); });

describe("apuração automática de metas", () => {
  it("registra os dias que fecham, em revisões seguidas e com a autoria da definição", async () => {
    m.query.mockResolvedValue([eventos[0]]);
    m.txQuery.mockResolvedValueOnce([]).mockResolvedValueOnce(eventos);
    m.apurar.mockImplementation(async (_tx: unknown, _sitio: number, data: string) => {
      if (data === "2026-11-01" || data === "2026-10-31") return { valor: 1000, observacao: "ok", proveniencia: {} };
      throw new AssistenteError("VALIDACAO", "Há parcelas sem confirmação no estoque. Apuração automática indisponível.");
    });
    expect(await apurarMetasAutomaticas(1, agora)).toEqual({ registradas: 2 });
    // 30 dias de 04/10 a 02/11; o dia 02/11 já tem medição.
    expect(m.apurar).toHaveBeenCalledTimes(29);
    expect(m.apurar).not.toHaveBeenCalledWith(expect.anything(), 1, "2026-11-02");
    const inseridos = m.txExecute.mock.calls.map((c) => c.slice(1));
    expect(inseridos.map((v) => [v[1], v[5], v[6]])).toEqual([[3, 7, "leite"], [4, 7, "leite"]]);
    expect(JSON.parse(inseridos[0][7] as string)).toMatchObject({ data: "2026-10-31", valor: 1000, concluido: null });
  });
  it("ignora metas manuais e propaga falhas que não são de cobertura", async () => {
    m.query.mockResolvedValue([evento(1, "definicao", { ...definicao, fonte: "manual" })]);
    expect(await apurarMetasAutomaticas(null, agora)).toEqual({ registradas: 0 });
    expect(m.apurar).not.toHaveBeenCalled();
    m.query.mockResolvedValue([eventos[0]]);
    m.txQuery.mockResolvedValueOnce([]).mockResolvedValueOnce(eventos);
    m.apurar.mockRejectedValue(new Error("conexão perdida"));
    await expect(apurarMetasAutomaticas(1, agora)).rejects.toThrow("conexão perdida");
  });
  it("lista os dias pendentes com o motivo de cada um", async () => {
    m.query.mockResolvedValue(eventos);
    m.dias.mockResolvedValue([{
      dataOperacional: new Date("2026-10-31T00:00:00Z"),
      configuracao: { fonteProducao: "GERAL", ordenhas: [{ posicaoId: "p" }] },
      sessoes: [{ posicaoId: "p", medicoesGerais: [{ id: "x", litros: 10, natureza: "COMERCIAL", entradasEstoque: [{ status: "PENDENTE" }] }] }],
    }]);
    const ctx = { usuario: { id: 1, nome: "A", email: "a@example.com", papel: "personalizado", dono: false, areas: ["pecuaria"], abas: [], flags: ["lancar"], status: "ATIVO" }, propriedadeId: 1, nomeEscopo: "Fazenda", agora } as ContextoAssistente;
    const [meta] = (await listarMetas(ctx)).metas;
    expect(meta.pendencias).toHaveLength(29);
    expect(meta.pendencias.find((p) => p.data === "2026-10-31")?.motivo).toContain("parcelas sem confirmação");
    expect(meta.pendencias.find((p) => p.data === "2026-10-30")?.motivo).toBe("Sem dia de produção cadastrado.");
    expect(meta.pendencias.some((p) => p.data === "2026-11-02")).toBe(false);
  });
});
