import { beforeEach, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ protocolo: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() }, etapaProtocolo: { count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() } }));
vi.mock("../../../db.js", () => ({ prisma: { $transaction: vi.fn(async (callback: (tx: typeof db) => unknown) => callback(db)) } }));
import { listarCadastrosProtocolos, obterCadastroProtocolo, listarAcoesCadastroProtocolo } from "./cadastros.js";
import { consultaCadastroProtocoloSchema } from "./cadastros.schemas.js";
const revisao = new Date("2026-10-21T12:00:00Z");
const meta = { id: "p", nome: "Controle", tipo: "SANITARIO", versao: 1, ativo: false, publicado: false, publicadoEm: null, atualizadoEm: revisao, _count: { etapas: 11, execucoes: 0, rodadas: 1 } };
beforeEach(() => { vi.clearAllMocks(); db.protocolo.count.mockResolvedValue(11); db.protocolo.findMany.mockResolvedValue([{...meta, momentos: [], etapas: [], _count: {...meta._count, momentos: 0}}]); db.protocolo.findUnique.mockResolvedValue(meta); db.protocolo.findFirst.mockResolvedValue({ versao: 4 }); db.etapaProtocolo.count.mockResolvedValue(11); db.etapaProtocolo.findMany.mockResolvedValue([]); db.etapaProtocolo.groupBy.mockResolvedValue([{protocoloId:"p",_count:{_all:11}}]); });
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
it("inclui todos os ativos sem transformar cadastros antigos em publicados e limita a prévia",async()=>{
  db.protocolo.findMany.mockResolvedValue([{...meta, momentos:[{id:"m",nome:"Preparo",_count:{etapas:3}}],etapas:[{id:"e",nome:"Avaliação",diaRelativo:10,unidadeIntervalo:"DIAS"}],_count:{...meta._count,momentos:1}}]);
  const p=await listarCadastrosProtocolos(consultaCadastroProtocoloSchema.parse({tipo:"REPRODUTIVO",situacao:"ATIVA"}));
  expect(db.protocolo.count).toHaveBeenCalledWith({where:{tipo:"REPRODUTIVO",ativo:true}});
  expect(p.itens[0]).toMatchObject({publicado:false,totalMomentos:1,totalAcoesSemEtapa:11,previaEstrutura:[{nome:"Preparo",agrupada:true,totalProcedimentos:3},{nome:"Avaliação",agrupada:false,intervalo:10}]});
  expect(db.protocolo.findMany.mock.calls[0][0].select.momentos.take).toBe(4);
  expect(db.protocolo.findMany.mock.calls[0][0].select.etapas.take).toBe(4);
});
it("pagina ações na origem e rejeita revisão divergente antes de ler a página", async () => {
  expect(await listarAcoesCadastroProtocolo("p", { pagina: 99, revisao: revisao.toISOString() })).toMatchObject({ pagina: 2, total: 11 });
  expect(db.etapaProtocolo.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10, orderBy: [{ ordem: "asc" }, { id: "asc" }] }));
  db.etapaProtocolo.findMany.mockClear();
  await expect(listarAcoesCadastroProtocolo("p", { revisao: "2026-10-20T12:00:00.000Z" })).rejects.toThrow("Esta versão mudou");
  expect(db.etapaProtocolo.findMany).not.toHaveBeenCalled();
});

it("devolve calendário completo e metadados de momento para derivação sem arredondar", async () => {
  db.protocolo.findUnique.mockResolvedValue({ tipo: "REPRODUTIVO", atualizadoEm: revisao });
  const orientacaoTemporal = { versao: 1, referencia: "ETAPA_ANTERIOR", intervaloHoras: 36, toleranciaAntesMinutos: 10, toleranciaDepoisMinutos: 50, efeito: "ALERTA" };
  const momento = { nome: "Preparo", ordem: 1, instrucoesGerais: "Conferir animal", modoAtendimento: "MANUAL" };
  db.etapaProtocolo.findMany.mockResolvedValue([{ id: "acao", ordem: 1, configuracao: { intervalo: 7.5, unidade: "DIAS", orientacaoTemporal }, momento }]);
  const resultado = await listarAcoesCadastroProtocolo("p", {});
  expect(resultado.itens[0]).toMatchObject({ intervalo: 7.5, unidade: "DIAS", orientacaoTemporal, momento });
});
