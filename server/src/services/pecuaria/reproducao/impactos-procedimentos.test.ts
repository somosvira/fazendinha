import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  transacao: vi.fn(),
  auditar: vi.fn(),
  tipo: vi.fn(),
  unica: vi.fn(),
  buscar: vi.fn(),
  criar: vi.fn(),
  atualizar: vi.fn(),
  trava: vi.fn(),
}));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: m.transacao }));
vi.mock("../rebanho/regras.js", async (original) => ({
  ...(await original<object>()),
  auditar: m.auditar,
}));
vi.mock("./operacoes.js", () => ({
  operacaoIdempotenteTx: (
    _tx: unknown,
    _input: unknown,
    _usuario: unknown,
    _tipo: unknown,
    executar: () => Promise<unknown>,
  ) => executar(),
}));
import {
  criarRegraImpactoProcedimento,
  revisarRegraImpactoProcedimento,
  regraImpactoProcedimentoSchema,
} from "./impactos-procedimentos.js";
const id = "9192047d-ab87-4ff6-bbc7-f7c6702eb83a";
const input = {
  chave: id,
  propriedadeId: 1,
  tipoAplicacaoId: id,
  finalidade: "IATF",
  efeito: "AVISAR",
  motivo: "Regra explícita aprovada pela fazenda",
  ativo: true,
};
beforeEach(() => {
  vi.clearAllMocks();
  m.tipo.mockResolvedValue({ id });
  m.unica.mockResolvedValue(null);
  m.buscar.mockResolvedValue({ id, propriedadeId: 1, versao: 2 });
  m.criar.mockResolvedValue({ id, versao: 1 });
  m.atualizar.mockResolvedValue({ id, versao: 3 });
  const tx = {
    tipoAplicacaoSanitaria: { findFirst: m.tipo },
    regraImpactoProcedimentoReprodutivo: {
      findUnique: m.unica,
      findFirst: m.buscar,
      create: m.criar,
      update: m.atualizar,
    },
    $queryRaw: m.trava,
  };
  m.transacao.mockImplementation(
    (executar: (t: typeof tx) => Promise<unknown>) => executar(tx),
  );
});
describe("regra própria de impacto de procedimento", () => {
  it("declara classificação, finalidade e efeito sem doença nem produto", async () => {
    expect(regraImpactoProcedimentoSchema.parse(input)).toEqual(input);
    expect(
      regraImpactoProcedimentoSchema.safeParse({ ...input, doencaId: id })
        .success,
    ).toBe(false);
    await criarRegraImpactoProcedimento(input, 9);
    expect(m.criar).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipoAplicacaoId: id,
        propriedadeId: 1,
        finalidade: "IATF",
        efeito: "AVISAR",
        criadoPorId: 9,
        atualizadoPorId: 9,
      }),
    });
    expect(m.auditar).toHaveBeenCalled();
  });
  it("recusa classificação inativa e duplicação do mesmo público", async () => {
    m.tipo.mockResolvedValueOnce(null);
    await expect(criarRegraImpactoProcedimento(input, 9)).rejects.toThrow(
      "ativa",
    );
    m.unica.mockResolvedValueOnce({ id });
    await expect(criarRegraImpactoProcedimento(input, 9)).rejects.toThrow(
      "Já existe",
    );
    expect(m.criar).not.toHaveBeenCalled();
  });
  it("revisão revalida sítio e versão sob trava antes de alterar", async () => {
    m.buscar.mockResolvedValueOnce(null);
    await expect(
      revisarRegraImpactoProcedimento(id, { ...input, versaoEsperada: 2 }, 9),
    ).rejects.toThrow("neste sítio");
    await expect(
      revisarRegraImpactoProcedimento(id, { ...input, versaoEsperada: 1 }, 9),
    ).rejects.toThrow("mudou");
    expect(m.atualizar).not.toHaveBeenCalled();
    expect(m.buscar).toHaveBeenCalledWith({ where: { id, propriedadeId: 1 } });
    expect(m.buscar.mock.invocationCallOrder[0]).toBeGreaterThan(
      m.trava.mock.invocationCallOrder[0],
    );
  });
  it("inativação versionada não modifica fatos nem participações antigas", async () => {
    await revisarRegraImpactoProcedimento(
      id,
      { ...input, versaoEsperada: 2, ativo: false },
      9,
    );
    expect(m.atualizar).toHaveBeenCalledWith({
      where: { id },
      data: expect.objectContaining({
        ativo: false,
        versao: { increment: 1 },
        atualizadoPorId: 9,
      }),
    });
    expect(m.auditar).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        acao: "REVISAO",
        antes: { id, propriedadeId: 1, versao: 2 },
      }),
    );
  });
});
