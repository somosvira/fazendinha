import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ estadoPopulacao: "ELEGIVEIS", count: vi.fn(), dias: vi.fn(), folha: vi.fn(), gerais: vi.fn() }));
vi.mock("../../../db.js", () => ({ prisma: { $transaction: async (f: (tx: unknown) => unknown) => f({ medicaoLeite: { count: m.count }, diaProducaoLeite: { findMany: m.dias } }) } }));
vi.mock("./producao.js", () => ({ folhaLeiteDTO: m.folha }));
vi.mock("./populacao-periodo.js", () => ({ consultarPopulacaoPeriodoLeiteTx: async (_tx: unknown, _id: number, inicio: string, fim: string) => {
  const dias = []; for(let t=Date.parse(inicio);t<=Date.parse(fim);t+=86400000) dias.push({data:new Date(t).toISOString().slice(0,10),estado:m.estadoPopulacao,elegiveis:[],pendentes:[]}); return dias;
} }));
vi.mock("./producao-geral-consulta.js", () => ({ linhasProducaoGeralTx: m.gerais }));
import { consultarProducaoLeite } from "./consultas-producao.js";
const filtro = { inicio: "2026-10-31", fim: "2026-11-01", pagina: 1, tamanho: 1 };
beforeEach(() => {
  vi.resetAllMocks(); m.estadoPopulacao="ELEGIVEIS"; m.gerais.mockResolvedValue([]); m.count.mockResolvedValue(3); m.dias.mockResolvedValue(["outubro", "novembro"]);
  m.folha.mockImplementation((dia: string) => ({ dataOperacional: dia === "outubro" ? "2026-10-31" : "2026-11-01", sessoes: [{ posicaoId: "manhã", nome: "Manhã" }], animais: [{ animalId: "a", finalidade: { estado: "COMPROVADA" }, brinco: "123", nome: null, medicoes: [{ posicaoId: "manhã", estado: "MEDIDO", litros: dia === "outubro" ? 10 : 20, confirmacaoEstoque: dia === "outubro" ? null : { natureza: "COMERCIAL" } }, { posicaoId: "tarde", estado: "PENDENTE", litros: null, confirmacaoEstoque: null }] }] }));
});
it("conserva litros por dia e mês sem confirmação e pagina só o detalhe", async () => {
  const r = await consultarProducaoLeite(2, filtro);
  expect(r.totais.litros).toBe(30); expect(r.total).toBe(4); expect(r.itens).toHaveLength(1);
  expect(r.ritmo.map(d => [d.data, d.litros, d.estado])).toEqual([["2026-10-31", 10, "PARCIAL"], ["2026-11-01", 20, "PARCIAL"]]);
  expect(r.porNatureza.map(n => [n.id, n.litros])).toEqual([["A_CLASSIFICAR", 10], ["COMERCIAL", 20]]);
  expect(r.porAnimal[0].litros).toBe(30); expect(r.porOrdenha.find(o => o.id === "manhã")?.litros).toBe(30);
  expect(m.dias).toHaveBeenCalledWith(expect.objectContaining({ where: { propriedadeId: 2, dataOperacional: { gte: new Date(filtro.inicio), lte: new Date(filtro.fim) } } }));
});
it("exporta o mesmo recorte completo, sem limitar à página", async () => {
  const r = await consultarProducaoLeite(2, filtro, true);
  expect(r.itens).toHaveLength(4); expect(r.totais.litros).toBe(30);
  const comercial = await consultarProducaoLeite(2, { ...filtro, natureza: "COMERCIAL" }, true);
  expect(comercial.total).toBe(1); expect(comercial.totais.litros).toBe(20);
  expect(comercial.ritmo[0].estado).toBe("SEM_PARTICIPANTES");
});
it("limita materialização no Worker e não trata lacuna como zero", async () => {
  m.dias.mockResolvedValue([]);
  const r = await consultarProducaoLeite(2, filtro);
  expect(r.totais.litros).toBeNull(); expect(r.ritmo.every(d => d.estado === "SEM_FOLHA")).toBe(true);
  m.count.mockResolvedValue(50_001);
  await expect(consultarProducaoLeite(2, filtro)).rejects.toMatchObject({ code: "VALIDACAO" });
});

it("aferição geral substitui o total individual do dia sem atribuir litros a animais", async () => {
 m.folha.mockImplementation(() => ({ dataOperacional: "2026-10-31", configuracao: { fonteProducao: "GERAL" }, sessoes: [{ posicaoId: "manha", nome: "Manhã" }], animais: [{ animalId: "a", finalidade: { estado: "COMPROVADA" }, brinco: "123", nome: null, medicoes: [{ posicaoId: "manha", estado: "MEDIDO", litros: 12, confirmacaoEstoque: null }] }] }));
 m.dias.mockResolvedValue(["geral"]);
 m.gerais.mockResolvedValue([{ fonte: "GERAL", tanqueId: "t", data: "2026-10-31", animalId: null, brinco: "Tanque", nome: "Tanque", finalidade: null, posicaoId: "manha", ordenha: "Manhã", natureza: "COMERCIAL", estado: "MEDIDO", litros: 1000, confirmada: false }]);
 const r = await consultarProducaoLeite(2, { ...filtro, fim: "2026-10-31" }, true);
 expect(r.totais.litros).toBe(1000); expect(r.porAnimal).toEqual([]); expect(r.itens[0].animalId).toBeNull();
});

it("dia geral sem tanques não é completo mesmo sem animais elegíveis", async () => {
  m.estadoPopulacao = "SEM_ANIMAIS_ELEGIVEIS";
  m.dias.mockResolvedValue(["geral"]);
  m.folha.mockReturnValue({ dataOperacional: "2026-10-31", configuracao: { fonteProducao: "GERAL" }, sessoes: [], animais: [] });
  const r = await consultarProducaoLeite(2, { ...filtro, fim: "2026-10-31" });
  expect(r.coberturaCompleta).toBe(false);
  expect(r.totais.litros).toBeNull();
});


it("agrupa por mês com turnos dinâmicos e total conhecido de todo o recorte", async () => {
  const r = await consultarProducaoLeite(2, { ...filtro, agrupamento: "MES" });
  expect(r.agrupamento).toBe("MES");
  expect(r.grupos.map(g => [g.periodo, g.litros])).toEqual([["2026-10", 10], ["2026-11", 20]]);
  expect(r.grupos[0].turnos[0]).toMatchObject({ posicaoId: "manhã", nome: "Manhã", litros: 10 });
  expect(r.total).toBe(4); expect(r.itens).toHaveLength(1);
});
