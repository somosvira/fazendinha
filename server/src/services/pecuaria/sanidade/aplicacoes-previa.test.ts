import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  tx: { tarefaSanitaria: { findFirst: vi.fn(), findUnique: vi.fn() }, destinoAnimal: { findFirst: vi.fn() }, tipoAplicacaoSanitaria: { findFirst: vi.fn() }, produto: { findUnique: vi.fn() },
    movimentoEstoque: { findMany: vi.fn(), create: vi.fn() }, aplicacaoProduto: { create: vi.fn() }, $executeRaw: vi.fn() },
  conferir: vi.fn(), travar: vi.fn(), auditar: vi.fn(), periodo: vi.fn(), base: vi.fn(), partida: vi.fn(), saldoPartida: vi.fn(),
}));
vi.mock("../../../db.js", () => ({ prisma: {} }));
vi.mock("../rebanho/regras.js", async (original) => ({ ...await original<typeof import("../rebanho/regras.js")>(), auditar: mocks.auditar, travarAnimais: mocks.travar }));
vi.mock("../fatos.js", () => ({ conferirAnimalNoFato: mocks.conferir }));
vi.mock("../../propriedade.js", () => ({ propriedadePrincipalId: async () => 1 }));
vi.mock("../../financeiro/regras.js", () => ({ exigirPeriodoAberto: mocks.periodo }));
vi.mock("../../estoque/estoque.js", () => ({ obterBaseCusto: mocks.base, statusSaldoEstoque: {}, estornarMovimentoTx: vi.fn() }));
vi.mock("../../estoque/partidas.js", () => ({ resolverLotePrincipalTx: mocks.partida, saldoPartidaTx: mocks.saldoPartida, validadeVencida: () => false }));
import { prepararAplicacaoTx, criarAplicacaoTx, travarOrigensAplicacoesTx, type AplicacaoInput } from "./aplicacoes.js";

const input: AplicacaoInput = { animalId: "animal", propriedadeId: 2, tarefaId: "tarefa", data: "2026-10-05", aplicadaEm: "2026-10-05T12:00:00Z", produtoId: "produto", nomeProdutoAplicado: "Vacina", tipoAplicacaoId: "tipo", dose: "0.1", unidadeDose: "ML", via: "Subcutânea", origemInsumo: "BAIXA_ESTOQUE", partidaId: "partida", estadoCarenciaLeite: "INFORMADO", estadoCarenciaCarne: "INFORMADO", carenciaLeiteHoras: 0, carenciaCarneHoras: 0 };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.tx.tarefaSanitaria.findFirst.mockResolvedValue({ id: "tarefa" });
  mocks.tx.tarefaSanitaria.findUnique.mockResolvedValue({ id: "tarefa", etapaId: "etapa", previstaPara: new Date("2026-10-05"),
    parametros: { tipo: "APLICACAO", produtoId: "produto", dose: "0.1", unidade: "ML", via: "Subcutânea", tipoAplicacaoId: "tipo" },
    execucao: { id: "execucao", protocoloId: "versao", animalId: "animal", propriedadeId: 2, canceladaEm: null, operacaoServicoId: null }, etapa: { protocoloId: "versao" }, aplicacoes: [], exames: [], dispensadaEm: null });
  mocks.tx.tipoAplicacaoSanitaria.findFirst.mockResolvedValue({ id: "tipo", nome: "Vacina" });
  mocks.tx.produto.findUnique.mockResolvedValue({ id: "produto", nome: "Vacina", ativo: true, usoSanitario: true, unidade: "ML", rastrearPartidas: true });
  mocks.tx.movimentoEstoque.findMany.mockResolvedValue([{ tipo: "ENTRADA", quantidade: new Prisma.Decimal(1) }]);
  mocks.partida.mockResolvedValue({ id: "partida", codigo: "001", validade: new Date("2027-01-01") });
  mocks.saldoPartida.mockResolvedValue(new Prisma.Decimal(1));
  mocks.tx.movimentoEstoque.create.mockResolvedValue({ id: "movimento" });
  mocks.tx.aplicacaoProduto.create.mockImplementation(async ({ data }) => ({ ...data, id: "aplicacao" }));
});
const tx = () => mocks.tx as unknown as Prisma.TransactionClient;

