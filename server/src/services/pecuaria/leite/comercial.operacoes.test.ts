import { Prisma } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  plano: vi.fn(),
  baixa: vi.fn(),
  financeiro: vi.fn(),
  periodo: vi.fn(),
  trava: vi.fn(),
  previa: vi.fn(),
  auditar: vi.fn(),
}));
vi.mock("../../../db.js", () => ({ prisma: {} }));
vi.mock("../../estoque/leite.js", () => ({
  METODO_LEITE: "LEITE_FIFO_V1",
  planejarBaixaLeiteTx: m.plano,
  registrarBaixaLeiteTx: m.baixa,
}));
vi.mock("../../estoque/valorizacao.js", () => ({
  travarValorizacaoTx: m.trava,
  previaRetroatividadeTx: m.previa,
}));
vi.mock("../../financeiro/operacoes.js", () => ({
  criarFechamentoPeriodoLeiteTx: m.financeiro,
}));
vi.mock("../../financeiro/regras.js", async (o) => ({
  ...(await o<typeof import("../../financeiro/regras.js")>()),
  exigirPeriodoAberto: m.periodo,
  exigirParceiroAtivo: vi.fn(),
}));
vi.mock("../rebanho/regras.js", async (o) => ({
  ...(await o<typeof import("../rebanho/regras.js")>()),
  auditar: m.auditar,
}));
import {
  abrirOperacaoLeiteTx,
  retirarOperacaoLeiteTx,
  fecharOperacaoLeiteTx,
  operacaoLeiteDTO,
} from "./comercial.operacoes.js";
const id = (n: number) =>
    `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  D = (v: number) => new Prisma.Decimal(v),
  ctx = { propriedadeId: 7, usuarioId: 9 };
function banco() {
  const movimento = (n: number, q: number) => ({
    id: id(n),
    produtoId: id(2),
    quantidade: D(q),
    data: new Date("2026-10-19"),
    status: "CONFIRMADO",
    reversaoDeId: null,
  });
  const retirada = (n: number, q: number) => ({
    id: id(n),
    movimentoId: id(n + 10),
    movimento: movimento(n + 10, q),
    referencia: `Coleta ${n}`,
    comprovantes: [],
    pontoColeta: null,
    horarioColeta: null,
  });
  const o = {
    id: id(1),
    propriedadeId: 7,
    parceiroId: id(3),
    parceiro: { nome: "Laticínio" },
    inicio: new Date("2026-10-01"),
    fim: new Date("2026-10-19"),
    referencia: "Mês de outubro",
    status: "ABERTA",
    versao: 3,
    retiradas: [retirada(4, 100), retirada(5, 150)],
    fechamentos: [] as Record<string, unknown>[],
  };
  const requests = new Map<string, Record<string, unknown>>();
  const financeiro = {
    id: id(30),
    status: "CONFIRMADA",
    data: new Date("2026-10-19"),
    transacoes: [] as { status: string; tipo: string }[],
    compromissos: [] as { liquidacoes: { transacao: { status: string } }[] }[],
  };
  const tx = {
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(async () => [{ id: o.id }]),
    requisicaoPecuaria: {
      findUnique: vi.fn(
        async ({ where }: { where: { chave: string } }) =>
          requests.get(where.chave) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        requests.set(data.chave as string, data);
        return data;
      }),
    },
    operacaoComercialLeite: {
      findFirst: vi.fn(async () => o),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: id(1),
        versao: 1,
        ...data,
      })),
      update: vi.fn(async () => ({ versao: o.versao + 1 })),
    },
    produto: {
      findFirst: vi.fn(async () => ({
        unidade: "L",
        rastrearPartidas: false,
        ativo: true,
      })),
    },
    movimentoEstoque: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: id(40),
        ...data,
      })),
    },
    retiradaOperacaoLeite: { create: vi.fn(async () => ({ id: id(41) })) },
    fechamentoOperacaoLeite: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: id(42),
        ...data,
      })),
    },
    operacao: {
      findUniqueOrThrow: vi.fn(async () => financeiro),
      update: vi.fn(),
    },
    compromissoFinanceiro: { updateMany: vi.fn() },
    transacaoFinanceira: { create: vi.fn() },
  };
  return { o, tx, financeiro, db: tx as unknown as Prisma.TransactionClient };
}
const fechar = () => ({
  chave: id(50),
  versaoEsperada: 3,
  data: "2026-10-19",
  precoUnitario: 2.5,
  ajuste: 0,
  motivo: "Preço negociado por litro",
  centroCustoId: id(9),
  financeiro: {
    condicao: "A_PRAZO" as const,
    parcelas: [{ valor: 625, dataVencimento: new Date("2026-10-30") }],
  },
  retiradas: [
    { retiradaId: id(4), quantidadeReconhecida: 100 },
    { retiradaId: id(5), quantidadeReconhecida: 150 },
  ],
});
beforeEach(() => {
  vi.clearAllMocks();
  m.previa.mockResolvedValue({ permitido: true });
  m.plano.mockResolvedValue({
    quantidade: D(100),
    valorTotal: null,
    finalidade: "VENDA",
    parcelas: [],
  });
  m.financeiro.mockResolvedValue({ id: id(30) });
});
it("abre identidade com preço desconhecido sem criar financeiro ou estoque; retry preserva identidade", async () => {
  const b = banco(),
    input = {
      chave: id(60),
      parceiroId: id(3),
      inicio: "2026-10-01",
      fim: "2026-10-19",
      referencia: "Período de outubro",
    };
  const a = await abrirOperacaoLeiteTx(b.db, input, ctx),
    r = await abrirOperacaoLeiteTx(b.db, input, ctx);
  expect(r).toEqual(a);
  expect(b.tx.operacaoComercialLeite.create).toHaveBeenCalledTimes(1);
  expect(m.financeiro).not.toHaveBeenCalled();
  expect(b.tx.movimentoEstoque.create).not.toHaveBeenCalled();
  await expect(
    abrirOperacaoLeiteTx(b.db, { ...input, referencia: "Outro período" }, ctx),
  ).rejects.toThrow(/Chave/);
});
it("retirada sem preço baixa uma vez com custo pendente; reenvio não duplica litros", async () => {
  const b = banco(),
    input = {
      chave: id(61),
      versaoEsperada: 3,
      produtoId: id(2),
      data: "2026-10-19",
      quantidadeLitros: 100,
      referencia: "Coleta do caminhão",
    };
  await retirarOperacaoLeiteTx(b.db, id(1), input, ctx);
  await retirarOperacaoLeiteTx(b.db, id(1), input, ctx);
  expect(b.tx.movimentoEstoque.create).toHaveBeenCalledTimes(1);
  expect(b.tx.movimentoEstoque.create.mock.calls[0][0]).toMatchObject({
    data: {
      origem: "RETIRADA_LEITE",
      tipo: "SAIDA",
      valorTotal: null,
      custoUnitario: null,
    },
  });
  expect(m.baixa).toHaveBeenCalledTimes(1);
  expect(m.financeiro).not.toHaveBeenCalled();
  expect(b.tx.transacaoFinanceira.create).not.toHaveBeenCalled();
});
it("retirada recusa período incorreto, concorrência de versão e operação fechada antes da baixa", async () => {
  const b = banco(),
    input = {
      chave: id(62),
      versaoEsperada: 3,
      produtoId: id(2),
      data: "2026-09-30",
      quantidadeLitros: 100,
      referencia: "Coleta comprovada",
    };
  await expect(retirarOperacaoLeiteTx(b.db, id(1), input, ctx)).rejects.toThrow(
    /período/,
  );
  await expect(
    retirarOperacaoLeiteTx(
      b.db,
      id(1),
      { ...input, data: "2026-10-19", versaoEsperada: 2 },
      ctx,
    ),
  ).rejects.toThrow(/mudou/);
  b.o.status = "FECHADA";
  await expect(
    retirarOperacaoLeiteTx(b.db, id(1), { ...input, data: "2026-10-19" }, ctx),
  ).rejects.toThrow(/fechada/);
  expect(b.tx.movimentoEstoque.create).not.toHaveBeenCalled();
});
it("fecha duas retiradas em operação única 250L/R$625 pelo executor, retry sem baixa ou obrigação duplicada", async () => {
  const b = banco();
  const r = await fecharOperacaoLeiteTx(b.db, id(1), fechar(), ctx);
  expect(await fecharOperacaoLeiteTx(b.db, id(1), fechar(), ctx)).toEqual(r);
  expect(m.financeiro).toHaveBeenCalledTimes(1);
  expect(m.financeiro).toHaveBeenCalledWith(
    b.db,
    expect.objectContaining({
      tipo: "VENDA",
      propriedadeId: 7,
      itens: [
        expect.objectContaining({
          quantidade: 250,
          valorTotal: 625,
          estocavel: false,
        }),
      ],
    }),
    id(1),
  );
  expect(b.tx.fechamentoOperacaoLeite.create.mock.calls[0][0]).toMatchObject({
    data: {
      volumeReconhecido: D(250),
      precoUnitario: 2.5,
      detalhes: {
        create: expect.arrayContaining([
          { retiradaId: id(4), quantidadeReconhecida: 100 },
          { retiradaId: id(5), quantidadeReconhecida: 150 },
        ]),
      },
    },
  });
  expect(b.tx.movimentoEstoque.create).not.toHaveBeenCalled();
  expect(m.baixa).not.toHaveBeenCalled();
});
it("versão e lista integral impedem fechar ignorando retirada concorrente", async () => {
  const b = banco();
  await expect(
    fecharOperacaoLeiteTx(b.db, id(1), { ...fechar(), versaoEsperada: 2 }, ctx),
  ).rejects.toThrow(/mudou/);
  await expect(
    fecharOperacaoLeiteTx(
      b.db,
      id(1),
      { ...fechar(), retiradas: fechar().retiradas.slice(0, 1) },
      ctx,
    ),
  ).rejects.toThrow(/todas/);
  expect(m.financeiro).not.toHaveBeenCalled();
});
it("correção preserva identidade e retiradas; recebimento/período fechado bloqueiam antes de cancelar original", async () => {
  const b = banco();
  b.o.status = "FECHADA";
  b.o.fechamentos.push({ id: id(42), versao: 1, operacaoId: id(30) });
  b.financeiro.transacoes.push({ status: "CONFIRMADA", tipo: "RECEBIMENTO" });
  await expect(
    fecharOperacaoLeiteTx(b.db, id(1), fechar(), ctx),
  ).rejects.toThrow(/recebimento ativo/);
  expect(b.tx.operacao.update).not.toHaveBeenCalled();
  b.financeiro.transacoes = [];
  m.periodo.mockRejectedValueOnce(new Error("Período fechado"));
  await expect(
    fecharOperacaoLeiteTx(b.db, id(1), fechar(), ctx),
  ).rejects.toThrow(/fechado/);
  expect(b.tx.operacao.update).not.toHaveBeenCalled();
  await fecharOperacaoLeiteTx(b.db, id(1), fechar(), ctx);
  expect(m.financeiro).toHaveBeenCalledWith(
    b.db,
    expect.objectContaining({ corrigeOperacaoId: id(30) }),
    id(1),
  );
  expect(b.tx.movimentoEstoque.create).not.toHaveBeenCalled();
  expect(b.tx.fechamentoOperacaoLeite.create.mock.calls[0][0]).toMatchObject({
    data: { versao: 2 },
  });
});
it("mascara preço, total e justificativas comerciais sem esconder litros ou comprovantes", () => {
  const b = banco();
  b.o.fechamentos.push({
    id: id(42),
    versao: 1,
    operacaoId: id(30),
    precoUnitario: D(2.5),
    volumeReconhecido: D(250),
    ajuste: D(0),
    motivoAjuste: "R$ 10 negociado",
    motivo: "R$625 negociados",
    detalhes: [
      {
        retiradaId: id(4),
        quantidadeReconhecida: D(100),
        motivoDiferenca: "Desconto R$50",
      },
    ],
    operacao: {
      numero: 10,
      data: new Date("2026-10-19"),
      status: "CONFIRMADA",
      valorTotal: D(625),
    },
  });
  const dto = operacaoLeiteDTO(b.o as never, false);
  expect(dto.retiradoLitros).toBe("250");
  expect(dto.fechamento).toMatchObject({
    precoUnitario: null,
    ajuste: null,
    valorTotal: null,
    motivo: null,
    motivoAjuste: null,
  });
  expect(JSON.stringify(dto)).not.toContain("R$");
});
