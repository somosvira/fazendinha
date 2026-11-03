import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./alertas/protocolos.js",()=>({reconciliarParticipacaoAlertaTx:vi.fn(),vincularParticipacaoAlertaTx:vi.fn()}));
vi.mock("./alertas/avaliador.js",()=>({marcarReavaliacaoDestinoTx:vi.fn()}));
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  tx: {
    doenca: { findUnique: vi.fn(), update: vi.fn() }, motivoBaixa: { findUnique: vi.fn() },
    ocorrenciaSanitaria: { updateMany: vi.fn(), findFirst: vi.fn() },
    etapaProtocolo: { findFirst: vi.fn() },
    tipoExame: { findUnique: vi.fn(), update: vi.fn() },
    tarefaProtocolo: { findFirst: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() }, localizacaoAnimal: { findFirst: vi.fn() },
    protocolo: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    participacaoProtocolo: { findMany: vi.fn(), create: vi.fn() },
    aplicacaoProduto: { findFirst: vi.fn() }, exameAnimal: { findFirst: vi.fn() },
    eventoTarefaProtocolo: { findFirst: vi.fn(), create: vi.fn() },
    requisicaoPecuaria: { findUnique: vi.fn(), create: vi.fn() },
    $executeRaw: vi.fn(), $queryRaw: vi.fn(),
  }, auditar: vi.fn(), travar: vi.fn(),
}));
vi.mock("../../../db.js", () => ({ prisma: { ...mocks.tx, $transaction: async (fn: (tx: typeof mocks.tx) => unknown) => fn(mocks.tx) } }));
vi.mock("../rebanho/regras.js", async (original) => ({ ...await original<typeof import("../rebanho/regras.js")>(), auditar: mocks.auditar, travarAnimais: mocks.travar }));
vi.mock("../fatos.js", () => ({ conferirAnimalNoFato: vi.fn() }));

