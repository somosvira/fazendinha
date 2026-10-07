import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { ExecucaoEtapasInput } from "./execucao-etapas.schemas.js";

const mocks = vi.hoisted(() => ({
  tx: { tarefaSanitaria: { findMany: vi.fn() }, produto: { findMany: vi.fn() }, itemOperacao: { findMany: vi.fn() }, partidaProduto: { findMany: vi.fn() },
    aplicacaoProduto: { aggregate: vi.fn() }, requisicaoPecuaria: { findUnique: vi.fn(), create: vi.fn() }, $executeRaw: vi.fn() },
  prepararAplicacao: vi.fn(), criarAplicacao: vi.fn(), prepararExame: vi.fn(), criarExame: vi.fn(), saldo: vi.fn(), travar: vi.fn(), travarOrigens: vi.fn(), travarTipos: vi.fn(),
}));
vi.mock("../../../db.js", () => ({ prisma: { $transaction: async (fn: (tx: typeof mocks.tx) => unknown) => fn(mocks.tx) } }));
vi.mock("../rebanho/regras.js", async (original) => ({ ...await original<typeof import("../rebanho/regras.js")>(), travarAnimais: mocks.travar }));
vi.mock("./aplicacoes.js", () => ({ prepararAplicacaoTx: mocks.prepararAplicacao, criarAplicacaoTx: mocks.criarAplicacao, obterSaldo: mocks.saldo, travarOrigensAplicacoesTx: mocks.travarOrigens }));
vi.mock("./exames.js", () => ({ prepararExameTx: mocks.prepararExame, registrarExameTx: mocks.criarExame, travarTiposExame: mocks.travarTipos }));

import { preverExecucaoEtapas, confirmarExecucaoEtapas } from "./execucao-etapas.js";
import { confirmarExecucaoEtapasSchema } from "./execucao-etapas.schemas.js";

const aplicacao = { tipo: "APLICACAO" as const, tarefaId: "t1", animalId: "a1", propriedadeId: 2, data: "2026-10-05", aplicadaEm: "2026-10-05T12:00:00Z", produtoId: "produto", nomeProdutoAplicado: "Vacina", dose: "0.1", unidadeDose: "ML" as const, origemInsumo: "BAIXA_ESTOQUE" as const, partidaId: "lote" };
const input: ExecucaoEtapasInput = { propriedadeId: 2, itens: [aplicacao, { ...aplicacao, tarefaId: "t2", animalId: "a2", dose: "0.2" }] };
const tarefas = input.itens.map((i) => ({ id: i.tarefaId, etapaId: "etapa", execucao: { protocoloId: "versao", rodadaId: "rodada" } }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.tx.tarefaSanitaria.findMany.mockResolvedValue(tarefas);
  mocks.tx.produto.findMany.mockResolvedValue([{ id: "produto", nome: "Vacina", unidade: "ML" }]);
  mocks.tx.itemOperacao.findMany.mockResolvedValue([]);
  mocks.tx.partidaProduto.findMany.mockResolvedValue([]);
  mocks.tx.aplicacaoProduto.aggregate.mockResolvedValue({ _sum: { quantidadeCompraDireta: null } });
  mocks.saldo.mockResolvedValue(new Prisma.Decimal("0.3"));
  mocks.prepararAplicacao.mockImplementation(async (_tx, item) => ({ dadosCriacao: { estadoCarenciaLeite: "INFORMADO", estadoCarenciaCarne: "INFORMADO", quantidadeCompraDireta: item.itemCompraDiretaId ? item.dose : null },
    desvioProtocoloSnapshot: { planejado: { data: "2026-10-05", dose: item.dose }, realizado: { data: item.data, dose: item.dose }, motivoObrigatorio: false, diferencas: [], motivo: null } }));
  mocks.prepararExame.mockResolvedValue({ dadosCriacao: {}, desvioProtocoloSnapshot: { planejado: { data: "2026-10-05" }, motivoObrigatorio: false } });
  mocks.criarAplicacao.mockImplementation(async (_tx, item) => ({ id: `fato-${item.animalId}`, animalId: item.animalId }));
  mocks.criarExame.mockImplementation(async (_tx, item) => ({ id: `coleta-${item.animalId}`, animalId: item.animalId }));
  mocks.tx.requisicaoPecuaria.findUnique.mockResolvedValue(null);
});

