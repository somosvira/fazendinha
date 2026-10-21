import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { uid } from "../../../lib/uid.fixture.js";

const banco = vi.hoisted(() => ({ tx: {} as Prisma.TransactionClient }));
vi.mock("../../../db.js", () => ({ prisma: new Proxy({}, { get: (_alvo, campo) => campo === "$transaction"
  ? (executar: (tx: Prisma.TransactionClient) => Promise<unknown>) => executar(banco.tx)
  : Reflect.get(banco.tx, campo) }) }));
vi.mock("../fatos.js", () => ({ conferirAnimalNoFato: vi.fn(async () => ({ sexo: "F" })) }));
import { executarTarefaTx } from "./iatf.js";
import { confirmarAtividadeTx, contextoAnimalVisitaTx } from "./visitas.js";
import { TIPO_EXAME_REPRODUTIVO } from "../exames/evidencia-reprodutiva.js";
import { confirmacaoVisitaSchema } from "./schemas.js";
import { anularFato, previaAnulacao } from "./correcoes.js";
import { listarAcompanhamentos } from "./acompanhamento.js";

const data = "2026-01-25";
const dia = (v: string) => new Date(`${v}T00:00:00Z`);
const animalId = uid(1), gestacaoId = uid(2), tarefa1 = uid(3), tarefa2 = uid(4), demanda1 = uid(5), demanda2 = uid(6);
type Exame = {
  id: string; animalId: string; propriedadeId: number; data: Date; status: string; realizacao: string; finalidades: string[];
  tipoExameId: string; tarefaId: string | null; demandaAcompanhamentoId: string | null;
  formatoSnapshot: unknown; resultados: Array<{ campo: string; valor: unknown }>;
  interpretacao: { id: string; exameId: string; tentativaId: string | null; gestacaoId: string | null };
};
function fixture() {
  const exames: Exame[] = [];
  const gestacao = { id: gestacaoId, animalId, propriedadeId: 7, status: "VALIDO", confirmadaEm: dia("2026-01-01"), encerradaEm: null, tentativaId: null, sexoFetal: null };
  const demandas = [1, 2].map(n => ({ id: n === 1 ? demanda1 : demanda2, animalId, propriedadeOrigemId: 7,
    finalidade: "RECONFIRMACAO", ocorrencia: n, tentativaId: null, gestacaoId, tentativa: null, gestacao,
    tarefaId: n === 1 ? tarefa1 : tarefa2, dataReferencia: dia("2026-01-01"), previstaPara: dia(n === 1 ? "2026-01-10" : "2026-01-20"),
    estado: "PENDENTE", exameResolucaoId: null as string | null, motivoEncerramento: null, regraSnapshot: {}, versao: 1,
    exameOrigemId: null as string | null, origemAdocao: "FATO_NOVO" }));
  const tarefa = { id: tarefa2, participanteId: uid(7), tipo: "AVALIACAO", etapa: 1, nome: "Segunda reconfirmação", precisaoTemporal: "DIA", previstaEm: dia(data),
    realizadaEm: null as Date | null, dispensadaEm: null, planejadoSnapshot: { versao: 1, precisaoTemporal: "DIA", previstaEm: data,
      etapa: { nome: "Segunda reconfirmação", tipo: "AVALIACAO", planoAvaliacao: { tipo: "RECONFIRMACAO", tipoExameId: TIPO_EXAME_REPRODUTIVO } } } };
  const participacao = { id: uid(7), animalId, programacaoId: uid(8), inicioEfetivo: dia("2026-01-01"), precisaoInicioEfetivo: "DIA", encerradoEm: null };
  const programa = { id: uid(8), propriedadeId: 7, status: "ABERTA" };
  const visita = { id: uid(9), propriedadeId: 7, data: dia(data), encerradaEm: null };
  const atividade = { id: uid(10), visitaId: visita.id, tipo: "TAREFA_IATF", contexto: {} };
  const participante = { id: uid(11), animalId, atividadeId: atividade.id, tarefaId: tarefa2, snapshot: {} as unknown, rascunho: {}, versaoRascunho: 0, status: "PENDENTE" };
  const requisicoes = new Map<string, unknown>();
  const animais = [{ id: animalId, sexo: "F", brinco: "7", nome: null, atualizadoEm: dia("2026-01-01"), dataNascimento: dia("2020-01-01"), dataEntrada: dia("2020-01-01"), partosAntesDaEntrada: 0 }];
  const locais = [{ id: uid(12), animalId, propriedadeId: 7, desde: dia("2020-01-01"), ate: null, loteId: null, lote: null }];
  const tipo = { id: TIPO_EXAME_REPRODUTIVO, ativo: true, nome: "Exame reprodutivo", contexto: "REPRODUTIVO", tipoResultado: "MULTIPLO", versaoFormato: 1,
    campos: [{ codigo: "CONCLUSAO_GESTACIONAL", tipo: "OPCAO", opcoes: ["POSITIVO", "NEGATIVO", "INCONCLUSIVO"] }, { codigo: "SEXO_FETAL", tipo: "OPCAO", opcoes: ["M", "F"] }] };
  const vazios = () => ({ findMany: vi.fn().mockResolvedValue([]) });
  const avaliacao = (id: string) => {
    const exame = exames.find(e => e.id === id)!;
    return { ...exame, ...exame.interpretacao, resultado: "RECONFIRMACAO", gestacaoId,
      gestacaoCriada: false, conduta: null, sexoFetal: null };
  };
  const db = {
    $executeRaw: vi.fn().mockResolvedValue(1), $queryRaw: vi.fn().mockResolvedValue([]),
    animal: { findMany: vi.fn().mockResolvedValue(animais) }, localizacaoAnimal: { findMany: vi.fn().mockResolvedValue(locais) },
    partoAnimal: vazios(), tentativaReprodutiva: vazios(), lactacaoAnimal: vazios(), situacaoInicialReprodutiva: vazios(),
    restricaoReprodutiva: vazios(), categoriaAnimal: vazios(), categoriaManualAnimal: vazios(), finalidadeAnimal: vazios(),
    ocorrenciaSanitaria: vazios(), regraSanitariaReprodutiva: vazios(), periodoReprodutivoAnimal: vazios(),
    gestacaoAnimal: { findMany: vi.fn().mockResolvedValue([gestacao]), findFirst: vi.fn().mockResolvedValue(gestacao) },
    tipoExame: { findUnique: vi.fn().mockResolvedValue(tipo) },
    demandaAcompanhamentoReprodutivo: {
      findMany: vi.fn(async (args) => structuredClone(demandas.map(d => args?.include?.exameOrigem ? { ...d, exameOrigem: exames.find(e => e.id === d.exameOrigemId) ?? null } : d))),
      findUnique: vi.fn(async ({ where, include }) => {
        const d = demandas.find(d => where.id ? d.id === where.id : d.tarefaId === where.tarefaId);
        return d && include?.exameOrigem ? { ...d, exameOrigem: exames.find(e => e.id === d.exameOrigemId) ?? null } : d ?? null;
      }),
      update: vi.fn(async ({ where, data: atualizacao }) => { const d = demandas.find(d => d.id === where.id)!; Object.assign(d, atualizacao, { versao: d.versao + 1 }); return d; }),
    },
    exameAnimal: {
      create: vi.fn(async ({ data: entrada }) => {
        const e: Exame = { ...entrada, status: "VALIDO", realizacao: entrada.realizacao, tarefaId: null, demandaAcompanhamentoId: null,
          interpretacao: { ...entrada.interpretacao.create, exameId: entrada.id, tentativaId: entrada.interpretacao.create.tentativaId ?? null, gestacaoId: entrada.interpretacao.create.gestacaoId ?? null }, resultados: entrada.resultados.create };
        exames.push(e); return e;
      }),
      findUnique: vi.fn(async ({ where }) => exames.find(e => e.id === where.id) ?? null),
      findUniqueOrThrow: vi.fn(async ({ where }) => exames.find(e => e.id === where.id)!),
      findMany: vi.fn(async () => exames),
      update: vi.fn(async ({ where, data: atualizacao }) => { const e = exames.find(e => e.id === where.id)!; Object.assign(e, atualizacao); return e; }),
    },
    avaliacaoReprodutiva: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(async ({ where }) => avaliacao(where.id)),
      findUniqueOrThrow: vi.fn(async ({ where }) => avaliacao(where.id)),
    },
    interpretacaoReprodutiva: { findUniqueOrThrow: vi.fn(async ({ where }) => exames.find(e => e.interpretacao.id === where.id)!.interpretacao) },
    tarefaIatf: { findUnique: vi.fn(async () => tarefa), findUniqueOrThrow: vi.fn(async () => tarefa), findMany: vi.fn().mockResolvedValue([]) },
    participanteIatf: { findUniqueOrThrow: vi.fn().mockResolvedValue(participacao) }, programacaoIatf: { findFirst: vi.fn().mockResolvedValue(programa) },
    tarefaProtocolo: { findFirst: vi.fn(async ({ where }) => ({ id: where.OR[0].id })),
      findUniqueOrThrow: vi.fn(async () => ({ ...tarefa, etapa: { tipo: "EXAME" }, execucao: { animalId }, vinculos: [] })),
      update: vi.fn(async ({ data: atualizacao }) => { Object.assign(tarefa, atualizacao); return tarefa; }) },
    vinculoTarefaProtocolo: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn(), create: vi.fn(async ({ data: entrada }) => entrada) },
    auditoriaPecuaria: { create: vi.fn(async ({ data: entrada }) => entrada) },
    visitaVeterinaria: { findFirst: vi.fn().mockResolvedValue(visita), update: vi.fn(async ({ data: entrada }) => ({ ...visita, ...entrada })) },
    atividadeVisita: { findFirst: vi.fn().mockResolvedValue(atividade), findMany: vi.fn().mockResolvedValue([atividade]) },
    participanteVisita: { findMany: vi.fn(async ({ where }) => where.OR ? [] : [participante]), findUniqueOrThrow: vi.fn(async () => participante), count: vi.fn().mockResolvedValue(0),
      update: vi.fn(async ({ data: entrada }) => { Object.assign(participante, entrada, { versaoRascunho: participante.versaoRascunho + 1 }); return participante; }) },
    requisicaoPecuaria: { findUnique: vi.fn(async ({ where }) => requisicoes.get(where.chave) ?? null),
      create: vi.fn(async ({ data: entrada }) => { requisicoes.set(entrada.chave, structuredClone(entrada)); return entrada; }) },
  };
  banco.tx = db as unknown as Prisma.TransactionClient;
  return { tx: banco.tx, db, demandas, exames, participante, visita, atividade, gestacao };
}
beforeEach(() => { vi.clearAllMocks(); });

