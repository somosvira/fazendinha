import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { uid } from "../../../lib/uid.fixture.js";
const mocks = vi.hoisted(() => ({ contexto: vi.fn() }));
vi.mock("./visitas.js", () => ({ carregarContextosVisitaTx: vi.fn(async () => ({})), contextoAnimalVisitaTx: mocks.contexto, adicionarAtividadeTx: vi.fn() }));
import { consultarPlannerTx, previaGrupoPlannerTx } from "./planner.js";
import { consultaPlannerSchema, previaGrupoPlannerSchema } from "./planner.schemas.js";
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const consulta = consultaPlannerSchema.parse({ propriedadeId: 7, data: "2026-01-15" });
function fonte() {
  const animalId = uid(1), tarefaId = uid(2), tentativaId = uid(3);
  const demanda = { id: uid(4), animalId, propriedadeOrigemId: 7, tarefaId, tentativaId, gestacaoId: null, finalidade: "DIAGNOSTICO", ocorrencia: 1, politicaId: uid(5), dataReferencia: dia("2026-01-01"), previstaPara: dia("2026-01-10"), estado: "PENDENTE", versao: 1, regraSnapshot: { politicaVersao: 1, tipoExameId: uid(6), tipoExameVersao: 1 } };
  const tarefa = { id: tarefaId, previstaPara: dia("2026-01-10"), previsaoPendente: false, precisaoTemporal: "DIA", etapaId: uid(7), parametros: { planoAvaliacao: { tipo: "DIAGNOSTICO", tipoExameId: uid(6) } }, etapa: { id: uid(7), tipo: "EXAME", nome: "Diagnóstico", ordem: 1 },
    execucao: { id: uid(8), animalId, rodadaId: null, inicio: dia("2026-01-01"), inicioEfetivo: null, precisaoInicioEfetivo: null, protocolo: { id: uid(9), nome: "Protocolo", tipo: "REPRODUTIVO", versao: 1 }, rodada: null } };
  const leitor = { localizacaoAnimal: { findMany: vi.fn().mockResolvedValue([{ animalId }]) }, tarefaProtocolo: { findMany: vi.fn().mockResolvedValue([tarefa]) },
    participanteVisita: { findMany: vi.fn().mockResolvedValue([]) }, atividadeVisita: { findMany: vi.fn().mockResolvedValue([]) }, visitaVeterinaria: { findMany: vi.fn().mockResolvedValue([]) },
    avaliacaoReprodutiva: { findMany: vi.fn().mockResolvedValue([]) }, demandaAcompanhamentoReprodutivo: { findMany: vi.fn().mockResolvedValue([demanda]), create: vi.fn(), update: vi.fn() },
    interpretacaoReprodutiva: { findMany: vi.fn().mockResolvedValue([]) }, $executeRaw: vi.fn() };
  return { tx: leitor as unknown as Prisma.TransactionClient, leitor, animalId, tarefa, demanda };
}
function retorno(f: ReturnType<typeof fonte>, id = uid(10), tentativaId = f.demanda.tentativaId, tipoExameId = uid(6), finalidade = "DIAGNOSTICO", explicita: string | null = null) {
  return { avaliacao: { id, animalId: f.animalId, data: dia("2026-01-05"), criadoEm: dia("2026-01-05"), tentativaId, gestacaoId: null, retornoEm: dia("2026-01-22"), resultado: "INCONCLUSIVO", status: "VALIDO" },
    interpretacao: { id, exame: { tipoExameId, finalidadePrincipal: finalidade, formatoSnapshot: { versao: 1 }, demandaAcompanhamentoId: explicita } } };
}
beforeEach(() => { vi.clearAllMocks(); mocks.contexto.mockResolvedValue({ animalId: uid(1), brinco: "7", sexo: "F", situacao: "AGUARDANDO_DIAGNOSTICO", propriedadeId: 7, lote: null }); });
describe("agenda de acompanhamento — contraprovas independentes", () => {
  it("tarefa pendente e demanda ligada geram uma linha sem gravar fatos durante leitura", async () => {
    const f = fonte(); const r = await consultarPlannerTx(f.tx, consulta, true);
    expect(r.totais).toEqual({ animaisUnicos: 1, procedimentos: 1 }); expect(r.grupos).toHaveLength(1); expect(r.grupos[0].grupo.origem).toBe("PROTOCOLO");
    expect(f.leitor.demandaAcompanhamentoReprodutivo.create).not.toHaveBeenCalled(); expect(f.leitor.demandaAcompanhamentoReprodutivo.update).not.toHaveBeenCalled(); expect(f.leitor.$executeRaw).not.toHaveBeenCalled();
  });
  it("retorno manual compatível prevalece só na agenda e datas originais entram no fingerprint", async () => {
    const f = fonte(); const manual = retorno(f); f.leitor.avaliacaoReprodutiva.findMany.mockResolvedValue([manual.avaliacao]); f.leitor.interpretacaoReprodutiva.findMany.mockResolvedValue([manual.interpretacao]);
    const r = await consultarPlannerTx(f.tx, consulta, true); expect(r.grupos).toHaveLength(1); expect(r.grupos[0].previstaPara).toBe("2026-01-22"); expect(f.tarefa.previstaPara).toEqual(dia("2026-01-10"));
    const primeira = await previaGrupoPlannerTx(f.tx, previaGrupoPlannerSchema.parse({ ...consulta, grupo: r.grupos[0].grupo }));
    f.tarefa.previstaPara = dia("2026-01-11");
    const segunda = await previaGrupoPlannerTx(f.tx, previaGrupoPlannerSchema.parse({ ...consulta, grupo: r.grupos[0].grupo }));
    expect(segunda.fingerprint).not.toBe(primeira.fingerprint); expect(segunda.grupo.previstaPara).toBe("2026-01-22"); expect(f.demanda.previstaPara).toEqual(dia("2026-01-10"));
  });
  it("tarefa concluída por inconclusivo não elimina a demanda que continua pendente", async () => {
    const f = fonte(); f.leitor.tarefaProtocolo.findMany.mockResolvedValue([]);
    const r = await consultarPlannerTx(f.tx, consulta, true); expect(r.totais.procedimentos).toBe(1); expect(r.grupos[0]).toMatchObject({ nome: "Diagnóstico pendente", tipo: "AVALIACAO_REPRODUTIVA", previstaPara: "2026-01-10" });
  });
  it.each([{ nome: "âncora", tentativaId: uid(99), tipoExameId: uid(6), finalidade: "DIAGNOSTICO" }, { nome: "método", tentativaId: uid(3), tipoExameId: uid(99), finalidade: "DIAGNOSTICO" }, { nome: "finalidade", tentativaId: uid(3), tipoExameId: uid(6), finalidade: "SEXAGEM" }])("retorno de outra $nome não some ao deduplicar demanda compatível", async ({ tentativaId, tipoExameId, finalidade }) => {
    const f = fonte(); f.leitor.tarefaProtocolo.findMany.mockResolvedValue([]);
    const compativel = retorno(f); const distinto = retorno(f, uid(11), tentativaId, tipoExameId, finalidade); distinto.avaliacao.retornoEm = dia("2026-01-25");
    f.leitor.avaliacaoReprodutiva.findMany.mockResolvedValue([compativel.avaliacao, distinto.avaliacao]); f.leitor.interpretacaoReprodutiva.findMany.mockResolvedValue([compativel.interpretacao, distinto.interpretacao]);
    const r = await consultarPlannerTx(f.tx, consulta, true); expect(r.totais.procedimentos).toBe(2); expect(r.grupos.map(g => g.previstaPara).sort()).toEqual(["2026-01-22", "2026-01-25"]);
  });
  it("retorno explícito da ocorrência2 não altera data da primeira reconfirmação", async () => {
    const f = fonte(); f.leitor.tarefaProtocolo.findMany.mockResolvedValue([]);
    const d1 = { ...f.demanda, finalidade: "RECONFIRMACAO", tentativaId: null, gestacaoId: uid(12), tarefaId: null };
    const d2 = { ...d1, id: uid(13), ocorrencia: 2, previstaPara: dia("2026-01-20") };
    f.leitor.demandaAcompanhamentoReprodutivo.findMany.mockResolvedValue([d1, d2]);
    const manual = retorno(f, uid(10), uid(3), uid(6), "RECONFIRMACAO", d2.id);
    const avaliacao = { ...manual.avaliacao, tentativaId: null, gestacaoId: uid(12) };
    f.leitor.avaliacaoReprodutiva.findMany.mockResolvedValue([avaliacao]); f.leitor.interpretacaoReprodutiva.findMany.mockResolvedValue([manual.interpretacao]);
    const r = await consultarPlannerTx(f.tx, consulta, true); expect(r.grupos.map(g => [g.nome, g.previstaPara])).toEqual([["Reconfirmação 1", "2026-01-10"], ["Reconfirmação 2", "2026-01-22"]]);
  });
});
