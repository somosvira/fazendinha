import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  participantes: vi.fn(),
  gestacoes: vi.fn(),
  exames: vi.fn(),
  locais: vi.fn(),
  demandas: vi.fn(),
  contexto: vi.fn(),
  contextos: vi.fn(),
}));
vi.mock("../../../db.js", () => ({
  prisma: {
    $transaction: async (f: (tx: unknown) => unknown) =>
      f({
        participacaoProtocolo: { findMany: m.participantes },
        gestacaoAnimal: { findMany: m.gestacoes },
        exameAnimal: { findMany: m.exames },
        localizacaoAnimal: { findMany: m.locais },
        demandaAcompanhamentoReprodutivo: { findMany: m.demandas },
      }),
  },
}));
vi.mock("./operacao.js", () => ({ obterContextoOperacaoTx: m.contexto }));
vi.mock("../reproducao/contexto-animal.js", () => ({
  obterContextosAnimaisNaDataTx: m.contextos,
}));
import {
  consultarResultadosProtocolo,
  consultaResultadosSchema,
} from "./resultados.js";
const data = new Date("2026-01-01T00:00:00Z");
const tarefa = () => ({
  id: "tarefa",
  previstaPara: data,
  precisaoTemporal: "DIA",
  realizadaEm: data,
  dispensadaEm: null,
  motivoDispensa: null,
  execucao: { canceladaEm: null },
  etapa: { configuracao: { tipo: "APLICACAO" } },
  aplicacoes: [],
  exames: [],
  manejos: [],
  tentativas: [],
  eventos: [],
  vinculos: [],
});
const tentativa = (id = "tentativa") => ({
  id,
  tipo: "IA",
  data,
  ordem: 1,
  animalId: "animal",
  propriedadeId: 1,
  status: "VALIDO",
  tarefaId: null,
});
const participante = () => ({
  id: "participacao",
  animalId: "animal",
  animal: { id: "animal", brinco: "123", nome: null },
  propriedadeId: 1,
  canceladaEm: null,
  protocolo: {
    finalidade: "IATF",
    modalidadeTentativa: "EXTERNA",
    modalidadeDiagnostico: "EXTERNO",
  },
  tarefas: [tarefa()],
  tentativasExternas: [],
});
beforeEach(() => {
  vi.resetAllMocks();
  m.contexto.mockResolvedValue({
    protocolo: { tipo: "REPRODUTIVO" },
    where: { propriedadeId: 1 },
  });
  m.participantes.mockResolvedValue([participante()]);
  m.gestacoes.mockResolvedValue([]);
  m.exames.mockResolvedValue([]);
  m.locais.mockResolvedValue([{ animalId: "animal" }]);
  m.demandas.mockResolvedValue([]);
  m.contextos.mockResolvedValue(
    new Map([["animal", { situacaoReprodutiva: "DESCONHECIDA" }]]),
  );
});
it("libera preparo concluído com tentativa externa pendente e não fabrica resultado", async () => {
  const r = await consultarResultadosProtocolo(
    { programacaoId: "grupo" },
    1,
    consultaResultadosSchema.parse({}),
  );
  expect(r).toMatchObject({
    liberado: true,
    resumo: { preparoConcluido: 1, tentativasRealizadas: 0, negativos: 0 },
    itens: [{ conclusao: "TENTATIVA_PENDENTE", primeiroDg: null }],
  });
  expect(m.participantes.mock.calls[0][0].where).toEqual({ propriedadeId: 1 });
});
it("vínculo explícito permite tentativa sem DG, mas exame de outra tentativa não resolve por proximidade", async () => {
  m.participantes.mockResolvedValue([
    {
      ...participante(),
      tentativasExternas: [
        {
          id: "v",
          snapshot: { animalId: "animal", data: "2026-01-01", tipo: "IA" },
          tentativa: tentativa(),
        },
      ],
    },
  ]);
  m.exames.mockResolvedValue([
    {
      id: "e",
      data,
      finalidades: ["DIAGNOSTICO"],
      resultados: [{ valor: "NEGATIVO" }],
      interpretacao: { tentativaId: "outra", gestacaoId: null },
    },
  ]);
  const r = await consultarResultadosProtocolo(
    { programacaoId: "grupo" },
    1,
    consultaResultadosSchema.parse({}),
  );
  expect(r.resumo).toMatchObject({
    tentativasRealizadas: 1,
    aguardandoDiagnostico: 1,
    negativos: 0,
    examinados: 0,
  });
});
it("anulação e alteração factual invalidam o vínculo na leitura, sem apagar evidência nem contar tentativa", async () => {
  m.participantes.mockResolvedValue([
    {
      ...participante(),
      tentativasExternas: [
        {
          id: "v",
          snapshot: { animalId: "animal", data: "2026-01-01", tipo: "IA" },
          tentativa: { ...tentativa(), status: "ANULADO" },
        },
      ],
    },
  ]);
  const r = await consultarResultadosProtocolo(
    { participacaoId: "participacao" },
    1,
    consultaResultadosSchema.parse({}),
  );
  expect(r.resumo.tentativasRealizadas).toBe(0);
  expect(r.itens[0].vinculoExterno).toMatchObject({ id: "v", valido: false });
  expect(r.itens[0].pendencia).toContain("revisão");
});
it("DG agendado não impede resultados e totais usam todo conjunto antes da paginação/busca", async () => {
  const dg = {
    ...tarefa(),
    id: "dg",
    realizadaEm: null,
    etapa: {
      configuracao: {
        tipo: "AVALIACAO",
        planoAvaliacao: { tipo: "DIAGNOSTICO" },
      },
    },
  };
  m.participantes.mockResolvedValue(
    Array.from({ length: 12 }, (_, i) => ({
      ...participante(),
      id: `p${i}`,
      animalId: `a${i}`,
      animal: { id: `a${i}`, brinco: String(i), nome: null },
      tarefas: [tarefa(), dg],
    })),
  );
  const r = await consultarResultadosProtocolo(
    { programacaoId: "grupo" },
    1,
    consultaResultadosSchema.parse({ pagina: 2, busca: "1" }),
  );
  expect(r.liberado).toBe(true);
  expect(r.resumo.incluidos).toBe(12);
  expect(r.total).toBe(3);
  expect(r.itens).toHaveLength(3);
});

