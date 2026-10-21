import { beforeEach, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ protocolo: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() }, etapaProtocolo: { count: vi.fn(), findMany: vi.fn() } }));
vi.mock("../../../db.js", () => ({ prisma: { $transaction: vi.fn(async (callback: (tx: typeof db) => unknown) => callback(db)) } }));
import { listarCadastrosProtocolos, obterCadastroProtocolo, listarAcoesCadastroProtocolo } from "./cadastros.js";
import { consultaCadastroProtocoloSchema } from "./cadastros.schemas.js";
const revisao = new Date("2026-10-21T12:00:00Z");
const meta = { id: "p", nome: "Controle", tipo: "SANITARIO", versao: 1, ativo: false, publicado: false, publicadoEm: null, atualizadoEm: revisao, _count: { etapas: 11, execucoes: 0, rodadas: 1 } };
beforeEach(() => { vi.clearAllMocks(); db.protocolo.count.mockResolvedValue(11); db.protocolo.findMany.mockResolvedValue([meta]); db.protocolo.findUnique.mockResolvedValue(meta); db.protocolo.findFirst.mockResolvedValue({ versao: 4 }); db.etapaProtocolo.count.mockResolvedValue(11); db.etapaProtocolo.findMany.mockResolvedValue([]); });
it("valida teto10 e usa busca/filtro antes da contagem com ordenação estável", async () => {
  expect(consultaCadastroProtocoloSchema.safeParse({ tipo: "SANITARIO", porPagina: 11 }).success).toBe(false);
  const result = await listarCadastrosProtocolos(consultaCadastroProtocoloSchema.parse({ tipo: "SANITARIO", busca: " Controle ", situacao: "INATIVA", pagina: 99 }));
  expect(result).toMatchObject({ pagina: 2, total: 11, porPagina: 10, itens: [{ totalEtapas: 11, utilizada: true }] });
  expect(result.itens[0]).not.toHaveProperty("etapas");
  const consulta = db.protocolo.findMany.mock.calls[0][0];
  expect(consulta).toMatchObject({ skip: 10, take: 10, where: { tipo: "SANITARIO", ativo: false, OR: [{ nome: { contains: "Controle", mode: "insensitive" } }, { descricao: { contains: "Controle", mode: "insensitive" } }] }, orderBy: [{ nome: "asc" }, { versao: "desc" }, { id: "asc" }] });
  expect(db.protocolo.count.mock.calls[0][0].where).toEqual(consulta.where);
});
it("obtém próxima versão do conjunto inteiro sem trazer ações", async () => {
  expect(await obterCadastroProtocolo("p")).toMatchObject({ proximaVersao: 5, totalEtapas: 11 });
  expect(db.etapaProtocolo.findMany).not.toHaveBeenCalled();
});
it("pagina ações na origem e rejeita revisão divergente antes de ler a página", async () => {
  expect(await listarAcoesCadastroProtocolo("p", { pagina: 99, revisao: revisao.toISOString() })).toMatchObject({ pagina: 2, total: 11 });
  expect(db.etapaProtocolo.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10, orderBy: [{ ordem: "asc" }, { id: "asc" }] }));
  db.etapaProtocolo.findMany.mockClear();
  await expect(listarAcoesCadastroProtocolo("p", { revisao: "2026-10-20T12:00:00.000Z" })).rejects.toThrow("Esta versão mudou");
  expect(db.etapaProtocolo.findMany).not.toHaveBeenCalled();
});
