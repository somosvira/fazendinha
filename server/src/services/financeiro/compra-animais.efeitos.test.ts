// Efeitos da devolução e do estorno sobre os animais, com um `tx` falso: confere a ordem das
// validações, o campo apontado, o teto do valor devolvido e que as consultas são em lote.
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const executores = vi.hoisted(() => ({ cadastrarTx: vi.fn(), registrarBaixaTx: vi.fn(), estornarBaixaTx: vi.fn() }));
vi.mock("../pecuaria/rebanho/animais.js", () => executores);
import { concluirAnimaisTx, estornarAnimaisTx, prepararAnimaisTx, type ContextoAnimaisOperacao } from "./compra-animais.js";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const FORNECEDOR = "00000000-0000-4000-8000-0000000000f1";

type Linha = Record<string, unknown>;
function txFalso(dados: { itens?: Linha[]; baixas?: Linha[] }) {
  const itemOperacao: { findMany: ReturnType<typeof vi.fn>; findFirst?: ReturnType<typeof vi.fn> } = { findMany: vi.fn(async (args: { where: Linha }) => {
    const alvo = (args.where.operacao as { tipo?: string }).tipo;
    return (dados.itens ?? []).filter((item) => item.tipoOperacao === alvo && (args.where.animalId as { in: string[] }).in.includes(item.animalId as string));
  }) };
  const baixaAnimal = { findMany: vi.fn(async (args: { where: Linha }) => (dados.baixas ?? []).filter((b) => (args.where.animalId as { in: string[] }).in.includes(b.animalId as string))) };
  Object.assign(itemOperacao, { findFirst: vi.fn() });
  return { tx: { itemOperacao, baixaAnimal } as never, itemOperacao, baixaAnimal };
}
const compra = (animalId: string, valorTotal: string, extra: Linha = {}) => ({
  tipoOperacao: "COMPRA_ANIMAIS", animalId, id: `item-${animalId}`, valorTotal: new Prisma.Decimal(valorTotal),
  operacao: { id: "op-compra", numero: 7, parceiroId: FORNECEDOR }, ...extra,
});
const devolucaoCtx = (itens: ContextoAnimaisOperacao["itens"]): ContextoAnimaisOperacao => ({
  tipo: "DEVOLUCAO", data: new Date("2026-11-10T00:00:00Z"), propriedadeId: 1, parceiroId: FORNECEDOR, itens,
});
const item = (animalId: string, valorTotal: number) => ({ animalId, quantidade: 1, valorTotal });

beforeEach(() => vi.clearAllMocks());

describe("devolução de animais — validações em lote", () => {
  it("aceita valor até o pago e consulta compra, devolução e baixa uma vez para todos os animais", async () => {
    const { tx, itemOperacao, baixaAnimal } = txFalso({ itens: [compra(A, "3000"), compra(B, "2500")] });
    await expect(prepararAnimaisTx(tx, devolucaoCtx([item(A, 3000), item(B, 2000)]))).resolves.toEqual([A, B]);
    expect(itemOperacao.findMany).toHaveBeenCalledTimes(2);
    expect(baixaAnimal.findMany).toHaveBeenCalledTimes(1);
  });

  it("recusa valor acima do líquido pago, no item certo", async () => {
    const { tx } = txFalso({ itens: [compra(A, "3000"), compra(B, "2500.5")] });
    await expect(prepararAnimaisTx(tx, devolucaoCtx([item(A, 3000), item(B, 2500.51)]))).rejects.toMatchObject({
      code: "VALIDACAO", campo: "itens.1.valorTotal", message: "O valor devolvido não pode passar do valor pago (R$ 2.500,50)",
    });
  });

  it("calcula o valor do item por quantidade × unitário quando não há total", async () => {
    const { tx } = txFalso({ itens: [compra(A, "3000")] });
    await expect(prepararAnimaisTx(tx, devolucaoCtx([{ animalId: A, quantidade: 300, valorUnitario: 10.1 }]))).rejects.toMatchObject({ campo: "itens.0.valorTotal" });
    await expect(prepararAnimaisTx(tx, devolucaoCtx([{ animalId: A, quantidade: 300, valorUnitario: 10 }]))).resolves.toEqual([A]);
  });

  it("mantém a ordem: compra ausente, fornecedor, já devolvido e já baixado vêm antes do valor", async () => {
    const semCompra = txFalso({});
    await expect(prepararAnimaisTx(semCompra.tx, devolucaoCtx([item(A, 1)]))).rejects.toMatchObject({ code: "CONFLITO", campo: "itens.0.animalId" });

    const outroFornecedor = txFalso({ itens: [compra(A, "10", { operacao: { id: "op", numero: 7, parceiroId: "outro" } })] });
    await expect(prepararAnimaisTx(outroFornecedor.tx, devolucaoCtx([item(A, 999)]))).rejects.toMatchObject({ code: "VALIDACAO", campo: "parceiroId" });

    const devolvido = txFalso({ itens: [compra(A, "10"), { tipoOperacao: "DEVOLUCAO", animalId: A, operacao: { numero: 9 } }] });
    await expect(prepararAnimaisTx(devolvido.tx, devolucaoCtx([item(A, 999)]))).rejects.toMatchObject({ code: "CONFLITO", message: "O animal já foi devolvido na operação #9", campo: "itens.0.animalId" });

    const baixado = txFalso({ itens: [compra(A, "10")], baixas: [{ animalId: A, tipo: "MORTE" }] });
    await expect(prepararAnimaisTx(baixado.tx, devolucaoCtx([item(A, 999)]))).rejects.toMatchObject({ code: "CONFLITO", campo: "itens.0.animalId" });
  });

  it("aponta o primeiro item inválido, na ordem do formulário", async () => {
    const { tx } = txFalso({ itens: [compra(B, "10")] });
    await expect(prepararAnimaisTx(tx, devolucaoCtx([item(A, 1), item(B, 999)]))).rejects.toMatchObject({ campo: "itens.0.animalId" });
  });
});