describe("ocorrência de acompanhamento na execução real da tarefa e da visita", () => {
  it("grava a demanda da tarefa2 no exame e mantém a primeira ocorrência pendente", async () => {
    const f = fixture();
    await executarTarefaTx(f.tx, tarefa2, { chave: uid(20), propriedadeId: 7, realizadaEm: data, dados: { resultado: "RECONFIRMACAO", gestacaoId } }, 7);
    expect(f.exames).toHaveLength(1);
    expect(f.exames[0]).toMatchObject({ tarefaId: tarefa2, demandaAcompanhamentoId: demanda2 });
    expect(f.demandas.map(d => [d.id, d.estado])).toEqual([[demanda1, "PENDENTE"], [demanda2, "RESOLVIDA"]]);
  });
  it("confirma a segunda ocorrência pela visita e reapresenta o retry sem outro exame", async () => {
    const f = fixture();
    f.participante.snapshot = await contextoAnimalVisitaTx(f.tx, animalId, 7, dia(data));
    const input = confirmacaoVisitaSchema.parse({ chave: uid(21), propriedadeId: 7, itens: [{ participanteId: f.participante.id,
      versaoRascunho: 0, dados: { realizadaEm: data, dados: { resultado: "RECONFIRMACAO" } } }] });
    const primeira = await confirmarAtividadeTx(f.tx, f.visita.id, f.atividade.id, input, 7);
    const repetida = await confirmarAtividadeTx(f.tx, f.visita.id, f.atividade.id, input, 7);
    expect(JSON.parse(JSON.stringify(repetida))).toEqual(JSON.parse(JSON.stringify(primeira)));
    expect(f.exames).toHaveLength(1);
    expect(f.exames[0]).toMatchObject({ tarefaId: tarefa2, demandaAcompanhamentoId: demanda2, interpretacao: { gestacaoId } });
    expect(f.demandas.map(d => [d.id, d.estado])).toEqual([[demanda1, "PENDENTE"], [demanda2, "RESOLVIDA"]]);
    expect(f.participante).toMatchObject({ status: "CONFIRMADO", versaoRascunho: 1 });
    expect(f.db.auditoriaPecuaria.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ entidade: "ParticipanteVisita", usuarioId: 7 }) }));
  });
  it("recusa trocar a ocorrência vinculada à tarefa antes de criar um exame", async () => {
    const f = fixture();
    await expect(executarTarefaTx(f.tx, tarefa2, { chave: uid(22), propriedadeId: 7, realizadaEm: data,
      dados: { resultado: "RECONFIRMACAO", demandaAcompanhamentoId: demanda1 } }, 7)).rejects.toMatchObject({ code: "VALIDACAO", campo: "demandaAcompanhamentoId" });
    expect(f.exames).toHaveLength(0);
    expect(f.db.tarefaProtocolo.update).not.toHaveBeenCalled();
  });
  it("anula o primeiro DG adotado pelo fluxo de correção, preserva a gestação e reabre suas demandas", async () => {
    const f = fixture(), origemId = uid(30);
    f.exames.push({ id: origemId, animalId, propriedadeId: 7, data: dia("2026-01-01"), status: "VALIDO", realizacao: "REALIZADO",
      tipoExameId: TIPO_EXAME_REPRODUTIVO, tarefaId: null, demandaAcompanhamentoId: null, finalidades: ["DIAGNOSTICO"], formatoSnapshot: { versao: 1 },
      interpretacao: { id: origemId, exameId: origemId, gestacaoId, tentativaId: null }, resultados: [{ campo: "CONCLUSAO_GESTACIONAL", valor: "POSITIVO" }] });
    for (const d of f.demandas) Object.assign(d, { exameOrigemId: origemId, origemAdocao: "ADOCAO_EXPLICITA" });
    await executarTarefaTx(f.tx, tarefa2, { chave: uid(31), propriedadeId: 7, realizadaEm: data, dados: { resultado: "RECONFIRMACAO" } }, 7);
    expect(f.demandas[1].estado).toBe("RESOLVIDA");
    const previa = await previaAnulacao("avaliacoes", origemId, 7);
    expect(previa.impedimentos).toEqual([]);
    await anularFato("avaliacoes", origemId, { chave: uid(32), propriedadeId: 7, motivo: "DG de origem pertence a outra coleta", fingerprint: previa.fingerprint }, 7);
    expect(f.gestacao.status).toBe("VALIDO");
    expect(f.exames.find(e => e.id === origemId)?.status).toBe("ANULADO");
    expect(f.demandas.map(d => [d.estado, d.exameResolucaoId, d.exameOrigemId, d.dataReferencia])).toEqual([
      ["PENDENTE", null, origemId, dia("2026-01-01")], ["PENDENTE", null, origemId, dia("2026-01-01")],
    ]);
    const atualizacoes = f.db.demandaAcompanhamentoReprodutivo.update.mock.calls.length;
    expect((await listarAcompanhamentos(7, animalId, data)).map(d => d.pendencias)).toEqual([["EXAME_ORIGEM_INVALIDO"], ["EXAME_ORIGEM_INVALIDO"]]);
    expect(f.db.demandaAcompanhamentoReprodutivo.update).toHaveBeenCalledTimes(atualizacoes);
    expect(f.db.auditoriaPecuaria.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ entidadeId: demanda2, usuarioId: 7,
      antes: expect.objectContaining({ estado: "RESOLVIDA" }), depois: expect.objectContaining({ estado: "PENDENTE" }) }) }));
  });
});
