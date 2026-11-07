import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  transacao: vi.fn(),
  elegibilidade: vi.fn(),
  trava: vi.fn(),
  publicar: vi.fn(),
  animal: vi.fn(),
  local: vi.fn(),
  necessidades: vi.fn(),
  criar: vi.fn(),
  atualizar: vi.fn(),
  participacoes: vi.fn(),
  demandas: vi.fn(),
  exames: vi.fn(),
  dispositivos: vi.fn(),
  politica: vi.fn(),
  alerta: vi.fn(),
  tentativa: vi.fn(),
}));
vi.mock("../../transacao.js", () => ({ transacaoPecuaria: m.transacao }));
vi.mock("../../fatos.js", () => ({ conferirAnimalNoFato: vi.fn() }));
vi.mock("../../rebanho/regras.js", async (original) => ({
  ...(await original<object>()),
  travarAnimais: m.trava,
  auditar: vi.fn(),
  hojeFazendaDate: () => new Date("2026-11-07"),
}));
vi.mock("../elegibilidade.js", () => ({
  obterElegibilidadesNaDataTx: m.elegibilidade,
}));
vi.mock("../../../alertas/publicacao.js", async (original) => ({
  ...(await original<object>()),
  publicarAlertaTx: m.publicar,
}));
import { reavaliarAtencaoAnimal } from "./decisoes.js";
const tarefa = (extra = {}) => ({
  id: "t",
  execucaoId: "p",
  etapa: { tipo: "RETIRADA", configuracao: {} },
  previstaPara: new Date("2026-11-05"),
  realizadaEm: null,
  dispensadaEm: null,
  previsaoPendente: false,
  parametros: {},
  aplicacoes: [],
  exames: [],
  tentativas: [],
  manejos: [],
  vinculos: [],
  ...extra,
});
const participacao = (tarefas: unknown[]) => ({
  id: "p",
  animalId: "a",
  propriedadeId: 1,
  inicio: new Date("2026-11-01"),
  protocolo: { finalidade: "IATF" },
  canceladaEm: null,
  rodada: null,
  tarefas,
});
beforeEach(() => {
  vi.clearAllMocks();
  m.animal.mockResolvedValue({
    brinco: "17",
    nome: null,
    sexo: "F",
    baixas: [],
  });
  m.local.mockResolvedValue({ propriedadeId: 1 });
  m.necessidades.mockResolvedValue([]);
  m.participacoes.mockResolvedValue([]);
  m.demandas.mockResolvedValue([]);
  m.exames.mockResolvedValue([]);
  m.dispositivos.mockResolvedValue([]);
  m.politica.mockResolvedValue(null);
  m.elegibilidade.mockResolvedValue(new Map());
  m.alerta.mockResolvedValue(null);
  m.tentativa.mockResolvedValue(null);
  m.criar.mockImplementation(async ({ data }) => ({
    id: "n",
    alertaId: null,
    decisao: null,
    revisaoEm: null,
    decisaoMotivo: null,
    decisaoDestino: null,
    ...data,
  }));
  m.atualizar.mockResolvedValue({});
  m.publicar.mockResolvedValue({ alertaId: "alerta" });
  const tx = {
    animal: { findUnique: m.animal },
    localizacaoAnimal: { findFirst: m.local },
    necessidadeReprodutiva: {
      findMany: m.necessidades,
      create: m.criar,
      update: m.atualizar,
    },
    participacaoProtocolo: { findMany: m.participacoes },
    demandaAcompanhamentoReprodutivo: { findMany: m.demandas },
    exameAnimal: { findMany: m.exames },
    aplicacaoProduto: { findMany: m.dispositivos },
    politicaAtencaoReprodutiva: { findFirst: m.politica },
    alerta: { findUnique: m.alerta },
    tentativaReprodutiva: { findFirst: m.tentativa },
  };
  m.transacao.mockImplementation(
    (executar: (t: typeof tx) => Promise<unknown>) => executar(tx),
  );
});
describe("produtor reprodutivo canônico", () => {
  it("tarefa e acompanhamento do mesmo cuidado publicam uma necessidade", async () => {
    m.participacoes.mockResolvedValue([participacao([tarefa()])]);
    m.demandas.mockResolvedValue([
      {
        id: "d",
        animalId: "a",
        propriedadeOrigemId: 1,
        tarefaId: "t",
        tarefa: { execucaoId: "p", dispensadaEm: null },
        finalidade: "DIAGNOSTICO",
        dataReferencia: new Date("2026-10-01"),
        previstaPara: new Date("2026-11-05"),
        regraSnapshot: { versao: 2, antecedencia: 2, tolerancia: 3 },
        estado: "PENDENTE",
      },
    ]);
    await reavaliarAtencaoAnimal("a", 1, 7);
    expect(m.criar).toHaveBeenCalledTimes(1);
    expect(m.criar).toHaveBeenCalledWith({
      data: expect.objectContaining({
        chave: "TAREFA:t",
        demandaId: "d",
        tarefaId: "t",
        situacao: "PENDENTE",
      }),
    });
    expect(m.publicar).toHaveBeenCalledTimes(1);
  });
  it("dispensa da etapa/retirada da participação não apaga cuidado físico", async () => {
    m.participacoes.mockResolvedValue([
      {
        ...participacao([tarefa({ dispensadaEm: new Date("2026-11-06") })]),
        canceladaEm: new Date("2026-11-06"),
      },
    ]);
    m.dispositivos.mockResolvedValue([
      {
        id: "insercao",
        data: new Date("2026-11-01"),
        propriedadeId: 1,
        tarefa: { execucaoId: "p" },
      },
    ]);
    await reavaliarAtencaoAnimal("a", 1, 7);
    expect(m.criar).toHaveBeenCalledTimes(1);
    expect(m.criar).toHaveBeenCalledWith({
      data: expect.objectContaining({
        chave: "DISPOSITIVO:insercao",
        tipo: "DISPOSITIVO_SEM_RETIRADA",
        situacao: "PLANEJAMENTO_PENDENTE",
        participacaoId: null,
      }),
    });
  });
  it("avaliação física realizada sem conclusão não satisfaz DG solicitado", async () => {
    m.participacoes.mockResolvedValue([
      participacao([
        tarefa({
          etapa: {
            tipo: "EXAME",
            configuracao: {
              tipo: "AVALIACAO",
              planoAvaliacao: { tipo: "DIAGNOSTICO" },
            },
          },
          realizadaEm: new Date("2026-11-05"),
          exames: [
            {
              id: "fisico",
              status: "VALIDO",
              realizacao: "REALIZADO",
              resultados: [],
            },
          ],
        }),
      ]),
    ]);
    await reavaliarAtencaoAnimal("a", 1, 7);
    expect(m.criar).toHaveBeenCalledWith({
      data: expect.objectContaining({
        chave: "TAREFA:t",
        tipo: "DG_VENCIDO",
        situacao: "PLANEJAMENTO_PENDENTE",
        previstaPara: null,
      }),
    });
  });
  it("DG positivo ou negativo vigente pode encerrar sem converter ausência em negativo", async () => {
    m.participacoes.mockResolvedValue([
      participacao([
        tarefa({
          etapa: {
            tipo: "EXAME",
            configuracao: {
              tipo: "AVALIACAO",
              planoAvaliacao: { tipo: "DIAGNOSTICO" },
            },
          },
          realizadaEm: new Date("2026-11-05"),
          exames: [
            {
              id: "dg",
              status: "VALIDO",
              realizacao: "REALIZADO",
              resultados: [
                { campo: "CONCLUSAO_GESTACIONAL", valor: "NEGATIVO" },
              ],
            },
          ],
        }),
      ]),
    ]);
    await reavaliarAtencaoAnimal("a", 1, 7);
    expect(m.criar).not.toHaveBeenCalled();
    expect(m.publicar).not.toHaveBeenCalled();
  });
  it("preparo externo sem regra fica em planejamento, sem inventar atraso", async () => {
    m.participacoes.mockResolvedValue([
      participacao([
        tarefa({
          etapa: { tipo: "APLICACAO", configuracao: {} },
          realizadaEm: new Date("2026-11-01"),
          aplicacoes: [{ status: "VALIDO" }],
        }),
      ]),
    ]);
    await reavaliarAtencaoAnimal("a", 1, 7);
    expect(m.criar).toHaveBeenCalledWith({
      data: expect.objectContaining({
        chave: "PREPARO:p",
        tipo: "TENTATIVA_APOS_PREPARO",
        situacao: "PLANEJAMENTO_PENDENTE",
        previstaPara: null,
      }),
    });
  });
  it("tentativa externa factual vinculada satisfaz preparo sem exigir tarefa de IA", async () => {
    m.participacoes.mockResolvedValue([
      participacao([
        tarefa({
          etapa: { tipo: "APLICACAO", configuracao: {} },
          realizadaEm: new Date("2026-11-01"),
          aplicacoes: [{ status: "VALIDO" }],
        }),
      ]),
    ]);
    m.tentativa.mockResolvedValue({ id: "externa" });
    await reavaliarAtencaoAnimal("a", 1, 7);
    expect(m.criar).not.toHaveBeenCalled();
    expect(m.tentativa).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            {
              participacoesExplicitas: {
                some: { participacaoId: "p", revogadoEm: null },
              },
            },
          ]),
        }),
      }),
    );
  });
  it("hora do preparo não exclui tentativa factual do mesmo dia civil", async () => {
    m.participacoes.mockResolvedValue([
      participacao([
        tarefa({
          etapa: { tipo: "APLICACAO", configuracao: {} },
          realizadaEm: new Date("2026-11-01T15:00:00Z"),
          aplicacoes: [{ status: "VALIDO" }],
        }),
      ]),
    ]);
    m.tentativa.mockResolvedValue({ id: "externa" });
    await reavaliarAtencaoAnimal("a", 1, 7);
    expect(m.tentativa).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          data: { gte: new Date("2026-11-01T00:00:00Z") },
        }),
      }),
    );
    expect(m.criar).not.toHaveBeenCalled();
  });
  it("dispensa de preparo não comprova preparo concluído", async () => {
    m.participacoes.mockResolvedValue([
      participacao([
        tarefa({
          etapa: { tipo: "APLICACAO", configuracao: {} },
          dispensadaEm: new Date("2026-11-01"),
        }),
      ]),
    ]);
    await reavaliarAtencaoAnimal("a", 1, 7);
    expect(m.tentativa).not.toHaveBeenCalled();
    expect(m.criar).not.toHaveBeenCalledWith({
      data: expect.objectContaining({ tipo: "TENTATIVA_APOS_PREPARO" }),
    });
  });
});
it("associação posterior à tarefa preserva o ID/chave/alerta da demanda publicada", async () => {
 const anterior = { id: "necessidade-original", chave: "DEMANDA:d", alertaId: "alerta-original", demandaId: "d", tarefaId: null, tipo: "DG_VENCIDO", origemId: "d", animalId: "a", propriedadeId: 1, dataReferencia: new Date("2026-10-01"), previstaPara: new Date("2026-11-05"), regraSnapshot: {}, situacao: "PENDENTE", revisao: 1, decisao: null, revisaoEm: null };
 m.necessidades.mockResolvedValue([anterior]);
 m.atualizar.mockImplementation(async ({ data }) => ({ ...anterior, ...data, revisao: 2 }));
 m.demandas.mockResolvedValue([{ id: "d", animalId: "a", propriedadeOrigemId: 1, tarefaId: "t", tarefa: { execucaoId: "p", dispensadaEm: null }, finalidade: "DIAGNOSTICO", dataReferencia: anterior.dataReferencia, previstaPara: anterior.previstaPara, regraSnapshot: {}, estado: "PENDENTE" }]);
 await reavaliarAtencaoAnimal("a", 1, 7);
 expect(m.criar).not.toHaveBeenCalled();
 expect(m.atualizar).toHaveBeenCalledWith({ where: { id: anterior.id }, data: expect.objectContaining({ tarefaId: "t", demandaId: "d" }) });
 expect(m.publicar.mock.calls[0][1]).toMatchObject({ origemId: anterior.id, chaveOcorrencia: anterior.chave });
});
