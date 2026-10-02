import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  tx: {
    doenca: { findUnique: vi.fn(), update: vi.fn() }, motivoBaixa: { findUnique: vi.fn() },
    ocorrenciaSanitaria: { updateMany: vi.fn(), findFirst: vi.fn() },
    tipoExame: { findUnique: vi.fn(), update: vi.fn() },
    tarefaSanitaria: { findUnique: vi.fn(), update: vi.fn() }, localizacaoAnimal: { findFirst: vi.fn() },
    protocoloSanitario: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    execucaoProtocoloSanitario: { findMany: vi.fn(), create: vi.fn() },
    aplicacaoProduto: { findFirst: vi.fn() }, exameAnimal: { findFirst: vi.fn() },
    $executeRaw: vi.fn(),
  }, auditar: vi.fn(), travar: vi.fn(),
}));
vi.mock("../../../db.js", () => ({ prisma: { ...mocks.tx, $transaction: async (fn: (tx: typeof mocks.tx) => unknown) => fn(mocks.tx) } }));
vi.mock("../rebanho/regras.js", async (original) => ({ ...await original<typeof import("../rebanho/regras.js")>(), auditar: mocks.auditar, travarAnimais: mocks.travar }));
vi.mock("../fatos.js", () => ({ conferirAnimalNoFato: vi.fn() }));

import { editarDoenca } from "./ocorrencias.js";
import { editarTipoExame, nomeExameHistorico } from "./exames.js";
import { adiarTarefa, iniciarExecucao, inativarProtocolo } from "./protocolos.js";
import { obterAplicacao, obterExame, ocultarCustosDetalhe } from "./detalhes.js";