it("não revela tentativa externa nem situação atual de outro sítio por uma participação histórica acessível", async () => {
  m.participantes.mockResolvedValue([
    {
      ...participante(),
      propriedadeId: 2,
      tentativasExternas: [
        {
          id: "privado",
          snapshot: { animalId: "animal", data: "2026-01-01", tipo: "IA" },
          tentativa: { ...tentativa(), propriedadeId: 2 },
        },
      ],
    },
  ]);
  m.contextos.mockResolvedValue(
    new Map([
      [
        "animal",
        {
          situacaoReprodutiva: "GESTANTE",
          localizacaoNaData: { propriedadeId: 2 },
        },
      ],
    ]),
  );
  const r = await consultarResultadosProtocolo(
    { programacaoId: "grupo" },
    1,
    consultaResultadosSchema.parse({}),
  );
  expect(r).toMatchObject({
    liberado: false,
    resumo: { tentativasRealizadas: 0 },
    itens: [{ situacaoAtual: null, vinculoExterno: null }],
  });
  expect(
    m.participantes.mock.calls[0][0].include.tentativasExternas.where,
  ).toMatchObject({ propriedadeId: 1, revogadoEm: null });
});

it("resultados expõem encaminhamento contextual do exame factual sem perder legado ou primeiro DG", async () => {
  m.participantes.mockResolvedValue([
    {
      ...participante(),
      tentativasExternas: [
        {
          id: "v",
          snapshot: { animalId: "animal", data: "2026-01-01", tipo: "IA" },
          tentativa: tentativa(),
        },
      ],
    },
  ]);
  m.exames.mockResolvedValue([
    {
      id: "dg-original",
      data,
      finalidades: ["DIAGNOSTICO"],
      resultados: [{ valor: "POSITIVO" }],
      interpretacao: {
        tentativaId: "tentativa",
        gestacaoId: null,
        conduta: null,
        retornoEm: null,
        condutasContextuais: [],
      },
    },
    {
      id: "avaliacao-posterior",
      data: new Date("2026-01-02T00:00:00Z"),
      finalidades: ["DIAGNOSTICO"],
      resultados: [],
      interpretacao: {
        tentativaId: "tentativa",
        gestacaoId: null,
        conduta: "AGUARDAR",
        retornoEm: new Date("2026-01-15T00:00:00Z"),
        condutasContextuais: [
          {
            codigo: "REVER",
            rotulo: "Não prosseguir neste momento",
            tipo: "NAO_PROSSEGUIR",
            destino: "Reavaliação clínica",
            revisaoEm: "2026-01-20",
            observacao: "Conferir antes de outro preparo",
            valorServico: "999.00",
          },
        ],
      },
    },
  ]);
  const r = await consultarResultadosProtocolo(
    { participacaoId: "participacao" },
    1,
    consultaResultadosSchema.parse({}),
  );
  const linha = r.itens[0];
  const conduta = {
    codigo: "REVER",
    rotulo: "Não prosseguir neste momento",
    tipo: "NAO_PROSSEGUIR",
    destino: "Reavaliação clínica",
    revisaoEm: "2026-01-20",
    observacao: "Conferir antes de outro preparo",
    retornoEm: null,
  };
  expect(linha).toMatchObject({
    encaminhamento: "AGUARDAR",
    retornoEm: "2026-01-15",
    condutasContextuais: [conduta],
    primeiroDg: { id: "dg-original", resultado: "POSITIVO" },
  });
  expect(linha.tentativas[0].posteriores).toEqual([
    expect.objectContaining({
      id: "avaliacao-posterior",
      condutasContextuais: [conduta],
    }),
  ]);
  expect(r.resumo).toMatchObject({ positivos: 1, negativos: 0, examinados: 1 });
  expect(JSON.stringify(r)).not.toContain("999.00");
  expect(m.exames).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ propriedadeId: 1 }),
      select: expect.objectContaining({
        interpretacao: expect.objectContaining({
          select: expect.objectContaining({ condutasContextuais: true }),
        }),
      }),
    }),
  );
});

it("dispensa administrativa não oferece diagnóstico nem fabrica conclusão", async () => {
 const p = participante();
 p.tentativasExternas = [];
 m.participantes.mockResolvedValue([{...p, tentativasExternas:[{id:"v",snapshot:{animalId:"animal",data:"2026-01-01",tipo:"IA"},tentativa:tentativa(),revogadoEm:null}]}]);
 m.demandas.mockResolvedValue([{id:"demanda",tentativaId:"tentativa",finalidade:"DIAGNOSTICO",estado:"PENDENTE",previstaPara:data,regraSnapshot:{},tarefa:null,decisaoOperacional:{id:"decisao",tipo:"DISPENSAR",data:null,destino:null,motivo:"Decisão administrativa"}}]);
 const r = await consultarResultadosProtocolo({participacaoId:"participacao"},1,consultaResultadosSchema.parse({}));
 expect(r.itens[0].tentativas).toHaveLength(1);
 expect(r.itens[0].demandaDiagnostico).toBeNull();
 expect(r.itens[0].primeiroDg).toBeNull();
});