describe("preparação compartilhada da aplicação", () => {
  it("ordena todas as origens, usos e produtos antes de consumir, mesmo invertendo o conjunto", async () => {
    const itens: AplicacaoInput[] = [
      { ...input, produtoId: "b" }, { ...input, produtoId: "a" },
      { ...input, produtoId: "b", origemInsumo: "COMPRA_CONSUMO_DIRETO", itemCompraDiretaId: "compra-b" },
      { ...input, produtoId: "a", origemInsumo: "COMPRA_CONSUMO_DIRETO", itemCompraDiretaId: "compra-a" },
    ];
    await travarOrigensAplicacoesTx(tx(), itens);
    const travas = mocks.tx.$executeRaw.mock.calls.map((args) => args.slice(1));
    expect(travas).toEqual([
      [["pec-compra-direta:compra-a", "pec-compra-direta:compra-b", "pec-produto:2:a", "pec-produto:2:b"]],
      ["produto-usos:a"], ["produto-usos:b"], [["pec-produto:a", "pec-produto:b"]],
    ]);
    expect(String(mocks.tx.$executeRaw.mock.calls[0][0])).toContain("ORDER BY h");
    mocks.tx.$executeRaw.mockClear();
    await travarOrigensAplicacoesTx(tx(), [...itens].reverse());
    expect(mocks.tx.$executeRaw.mock.calls.map((args) => args.slice(1))).toEqual(travas);
    expect(mocks.tx.movimentoEstoque.create).not.toHaveBeenCalled();
  });
  it("valida lote e saldo na prévia sem criar movimento, fato ou auditoria", async () => {
    const previa = await prepararAplicacaoTx(tx(), input, null, true);
    expect(previa.dadosCriacao).toMatchObject({ via: "Subcutânea", movimentoEstoqueId: null, desvioProtocoloSnapshot: { diferencas: [] } });
    expect(mocks.partida).toHaveBeenCalledWith(mocks.tx, "partida", "produto");
    expect(mocks.periodo).toHaveBeenCalled(); expect(mocks.saldoPartida).toHaveBeenCalled();
    expect(mocks.tx.movimentoEstoque.create).not.toHaveBeenCalled(); expect(mocks.tx.aplicacaoProduto.create).not.toHaveBeenCalled(); expect(mocks.auditar).not.toHaveBeenCalled();
  });
  it("persiste via e snapshot no fato e na auditoria da confirmação", async () => {
    const fato = await criarAplicacaoTx(tx(), { ...input, dose: "0.2", desvio: { motivo: "Dose revisada pelo veterinário" } }, 7);
    expect(fato).toMatchObject({ via: "Subcutânea", movimentoEstoqueId: "movimento", desvioProtocoloSnapshot: { diferencas: [{ campo: "dose", planejado: "0.1", realizado: "0.2" }] } });
    expect(mocks.auditar).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({ depois: expect.objectContaining({ via: "Subcutânea", desvioProtocoloSnapshot: fato.desvioProtocoloSnapshot }) }));
  });
  it("recusa dose desviada sem motivo antes de consumir estoque", async () => {
    await expect(criarAplicacaoTx(tx(), { ...input, dose: "0.2" }, 7)).rejects.toMatchObject({ campo: "desvio.motivo" });
    expect(mocks.tx.movimentoEstoque.create).not.toHaveBeenCalled();
  });
  it("não aceita finalidade legada como forma de ocultar troca do tipo efetivo", async () => {
    const tarefa = await mocks.tx.tarefaSanitaria.findUnique();
    mocks.tx.tarefaSanitaria.findUnique.mockResolvedValue({ ...tarefa, parametros: { ...tarefa.parametros, tipoAplicacaoId: null, finalidade: "VACINA" } });
    const alterado = { ...input, finalidade: "VACINA" as const, tipoAplicacaoId: "a0300000-0000-4000-8000-000000000001" };
    mocks.tx.tipoAplicacaoSanitaria.findFirst.mockResolvedValue({ id: alterado.tipoAplicacaoId, nome: "Tratamento" });
    const previa = await prepararAplicacaoTx(tx(), alterado, null, true);
    expect(previa.desvioProtocoloSnapshot).toMatchObject({ motivoObrigatorio: true, diferencas: [{ campo: "tipoAplicacaoId" }] });
    await expect(criarAplicacaoTx(tx(), alterado, 7)).rejects.toMatchObject({ campo: "desvio.motivo" });
    expect(mocks.tx.movimentoEstoque.create).not.toHaveBeenCalled();
    const fato = await criarAplicacaoTx(tx(), { ...alterado, desvio: { motivo: "Tipo revisado pelo veterinário" } }, 7);
    expect(fato.desvioProtocoloSnapshot).toMatchObject({ diferencas: [{ campo: "tipoAplicacaoId", planejado: "a0300000-0000-4000-8000-000000000002", realizado: alterado.tipoAplicacaoId }] });
  });
  it("troca de Produto revalida lote e não reutiliza o lote incompatível", async () => {
    mocks.tx.produto.findUnique.mockResolvedValue({ id: "outro", nome: "Outro", ativo: true, usoSanitario: true, unidade: "ML", rastrearPartidas: true });
    mocks.partida.mockResolvedValue(null);
    await expect(criarAplicacaoTx(tx(), { ...input, produtoId: "outro", desvio: { motivo: "Produto revisado pelo veterinário" } }, 7)).rejects.toMatchObject({ campo: "partidaId" });
    expect(mocks.partida).toHaveBeenCalledWith(mocks.tx, "partida", "outro"); expect(mocks.tx.movimentoEstoque.create).not.toHaveBeenCalled();
  });
  it("carência inconsistente e fato futuro falham antes de gravar", async () => {
    await expect(prepararAplicacaoTx(tx(), { ...input, estadoCarenciaLeite: "NAO_INFORMADO" }, null, true)).rejects.toMatchObject({ campo: "carenciaLeiteHoras" });
    await expect(prepararAplicacaoTx(tx(), { ...input, data: "2099-01-01", aplicadaEm: "2099-01-01T12:00:00Z" }, null, true)).rejects.toMatchObject({ campo: "aplicadaEm" });
    expect(mocks.tx.movimentoEstoque.create).not.toHaveBeenCalled();
  });
});
