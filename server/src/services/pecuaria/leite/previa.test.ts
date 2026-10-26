import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { preverHistoricoLeiteTx } from "./previa.js";
import {
  previaHistoricaLeiteSchema,
  type PreviaHistoricaLeiteInput,
} from "./previa.schemas.js";
const m = vi.hoisted(() => ({
  propriedade: { findUnique: vi.fn() },
  animal: { findMany: vi.fn() },
  lactacaoAnimal: { findMany: vi.fn() },
  configuracaoOrdenha: { findMany: vi.fn() },
  diaProducaoLeite: { findMany: vi.fn() },
  movimentoEstoque: { count: vi.fn() },
  versaoComercialVendaLeite: { count: vi.fn() },
}));
vi.mock("../../../db.js", () => ({ prisma: m }));
const input: PreviaHistoricaLeiteInput = {
  inicio: "2026-10-01",
  fim: "2026-10-01",
  unidade: "L",
  referenciaUnidade: "Litros confirmados no cabeçalho da folha",
  origemArquivo: "Folha de ordenhas conferida",
  linhas: [
    {
      origemId: "linha1",
      brinco: "00123",
      data: "2026-10-01",
      ordenha: "manha",
      estado: "MEDIDO",
      litros: 12,
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  m.propriedade.findUnique.mockResolvedValue({ id: 2, nome: "Fazenda" });
  m.animal.findMany.mockResolvedValue([
    {
      id: "animal",
      brinco: "00123",
      nome: "Aurora",
      sexo: "F",
      dataNascimento: new Date("2024-01-01"),
      dataEntrada: new Date("2024-01-01"),
      destinos: [{ id: "finalidade", aptidao: "LEITE", desde: new Date("2020-01-01"), ate: null }], localizacoes: [
        {
          id: "local",
          propriedadeId: 2,
          desde: new Date("2024-01-01"),
          ate: null,
        },
      ],
      baixas: [],
    },
  ]);
  m.lactacaoAnimal.findMany.mockResolvedValue([
    {
      id: "lactacao",
      animalId: "animal",
      inicio: new Date("2026-09-01"),
      encerradaEm: null,
    },
  ]);
  m.configuracaoOrdenha.findMany.mockResolvedValue([]);
  m.diaProducaoLeite.findMany.mockResolvedValue([]);
  m.movimentoEstoque.count.mockResolvedValue(0);
  m.versaoComercialVendaLeite.count.mockResolvedValue(0);
});
it("preserva brinco literal, concilia rótulo e soma apenas informação nova sem escrever", async () => {
  const r = await preverHistoricoLeiteTx(prisma, 2, input);
  expect(r.linhas[0]).toMatchObject({
    animalId: "animal",
    brinco: "00123",
    situacao: "NOVO_REGISTRO",
    litros: 12,
  });
  expect(r.litrosNovosMedidos).toBe("12");
  expect(r.conciliacao).toMatchObject({
    estoqueAlterado: false,
    financeiroAlterado: false,
    importacaoExecutada: false,
  });
  expect(r.assinaturaFonte).toMatch(/^[a-f0-9]{64}$/);
});
it("identificador duplicado não conta litros duas vezes nem libera conferência", async () => {
  const r = await preverHistoricoLeiteTx(prisma, 2, {
    ...input,
    linhas: [input.linhas[0], input.linhas[0]],
  });
  expect(r.totais.DUPLICADO_NO_LOTE).toBe(2);
  expect(r.litrosNovosMedidos).toBe("0");
  expect(r.conferenciaSemConflitos).toBe(false);
});
it("mesma medição é já registrada e alteração consumida exige regularização", async () => {
  const posicaoId = "b0500000-0000-4000-8000-000000000001";
  // Usa a posição efetiva da configuração do dia, sem inferir uma nova coluna fixa.
  m.diaProducaoLeite.findMany.mockResolvedValue([
    {
      dataOperacional: new Date("2026-10-01"),
      configuracao: {
        id: "config",
        propriedadeId: 2,
        vigenteDesde: new Date("2026-09-01"),
        inicial: false,
        ordenhas: [{ posicaoId, nome: "Manhã", ordem: 1, horario: null }],
      },
      sessoes: [{ id: "sessao", posicaoId }],
      participantes: [
        {
          animalId: "animal",
          excluidoEm: null,
          medicoes: [
            {
              sessaoId: "sessao",
              estado: "MEDIDO",
              litros: new Prisma.Decimal(12),
              motivo: null,
              origensEstoque: [{ entradaId: "entrada" }],
            },
          ],
        },
      ],
    },
  ]);
  expect(
    (await preverHistoricoLeiteTx(prisma, 2, input)).linhas[0].situacao,
  ).toBe("JA_REGISTRADO");
  const r = await preverHistoricoLeiteTx(prisma, 2, {
    ...input,
    linhas: [{ ...input.linhas[0], litros: 15 }],
  });
  expect(r.linhas[0]).toMatchObject({
    situacao: "CONFLITO_EXISTENTE",
    motivo: expect.stringContaining("estoque confirmada"),
  });
  expect(r.litrosNovosMedidos).toBe("0");
});
it("rejeita unidade não comprovada, data impossível e zero presumido em ausência", () => {
  expect(
    previaHistoricaLeiteSchema.safeParse({ ...input, unidade: "kg" }).success,
  ).toBe(false);
  expect(
    previaHistoricaLeiteSchema.safeParse({
      ...input,
      linhas: [{ ...input.linhas[0], data: "2026-02-30" }],
    }).success,
  ).toBe(false);
  expect(
    previaHistoricaLeiteSchema.safeParse({
      ...input,
      linhas: [{ ...input.linhas[0], estado: "PENDENTE", litros: 0 }],
    }).success,
  ).toBe(false);
});
