import { condicaoSituacaoTarefa } from "../protocolos/situacao.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listar: vi.fn(), contar: vi.fn(), transacao: vi.fn() }));
vi.mock("../../../db.js", () => ({ prisma: {
  tarefaProtocolo: { findMany: mocks.listar, count: mocks.contar },
  $transaction: mocks.transacao,
} }));
import { consultaSanitariaSchema } from "./consulta.js";
import { listarTarefas } from "./protocolos.js";

const pendente = condicaoSituacaoTarefa("PENDENTE");
const ordem = [{ previstaPara: "asc" }, { id: "asc" }];
const tarefa = (id: string, realizada = false) => ({
  id, previstaPara: new Date("2026-10-01"), dispensadaEm: null,
  aplicacoes: realizada ? [{ id: "aplicacao", status: "VALIDO" }] : [], exames: [],
  execucao: { canceladaEm: null, animalId: "animal", propriedadeId: 2,
    animal: { id: "animal", brinco: "DEV-01", nome: "Aurora", localizacoes: [{ propriedadeId: 2 }] } },
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.contar.mockResolvedValue(0);
  mocks.listar.mockResolvedValue([]);
  mocks.transacao.mockImplementation((fn) => fn({ tarefaProtocolo: { findMany: mocks.listar, count: mocks.contar } }));
});

describe("prioridade global de tarefas sanitárias", () => {
  it("valida a opção sem alterar a ordem dos consumidores antigos", async () => {
    expect(consultaSanitariaSchema.safeParse({ ordenacaoTarefas: "urgencia" }).success).toBe(false);
    await listarTarefas(2, undefined, consultaSanitariaSchema.parse({ pagina: 2 }));
    expect(mocks.transacao).not.toHaveBeenCalled();
    expect(mocks.listar).toHaveBeenCalledWith(expect.objectContaining({ orderBy: ordem, skip: 50, take: 50 }));
  });

  it("pagina as pendentes antes do histórico sem buscar o conjunto inteiro", async () => {
    mocks.contar.mockResolvedValue(101);
    mocks.listar.mockResolvedValue(Array.from({ length: 50 }, (_, i) => tarefa(`pendente-${i}`)));
    const itens = await listarTarefas(2, undefined, consultaSanitariaSchema.parse({ ordenacaoTarefas: "prioridade", pagina: 2 }));
    expect(itens).toHaveLength(50);
    expect(itens[0]).toMatchObject({ situacao: "PENDENTE", propriedadeAtualId: 2 });
    expect(mocks.listar).toHaveBeenCalledTimes(1);
    expect(mocks.listar).toHaveBeenCalledWith(expect.objectContaining({ where: { AND: [expect.objectContaining({ execucao: expect.any(Object) }), pendente] }, orderBy: ordem, skip: 50, take: 50 }));
    expect(mocks.transacao).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
  });

  it("completa a página na fronteira entre pendências e histórico", async () => {
    mocks.contar.mockResolvedValue(51);
    mocks.listar.mockResolvedValueOnce([tarefa("ultima-pendente")]).mockResolvedValueOnce([tarefa("realizada", true)]);
    const itens = await listarTarefas(2, undefined, consultaSanitariaSchema.parse({ ordenacaoTarefas: "prioridade", pagina: 2 }));
    expect(itens.map(i => i.id)).toEqual(["ultima-pendente", "realizada"]);
    expect(itens[1].situacao).toBe("REALIZADA");
    expect(mocks.listar.mock.calls[1][0]).toMatchObject({ where: { AND: [expect.any(Object), { NOT: pendente }] }, skip: 0, take: 49, orderBy: ordem });
  });

  it("aplica o deslocamento ao histórico após todas as pendências", async () => {
    mocks.contar.mockResolvedValue(20);
    await listarTarefas(2, undefined, consultaSanitariaSchema.parse({ ordenacaoTarefas: "prioridade", pagina: 3 }));
    expect(mocks.listar).toHaveBeenCalledTimes(1);
    expect(mocks.listar).toHaveBeenCalledWith(expect.objectContaining({ skip: 80, take: 50, where: { AND: [expect.any(Object), { NOT: pendente }] } }));
  });

  it("conserva sítio, animal, busca, lote, período e situação nos dois grupos", async () => {
    const filtro = consultaSanitariaSchema.parse({ ordenacaoTarefas: "prioridade", buscaAnimal: "Aurora", loteId: "00000000-0000-4000-8000-000000000001", situacao: "REALIZADA", de: "2026-09-01", ate: "2026-10-31" });
    await listarTarefas(2, "animal", filtro);
    const base = mocks.contar.mock.calls[0][0].where.AND[0];
    expect(base).toMatchObject({ execucao: { animalId: "animal", animal: { OR: expect.any(Array), localizacoes: { some: { propriedadeId: 2, loteId: filtro.loteId, ate: null } } } }, previstaPara: { gte: new Date("2026-09-01"), lte: new Date("2026-10-31") }, AND: expect.arrayContaining([expect.objectContaining({ OR: expect.any(Array) })]) });
    expect(mocks.listar.mock.calls[0][0].where.AND[0]).toEqual(base);
  });
});