beforeEach(() => vi.resetAllMocks());
describe("manutenção sanitária preserva fatos e decisões", () => {
  it("renomear e inativar doença congela o nome legado antes da alteração e audita", async () => {
    mocks.tx.doenca.findUnique.mockResolvedValue({ id: "doenca", nome: "Mastite", ativo: true });
    mocks.tx.doenca.update.mockResolvedValue({ id: "doenca", nome: "Mastite clínica", ativo: false });
    await editarDoenca("doenca", { nome: "Mastite clínica", ativo: false }, 7);
    expect(mocks.tx.ocorrenciaSanitaria.updateMany).toHaveBeenCalledWith({ where: { doencaId: "doenca", doencaNomeSnapshot: null }, data: { doencaNomeSnapshot: "Mastite" } });
    expect(mocks.tx.ocorrenciaSanitaria.updateMany.mock.invocationCallOrder[0]).toBeLessThan(mocks.tx.doenca.update.mock.invocationCallOrder[0]);
    expect(mocks.auditar).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({ entidade: "Doenca", usuarioId: 7, antes: { id: "doenca", nome: "Mastite", ativo: true }, depois: { id: "doenca", nome: "Mastite clínica", ativo: false } }));
  });

  it("trocar formato do exame conserva nome e formato anteriores da coleta", async () => {
    mocks.tx.tipoExame.findUnique.mockResolvedValue({ id: "tipo", nome: "Teste rápido", tipoResultado: "OPCAO", opcoes: ["Positivo", "Negativo"] });
    mocks.tx.tipoExame.update.mockResolvedValue({ id: "tipo", nome: "Teste quantitativo", tipoResultado: "NUMERO" });
    await editarTipoExame("tipo", { nome: "Teste quantitativo", tipoResultado: "NUMERO", unidade: "mg" }, 7);
    expect(mocks.tx.$executeRaw).toHaveBeenCalledOnce();
    expect(mocks.tx.tipoExame.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tipoResultado: "NUMERO", opcoes: Prisma.JsonNull }) }));
    expect(nomeExameHistorico({ nome: "Teste rápido", tipoResultado: "OPCAO", opcoes: ["Positivo", "Negativo"] }, "Teste quantitativo")).toBe("Teste rápido");
  });

  it("recusa um formato por escolha sem opções, antes de gravar", async () => {
    mocks.tx.tipoExame.findUnique.mockResolvedValue({ id: "tipo", nome: "Exame", tipoResultado: "TEXTO", opcoes: null });
    await expect(editarTipoExame("tipo", { tipoResultado: "OPCAO" }, null)).rejects.toThrow("opções");
    expect(mocks.tx.tipoExame.update).not.toHaveBeenCalled();
  });

  it("adia tarefa pendente no sítio atual sem alterar parâmetros clínicos", async () => {
    const tarefa = { id: "tarefa", previstaPara: new Date("2026-09-01"), dispensadaEm: null, execucao: { animalId: "animal", canceladaEm: null }, aplicacoes: [], exames: [], parametros: { dose: "5" } };
    mocks.tx.tarefaSanitaria.findUnique.mockResolvedValue(tarefa);
    mocks.tx.localizacaoAnimal.findFirst.mockResolvedValue({ propriedadeId: 2 });
    mocks.tx.tarefaSanitaria.update.mockResolvedValue({ ...tarefa, previstaPara: new Date("2026-09-03") });
    await adiarTarefa("tarefa", { previstaPara: "2026-09-03", motivo: "Veterinário remarcou a visita" }, 7, 2);
    expect(mocks.tx.tarefaSanitaria.update).toHaveBeenCalledWith({ where: { id: "tarefa" }, data: { previstaPara: new Date("2026-09-03") } });
    expect(mocks.auditar).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({ acao: "ADIAMENTO", propriedadeId: 2, antes: tarefa, depois: expect.objectContaining({ motivo: "Veterinário remarcou a visita" }) }));
  });

  it.each(["realizada", "dispensada", "cancelada"])("recusa adiar tarefa %s", async (situacao) => {
    mocks.tx.tarefaSanitaria.findUnique.mockResolvedValue({ previstaPara: new Date("2026-09-01"), dispensadaEm: situacao === "dispensada" ? new Date() : null, execucao: { animalId: "animal", canceladaEm: situacao === "cancelada" ? new Date() : null }, aplicacoes: situacao === "realizada" ? [{ id: "feito" }] : [], exames: [] });
    mocks.tx.localizacaoAnimal.findFirst.mockResolvedValue({ propriedadeId: 2 });
    await expect(adiarTarefa("tarefa", { previstaPara: "2026-09-03", motivo: "Mudança de agenda" }, 7, 2)).rejects.toThrow("pendente");
    expect(mocks.tx.tarefaSanitaria.update).not.toHaveBeenCalled();
  });

  it.each(["2026-09-01", "2026-08-31", "2027-02-31"])("recusa adiamento para a data inválida ou não posterior %s", async (previstaPara) => {
    mocks.tx.tarefaSanitaria.findUnique.mockResolvedValue({ previstaPara: new Date("2026-09-01"), dispensadaEm: null, execucao: { animalId: "animal", canceladaEm: null }, aplicacoes: [], exames: [] });
    mocks.tx.localizacaoAnimal.findFirst.mockResolvedValue({ propriedadeId: 2 });
    await expect(adiarTarefa("tarefa", { previstaPara, motivo: "Mudança de agenda" }, 7, 2)).rejects.toMatchObject({ code: "VALIDACAO", campo: "previstaPara" });
    expect(mocks.tx.tarefaSanitaria.update).not.toHaveBeenCalled();
  });

  it("outro sítio não pode adiar a tarefa", async () => {
    mocks.tx.tarefaSanitaria.findUnique.mockResolvedValue({ execucao: { animalId: "animal" } });
    mocks.tx.localizacaoAnimal.findFirst.mockResolvedValue(null);
    await expect(adiarTarefa("tarefa", { previstaPara: "2026-09-03", motivo: "Mudança de agenda" }, 7, 9)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect(mocks.tx.tarefaSanitaria.update).not.toHaveBeenCalled();
  });

  it("exige confirmação e justificativa de execução equivalente antes de criar tarefas", async () => {
    mocks.tx.protocoloSanitario.findFirst.mockResolvedValue({ id: "p", nome: "Protocolo mastite", etapas: [] });
    mocks.tx.execucaoProtocoloSanitario.findMany.mockResolvedValue([{ id: "anterior" }]);
    const input = { protocoloId: "p", animalId: "animal", propriedadeId: 2, inicio: "2026-09-01" };
    await expect(iniciarExecucao(input, 7)).rejects.toMatchObject({ code: "CONFLITO", campo: "confirmarSobreposicao" });
    await expect(iniciarExecucao({ ...input, confirmarSobreposicao: true, justificativaSobreposicao: "sim" }, 7)).rejects.toThrow("justificativa");
    expect(mocks.tx.execucaoProtocoloSanitario.create).not.toHaveBeenCalled();
    mocks.tx.execucaoProtocoloSanitario.create.mockResolvedValue({ id: "nova", tarefas: [] });
    await iniciarExecucao({ ...input, confirmarSobreposicao: true, justificativaSobreposicao: "Nova avaliação do veterinário" }, 7);
    expect(mocks.auditar).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({ depois: expect.objectContaining({ sobreposicao: { execucaoIds: ["anterior"], justificativa: "Nova avaliação do veterinário", confirmada: true } }) }));
  });

  it("inativa protocolo sem apagar execuções ou editar versão publicada", async () => {
    mocks.tx.protocoloSanitario.findUnique.mockResolvedValue({ id: "p", publicadoEm: new Date(), ativo: true });
    mocks.tx.protocoloSanitario.update.mockResolvedValue({ id: "p", ativo: false });
    await inativarProtocolo("p", 7);
    expect(mocks.tx.protocoloSanitario.update).toHaveBeenCalledWith({ where: { id: "p" }, data: { ativo: false } });
    expect(mocks.tx.execucaoProtocoloSanitario.create).not.toHaveBeenCalled();
  });

  it("detalhe nega outro sítio e mantém nome histórico no exame", async () => {
    mocks.tx.aplicacaoProduto.findFirst.mockResolvedValue(null);
    await expect(obterAplicacao("a", 2)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect(mocks.tx.aplicacaoProduto.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "a", propriedadeId: 2 } }));
    mocks.tx.exameAnimal.findFirst.mockResolvedValue({ id: "e", formatoSnapshot: { nome: "Nome da coleta" }, tipoExame: { nome: "Nome atual" } });
    expect(await obterExame("e", 2)).toMatchObject({ tipoExame: { nome: "Nome da coleta" } });
  });

  it("oculta valores em todos os vínculos do detalhe sem perder datas ou dose", () => {
    const data = new Date("2026-09-01");
    const dose = new Prisma.Decimal(5);
    expect(ocultarCustosDetalhe({ data, dose, aplicacoes: [{ valorProdutoAtribuido: "10", valorServicoAtribuido: "20", nomeProdutoAplicado: "Vacina" }], execucoes: [{ valorServicoAtribuido: "30" }] })).toEqual({ data, dose, aplicacoes: [{ valorProdutoAtribuido: null, valorServicoAtribuido: null, nomeProdutoAplicado: "Vacina" }], execucoes: [{ valorServicoAtribuido: null }] });
  });
});
