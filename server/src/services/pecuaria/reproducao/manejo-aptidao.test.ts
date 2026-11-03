import { beforeEach, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
vi.mock("../../../db.js", () => ({ prisma: {} }));
vi.mock("./elegibilidade.js", () => ({ obterElegibilidadesNaDataTx: vi.fn() }));
vi.mock("./filas-aptidao.js", () => ({ carregarFilasAptidaoTx: vi.fn() }));
import { obterElegibilidadesNaDataTx } from "./elegibilidade.js";
import { carregarFilasAptidaoTx } from "./filas-aptidao.js";
import { consultarManejoAptidaoTx } from "./manejo-aptidao.js";
const buscar = vi.fn(), buscarDemandas = vi.fn();
const tx = { animal: { findMany: buscar }, demandaAcompanhamentoReprodutivo: { findMany: buscarDemandas } } as unknown as Prisma.TransactionClient;
beforeEach(() => { vi.clearAllMocks(); buscarDemandas.mockResolvedValue([]); });
it("conserva escopo temporal e não calcula nem grava para conjunto vazio", async () => {
  buscar.mockResolvedValue([]);
  expect(await consultarManejoAptidaoTx(tx, 3, "2026-10-29")).toEqual({ propriedadeId: 3, dataReferencia: "2026-10-29", itens: [] });
  expect(buscar).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ sexo: "F", baixas: { none: { estornadaEm: null, data: { lte: new Date("2026-10-29") } } }, localizacoes: { some: expect.objectContaining({ propriedadeId: 3 }) } }) }));
  expect(obterElegibilidadesNaDataTx).not.toHaveBeenCalled();
  expect(buscarDemandas).not.toHaveBeenCalled();
});
it("compartilha o cálculo e a identidade de necessidade com ficha e agenda", async () => {
  buscar.mockResolvedValue([{ id: "a" }]);
  const mapa = new Map<string, Awaited<ReturnType<typeof obterElegibilidadesNaDataTx>> extends Map<string, infer E> ? E : never>();
  vi.mocked(obterElegibilidadesNaDataTx).mockResolvedValue(mapa);
  vi.mocked(carregarFilasAptidaoTx).mockResolvedValue([]);
  await consultarManejoAptidaoTx(tx, 3, "2026-10-29");
  expect(carregarFilasAptidaoTx).toHaveBeenCalledWith(tx, ["a"], 3, new Date("2026-10-29"), mapa);
});

function demanda(id: string, patch: Record<string, unknown> = {}) {
  return { id, animalId: "a", finalidade: "RECONFIRMACAO", ocorrencia: 2, tentativaId: null, gestacaoId: "gestacao", estado: "PENDENTE", dataReferencia: new Date("2026-09-01"), previstaPara: new Date("2026-10-10"), exameOrigemId: null, exameOrigem: null, ...patch };
}
async function consultarComDemandas(demandas: ReturnType<typeof demanda>[]) {
  buscar.mockResolvedValue([{ id: "a" }]); buscarDemandas.mockResolvedValue(demandas);
  vi.mocked(obterElegibilidadesNaDataTx).mockResolvedValue(new Map([["a", {
    animalId: "a", propriedadeId: 3, dataReferencia: "2026-10-29", estado: "NAO_ELEGIVEL", baseElegivel: false, elegivel: false,
    aptaDesde: null, ciclo: null, vinculoCicloId: null, politicaId: null, politicaVersao: null, metodologia: "IDEAGRI_IILB_BASE_V1", decisaoId: null, motivos: ["GESTACAO_CONFIRMADA"], alertas: [], restricaoIds: [],
  }]]));
  vi.mocked(carregarFilasAptidaoTx).mockResolvedValue([]);
  return consultarManejoAptidaoTx(tx, 3, "2026-10-29");
}
it("gestante conserva a reconfirmação pendente/vencida sem depender de elegibilidade ou inventar vínculo", async () => {
  const r = await consultarComDemandas([demanda("reconfirmacao")]);
  expect(r.itens[0]).toMatchObject({ elegivel: false, demandasAcompanhamento: [{ id: "reconfirmacao", finalidade: "RECONFIRMACAO", ocorrencia: 2, gestacaoId: "gestacao", tentativaId: null, dataReferencia: "2026-09-01", previstaPara: "2026-10-10", pendencias: [] }] });
  expect(buscarDemandas).toHaveBeenCalledWith(expect.objectContaining({ where: { animalId: { in: ["a"] }, dataReferencia: { lte: new Date("2026-10-29") } } }));
});
it("concluídas e encerradas/anuladas não entram; todas as ocorrências pendentes são preservadas", async () => {
  const r = await consultarComDemandas([demanda("concluida", { estado: "RESOLVIDA" }), demanda("encerrada", { estado: "ENCERRADA", motivoEncerramento: "ORIGEM_ANULADA" }), demanda("r1", { ocorrencia: 1 }), demanda("r2", { ocorrencia: 2, previstaPara: null })]);
  expect(r.itens[0]).toMatchObject({ demandasAcompanhamento: [{ id: "r1", ocorrencia: 1 }, { id: "r2", ocorrencia: 2, previstaPara: null }] });
  expect(r.itens[0].demandasAcompanhamento).toHaveLength(2);
});
it("origem inválida aparece como pendência na mesma projeção de leitura, sem reancorar a demanda", async () => {
  const r = await consultarComDemandas([demanda("revisar", { estado: "RESOLVIDA", exameOrigemId: "positivo-anulado", exameOrigem: null })]);
  expect(r.itens[0]).toMatchObject({ demandasAcompanhamento: [{ id: "revisar", previstaPara: "2026-10-10", pendencias: ["EXAME_ORIGEM_INVALIDO"] }] });
});

it("não expõe demandas de outro animal nem snapshots internos no DTO do manejo", async () => {
  const r = await consultarComDemandas([demanda("propria", { regraSnapshot: { custo: 123 }, propriedadeOrigemId: 99 }), demanda("fora", { animalId: "fora-do-escopo" })]);
  expect(r.itens[0].demandasAcompanhamento).toHaveLength(1);
  expect(r.itens[0].demandasAcompanhamento[0]).toMatchObject({ id: "propria", gestacaoId: "gestacao" });
  expect(r.itens[0].demandasAcompanhamento[0]).not.toHaveProperty("regraSnapshot");
  expect(r.itens[0].demandasAcompanhamento[0]).not.toHaveProperty("propriedadeOrigemId");
});
