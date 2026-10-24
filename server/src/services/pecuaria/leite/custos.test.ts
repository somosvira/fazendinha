import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { carregarFontesCustoTx } from "../custos/custos.js";
import { consultarCustosLeiteTx } from "./custos.js";
import { consultarPopulacaoPeriodoLeiteTx } from "./populacao-periodo.js";
import { linhasProducaoGeralTx } from "./producao-geral-consulta.js";
import { consultaCustosLeiteSchema } from "./custos.schemas.js";

vi.mock("../../../db.js", () => ({
  prisma: {
    diaProducaoLeite: { findMany: vi.fn() },
    medicaoLeite: { count: vi.fn() },
    animal: { findMany: vi.fn(async () => []) }, lactacaoAnimal: { findMany: vi.fn(async () => []) },
    baixaAnimal: { findMany: vi.fn(async () => []) },
    finalidadeAnimal: { findMany: vi.fn(async () => [{ id: "finalidade", animalId, aptidao: "LEITE", desde: new Date("2020-01-01"), ate: null }]) },
  },
}));
vi.mock("./populacao-periodo.js", () => ({ consultarPopulacaoPeriodoLeiteTx: vi.fn(async (_tx, _id, inicio: string, fim: string) => {
  const dias = []; for (let t=Date.parse(inicio);t<=Date.parse(fim);t+=86400000) dias.push({data:new Date(t).toISOString().slice(0,10),estado:"ELEGIVEIS",elegiveis:[],pendentes:[],potenciais:[]}); return dias;
}) }));
vi.mock("./producao-geral-consulta.js", () => ({ linhasProducaoGeralTx: vi.fn(async () => []) }));
vi.mock("../custos/custos.js", () => ({ carregarFontesCustoTx: vi.fn() }));
const animalId = "00000000-0000-4000-8000-000000000001";
const periodo = { inicio: "2026-10-01", fim: "2026-10-01" };
const resumo = {
  litros: 600,
  esperadas: 1,
  medidas: 1,
  naoOrdenhadas: 0,
  pendentes: 0,
  resolvidas: 1,
  completa: true,
};
function dia(data = periodo.inicio) {
  return {
    id: "dia",
    propriedadeId: 3,
    dataOperacional: new Date(data),
    configuracaoId: "config",
    versao: 1,
    criadoEm: new Date(),
    criadoPorId: null,
    atualizadoEm: new Date(),
    configuracao: {
      id: "config",
      propriedadeId: 3,
      vigenteDesde: new Date("2026-10-01"),
      ordenhas: [
        { posicaoId: "manha", nome: "Manhã", ordem: 1, horario: null },
      ],
    },
    sessoes: [{ id: "sessao", posicaoId: "manha", ordem: 1, versao: 1 }],
    participantes: [
      {
        id: "participante", finalidadeId: "finalidade", finalidadeSnapshot: { finalidadeId: "finalidade", aptidao: "LEITE", regra: "FINALIDADE_LEITE_V1", dataOperacional: data, desde: "2020-01-01", ate: null },
        animalId,
        brinco: "123",
        nome: "Aurora",
        lactacaoId: "lactacao",
        localizacaoId: "local",
        pendencias: [],
        excluidoEm: null,
        motivoExclusao: null,
        medicoes: [
          {
            id: "medicao",
            sessaoId: "sessao",
            estado: "MEDIDO",
            litros: new Prisma.Decimal(600),
            motivo: null,
            versao: 1,
          },
        ],
      },
    ],
  };
}

