import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const mocks = vi.hoisted(() => ({
  tx: {
    mesNutricao: {
      findFirst: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    consumoDiario: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    requisicaoPecuaria: { findUnique: vi.fn(), create: vi.fn() },
    localizacaoAnimal: { findMany: vi.fn() },
    lote: { findFirst: vi.fn() },
    vigenciaDietaLote: { findFirst: vi.fn() },
    itemConsumoDiario: {
      update: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    configuracaoNutricao: { findMany: vi.fn() },
    participacaoConsumoDiario: { deleteMany: vi.fn(), createMany: vi.fn() },
    classificacaoCustoPecuaria: { findMany: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
  },
  leite: vi.fn(),
  ajustar: vi.fn(),
  auditar: vi.fn(),
  periodo: vi.fn(),
}));
vi.mock("../leite/nutricao.js", () => ({ ingredienteLeiteProducaoTx: mocks.leite }));
vi.mock("../../../db.js", () => ({ prisma: mocks.tx }));
vi.mock("../transacao.js", () => ({
  transacaoPecuaria: (f: (tx: unknown) => unknown) => f(mocks.tx),
}));
vi.mock("./mensal.estoque.js", () => ({ ajustarItemTx: mocks.ajustar }));
vi.mock("../../financeiro/regras.js", () => ({
  exigirPeriodoAberto: mocks.periodo,
}));
vi.mock("../rebanho/regras.js", async (original) => ({
  ...(await original<object>()),
  hojeFazendaDate: () => new Date("2026-11-02T00:00:00Z"),
  auditar: mocks.auditar,
}));
import {
  confirmarMes,
  reconciliarMes,
  consultarMeses,
  configuracaoEfetiva,
  resumoMes,
  type MesCompleto,
} from "./mensal.js";
import { createHash } from "node:crypto";
const D = (v: string) => new Prisma.Decimal(v);
function mes(modelo = "AUTOMATICO") {
  const base = {
    dietaId: "dieta",
    dietaNome: "Receita v1",
    centroCustoId: "centro",
    participacoes: [{ animalId: "animal", dias: 1 }],
    itens: [
      {
        produtoId: "produto",
        nome: "Milho",
        unidade: "KG",
        prevista: "10.000",
      },
    ],
    pendencia: null,
  };
  const baseHash = createHash("sha256")
    .update(JSON.stringify(base))
    .digest("hex");
  return {
    id: "mes",
    loteId: "lote",
    lote: { nome: "Lote" },
    propriedadeId: 1,
    competencia: new Date("2026-10-01"),
    inicio: new Date("2026-10-31"),
    configuracaoId: "cfg",
    revisao: 2,
    revisadoEm: null,
    revisadoPorId: null,
    configuracao: {
      id: "cfg",
      modelo,
      diaConferencia: 1,
      autorizaValidade: false,
    },
    dias: [
      {
        id: "dia",
        mesId: "mes",
        data: new Date("2026-10-31"),
        baseHash,
        pendencia: null,
        situacao: modelo === "PROVISORIO" ? "PREVISTO" : "EFETIVADO",
        dietaNome: "Receita v1",
        participantes: [
          { id: "participacao", animalId: "animal", animal: { brinco: "A" } },
        ],
        itens: [
          {
            id: "item",
            diaId: "dia",
            produtoId: "produto",
            nome: "Milho",
            unidade: "KG",
            prevista: D("10"),
            confirmada: D(modelo === "PROVISORIO" ? "0" : "10"),
            custoLiquido: D("20"),
            origemQuantidade: "CALCULADA",
            produto: { rastrearPartidas: false },
            movimentos: [],
          },
        ],
      },
    ],
  } as unknown as MesCompleto;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.tx.mesNutricao.findFirst.mockResolvedValue(mes());
  mocks.tx.lote.findFirst.mockResolvedValue({
    id: "lote",
    centroCustoId: "centro",
  });
  mocks.tx.localizacaoAnimal.findMany.mockResolvedValue([
    { animalId: "animal", desde: new Date("2026-10-01"), ate: null },
  ]);
  mocks.tx.vigenciaDietaLote.findFirst.mockResolvedValue({
    dietaId: "dieta",
    dieta: {
      nome: "Receita",
      versao: 1,
      publicadaEm: new Date(),
      itens: [
        {
          produtoId: "produto",
          unidade: "KG",
          quantidadeCabecaDia: D("10"),
          produto: { nome: "Milho", unidade: "KG" },
        },
      ],
    },
  });
});
const pedido = (quantidade = "10") => ({
  chave: "chave",
  revisao: 2,
  motivo: "",
  itens: [{ produtoId: "produto", quantidade }],
});
describe("confirmação mensal", () => {
  it("bloqueia baixa convencional quando o ingrediente passa a ter origem leiteira V5", async () => {
    const vigencia = await mocks.tx.vigenciaDietaLote.findFirst();
    vigencia.dieta.itens[0].unidade = "L";
    vigencia.dieta.itens[0].produto.unidade = "L";
    mocks.leite.mockResolvedValue(true);
    await expect(confirmarMes("mes", 1, 1, pedido())).rejects.toThrow();
    expect(mocks.leite).toHaveBeenCalledWith(mocks.tx, "produto", 1);
    expect(mocks.ajustar).not.toHaveBeenCalled();
  });
  it("recusa revisão obsoleta antes de movimentar estoque", async () => {
    await expect(
      confirmarMes("mes", 1, 1, { ...pedido(), revisao: 1 }),
    ).rejects.toThrow("mudou");
    expect(mocks.ajustar).not.toHaveBeenCalled();
  });
  it("recusa divergência sem justificativa", async () => {
    await expect(confirmarMes("mes", 1, 1, pedido("8"))).rejects.toThrow(
      "Justifique",
    );
    expect(mocks.ajustar).not.toHaveBeenCalled();
  });
  it("confere total por ingrediente e conserva alvo já debitado", async () => {
    await confirmarMes("mes", 1, 1, pedido());
    expect(mocks.ajustar).toHaveBeenCalledWith(
      mocks.tx,
      "item",
      D("10"),
      1,
      "Revisão mensal sem alteração",
      undefined,
    );
    expect(mocks.tx.mesNutricao.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revisadoPorId: 1 }),
      }),
    );
  });
  it("confirma provisório somente no mês e repete chave sem executar outra vez", async () => {
    mocks.tx.mesNutricao.findFirst.mockResolvedValue(mes("PROVISORIO"));
    await confirmarMes("mes", 1, 1, pedido());
    const escrita = mocks.tx.requisicaoPecuaria.create.mock.calls[0][0].data;
    mocks.tx.requisicaoPecuaria.findUnique.mockResolvedValue(escrita);
    mocks.ajustar.mockClear();
    expect(await confirmarMes("mes", 1, 1, pedido())).toEqual({ id: "mes" });
    expect(mocks.ajustar).not.toHaveBeenCalled();
    await expect(confirmarMes("mes", 1, 1, pedido("9"))).rejects.toThrow(
      "Chave",
    );
  });
  it("sinaliza atraso e mascara valores monetários", () => {
    const r = resumoMes(mes(), false);
    expect(r.situacao).toBe("ATRASADO");
    expect(r.itens[0].custo).toBeNull();
    expect(r.itens[0].confirmada).toBe("10.000");
  });
  it("prioriza exceção vigente sem antecipar mudança futura", () => {
    const cs = [
      { loteId: null, desde: new Date("2026-09-01"), modelo: "AUTOMATICO" },
      { loteId: "lote", desde: new Date("2026-10-01"), modelo: "MANUAL" },
      { loteId: "lote", desde: new Date("2026-12-01"), modelo: "PROVISORIO" },
    ] as Parameters<typeof configuracaoEfetiva>[0];
    expect(
      configuracaoEfetiva(cs, "lote", new Date("2026-11-01"))?.modelo,
    ).toBe("MANUAL");
    expect(
      configuracaoEfetiva(cs, "outro", new Date("2026-11-01"))?.modelo,
    ).toBe("AUTOMATICO");
  });
});

