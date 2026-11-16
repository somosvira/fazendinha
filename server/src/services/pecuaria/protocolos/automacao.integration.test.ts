import { randomUUID } from "node:crypto";
import { describe, it, expect, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { exigirBancoIntegracaoPecuaria } from "../../../lib/banco-pecuaria-integration.fixture.js";
import { criarEntradaValorizadaFixtureTx } from "../../../test/estoque-valorizado.fixture.js";
import { criarAptidaoFixture, limparAptidaoFixture } from "../../../test/aptidao-reprodutiva.fixture.js";
import { limparAlertasReprodutivosFixtureTx } from "../../../test/alertas-reprodutivos.fixture.js";
import { prepararTentativaTx, criarTentativaTx } from "../reproducao/registros.js";
import { tentativaSchema } from "../reproducao/schemas.js";
import { prepararExecucaoProtocoloTx, executarItensPreparadosProtocoloTx } from "./execucao.js";
import { transacaoPecuaria } from "../transacao.js";
import { prisma } from "../../../db.js";
import { criarProtocoloReprodutivoTx, criarParticipacaoReprodutivaTx, criarProgramacaoReprodutivaTx, criarTarefasReprodutivasTx } from "./reproducao.js";
import { ativarAutomacaoTx, executarAutomacaoTx, registrarExcecaoAutomacaoTx, registrarExcecaoAutomacao, ativarAutomacoesAdesaoTx, prepararPreviaExcecaoAutomacaoTx } from "./automacao.js";
const banco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const rollback = new Error("ROLLBACK_FIXTURE_AUTOMACAO");
async function isolado(executar: (tx: Prisma.TransactionClient) => Promise<void>) {
  exigirBancoIntegracaoPecuaria();
  try { await prisma.$transaction(async tx => { await executar(tx); throw rollback; }, { timeout: 30000 }); }
  catch (erro) { if (erro !== rollback) throw erro; }
}
async function fixture(tx: Prisma.TransactionClient, acoes = 1) {
  const token = randomUUID();
  const sitio = await tx.propriedade.create({ data: { nome: `Auto ${token}` } });
  const usuario = await tx.usuario.create({ data: { nome: "Responsável automação", email: `${token}@auto.test`, papel: "proprietario", dono: true, status: "ATIVO", abas: [], flags: [] } });
  const tipo = await tx.tipoAplicacaoSanitaria.create({ data: { nome: `Auto ${token}` } });
  const produto = await tx.produto.create({ data: { nome: `Produto ${token}`, unidade: "ML", usoSanitario: true } });
  const animal = await tx.animal.create({ data: { brinco: token, sexo: "F", origem: "COMPRADO", dataNascimento: new Date("2015-01-01"), dataEntrada: new Date("2020-01-01"), localizacoes: { create: { propriedadeId: sitio.id, desde: new Date("2020-01-01") } }, destinos: { create: { aptidao: "LEITE", desde: new Date("2020-01-01") } } } });
  await criarAptidaoFixture(tx, animal.id, sitio.id, new Date("2026-09-01"));
  const etapa = { nome: "Aplicação", tipo: "APLICACAO", intervalo: 0, unidade: "DIAS", planoAplicacao: { produtoId: produto.id, tipoAplicacaoId: tipo.id, dose: "1", unidadeDose: "ML" }, momento: { nome: "D0", ordem: 1, politicaExecucao: "AUTOMATICA_EXCECAO", horarioPadrao: "08:00", fusoHorario: "America/Sao_Paulo" } };
  const protocolo = await criarProtocoloReprodutivoTx(tx, { data: { nome: `Auto ${token}`, versao: 1, publicado: true, etapas: Array.from({ length: acoes }, (_, i) => ({ ...etapa, nome: `Aplicação ${i + 1}` })) } });
  const grupo = await criarProgramacaoReprodutivaTx(tx, { data: { propriedadeId: sitio.id, protocoloId: protocolo.id, nome: "Grupo", inicioPrevisto: new Date("2026-10-01"), precisaoTemporal: "DIA" } });
  const participante = await criarParticipacaoReprodutivaTx(tx, { data: { programacaoId: grupo.id, animalId: animal.id, inicioPrevisto: new Date("2026-10-01"), precisaoTemporal: "DIA" } });
  await criarTarefasReprodutivasTx(tx, { data: Array.from({ length: acoes }, (_, i) => ({ participanteId: participante.id, etapa: i, tipo: "APLICACAO", nome: `Aplicação ${i + 1}`, previstaEm: new Date("2026-10-01"), previsaoOriginal: new Date("2026-10-01"), precisaoTemporal: "DIA" as const, planejadoSnapshot: { versao: 1, etapa } })) });
  const tarefa = await tx.tarefaProtocolo.findFirstOrThrow({ where: { execucaoId: participante.id } });
  const momento = await tx.momentoProtocolo.findFirstOrThrow({ where: { protocoloId: protocolo.id } });
  const input = { propriedadeId: sitio.id, participacaoId: participante.id, momentoId: momento.id, itens: [{ tipo: "APLICACAO", tarefaId: tarefa.id, animalId: animal.id, propriedadeId: sitio.id, data: "2026-10-01", produtoId: produto.id, tipoAplicacaoId: tipo.id, nomeProdutoAplicado: produto.nome, dose: "1", unidadeDose: "ML", origemInsumo: "SEM_ORIGEM_JUSTIFICADA", justificativaSemOrigem: "Material fornecido para teste sem origem financeira", estadoCarenciaLeite: "INFORMADO", estadoCarenciaCarne: "INFORMADO", carenciaLeiteHoras: 0, carenciaCarneHoras: 0, desvio: { motivo: "Autorização explícita conferida para o teste" } }] };
  const tarefas = await tx.tarefaProtocolo.findMany({ where: { execucaoId: participante.id }, orderBy: { etapa: { ordem: "asc" } } });
  input.itens = tarefas.map(t => ({ ...input.itens[0], tarefaId: t.id }));
  return { input, usuario, animal, tarefa, momento, produto, sitio, tipo, protocolo, grupo, participante };
}
async function fixtureDispositivo(tx: Prisma.TransactionClient, retiradaEm: string) {
  const f = await fixture(tx);
  const produto = await tx.produto.create({ data: { nome: `Dispositivo ${randomUUID()}`, unidade: "UN", usoSanitario: true } });
  const momento = { nome: "Inserção", ordem: 1, politicaExecucao: "AUTOMATICA_EXCECAO", horarioPadrao: "08:00", fusoHorario: "America/Sao_Paulo" };
  const etapas = [
    { nome: "Inserir dispositivo", tipo: "APLICACAO", subtipo: "INSERCAO_DISPOSITIVO", intervalo: 0, unidade: "DIAS", momento, planoAplicacao: { produtoId: produto.id, tipoAplicacaoId: f.tipo.id, dose: "1", unidadeDose: "UN" } },
    { nome: "Retirar dispositivo", tipo: "RETIRADA", intervalo: Math.round((Date.parse(retiradaEm) - Date.parse("2026-10-01")) / 86400000), unidade: "DIAS", momento: { ...momento, nome: "Retirada", ordem: 2 } },
  ];
  const protocolo = await criarProtocoloReprodutivoTx(tx, { data: { nome: `Dispositivo ${randomUUID()}`, versao: 1, publicado: true, etapas } });
  const grupo = await criarProgramacaoReprodutivaTx(tx, { data: { propriedadeId: f.sitio.id, protocoloId: protocolo.id, nome: "Grupo dispositivos", inicioPrevisto: new Date("2026-10-01"), precisaoTemporal: "DIA" } });
  const participante = await criarParticipacaoReprodutivaTx(tx, { data: { programacaoId: grupo.id, animalId: f.animal.id, inicioPrevisto: new Date("2026-10-01"), precisaoTemporal: "DIA" } });
  await criarTarefasReprodutivasTx(tx, { data: etapas.map((etapa, i) => ({ participanteId: participante.id, etapa: i, tipo: etapa.tipo, nome: etapa.nome, previstaEm: new Date(i ? retiradaEm : "2026-10-01"), previsaoOriginal: new Date(i ? retiradaEm : "2026-10-01"), precisaoTemporal: "DIA" as const, planejadoSnapshot: { versao: 1, etapa } })) });
  const tarefas = await tx.tarefaProtocolo.findMany({ where: { execucaoId: participante.id }, include: { etapa: true }, orderBy: { etapa: { ordem: "asc" } } });
  const insercao = { ...f.input.itens[0], tipo: "APLICACAO" as const, unidadeDose: "UN" as const, origemInsumo: "SEM_ORIGEM_JUSTIFICADA" as const, estadoCarenciaLeite: "INFORMADO" as const, estadoCarenciaCarne: "INFORMADO" as const, tarefaId: tarefas[0].id, produtoId: produto.id, nomeProdutoAplicado: produto.nome };
  const retirada = { tipo: "RETIRADA" as const, tarefaId: tarefas[1].id, animalId: f.animal.id, propriedadeId: f.sitio.id, data: retiradaEm, insercaoTarefaId: tarefas[0].id, desvio: { motivo: "Conferência do procedimento de retirada programada" } };
  const base = { propriedadeId: f.sitio.id, participacaoId: participante.id };
  return { ...f, participante, tarefas, insercao, retirada, base };
}

async function concorrente(executar: (f: Awaited<ReturnType<typeof fixture>>, jobId: string) => Promise<void>) {
  exigirBancoIntegracaoPecuaria();
  const { f, job } = await prisma.$transaction(async tx => {
    const f = await fixture(tx); const job = await ativarAutomacaoTx(tx, f.input, f.usuario.id, new Date("2026-09-30")); return { f, job };
  }, { timeout: 30000 });
  try { await executar(f, job.id); }
  finally {
    await prisma.$transaction(async tx => {
      await limparAlertasReprodutivosFixtureTx(tx, [f.animal.id]);
      await tx.requisicaoPecuaria.deleteMany({ where: { propriedadeId: f.sitio.id } });
      await tx.auditoriaPecuaria.deleteMany({ where: { OR: [{ propriedadeId: f.sitio.id }, { animalId: f.animal.id }, { usuarioId: f.usuario.id }] } });
      await tx.automacaoProtocolo.deleteMany({ where: { propriedadeId: f.sitio.id } });
      await tx.classificacaoCustoPecuaria.deleteMany({ where: { aplicacao: { animalId: f.animal.id } } });
      await tx.vinculoTarefaProtocolo.deleteMany({ where: { tarefa: { execucaoId: f.participante.id } } });
      await tx.aplicacaoProduto.deleteMany({ where: { animalId: f.animal.id } });
      await tx.tarefaProtocolo.deleteMany({ where: { execucaoId: f.participante.id } });
      await tx.participacaoProtocolo.delete({ where: { id: f.participante.id } });
      await tx.programacaoProtocolo.delete({ where: { id: f.grupo.id } });
      await tx.protocolo.delete({ where: { id: f.protocolo.id } });
      await tx.finalidadeAnimal.deleteMany({ where: { animalId: f.animal.id } });
      await tx.localizacaoAnimal.deleteMany({ where: { animalId: f.animal.id } });
      await limparAptidaoFixture(tx, [f.animal.id]);
      await tx.animal.delete({ where: { id: f.animal.id } });
      await tx.produto.delete({ where: { id: f.produto.id } });
      await tx.tipoAplicacaoSanitaria.delete({ where: { id: f.tipo.id } });
      await tx.usuario.delete({ where: { id: f.usuario.id } });
      await tx.propriedade.delete({ where: { id: f.sitio.id } });
    }, { timeout: 30000 });
  }
}

banco("automação durável — fixtures isoladas por rollback", () => {
  it("não executa antes da hora; execução repetida retorna recibo sem duplicar fato", () => isolado(async tx => {
    const f = await fixture(tx);
    const job = await ativarAutomacaoTx(tx, f.input, f.usuario.id, new Date("2026-09-30"));
    expect(job.programadaPara.toISOString()).toBe("2026-10-01T11:00:00.000Z");
    await executarAutomacaoTx(tx, job.id, new Date("2026-10-01T10:59:59Z"));
    expect(await tx.aplicacaoProduto.count({ where: { animalId: f.animal.id } })).toBe(0);
    await executarAutomacaoTx(tx, job.id, new Date("2026-10-01T11:00:00Z"));
    await executarAutomacaoTx(tx, job.id, new Date("2026-10-01T11:01:00Z"));
    expect(await tx.aplicacaoProduto.count({ where: { animalId: f.animal.id } })).toBe(1);
    expect((await tx.automacaoProtocolo.findUniqueOrThrow({ where: { id: job.id } })).estado).toBe("EXECUTADA");
  }), 35000);
  it("cancelamento persistido impede cron e versão publicada protege os novos campos", () => isolado(async tx => {
    const f = await fixture(tx);
    const job = await ativarAutomacaoTx(tx, f.input, f.usuario.id, new Date("2026-09-30"));
    await tx.automacaoProtocolo.update({ where: { id: job.id }, data: { estado: "CANCELADA" } });
    await executarAutomacaoTx(tx, job.id, new Date("2026-10-01T11:01:00Z"));
    expect(await tx.aplicacaoProduto.count({ where: { animalId: f.animal.id } })).toBe(0);
    // Savepoint permite conferir rejeição SQL sem contaminar o restante da transação.
    await tx.$executeRawUnsafe('SAVEPOINT teste_guarda');
    await expect(tx.momentoProtocolo.update({ where: { id: f.momento.id }, data: { horarioPadrao: "09:00" } })).rejects.toThrow(/imutável/);
    await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT teste_guarda');
  }), 35000);
  it("revogação do responsável e mudança de calendário impedem execução", () => isolado(async tx => {
    const f = await fixture(tx);
    const job = await ativarAutomacaoTx(tx, f.input, f.usuario.id, new Date("2026-09-30"));
    await tx.usuario.update({ where: { id: f.usuario.id }, data: { status: "INATIVO" } });
    await expect(executarAutomacaoTx(tx, job.id, new Date("2026-10-01T11:00Z"))).rejects.toThrow(/acesso ativo/);
    await tx.usuario.update({ where: { id: f.usuario.id }, data: { status: "ATIVO" } });
    await tx.tarefaProtocolo.update({ where: { id: f.tarefa.id }, data: { previstaPara: new Date("2026-10-02") } });
    await expect(executarAutomacaoTx(tx, job.id, new Date("2026-10-01T11:00Z"))).rejects.toThrow(/Calendário alterado/);
    expect(await tx.aplicacaoProduto.count({ where: { animalId: f.animal.id } })).toBe(0);
  }), 35000);
  it.each(["DEVOLVER_ESTOQUE", "MANTER_CONSUMO"] as const)("consumo real uma vez e reversão %s com retirada e reenvio", destino => isolado(async tx => {
    const f = await fixture(tx);
    await criarEntradaValorizadaFixtureTx(tx, { data: { produtoId: f.produto.id, propriedadeId: f.sitio.id, data: new Date("2026-09-01"), tipo: "ENTRADA", origem: "INVENTARIO_INICIAL", quantidade: 10, custoUnitario: 2, valorTotal: 20 } });
    f.input.itens[0].origemInsumo = "BAIXA_ESTOQUE";
    const job = await ativarAutomacaoTx(tx, f.input, f.usuario.id, new Date("2026-09-30"));
    await executarAutomacaoTx(tx, job.id, new Date("2026-10-01T11:00Z"));
    await executarAutomacaoTx(tx, job.id, new Date("2026-10-01T11:01Z"));
    const fato = await tx.aplicacaoProduto.findFirstOrThrow({ where: { animalId: f.animal.id } });
    expect(fato.valorProdutoAtribuido?.toString()).toBe("2");
    expect(await tx.movimentoEstoque.count({ where: { produtoId: f.produto.id, tipo: "SAIDA" } })).toBe(1);
    const entrada = { chave: randomUUID(), propriedadeId: f.sitio.id, motivo: "Exceção conferida no manejo", retirarDoProtocolo: true, reversoes: [{ tipo: "APLICACAO", id: fato.id, destinoConsumo: destino, ...(destino === "MANTER_CONSUMO" ? { administracaoMantida: true } : {}) }] };
    await registrarExcecaoAutomacaoTx(tx, job.id, entrada, f.usuario.id);
    await registrarExcecaoAutomacaoTx(tx, job.id, entrada, f.usuario.id);
    await executarAutomacaoTx(tx, job.id, new Date("2026-10-01T11:02Z"));
    expect((await tx.participacaoProtocolo.findUniqueOrThrow({ where: { id: job.participacaoId } })).canceladaEm).not.toBeNull();
    expect(await tx.aplicacaoProduto.count({ where: { animalId: f.animal.id } })).toBe(1);
    const anulado = await tx.aplicacaoProduto.findUniqueOrThrow({ where: { id: fato.id } });
    expect(anulado.status).toBe("ANULADO");expect(anulado.consumoMantido).toBe(destino === "MANTER_CONSUMO");
    if (destino === "MANTER_CONSUMO") expect(anulado.administracaoMantida).toBe(true);
    expect(await tx.movimentoEstoque.count({ where: { produtoId: f.produto.id } })).toBe(destino === "DEVOLVER_ESTOQUE" ? 3 : 2);
  }), 35000);
  it("falha da segunda ação por estoque insuficiente desfaz a primeira na transação do job", () => isolado(async tx => {
    const f = await fixture(tx, 2);
    await criarEntradaValorizadaFixtureTx(tx, { data: { produtoId: f.produto.id, propriedadeId: f.sitio.id, data: new Date("2026-09-01"), tipo: "ENTRADA", origem: "INVENTARIO_INICIAL", quantidade: 1, custoUnitario: 2, valorTotal: 2 } });
    f.input.itens.forEach(i => { i.origemInsumo = "BAIXA_ESTOQUE"; });
    const job = await ativarAutomacaoTx(tx, f.input, f.usuario.id, new Date("2026-09-30"));
    await tx.$executeRawUnsafe('SAVEPOINT unidade_atomica');
    await expect(executarAutomacaoTx(tx, job.id, new Date("2026-10-01T11:00Z"))).rejects.toThrow(/Saldo|saldo/);
    await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT unidade_atomica');
    expect(await tx.aplicacaoProduto.count({ where: { animalId: f.animal.id } })).toBe(0);
    expect(await tx.movimentoEstoque.count({ where: { produtoId: f.produto.id, tipo: "SAIDA" } })).toBe(0);
    expect((await tx.automacaoProtocolo.findUniqueOrThrow({ where: { id: job.id } })).estado).toBe("AGENDADA");
  }), 35000);

  it("dois Workers concorrentes registram no máximo um fato e um recibo", () => concorrente(async (f, jobId) => {
    await Promise.all([1, 2].map(() => transacaoPecuaria(tx => executarAutomacaoTx(tx, jobId, new Date("2026-10-01T11:00Z")))));
    expect(await prisma.aplicacaoProduto.count({ where: { animalId: f.animal.id } })).toBe(1);
    expect((await prisma.automacaoProtocolo.findUniqueOrThrow({ where: { id: jobId } })).tentativas).toBe(1);
  }), 35000);
  it("execução concorrente com cancelamento preserva somente a decisão vencedora", () => concorrente(async (f, jobId) => {
    const resultados = await Promise.allSettled([
      transacaoPecuaria(tx => executarAutomacaoTx(tx, jobId, new Date("2026-10-01T11:00Z"))),
      registrarExcecaoAutomacao(jobId, { chave: randomUUID(), propriedadeId: f.sitio.id, motivo: "Animal não será atendido nesta etapa", retirarDoProtocolo: false, reversoes: [] }, f.usuario.id),
    ]);
    const job = await prisma.automacaoProtocolo.findUniqueOrThrow({ where: { id: jobId } });
    const fatos = await prisma.aplicacaoProduto.count({ where: { animalId: f.animal.id } });
    expect(["CANCELADA", "EXECUTADA"]).toContain(job.estado);
    expect(fatos).toBe(job.estado === "CANCELADA" ? 0 : 1);
    expect(resultados.some(r => r.status === "fulfilled")).toBe(true);
  }), 35000);

  it("reversão parcial conserva fatos restantes e permite nova exceção com retirada", () => isolado(async tx => {
    const f = await fixture(tx, 2);
    const job = await ativarAutomacaoTx(tx, f.input, f.usuario.id, new Date("2026-09-30"));
    await executarAutomacaoTx(tx, job.id, new Date("2026-10-01T11:00Z"));
    const fatos = await tx.aplicacaoProduto.findMany({ where: { animalId: f.animal.id }, orderBy: { id: "asc" } });
    const excecao = (id: string, retirarDoProtocolo: boolean) => ({ chave: randomUUID(), propriedadeId: f.sitio.id, motivo: "Revisão individual do procedimento", retirarDoProtocolo, reversoes: [{ tipo: "APLICACAO", id, destinoConsumo: "DEVOLVER_ESTOQUE" }] });
    await registrarExcecaoAutomacaoTx(tx, job.id, excecao(fatos[0].id, false), f.usuario.id);
    expect(await tx.aplicacaoProduto.count({ where: { animalId: f.animal.id, status: "VALIDO" } })).toBe(1);
    await registrarExcecaoAutomacaoTx(tx, job.id, excecao(fatos[1].id, true), f.usuario.id);
    expect(await tx.aplicacaoProduto.count({ where: { animalId: f.animal.id, status: "VALIDO" } })).toBe(0);
    const final = await tx.automacaoProtocolo.findUniqueOrThrow({ where: { id: job.id } });
    expect(final.estado).toBe("REVERTIDA");expect(final.resultado).toHaveLength(2);
    await executarAutomacaoTx(tx, job.id, new Date("2026-10-01T11:05Z"));
    expect(await tx.aplicacaoProduto.count({ where: { animalId: f.animal.id } })).toBe(2);
  }), 35000);

  it.each(["REGISTRAR_MANUALMENTE", "DISPENSAR"] as const)("revisão retroativa %s preserva política original na auditoria sem executar passado", decisao => isolado(async tx => {
    const f = await fixture(tx);
    await ativarAutomacoesAdesaoTx(tx, f.participante.id, f.sitio.id, [], f.usuario.id, [{ animalId: f.animal.id, etapaId: f.tarefa.etapaId, decisao, motivo: "Revisão explícita do início retroativo" }]);
    const tarefa = await tx.tarefaProtocolo.findUniqueOrThrow({ where: { id: f.tarefa.id } });
    expect(tarefa.momentoSnapshot).toMatchObject({ politicaExecucao: "AUTOMATICA_EXCECAO" });
    expect(tarefa.historicoRegularizacao).toEqual([expect.objectContaining({ acao: "REVISAO_AUTOMACAO_RETROATIVA", decisao })]);
    expect(tarefa.dispensadaEm != null).toBe(decisao === "DISPENSAR");
    expect(await tx.automacaoProtocolo.count({ where: { participacaoId: f.participante.id } })).toBe(0);
    expect(await tx.aplicacaoProduto.count({ where: { animalId: f.animal.id } })).toBe(0);
    expect(await tx.auditoriaPecuaria.count({ where: { entidadeId: f.tarefa.id, acao: "REVISAO_INICIO_RETROATIVO" } })).toBe(1);
  }), 35000);

  it("inserção automática fornece a origem real para retirada automática posterior", () => isolado(async tx => {
    const f = await fixtureDispositivo(tx, "2026-10-02");
    expect(f.tarefas[0].etapa.configuracao).toMatchObject({ subtipo: "INSERCAO_DISPOSITIVO" });
    const primeiro = await ativarAutomacaoTx(tx, { ...f.base, momentoId: f.tarefas[0].etapa.momentoId, itens: [f.insercao] }, f.usuario.id, new Date("2026-09-30"));
    const segundo = await ativarAutomacaoTx(tx, { ...f.base, momentoId: f.tarefas[1].etapa.momentoId, itens: [f.retirada] }, f.usuario.id, new Date("2026-09-30"));
    expect(await tx.aplicacaoProduto.count({ where: { animalId: f.animal.id } })).toBe(0);
    await executarAutomacaoTx(tx, primeiro.id, new Date("2026-10-01T11:00Z"));
    await executarAutomacaoTx(tx, segundo.id, new Date("2026-10-02T11:00Z"));
    const aplicacao = await tx.aplicacaoProduto.findFirstOrThrow({ where: { tarefaId: f.tarefas[0].id } });
    expect(await tx.manejoAnimal.findFirst({ where: { tarefaId: f.tarefas[1].id } })).toMatchObject({ insercaoAplicacaoId: aplicacao.id, tipo: "RETIRADA_DISPOSITIVO" });
  }), 35000);
  it("inserção retroativa manual permite agendar retirada futura, mas exige fato real na execução", () => isolado(async tx => {
    const futura = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const f = await fixtureDispositivo(tx, futura);
    await ativarAutomacoesAdesaoTx(tx, f.participante.id, f.sitio.id, [{ animalId: f.animal.id, etapaId: f.tarefas[1].etapaId, dados: { tipo: "RETIRADA", insercaoEtapaId: f.tarefas[0].etapaId, desvio: f.retirada.desvio } }], f.usuario.id, [{ animalId: f.animal.id, etapaId: f.tarefas[0].etapaId, decisao: "REGISTRAR_MANUALMENTE", motivo: "Revisar a inserção no atendimento individual" }]);
    const job = await tx.automacaoProtocolo.findFirstOrThrow({ where: { participacaoId: f.participante.id } });
    expect(await tx.automacaoProtocolo.count({ where: { participacaoId: f.participante.id } })).toBe(1);
    expect(await tx.aplicacaoProduto.count({ where: { animalId: f.animal.id } })).toBe(0);
    await expect(executarAutomacaoTx(tx, job.id, new Date(`${futura}T12:00Z`))).rejects.toThrow(/único registro válido/);
    const previa = await prepararExecucaoProtocoloTx(tx, { versao: 1, propriedadeId: f.sitio.id, itens: [{ ...f.insercao, aplicadaEm: "2026-10-01T11:00:00Z" }] });
    await executarItensPreparadosProtocoloTx(tx, previa, f.usuario.id);
    vi.useFakeTimers({ toFake: ["Date"] });
    try { vi.setSystemTime(new Date(`${futura}T12:00Z`)); await executarAutomacaoTx(tx, job.id, new Date()); }
    finally { vi.useRealTimers(); }
    expect(await tx.manejoAnimal.count({ where: { tarefaId: f.tarefas[1].id, tipo: "RETIRADA_DISPOSITIVO" } })).toBe(1);
  }), 35000);

  it("prévia de reversão não grava, revalida escolhas/estado e conserva reenvio idempotente", () => isolado(async tx => {
    const f = await fixture(tx);
    const job = await ativarAutomacaoTx(tx, f.input, f.usuario.id, new Date("2026-09-30"));
    await executarAutomacaoTx(tx, job.id, new Date("2026-10-01T11:00Z"));
    const fato = await tx.aplicacaoProduto.findFirstOrThrow({ where: { animalId: f.animal.id } });
    const input = { chave: randomUUID(), propriedadeId: f.sitio.id, motivo: "Ação automática não ocorreu", retirarDoProtocolo: true, reversoes: [{ tipo: "APLICACAO", id: fato.id, destinoConsumo: "DEVOLVER_ESTOQUE" }] };
    const auditorias = await tx.auditoriaPecuaria.count({ where: { propriedadeId: f.sitio.id } });
    const previa = await prepararPreviaExcecaoAutomacaoTx(tx, job.id, input, f.usuario.id);
    expect(previa.impedimentos).toEqual([]);expect(previa.fatos[0].efeitoMaterial).toMatch(/não será criada entrada/);
    expect(JSON.stringify(previa)).not.toMatch(/valorProdutoAtribuido|valorServicoAtribuido/);
    expect(await tx.auditoriaPecuaria.count({ where: { propriedadeId: f.sitio.id } })).toBe(auditorias);
    expect((await tx.aplicacaoProduto.findUniqueOrThrow({ where: { id: fato.id } })).status).toBe("VALIDO");
    await expect(prepararPreviaExcecaoAutomacaoTx(tx, job.id, { ...input, propriedadeId: f.sitio.id + 99999 }, f.usuario.id)).rejects.toThrow(/neste sítio/);
    await expect(registrarExcecaoAutomacaoTx(tx, job.id, { ...input, retirarDoProtocolo: false, fingerprint: previa.fingerprint }, f.usuario.id)).rejects.toThrow(/mudaram/);
    await tx.automacaoProtocolo.update({ where: { id: job.id }, data: { revisao: { increment: 1 } } });
    await expect(registrarExcecaoAutomacaoTx(tx, job.id, { ...input, fingerprint: previa.fingerprint }, f.usuario.id)).rejects.toThrow(/mudaram/);
    const atual = await prepararPreviaExcecaoAutomacaoTx(tx, job.id, input, f.usuario.id);
    const payload = { ...input, fingerprint: atual.fingerprint };
    await registrarExcecaoAutomacaoTx(tx, job.id, payload, f.usuario.id);
    await registrarExcecaoAutomacaoTx(tx, job.id, payload, f.usuario.id);
    expect((await tx.aplicacaoProduto.findUniqueOrThrow({ where: { id: fato.id } })).status).toBe("ANULADO");
  }), 35000);

  it("consumo excepcional novo exige motivo, mantém uma tentativa e audita sem inventar perda", () => isolado(async tx => {
    const f = await fixture(tx);
    const produto = await tx.produto.create({ data: { nome: `Sêmen ${randomUUID()}`, unidade: "DOSE", usoGenetico: true } });
    const touro = await tx.genitorExterno.create({ data: { nome: `Touro ${randomUUID()}`, sexo: "M" } });
    const material = await tx.materialGenetico.create({ data: { tipo: "SEMEN", produtoId: produto.id, touroExternoId: touro.id } });
    const input = tentativaSchema.parse({ chave: randomUUID(), animalId: f.animal.id, propriedadeId: f.sitio.id, data: "2026-10-01", tipo: "IA", materialId: material.id, origem: "DOCUMENTADA", quantidade: 2, justificativaSemOrigem: "Registro documental com consumo conhecido" });
    await expect(prepararTentativaTx(tx, input, f.usuario.id)).rejects.toThrow(/motivo/);
    expect(await tx.tentativaReprodutiva.count({ where: { animalId: f.animal.id } })).toBe(0);
    const autorizado = { ...input, motivoQuantidadeExcepcional: "Consumo excepcional observado no atendimento" };
    await prepararTentativaTx(tx, autorizado, f.usuario.id);
    expect(await tx.tentativaReprodutiva.count({ where: { animalId: f.animal.id } })).toBe(0);
    const fato = await criarTentativaTx(tx, autorizado, f.usuario.id);
    expect(fato.quantidade?.toString()).toBe("2");
    expect(await tx.tentativaReprodutiva.count({ where: { animalId: f.animal.id } })).toBe(1);
    expect(await tx.movimentoEstoque.count({ where: { propriedadeId: f.sitio.id } })).toBe(0);
    const auditoria = await tx.auditoriaPecuaria.findFirstOrThrow({ where: { entidadeId: fato.id, acao: "REGISTRO" } });
    expect(auditoria.depois).toMatchObject({ quantidadeExcepcional: true, motivoQuantidadeExcepcional: autorizado.motivoQuantidadeExcepcional });
  }), 35000);

});
