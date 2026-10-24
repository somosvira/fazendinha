import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ tarefa: vi.fn(), contar: vi.fn(), listar: vi.fn() }));
vi.mock("../../../db.js", () => ({ prisma: { $transaction: (fn: (tx: object) => Promise<unknown>) => fn({ tarefaProtocolo: { findFirst: m.tarefa }, aplicacaoProduto: { count: m.contar, findMany: m.listar } }) } }));
import { listarInsercoesTarefa } from "./execucao.manejos.js";

beforeEach(() => {
  vi.clearAllMocks();
  m.tarefa.mockResolvedValue({ execucao: { animalId: "animal-autorizado" } });
  m.contar.mockResolvedValue(1);
  m.listar.mockResolvedValue([{ id: "insercao", data: new Date("2026-10-01") }]);
});
describe("consulta e proposta de origem da retirada", () => {
  it("propõe somente a origem única filtrada para o mesmo animal e a data", async () => {
    const r = await listarInsercoesTarefa("tarefa", 7, { realizadaEm: "2026-10-19" });
    expect(r).toMatchObject({ total: 1, pagina: 1, porPagina: 10, sugestaoInsercaoId: "insercao", situacaoOrigem: "UNIVOCA" });
    expect(m.tarefa).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "tarefa", etapa: { tipo: "RETIRADA" }, execucao: { propriedadeId: 7 } } }));
    const filtro = m.contar.mock.calls[0][0].where;
    expect(filtro).toMatchObject({ animalId: "animal-autorizado", status: "VALIDO" });
    expect(m.listar).toHaveBeenCalledWith(expect.objectContaining({ where: filtro, skip: 0, take: 10 }));
  });
  it("zero origens e múltiplas origens não escolhem a primeira nem a mais recente", async () => {
    for (const [total, estado] of [[0, "SEM_ORIGEM"], [2, "AMBIGUA"], [11, "AMBIGUA"]] as const) {
      m.contar.mockResolvedValue(total);
      const r = await listarInsercoesTarefa("tarefa", 7, { realizadaEm: "2026-10-19", pagina: total === 11 ? 2 : 1 });
      expect(r.sugestaoInsercaoId).toBeNull();
      expect(r.situacaoOrigem).toBe(estado);
    }
    expect(m.listar).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
  });
  it("consulta compatível sem data não propõe origem", async () => {
    expect(await listarInsercoesTarefa("tarefa", 7, {})).toMatchObject({ sugestaoInsercaoId: null, situacaoOrigem: "DATA_NECESSARIA" });
  });
  it("escopo inexistente bloqueia antes de consultar inserções", async () => {
    m.tarefa.mockResolvedValue(null);
    await expect(listarInsercoesTarefa("tarefa", 8, { realizadaEm: "2026-10-19" })).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect(m.contar).not.toHaveBeenCalled(); expect(m.listar).not.toHaveBeenCalled();
  });
});