describe("execução conjunta de etapa", () => {
  it("a prévia não cria fatos, movimento nem chave; soma doses com precisão decimal por Produto/lote", async () => {
    const previa = await preverExecucaoEtapas(input);
    expect(previa.consumos).toEqual([{ produtoId: "produto", partidaId: "lote", itemCompraDiretaId: null, unidade: "ML", quantidade: "0.3", produtoNome: "Vacina", partidaNome: null, partidaValidade: null }]);
    expect(previa.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.prepararAplicacao).toHaveBeenCalledWith(mocks.tx, aplicacao, null, true);
    expect(mocks.criarAplicacao).not.toHaveBeenCalled(); expect(mocks.criarExame).not.toHaveBeenCalled(); expect(mocks.tx.requisicaoPecuaria.create).not.toHaveBeenCalled();
  });
  it("recusa saldo que cobre as doses individuais mas não o conjunto", async () => {
    mocks.saldo.mockResolvedValue(new Prisma.Decimal("0.29"));
    await expect(preverExecucaoEtapas(input)).rejects.toMatchObject({ code: "VALIDACAO", campo: "partidaId" });
    expect(mocks.criarAplicacao).not.toHaveBeenCalled();
  });
  it("confere o total do Produto quando as doses usam lotes distintos", async () => {
    mocks.saldo.mockImplementation(async (_tx, _produto, _sitio, lote) => new Prisma.Decimal(lote ? "0.2" : "0.29"));
    await expect(preverExecucaoEtapas({ ...input, itens: [input.itens[0], { ...aplicacao, tarefaId: "t2", animalId: "a2", dose: "0.2", partidaId: "outro" }] })).rejects.toMatchObject({ campo: "dose" });
  });
  it("soma aliases de um mesmo lote principal antes de validar seu saldo", async () => {
    mocks.tx.partidaProduto.findMany.mockResolvedValue([{ id: "lote", lotePrincipalId: "principal" }, { id: "alias", lotePrincipalId: "principal" }]);
    mocks.saldo.mockImplementation(async (_tx, _produto, _sitio, lote) => new Prisma.Decimal(lote ? "0.29" : "1"));
    await expect(preverExecucaoEtapas({ ...input, itens: [input.itens[0], { ...aplicacao, tarefaId: "t2", animalId: "a2", dose: "0.2", partidaId: "alias" }] })).rejects.toMatchObject({ campo: "partidaId" });
    expect(mocks.saldo).toHaveBeenCalledWith(mocks.tx, "produto", 2, "principal");
  });
  it("confere compra direta conjuntamente sem preparar cada dose outra vez", async () => {
    mocks.tx.itemOperacao.findMany.mockResolvedValue([{ id: "compra", unidade: "mL", quantidade: new Prisma.Decimal("0.29") }]);
    const direto: ExecucaoEtapasInput = { ...input, itens: input.itens.map((i) => ({ ...i, origemInsumo: "COMPRA_CONSUMO_DIRETO", itemCompraDiretaId: "compra", partidaId: null })) };
    await expect(preverExecucaoEtapas(direto)).rejects.toMatchObject({ campo: "itemCompraDiretaId" });
    expect(mocks.prepararAplicacao).toHaveBeenCalledTimes(2);
  });
  it.each(["etapaId", "protocoloId", "rodadaId"])("recusa tarefas com %s diferentes", async (campo) => {
    const outra = campo === "etapaId" ? { ...tarefas[1], etapaId: "outro" } : { ...tarefas[1], execucao: { ...tarefas[1].execucao, [campo]: "outro" } };
    mocks.tx.tarefaSanitaria.findMany.mockResolvedValue([tarefas[0], outra]);
    await expect(preverExecucaoEtapas(input)).rejects.toMatchObject({ campo: "itens" });
    expect(mocks.prepararAplicacao).not.toHaveBeenCalled();
  });
  it("trava animais antes de reler e grava apenas depois de validar toda a prévia", async () => {
    const previa = await preverExecucaoEtapas(input);
    await expect(confirmarExecucaoEtapas({ ...input, chave: "chave", fingerprint: previa.fingerprint }, 7)).resolves.toEqual({ resultados: [{ id: "fato-a1", animalId: "a1" }, { id: "fato-a2", animalId: "a2" }] });
    expect(mocks.travar.mock.invocationCallOrder[0]).toBeLessThan(mocks.tx.tarefaSanitaria.findMany.mock.invocationCallOrder[0]);
    expect(mocks.travarOrigens.mock.invocationCallOrder[0]).toBeLessThan(mocks.prepararAplicacao.mock.invocationCallOrder[0]);
    expect(mocks.prepararAplicacao.mock.invocationCallOrder[3]).toBeLessThan(mocks.criarAplicacao.mock.invocationCallOrder[0]);
    expect(mocks.tx.requisicaoPecuaria.create).toHaveBeenCalledTimes(1);
  });
  it("interrompe confirmação quando adiamento alterou a referência da prévia", async () => {
    const previa = await preverExecucaoEtapas(input);
    mocks.prepararAplicacao.mockResolvedValue({ dadosCriacao: {}, desvioProtocoloSnapshot: { planejado: { data: "2026-10-06" }, motivoObrigatorio: true } });
    await expect(confirmarExecucaoEtapas({ ...input, chave: "chave", fingerprint: previa.fingerprint }, 7)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(mocks.criarAplicacao).not.toHaveBeenCalled(); expect(mocks.tx.requisicaoPecuaria.create).not.toHaveBeenCalled();
  });
  it("reenvio idempotente devolve resultados anteriores sem revalidar tarefa já realizada", async () => {
    const previa = await preverExecucaoEtapas(input); const confirmar = { ...input, chave: "chave", fingerprint: previa.fingerprint };
    const original = await confirmarExecucaoEtapas(confirmar, 7);
    mocks.tx.requisicaoPecuaria.findUnique.mockResolvedValue(mocks.tx.requisicaoPecuaria.create.mock.calls[0][0].data);
    expect(await confirmarExecucaoEtapas(confirmar, 7)).toEqual(original);
    expect(mocks.criarAplicacao).toHaveBeenCalledTimes(2);
    await expect(confirmarExecucaoEtapas({ ...confirmar, fingerprint: "a".repeat(64) }, 7)).rejects.toMatchObject({ code: "CONFLITO" });
  });
  it("valida limite, duplicidade de animal e sítio na fronteira do serviço", async () => {
    await expect(preverExecucaoEtapas({ ...input, itens: [] })).rejects.toMatchObject({ campo: "itens" });
    await expect(preverExecucaoEtapas({ ...input, itens: [aplicacao, { ...aplicacao, tarefaId: "t2" }] })).rejects.toMatchObject({ campo: "itens" });
    await expect(preverExecucaoEtapas({ ...input, propriedadeId: 3 })).rejects.toMatchObject({ campo: "itens" });
    await expect(preverExecucaoEtapas({ ...input, itens: Array.from({ length: 101 }, (_, i) => ({ ...aplicacao, animalId: `a${i}`, tarefaId: `t${i}` })) })).rejects.toMatchObject({ campo: "itens" });
  });
  it("coletas conjuntas percorrem a mesma prévia e confirmação sem gerar consumo", async () => {
    const exames: ExecucaoEtapasInput = { propriedadeId: 2, itens: input.itens.map((i) => ({ tipo: "EXAME", animalId: i.animalId, propriedadeId: i.propriedadeId, tarefaId: i.tarefaId, data: i.data, tipoExameId: "exame" })) };
    const previa = await preverExecucaoEtapas(exames);
    expect(previa.consumos).toEqual([]); expect(previa.itens.map((i) => i.carencia)).toEqual([null, null]);
    expect(mocks.travarTipos).toHaveBeenCalledWith(mocks.tx, ["exame", "exame"]);
    expect(mocks.travarTipos.mock.invocationCallOrder[0]).toBeLessThan(mocks.prepararExame.mock.invocationCallOrder[0]);
    expect(mocks.criarExame).not.toHaveBeenCalled(); expect(mocks.prepararAplicacao).not.toHaveBeenCalled();
    expect(await confirmarExecucaoEtapas({ ...exames, chave: "exames", fingerprint: previa.fingerprint }, 7)).toEqual({ resultados: [{ id: "coleta-a1", animalId: "a1" }, { id: "coleta-a2", animalId: "a2" }] });
    expect(mocks.criarExame).toHaveBeenCalledTimes(2); expect(mocks.criarAplicacao).not.toHaveBeenCalled();
  });
  it("a confirmação exige chave e impressão da prévia, rejeitando parâmetros de comparação fornecidos pelo cliente", () => {
    expect(confirmarExecucaoEtapasSchema.safeParse({ propriedadeId: 2, itens: [] }).success).toBe(false);
    expect(confirmarExecucaoEtapasSchema.safeParse({ ...input, chave: "nao-uuid", fingerprint: "a".repeat(64), planejado: {} }).success).toBe(false);
  });
});