import { editarDoenca } from "./ocorrencias.js";
import { editarTipoExame, nomeExameHistorico } from "./exames.js";
import { adiarTarefa, iniciarExecucao, inativarProtocolo } from "./protocolos.js";
import { obterAplicacao, obterExame, ocultarCustosDetalhe } from "./detalhes.js";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.tx.tarefaProtocolo.findFirst.mockResolvedValue({ id: "tarefa", execucao: { animalId: "animal" } });
  mocks.tx.tarefaProtocolo.findUniqueOrThrow.mockImplementation(async () => {
    const entrada = await mocks.tx.tarefaProtocolo.findUnique();
    return { id: "tarefa", previstaPara: new Date("2026-09-01"), previsaoOriginal: null, precisaoTemporal: "DIA", dispensadaEm: null,
      regularizacaoPendente: false, etapa: { protocoloId: "protocolo" }, aplicacoes: [], exames: [], tentativas: [], vinculos: [], ...entrada,
      execucao: { propriedadeId: 2, protocoloId: "protocolo", rodada: null, ...entrada?.execucao } };
  });
  mocks.tx.eventoTarefaProtocolo.create.mockImplementation(async ({ data }) => ({ id: "evento", ...data }));
});
describe("manutenção sanitária preserva fatos e decisões", () => {
  it("renomear e inativar doença congela o nome legado antes da alteração e audita", async () => {
    mocks.tx.doenca.findUnique.mockResolvedValue({ id: "doenca", nome: "Mastite", ativo: true });
    mocks.tx.doenca.update.mockResolvedValue({ id: "doenca", nome: "Mastite clínica", ativo: false });
    await editarDoenca("doenca", { nome: "Mastite clínica", ativo: false }, 7);
    expect(mocks.tx.ocorrenciaSanitaria.updateMany).toHaveBeenCalledWith({ where: { doencaId: "doenca", doencaNomeSnapshot: null }, data: { doencaNomeSnapshot: "Mastite" } });
    expect(mocks.tx.ocorrenciaSanitaria.updateMany.mock.invocationCallOrder[0]).toBeLessThan(mocks.tx.doenca.update.mock.invocationCallOrder[0]);
    expect(mocks.auditar).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({ entidade: "Doenca", usuarioId: 7, antes: { id: "doenca", nome: "Mastite", ativo: true }, depois: { id: "doenca", nome: "Mastite clínica", ativo: false } }));
  });

  it("permite mudar formato somente antes da primeira coleta", async () => {
    mocks.tx.tipoExame.findUnique.mockResolvedValue({ id: "tipo", nome: "Teste rápido", tipoResultado: "OPCAO", opcoes: ["Positivo", "Negativo"] });
    mocks.tx.tipoExame.update.mockResolvedValue({ id: "tipo", nome: "Teste quantitativo", tipoResultado: "NUMERO" });
    await editarTipoExame("tipo", { nome: "Teste quantitativo", tipoResultado: "NUMERO", unidade: "mg" }, 7);
    const consultasDoFormato = mocks.tx.$executeRaw.mock.calls.filter(([sql]) => sql.join("") !== "SET CONSTRAINTS ALL IMMEDIATE");
    expect(consultasDoFormato).toHaveLength(2);
    expect(mocks.tx.$executeRaw.mock.lastCall?.[0].join("")).toBe("SET CONSTRAINTS ALL IMMEDIATE");
    expect(mocks.tx.tipoExame.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tipoResultado: "NUMERO", opcoes: Prisma.JsonNull }) }));
    expect(nomeExameHistorico({ nome: "Teste rápido", tipoResultado: "OPCAO", opcoes: ["Positivo", "Negativo"] }, "Teste quantitativo")).toBe("Teste rápido");
  });

  it("recusa um formato por escolha sem opções, antes de gravar", async () => {
    mocks.tx.tipoExame.findUnique.mockResolvedValue({ id: "tipo", nome: "Exame", tipoResultado: "TEXTO", opcoes: null });
    await expect(editarTipoExame("tipo", { tipoResultado: "OPCAO" }, null)).rejects.toThrow("opções");
    expect(mocks.tx.tipoExame.update).not.toHaveBeenCalled();
  });

  it("adia tarefa pendente no sítio autorizado sem alterar parâmetros clínicos", async () => {
    const tarefa = { id: "tarefa", previstaPara: new Date("2026-09-01"), dispensadaEm: null, execucao: { animalId: "animal", canceladaEm: null }, aplicacoes: [], exames: [], parametros: { dose: "5" } };
    mocks.tx.tarefaProtocolo.findUnique.mockResolvedValue(tarefa);
    mocks.tx.localizacaoAnimal.findFirst.mockResolvedValue({ propriedadeId: 2 });
    mocks.tx.tarefaProtocolo.update.mockResolvedValue({ ...tarefa, previstaPara: new Date("2026-09-03") });
    await adiarTarefa("tarefa", { previstaPara: "2026-09-03", motivo: "Veterinário remarcou a visita" }, 7, 2);
    expect(mocks.tx.tarefaProtocolo.update).toHaveBeenCalledWith({ where: { id: "tarefa" }, data: {
      previstaPara: new Date("2026-09-03"), previsaoOriginal: tarefa.previstaPara, precisaoTemporal: "DIA", previsaoPendente: false,
    } });
    expect(mocks.tx.eventoTarefaProtocolo.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      tarefaId: "tarefa", tipo: "ADIAMENTO", motivo: "Veterinário remarcou a visita", registradoPorId: 7,
      previsaoAnterior: tarefa.previstaPara, previsaoNova: new Date("2026-09-03"), precisaoAnterior: "DIA", precisaoNova: "DIA",
    }) });
    expect(mocks.auditar).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({ entidade: "EventoTarefaProtocolo", entidadeId: "evento", usuarioId: 7,
      acao: "ADIAMENTO", propriedadeId: 2, depois: expect.objectContaining({ motivo: "Veterinário remarcou a visita" }) }));
  });

  it.each(["realizada", "dispensada", "cancelada"])("recusa adiar tarefa %s", async (situacao) => {
    mocks.tx.tarefaProtocolo.findUnique.mockResolvedValue({ previstaPara: new Date("2026-09-01"), dispensadaEm: situacao === "dispensada" ? new Date() : null, execucao: { animalId: "animal", canceladaEm: situacao === "cancelada" ? new Date() : null }, aplicacoes: situacao === "realizada" ? [{ id: "feito" }] : [], exames: [] });
    mocks.tx.localizacaoAnimal.findFirst.mockResolvedValue({ propriedadeId: 2 });
    await expect(adiarTarefa("tarefa", { previstaPara: "2026-09-03", motivo: "Mudança de agenda" }, 7, 2)).rejects.toThrow("pendente");
    expect(mocks.tx.tarefaProtocolo.update).not.toHaveBeenCalled();
  });

  it.each(["2026-09-01", "2026-08-31", "2027-02-31"])("recusa adiamento para a data inválida ou não posterior %s", async (previstaPara) => {
    mocks.tx.tarefaProtocolo.findUnique.mockResolvedValue({ previstaPara: new Date("2026-09-01"), dispensadaEm: null, execucao: { animalId: "animal", canceladaEm: null }, aplicacoes: [], exames: [] });
    mocks.tx.localizacaoAnimal.findFirst.mockResolvedValue({ propriedadeId: 2 });
    await expect(adiarTarefa("tarefa", { previstaPara, motivo: "Mudança de agenda" }, 7, 2)).rejects.toMatchObject({ code: "VALIDACAO", campo: "previstaPara" });
    expect(mocks.tx.tarefaProtocolo.update).not.toHaveBeenCalled();
  });

  it("outro sítio não pode adiar a tarefa", async () => {
    mocks.tx.tarefaProtocolo.findUnique.mockResolvedValue({ execucao: { animalId: "animal" } });
    mocks.tx.localizacaoAnimal.findFirst.mockResolvedValue(null);
    await expect(adiarTarefa("tarefa", { previstaPara: "2026-09-03", motivo: "Mudança de agenda" }, 7, 9)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect(mocks.tx.tarefaProtocolo.update).not.toHaveBeenCalled();
  });

  it("exige confirmação e justificativa de execução equivalente antes de criar tarefas", async () => {
    mocks.tx.protocolo.findFirst.mockResolvedValue({ id: "p", nome: "Protocolo mastite", etapas: [] });
    mocks.tx.participacaoProtocolo.findMany.mockResolvedValue([{ id: "anterior" }]);
    const input = { protocoloId: "p", animalId: "animal", propriedadeId: 2, inicio: "2026-09-01" };
    await expect(iniciarExecucao(input, 7)).rejects.toMatchObject({ code: "CONFLITO", campo: "confirmarSobreposicao" });
    await expect(iniciarExecucao({ ...input, confirmarSobreposicao: true, justificativaSobreposicao: "sim" }, 7)).rejects.toThrow("justificativa");
    expect(mocks.tx.participacaoProtocolo.create).not.toHaveBeenCalled();
    mocks.tx.participacaoProtocolo.create.mockResolvedValue({ id: "nova", tarefas: [] });
    await iniciarExecucao({ ...input, confirmarSobreposicao: true, justificativaSobreposicao: "Nova avaliação do veterinário" }, 7);
    expect(mocks.auditar).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({ depois: expect.objectContaining({ sobreposicao: { execucaoIds: ["anterior"], justificativa: "Nova avaliação do veterinário", confirmada: true } }) }));
  });

  it("inativa protocolo sem apagar execuções ou editar versão publicada", async () => {
    mocks.tx.protocolo.findFirst.mockResolvedValue({ id: "p", publicadoEm: new Date(), ativo: true });
    mocks.tx.protocolo.update.mockResolvedValue({ id: "p", ativo: false });
    await inativarProtocolo("p", 7);
    expect(mocks.tx.protocolo.update).toHaveBeenCalledWith({ where: { id: "p", tipo: "SANITARIO" }, data: { ativo: false } });
    expect(mocks.tx.participacaoProtocolo.create).not.toHaveBeenCalled();
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

it("resumo da aplicação segue a autorização operacional sem expor documento financeiro", () => {
  const resumoCusto = { totalConhecido: "19.70", componentes: [{ natureza: "MATERIAL", valor: "12.30" }, { natureza: "SERVICO", valor: "7.40" }] };
  const detalhe = { resumoCusto, operacaoServico: { numero: 42, valorTotal: "1000.00" } };
  expect(ocultarCustosDetalhe(detalhe)).toEqual({ resumoCusto: null, operacaoServico: { numero: 42, valorTotal: null } });
  expect(ocultarCustosDetalhe(detalhe, true)).toEqual({ resumoCusto, operacaoServico: { numero: 42, valorTotal: null } });
});
