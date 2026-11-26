import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ tx: { programacaoProtocolo: { findFirst: vi.fn() }, etapaProtocolo: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() }, tarefaProtocolo: { findFirst: vi.fn(), findMany: vi.fn() }, $queryRaw: vi.fn() } }));
vi.mock("../../../db.js", () => ({ prisma: { $transaction: (fn: (tx: typeof m.tx) => unknown) => fn(m.tx) } }));
import { listarEtapasOperacao, listarTarefasOperacao } from "./operacao.js";
import { consultaOperacaoSchema } from "./operacao.schemas.js";
const id = "00000000-0000-4000-8000-000000000001";
const restrito = { dono: false, areas: ["pecuaria"], flags: [] };
const autorizado = { dono: false, areas: ["pecuaria", "financeiro"], flags: ["verValores"] };
const ref = { servico: { valorUnitario: "123.45", origem: "Tabela", data: "2026-01-01", unidade: "POR_ATENDIMENTO" } };
const configuracao = { tipo: "APLICACAO", planoAplicacao: { dose: "2" }, referenciasCusto: ref };
const data = new Date("2026-01-01T00:00:00.000Z");
beforeEach(() => {
  vi.resetAllMocks();
  m.tx.programacaoProtocolo.findFirst.mockResolvedValue({ id, nome: "Grupo", propriedadeId: 1, inicioReferencia: data, status: "ABERTA", protocolo: { id, nome: "Protocolo", versao: 1, tipo: "REPRODUTIVO" } });
  m.tx.etapaProtocolo.count.mockResolvedValue(1);
  m.tx.etapaProtocolo.findMany.mockResolvedValue([{ id, nome: "Dose", ordem: 1, tipo: "APLICACAO", diaRelativo: 0, unidadeIntervalo: "DIAS", momento: null, configuracao }]);
  m.tx.tarefaProtocolo.findFirst.mockResolvedValue({ previstaPara: data, precisaoTemporal: "DIA", parametros: { etapa: configuracao } });
  m.tx.tarefaProtocolo.findMany.mockImplementation(async (args: { select?: unknown }) => args.select ? [{ id, execucao: { propriedadeId: 1 }, vinculos: [] }] : [{ id, execucaoId: id, etapaId: id, previstaPara: data, previsaoOriginal: data, precisaoTemporal: "DIA", parametros: { etapa: configuracao }, realizadoSnapshot: { resultado: "POSITIVO" }, historicoRegularizacao: [], evento: [], eventos: [], vinculos: [], manejos: [], aplicacoes: [], exames: [], tentativas: [], demandaAcompanhamento: null, etapa: { nome: "Dose", tipo: "APLICACAO", configuracao }, execucao: { id, animalId: id, propriedadeId: 1, canceladaEm: null, animal: { id, brinco: "1", nome: null }, protocolo: { id, tipo: "REPRODUTIVO" } } }]);
  m.tx.$queryRaw.mockImplementation(async (sql: { sql: string }) => sql.sql.includes("SELECT id,situacao") ? [{ id, situacao: "PREVISTO", acompanhamentoPendente: false }] : sql.sql.includes("SELECT count(*) AS total FROM tarefas") ? [{ total: 1n }] : []);
});
it.each(["REPRODUTIVO", "SANITARIO"] as const)("protege configuração e snapshots na operação %s conforme domínio e permissão", async tipo => {
  m.tx.programacaoProtocolo.findFirst.mockResolvedValue({ id, nome: "Grupo", propriedadeId: 1, inicioReferencia: data, status: "ABERTA", protocolo: { id, nome: "Protocolo", versao: 1, tipo } });
  for (const [usuario, verValores] of [[restrito, false], [autorizado, true]] as const) {
    const etapas = await listarEtapasOperacao({ programacaoId: id }, 1, consultaOperacaoSchema.parse({}), usuario);
    const tarefas = await listarTarefasOperacao({ programacaoId: id }, 1, consultaOperacaoSchema.parse({}), usuario);
    expect(etapas.itens[0].configuracao).toMatchObject({ tipo: "APLICACAO", planoAplicacao: { dose: "2" } });
    expect(tarefas.itens[0].tarefaOrigem).toMatchObject({ parametros: { etapa: { planoAplicacao: { dose: "2" } } }, realizadoSnapshot: { resultado: "POSITIVO" } });
    expect(JSON.stringify([etapas, tarefas]).includes("123.45")).toBe(tipo === "SANITARIO" || verValores);
  }
});
