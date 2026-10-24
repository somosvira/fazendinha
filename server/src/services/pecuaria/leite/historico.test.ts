import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const m = vi.hoisted(() => ({ tx: { configuracaoOrdenha: { findFirst: vi.fn() }, medicaoLeite: { findFirst: vi.fn() }, propriedade: { findUnique: vi.fn() }, animal: { findFirst: vi.fn() }, participanteProducaoLeite: { findMany: vi.fn() }, localizacaoAnimal: { findFirst: vi.fn() } }, carencia: vi.fn() }));
vi.mock("../../../db.js", () => ({ prisma: { ...m.tx, $transaction: async (f: (tx: typeof m.tx) => unknown) => f(m.tx) } }));
vi.mock("../sanidade/aplicacoes.js", () => ({ carenciaAnimalTx: m.carencia }));
vi.mock("../rebanho/regras.js", async original => ({ ...await original<typeof import("../rebanho/regras.js")>(), hojeFazendaDate: () => new Date("2026-10-19") }));
import { consultarHistoricoProdutivo } from "./historico.js";
const dia = (data: string) => new Date(data);
function participante(id: string, data = "2026-10-01", litros: number | null = 12) {
  return { id, animalId: "animal", lactacao: { id: "lactacao", animalId: "animal", inicio: dia("2026-10-01"), encerradaEm: null },
    dia: { propriedadeId: 1, dataOperacional: dia(data), sessoes: [{ id: "manha", posicaoId: "pos-manha", nome: "Manhã" }, { id: "noite", posicaoId: "pos-noite", nome: "Noite" }] },
    medicoes: [{ id: "medicao", sessaoId: "manha", estado: litros === null ? "PENDENTE" : "MEDIDO", litros: litros === null ? null : new Prisma.Decimal(litros), motivo: null }], excluidoEm: null, motivoExclusao: null };
}
const filtro = { inicio: "2026-10-01", fim: "2026-10-03", pagina: 1, tamanho: 20 };
beforeEach(() => { vi.resetAllMocks(); m.tx.configuracaoOrdenha.findFirst.mockResolvedValue(null); m.tx.medicaoLeite.findFirst.mockResolvedValue(null); m.tx.propriedade.findUnique.mockResolvedValue({ id: 1, ativo: true }); m.tx.animal.findFirst.mockResolvedValue({ id: "animal", brinco: "123", nome: "Aurora" }); m.tx.participanteProducaoLeite.findMany.mockResolvedValue([participante("p")]); m.tx.localizacaoAnimal.findFirst.mockResolvedValue({ propriedadeId: 1 }); m.carencia.mockResolvedValue({ leite: { estado: "NAO_INFORMADO" }, revisaoLeitePendente: true, revisaoAdministracaoPendente: true }); });
describe("histórico individual e contexto sanitário a partir dos fatos existentes", () => {
  it("calcula a próxima referência mensal a partir da última medição, mesmo fora do filtro", async () => {
    m.tx.medicaoLeite.findFirst.mockResolvedValue({ sessao: { dia: { dataOperacional: dia("2026-09-01") } } });
    const r = await consultarHistoricoProdutivo(1, "animal", filtro);
    expect(r.controleIndividual).toEqual({ quantidade: 1, unidade: "MESES", ultimaAfericao: "2026-09-01", proximaAfericao: "2026-10-01" });
    expect(m.tx.medicaoLeite.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ estado: "MEDIDO", participante: { animalId: "animal", excluidoEm: null } }) }));
  });
  it("usa sessões históricas com pendência, preserva zero e DEL D0", async () => {
    m.tx.participanteProducaoLeite.findMany.mockResolvedValue([participante("p", "2026-10-01", 0)]);
    const r = await consultarHistoricoProdutivo(1, "animal", filtro);
    expect(r.itens[0]).toMatchObject({ del: 0, convencaoDel: "D0", totais: { litros: 0, completa: false, pendentes: 1 }, medicoes: [{ nomeOrdenha: "Manhã", estado: "MEDIDO", litros: 0 }, { nomeOrdenha: "Noite", estado: "PENDENTE", litros: null }] });
    expect(r.coberturaPeriodo).toEqual({ diasCalendario: 3, diasComRegistro: 1, diasSemRegistro: 2 });
  });
  it("não infere lactação ausente nem DEL após encerramento", async () => {
    const sem = { ...participante("sem"), lactacao: null };
    const encerrada = { ...participante("encerrada", "2026-10-02"), lactacao: { id: "l", animalId: "animal", inicio: dia("2026-10-01"), encerradaEm: dia("2026-10-02") } };
    m.tx.participanteProducaoLeite.findMany.mockResolvedValue([sem, encerrada]);
    const r = await consultarHistoricoProdutivo(1, "animal", filtro);
    expect(r.itens.map(d => d.del)).toEqual([null, null]);
    expect(r.itens[0].lactacao).toBeNull();
  });
  it("soma todo período antes de paginar e mantém exclusões visíveis fora dos totais", async () => {
    const excluido = { ...participante("excluido", "2026-10-03", 900), excluidoEm: dia("2026-10-19"), motivoExclusao: "Registro indevido" };
    m.tx.participanteProducaoLeite.findMany.mockResolvedValue([participante("um", "2026-10-01", 12), participante("dois", "2026-10-02", 10), excluido]);
    const r = await consultarHistoricoProdutivo(1, "animal", { ...filtro, pagina: 3, tamanho: 1 });
    expect(r).toMatchObject({ total: 3, totaisPeriodo: { litros: 22 }, coberturaPeriodo: { diasComRegistro: 2, diasSemRegistro: 1 }, itens: [{ participanteId: "excluido", motivoExclusao: "Registro indevido" }] });
  });
  it("ausência de registros permanece null, com todos os dias explicitamente sem registro", async () => {
    m.tx.participanteProducaoLeite.findMany.mockResolvedValue([]);
    expect(await consultarHistoricoProdutivo(1, "animal", filtro)).toMatchObject({ itens: [], total: 0, totaisPeriodo: { litros: null }, coberturaPeriodo: { diasSemRegistro: 3 } });
  });
  it("consulta carência na data escolhida pelo sítio atual sem converter desconhecido/revisão", async () => {
    const r = await consultarHistoricoProdutivo(1, "animal", filtro);
    expect(m.carencia).toHaveBeenCalledWith(m.tx, "animal", "2026-10-03");
    expect(r.carenciaLeite).toEqual({ disponibilidade: "DISPONIVEL", dataReferencia: "2026-10-03", leite: { estado: "NAO_INFORMADO" }, revisaoLeitePendente: true, revisaoAdministracaoPendente: true });
  });
  it("histórico antigo não revela carência integral quando o animal está em outro sítio", async () => {
    m.tx.localizacaoAnimal.findFirst.mockResolvedValue({ propriedadeId: 2 });
    expect((await consultarHistoricoProdutivo(1, "animal", filtro)).carenciaLeite).toEqual({ disponibilidade: "FORA_DO_ESCOPO_ATUAL", dataReferencia: "2026-10-03" });
    expect(m.carencia).not.toHaveBeenCalled();
  });
  it("nega animal sem localização comprovada no sítio antes de ler seus fatos", async () => {
    m.tx.animal.findFirst.mockResolvedValue(null);
    await expect(consultarHistoricoProdutivo(1, "animal", filtro)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect(m.tx.participanteProducaoLeite.findMany).not.toHaveBeenCalled();
    expect(m.carencia).not.toHaveBeenCalled();
  });
  it("limita recorte a 366 dias e datas até hoje", async () => {
    await expect(consultarHistoricoProdutivo(1, "animal", { ...filtro, inicio: "2025-01-01" })).rejects.toThrow();
    await expect(consultarHistoricoProdutivo(1, "animal", { ...filtro, fim: "2026-10-20" })).rejects.toMatchObject({ campo: "fim" });
    expect(m.tx.participanteProducaoLeite.findMany).not.toHaveBeenCalled();
  });
});