describe("compra ativa e estorno — consultas em lote", () => {
  it("recusa animal já em compra ativa apontando o índice do item", async () => {
    const { tx, itemOperacao } = txFalso({ itens: [compra(B, "10")] });
    const ctx: ContextoAnimaisOperacao = { tipo: "COMPRA_ANIMAIS", data: new Date(), propriedadeId: 1, corrigeOperacaoId: "orig", animaisOriginais: [A, B], itens: [{ animalId: A }, { animalId: B }] };
    await expect(prepararAnimaisTx(tx, ctx)).rejects.toMatchObject({ code: "CONFLITO", message: "O animal já está na compra ativa #7", campo: "itens.1.animalId" });
    expect(itemOperacao.findMany).toHaveBeenCalledTimes(1);
  });

  it("estorno da compra baixa só os animais sem baixa ativa, com uma consulta de baixas", async () => {
    const { tx, baixaAnimal, itemOperacao } = txFalso({ baixas: [{ animalId: A, tipo: "MORTE" }] });
    itemOperacao.findMany.mockImplementation(async (args: { where: Linha }) => (args.where.operacaoId ? [{ animalId: A }, { animalId: B }] : []));
    itemOperacao.findFirst!.mockResolvedValue(null);
    await estornarAnimaisTx(tx, { id: "op", tipo: "COMPRA_ANIMAIS", numero: 7 }, "erro", 5);
    expect(baixaAnimal.findMany).toHaveBeenCalledTimes(1);
    expect(executores.registrarBaixaTx).toHaveBeenCalledTimes(1);
    expect(executores.registrarBaixaTx).toHaveBeenCalledWith(tx, expect.objectContaining({ animalId: B, tipo: "COMPRA_ESTORNADA" }), 5);
  });

  it("estorno da devolução reativa só quem tem baixa ativa", async () => {
    const { tx, baixaAnimal, itemOperacao } = txFalso({ baixas: [{ animalId: B, tipo: "COMPRA_ESTORNADA" }] });
    itemOperacao.findMany.mockResolvedValue([{ animalId: A }, { animalId: B }]);
    await estornarAnimaisTx(tx, { id: "op", tipo: "DEVOLUCAO", numero: 8 }, "erro", 5);
    expect(baixaAnimal.findMany).toHaveBeenCalledTimes(1);
    expect(executores.estornarBaixaTx).toHaveBeenCalledTimes(1);
    expect(executores.estornarBaixaTx).toHaveBeenCalledWith(tx, B, expect.anything(), 5, true);
  });

  it("correção reativa só animais com baixa COMPRA_ESTORNADA; morte e venda continuam baixados", async () => {
    const { tx, baixaAnimal } = txFalso({ baixas: [{ animalId: A, tipo: "COMPRA_ESTORNADA" }, { animalId: B, tipo: "MORTE" }] });
    const ctx: ContextoAnimaisOperacao = { tipo: "COMPRA_ANIMAIS", data: new Date(), propriedadeId: 1, corrigeOperacaoId: "orig", itens: [{ animalId: A }, { animalId: B }] };
    await concluirAnimaisTx(tx, ctx, { id: "nova", numero: 10 }, [A, B]);
    expect(baixaAnimal.findMany).toHaveBeenCalledTimes(1);
    expect(executores.estornarBaixaTx).toHaveBeenCalledTimes(1);
    expect(executores.estornarBaixaTx).toHaveBeenCalledWith(tx, A, expect.anything(), null, true);
  });
});
