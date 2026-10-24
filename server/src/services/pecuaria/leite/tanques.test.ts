import { Prisma } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({
  tx: {} as Prisma.TransactionClient,
  config: vi.fn(),
  origens: vi.fn(),
  folha: vi.fn(),
  automaticas: vi.fn(),
}));
vi.mock("../../../db.js", () => ({ prisma: { $transaction: (fn: (tx: Prisma.TransactionClient) => unknown) => fn(f.tx) } }));
vi.mock("../transacao.js", () => ({
  transacaoPecuaria: (fn: (tx: Prisma.TransactionClient) => unknown) =>
    fn(f.tx),
}));
vi.mock("../reproducao/operacoes.js", () => ({
  operacaoIdempotenteTx: (
    _tx: unknown,
    _input: unknown,
    _user: unknown,
    _op: unknown,
    fn: () => unknown,
  ) => fn(),
}));
vi.mock("../rebanho/regras.js", async (original) => ({
  ...(await original<typeof import("../rebanho/regras.js")>()),
  auditar: vi.fn(),
  travarAnimais: vi.fn(),
  hojeFazendaDate: () => new Date("2026-10-23"),
}));
vi.mock("./configuracoes.js", () => ({
  conferirSitioLeiteTx: vi.fn(),
  travarRotinaLeiteTx: vi.fn(),
  garantirConfiguracaoLeiteTx: f.config,
}));
vi.mock("./producao.js", () => ({
  conferirAnimaisOrigemGeralTx: f.origens,
  consultarFolha: f.folha,
  consultarOrigensAutomaticasGeraisTx: f.automaticas,
}));
import { travarAnimais } from "../rebanho/regras.js";
import { salvarMedicaoGeral, consultarOrdenhasGerais } from "./tanques.js";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tanque = {
  id: id(1),
  propriedadeId: 1,
  identidadeId: id(2),
  versao: 1,
  nome: "Tanque",
  fabricante: null,
  modelo: null,
  numeroSerie: null,
  capacidadeLitros: new Prisma.Decimal(3000),
  vigenteDesde: new Date("2026-10-01"),
  ativo: true,
  tabelaConversao: [{ mm: 0, litros: 22.5 }],
  referenciaTabela: "Fabricante",
};
const input = {
  chave: id(3),
  propriedadeId: 1,
  dataOperacional: "2026-10-20",
  posicaoId: id(4),
  tanqueId: id(1),
  versaoEsperada: 0,
  litros: 22.5,
  reguaMm: 0,
  natureza: "NAO_COMERCIAL" as const,
  animaisOrigem: [],
  responsavel: "Equipe da ordenha",
};
function banco() {
  return {
    tanqueLeite: { findMany: vi.fn(async () => [tanque]) },
    diaProducaoLeite: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async () => ({
        id: id(5),
        configuracao: { fonteProducao: "GERAL" },
      })),
    },
    sessaoOrdenha: { findUnique: vi.fn(async () => ({ id: id(6) })) },
    medicaoGeralLeite: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...data,
        id: id(7),
        tanque,
        entradasEstoque: [],
        versao: 1,
      })),
    },
    participanteProducaoLeite: { create: vi.fn() },
    medicaoLeite: { create: vi.fn() },
    $queryRaw: vi.fn(),
  };
}
let tx: ReturnType<typeof banco>;
beforeEach(() => {
  vi.clearAllMocks();
  tx = banco();
  f.tx = tx as unknown as Prisma.TransactionClient;
  f.config.mockResolvedValue({
    id: id(8),
    fonteProducao: "GERAL",
    ordenhas: [{ posicaoId: id(4), nome: "Manhã", ordem: 1, horario: null }],
  });
});
it("registra volume só da ordenha sem criar litros ou participantes individuais", async () => {
  const r = await salvarMedicaoGeral(input, 9);
  expect(r).toMatchObject({
    litros: 22.5,
    reguaMm: 0,
    origemLitros: "TABELA_TANQUE",
    versao: 1,
  });
  expect(tx.participanteProducaoLeite.create).not.toHaveBeenCalled();
  expect(tx.medicaoLeite.create).not.toHaveBeenCalled();
  expect(tx.diaProducaoLeite.create).toHaveBeenCalledTimes(1);
});
it("recusa conflito de versão e correção de aferição já confirmada", async () => {
  tx.medicaoGeralLeite.findUnique.mockResolvedValue({
    versao: 2,
    entradasEstoque: [],
  });
  await expect(salvarMedicaoGeral(input, 9)).rejects.toMatchObject({
    code: "CONFLITO",
  });
  tx.medicaoGeralLeite.findUnique.mockResolvedValue({
    versao: 1,
    entradasEstoque: [{ id: "entrada" }],
  });
  await expect(
    salvarMedicaoGeral(
      { ...input, versaoEsperada: 1, motivoCorrecao: "Conferência" },
      9,
    ),
  ).rejects.toMatchObject({ code: "CONFLITO" });
  expect(tx.medicaoGeralLeite.create).not.toHaveBeenCalled();
  expect(tx.medicaoGeralLeite.update).not.toHaveBeenCalled();
});
it("recusa tanque de outra vigência/sítio, fonte individual e data futura", async () => {
  await expect(
    salvarMedicaoGeral({ ...input, tanqueId: id(99) }, 9),
  ).rejects.toMatchObject({ code: "VALIDACAO" });
  f.config.mockResolvedValue({ fonteProducao: "INDIVIDUAL" });
  await expect(salvarMedicaoGeral(input, 9)).rejects.toMatchObject({
    code: "CONFLITO",
  });
  await expect(
    salvarMedicaoGeral({ ...input, dataOperacional: "2026-10-24" }, 9),
  ).rejects.toMatchObject({ code: "VALIDACAO" });
  expect(tx.medicaoGeralLeite.create).not.toHaveBeenCalled();
});

it("correção trava animais anteriores e novos antes da sessão e rejeita referência obsoleta", async () => {
  tx.medicaoGeralLeite.findFirst.mockResolvedValue({ id: id(7), animaisOrigem: [id(40)] });
  tx.medicaoGeralLeite.findUnique.mockResolvedValue({ id: id(7), animaisOrigem: [id(50)], versao: 1, entradasEstoque: [] });
  await expect(salvarMedicaoGeral({ ...input, animaisOrigem: [id(60)], versaoEsperada: 1, motivoCorrecao: "Origem conferida" }, 9)).rejects.toMatchObject({ code: "CONFLITO" });
  expect(travarAnimais).toHaveBeenCalledWith(tx, [id(40), id(60)]);
  expect(vi.mocked(travarAnimais).mock.invocationCallOrder[0]).toBeLessThan(tx.$queryRaw.mock.invocationCallOrder[0]);
  expect(tx.medicaoGeralLeite.update).not.toHaveBeenCalled();
});

it("expõe a pré-seleção na data sem substituí-la pela população antiga do controle individual", async () => {
  f.folha.mockResolvedValue({ configuracao: {}, sessoes: [], animais: [{ animalId: id(30), brinco: "Antiga", nome: null }] });
  const origens = [{ animalId: id(31), brinco: "103", nome: "Aurora", del: 12 }];
  f.automaticas.mockResolvedValue(origens);
  const resultado = await consultarOrdenhasGerais(1, "2026-10-20");
  expect(f.automaticas).toHaveBeenCalledWith(tx, 1, new Date("2026-10-20T00:00:00Z"));
  expect(resultado.origensAutomaticas).toEqual(origens);
  expect(resultado.animais[0].animalId).toBe(id(30));
});
