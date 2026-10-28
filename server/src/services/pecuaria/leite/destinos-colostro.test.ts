import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ animal: vi.fn(),
  tx: { $executeRaw: vi.fn(), fornecimentoColostro: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    criaParto: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() }, partoAnimal: { findUnique: vi.fn() },
    parcelaDestinoLeite: { findFirst: vi.fn() }, alocacaoFornecimentoColostro: { findFirst: vi.fn() }, auditoriaPecuaria: { create: vi.fn() } } }));
vi.mock("../../../db.js", () => ({ prisma: {} }));
vi.mock("../fatos.js", () => ({ conferirAnimalNoFato: mocks.animal }));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: (executar: (tx: typeof mocks.tx) => unknown) => executar(mocks.tx) }));
vi.mock("../reproducao/operacoes.js", () => ({ operacaoIdempotenteTx: (_tx: unknown, _input: unknown, _usuario: unknown, _operacao: unknown, executar: () => unknown) => executar() }));
import { corrigirColostro } from "../reproducao/colostro.js";
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const base = { chave: "10000000-0000-4000-8000-000000000001", propriedadeId: 1, versaoEsperada: 1, motivo: "Correção informada pelo responsável" };
beforeEach(() => {
  vi.resetAllMocks();
  const anterior = { id: "fornecimento", criaId: "cria", propriedadeId: 1, data: dia("2026-10-01"), status: "VALIDO", versao: 1,
    quantidadeLitros: new Prisma.Decimal(3), unidadeInformada: "L", metodoQualidade: null, qualidadeBrix: null, qualidadeClassificacao: null,
    ocorridoEm: null, horarioEstimado: false, tipo: null, forma: null, responsavel: null, observacao: null };
  mocks.tx.fornecimentoColostro.findFirst.mockResolvedValue(anterior); mocks.tx.fornecimentoColostro.findUniqueOrThrow.mockResolvedValue(anterior);
  mocks.tx.fornecimentoColostro.update.mockResolvedValue({ ...anterior, versao: 2 });
  mocks.tx.criaParto.findUniqueOrThrow.mockResolvedValue({ id: "cria", animalId: "animal", viva: true, partoId: "parto" });
  mocks.tx.criaParto.findUnique.mockResolvedValue({ id: "cria", animalId: "animal", viva: true, partoId: "parto" });
  mocks.tx.partoAnimal.findUnique.mockResolvedValue({ id: "parto", status: "VALIDO", data: dia("2026-09-30"), ocorridoEm: null });
  mocks.tx.parcelaDestinoLeite.findFirst.mockResolvedValue({ id: "vinculoAtivo" }); mocks.animal.mockResolvedValue({ id: "animal" });
  mocks.tx.alocacaoFornecimentoColostro.findFirst.mockResolvedValue(null);
});
describe("fornecimento V4 vinculado ao estoque", () => {
  it.each([{ anular: true }, { quantidade: 4, unidade: "L" as const }, { data: "2026-10-02" }])("impede alteração física independente de um destino ativo: %o", async alteracao => {
    await expect(corrigirColostro("fornecimento", { ...base, ...alteracao }, 7)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(mocks.tx.fornecimentoColostro.update).not.toHaveBeenCalled();
  });
  it("preserva correção de qualidade/observação sem mexer em litros ou data", async () => {
    await expect(corrigirColostro("fornecimento", { ...base, metodoQualidade: "REFRATOMETRO_BRIX", qualidadeBrix: 23, observacao: "Resultado conferido" }, 7)).resolves.toMatchObject({ id: "fornecimento" });
    expect(mocks.tx.parcelaDestinoLeite.findFirst).not.toHaveBeenCalled();
    expect(mocks.tx.fornecimentoColostro.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ quantidadeLitros: new Prisma.Decimal(3), qualidadeBrix: new Prisma.Decimal(23) }) }));
  });
  it("após estorno do vínculo, V4 volta a permitir correção física com auditoria", async () => {
    mocks.tx.parcelaDestinoLeite.findFirst.mockResolvedValue(null);
    await expect(corrigirColostro("fornecimento", { ...base, anular: true }, 7)).resolves.toMatchObject({ id: "fornecimento" });
    expect(mocks.tx.auditoriaPecuaria.create).toHaveBeenCalled();
  });
  it("protege também a origem do Bezerreiro contra correção física pelo fluxo V4", async () => {
    mocks.tx.parcelaDestinoLeite.findFirst.mockResolvedValue(null);
    mocks.tx.alocacaoFornecimentoColostro.findFirst.mockResolvedValue({ id: "origemBezerreiro" });
    await expect(corrigirColostro("fornecimento", { ...base, anular: true }, 7)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(mocks.tx.fornecimentoColostro.update).not.toHaveBeenCalled();
  });
});