it("reconcilia nova composição antes da confirmação, sem movimentar estoque", async () => {
  const anterior = mes();
  anterior.dias[0].itens[0].movimentos.push({ id: "mov" } as never);
  mocks.tx.mesNutricao.findFirst.mockResolvedValue(anterior);
  mocks.tx.mesNutricao.upsert.mockResolvedValue(anterior);
  mocks.tx.consumoDiario.findUnique.mockResolvedValue(anterior.dias[0]);
  mocks.tx.consumoDiario.update.mockResolvedValue(anterior.dias[0]);
  mocks.tx.configuracaoNutricao.findMany.mockResolvedValue([
    { id: "cfg", loteId: null, desde: new Date("2026-10-31") },
  ]);
  mocks.tx.vigenciaDietaLote.findFirst.mockResolvedValue({
    dietaId: "nova",
    dieta: {
      nome: "Nova receita",
      versao: 1,
      publicadaEm: new Date(),
      itens: [
        {
          produtoId: "novo",
          unidade: "KG",
          quantidadeCabecaDia: D("2"),
          produto: { nome: "Farelo", unidade: "KG" },
        },
      ],
    },
  });
  await expect(confirmarMes("mes", 1, 1, pedido())).rejects.toThrow(
    "base histórica mudou",
  );
  await reconciliarMes("mes", 1, 1, {
    chave: "reconciliar",
    revisao: 2,
    motivo: "Correção de dieta histórica",
  });
  expect(mocks.tx.itemConsumoDiario.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      create: expect.objectContaining({ produtoId: "novo", prevista: "2.000" }),
    }),
  );
  expect(mocks.ajustar).not.toHaveBeenCalled();
  expect(mocks.auditar).toHaveBeenCalledWith(
    mocks.tx,
    expect.objectContaining({ acao: "RECONCILIACAO_HISTORICA", usuarioId: 1 }),
  );
});
it("o filtro de alerta mensal espera o dia configurado e inclui falhas operacionais", async () => {
  mocks.tx.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn(mocks.tx),
  );
  mocks.tx.mesNutricao.findMany.mockResolvedValue([]);
  mocks.tx.mesNutricao.count.mockResolvedValue(0);
  await consultarMeses(1, undefined, undefined, 1, true);
  expect(mocks.tx.mesNutricao.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        propriedadeId: 1,
        revisadoEm: null,
        OR: [
          { competencia: { lt: new Date("2026-10-01") } },
          {
            competencia: new Date("2026-10-01"),
            configuracao: { diaConferencia: { lte: 2 } },
          },
          { dias: { some: { pendencia: { not: null } } } },
        ],
      }),
    }),
  );
});

import { apresentarConsumoDiario } from "./mensal.animal.js";
it("preserva versão documental da dieta e mascara custo individual", () => {
  const m = mes();
  const diario = {
    ...m.dias[0],
    mes: { ...m, lote: { ...m.lote, id: m.loteId } },
    dietaNome: "Receita v7",
  } satisfies Parameters<typeof apresentarConsumoDiario>[0];
  const dto = apresentarConsumoDiario(diario, "animal", false);
  expect(dto.dieta.versao).toBe(7);
  expect(dto.custoConhecido).toBeNull();
  expect(dto.itens[0].custoConhecido).toBeNull();
  expect(dto.origem).toBe("DIARIO");
});