describe("consulta do custo por litro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.medicaoLeite.count).mockResolvedValue(1);
    vi.mocked(prisma.diaProducaoLeite.findMany).mockResolvedValue([dia()]);
    vi.mocked(carregarFontesCustoTx).mockResolvedValue([
      {
        id: "nutricao",
        tipo: "NUTRICAO",
        animalId,
        propriedadeId: 3,
        data: periodo.inicio,
        descricao: "Alimentação",
        estadoFato: "CONFIRMADO",
        participacaoId: null,
        origemMaterial: "ESTOQUE",
        movimentoEstoqueId: "movimento",
        operacaoServicoId: null,
        valorMaterial: new Prisma.Decimal(900),
        valorServico: null,
        classificacao: null,
        componenteId: "alimento",
        periodoConsumo: periodo,
      },
    ]);
  });
  it("usa população das folhas autorizadas e os componentes originais em uma carga", async () => {
    const r = await consultarCustosLeiteTx(prisma, 3, periodo, true);
    expect(carregarFontesCustoTx).toHaveBeenCalledWith(prisma, 3, {
      animalIds: [animalId],
    });
    expect(r.consolidado.custoPorLitro).toBe("1.50");
    expect(r.coberturaPeriodo.completa).toBe(true);
    expect(prisma.diaProducaoLeite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ propriedadeId: 3 }),
      }),
    );
  });
  it("não divide o custo do período apenas pelos dias que têm folha", async () => {
    const r = await consultarCustosLeiteTx(
      prisma,
      3,
      { inicio: "2026-10-01", fim: "2026-10-02" },
      true,
    );
    expect(r.coberturaPeriodo.diasSemFolha).toEqual(["2026-10-02"]);
    expect(r.ritmo).toEqual([
      {
        data: "2026-10-01",
        litros: 600,
        estado: "COMPLETA",
        esperadas: 1,
        resolvidas: 1,
        pendentes: 0,
      },
      {
        data: "2026-10-02",
        litros: null,
        estado: "SEM_FOLHA",
        esperadas: null,
        resolvidas: null,
        pendentes: null,
      },
    ]);
    expect(r.consolidado.custoPorLitro).toBeNull();
    expect(r.animais[0].custoPorLitro).toBeNull();
    expect(r.consolidado.motivos).toContain("DIAS_SEM_FOLHA");
  });
  it("mascara todos os componentes e o indicador sem visibilidade financeira", async () => {
    const r = await consultarCustosLeiteTx(prisma, 3, periodo, false);
    expect(r.consolidado.situacao).toBe("OCULTO");
    expect(r.consolidado.custos.totalConhecido).toBeNull();
    expect(r.consolidado.custoPorLitro).toBeNull();
    expect(
      r.animais[0].custos.componentes.every(
        (c) => c.valor === null && c.origemId === null,
      ),
    ).toBe(true);
  });
  it("recusa animal de fora das folhas do sítio e não carrega seus custos", async () => {
    await expect(
      consultarCustosLeiteTx(
        prisma,
        3,
        { ...periodo, animalId: "00000000-0000-4000-8000-000000000002" },
        true,
      ),
    ).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect(carregarFontesCustoTx).not.toHaveBeenCalled();
  });
  it("não consulta custos de outro animal quando não há produção conhecida", async () => {
    vi.mocked(prisma.diaProducaoLeite.findMany).mockResolvedValue([]);
    const r = await consultarCustosLeiteTx(prisma, 3, periodo, true);
    expect(carregarFontesCustoTx).not.toHaveBeenCalled();
    expect(r.animais).toEqual([]);
    expect(r.consolidado.custoPorLitro).toBeNull();
  });
  it("limita o recorte e rejeita datas inválidas", () => {
    expect(
      consultaCustosLeiteSchema.safeParse({
        inicio: "2026-02-30",
        fim: "2026-10-01",
      }).success,
    ).toBe(false);
    expect(
      consultaCustosLeiteSchema.safeParse({
        inicio: "2025-01-01",
        fim: "2026-10-01",
      }).success,
    ).toBe(false);
  });
  it("recusa volume excessivo antes de carregar folhas e custos", async () => {
    vi.mocked(prisma.medicaoLeite.count).mockResolvedValue(50_001);
    await expect(
      consultarCustosLeiteTx(prisma, 3, periodo, true),
    ).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(prisma.diaProducaoLeite.findMany).not.toHaveBeenCalled();
    expect(carregarFontesCustoTx).not.toHaveBeenCalled();
  });
});

it.each(["pendentes", "potenciais"] as const)("não apura custo/L geral se há animais %s apesar de tanque completo", async (pendencia) => {
  vi.mocked(prisma.medicaoLeite.count).mockResolvedValue(1);
  const folha = dia();
  vi.mocked(prisma.diaProducaoLeite.findMany).mockResolvedValue([{ ...folha, configuracao: { ...folha.configuracao, fonteProducao: "GERAL" } }] as never);
  vi.mocked(consultarPopulacaoPeriodoLeiteTx).mockResolvedValueOnce([{ data: periodo.inicio, estado: "ELEGIVEIS", elegiveis: [animalId], pendentes: [], potenciais: [], [pendencia]: ["animal-incerto"] }]);
  vi.mocked(linhasProducaoGeralTx).mockResolvedValueOnce([{ animaisOrigem: [animalId], fonte: "GERAL", tanqueId: "tanque", data: periodo.inicio, animalId: null, brinco: "Tanque", nome: "Tanque", finalidade: null, posicaoId: "manha", ordenha: "Manhã", natureza: "COMERCIAL", estado: "MEDIDO", litros: 1000, confirmada: false }]);
  vi.mocked(carregarFontesCustoTx).mockResolvedValue([]);
  const r = await consultarCustosLeiteTx(prisma, 3, periodo, true);
  expect(r.consolidado.producao.litros).toBe(1000);
  expect(r.consolidado.custoPorLitro).toBeNull();
  expect(r.consolidado.motivos).toContain("POPULACAO_GERAL_NAO_CONCILIADA");
});
