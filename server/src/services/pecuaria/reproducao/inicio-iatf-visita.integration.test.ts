import { randomUUID } from "node:crypto";
import { Prisma, type Animal } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { exigirBancoIntegracaoPecuaria } from "../../../lib/banco-pecuaria-integration.fixture.js";
import { adicionarAtividadeTx, confirmarAtividadeTx, criarVisitaTx } from "./visitas.js";
import { criarParticipacaoPlanejadaTx } from "./iatf.js";
import { criarProgramacaoReprodutivaTx } from "../protocolos/reproducao.js";
import { atividadeSchema, confirmacaoVisitaSchema } from "./schemas.js";

const suite = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
/** Fixtures exclusivas e todas as escritas revertidas; nunca limpa dados compartilhados. */
async function comRollback(executar: (tx: Prisma.TransactionClient) => Promise<void>) {
  exigirBancoIntegracaoPecuaria();
  const rollback = new Error("ROLLBACK_INICIO_IATF_VISITA");
  try {
    await prisma.$transaction(async tx => { await executar(tx); await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`; throw rollback; },
      { timeout: 60000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (e) { if (e !== rollback) throw e; }
}
async function fixture(tx: Prisma.TransactionClient) {
  const sitio = await tx.propriedade.create({ data: { nome: `Início visita rollback ${randomUUID()}` } });
  const animais: Animal[] = [];
  for (let i = 0; i < 3; i++) animais.push(await tx.animal.create({ data: { sexo: "F", origem: "COMPRADO", brinco: `IV-${randomUUID()}`,
    dataNascimento: new Date("2020-01-01"), dataEntrada: new Date("2024-01-01"), localizacoes: { create: { propriedadeId: sitio.id, desde: new Date("2024-01-01") } } } }));
  const protocolo = await tx.protocolo.create({ data: { tipo: "REPRODUTIVO", nome: `Início IATF ${randomUUID()}`, versao: 1,
    etapas: { create: [
      { nome: "Retirada", ordem: 1, tipo: "RETIRADA", diaRelativo: 1, configuracao: { tipo: "RETIRADA", nome: "Retirada", intervalo: 1, unidade: "DIAS" } },
      { nome: "Manejo horário", ordem: 2, tipo: "RETIRADA", diaRelativo: 12, unidadeIntervalo: "HORAS", configuracao: { tipo: "RETIRADA", nome: "Manejo horário", intervalo: 12, unidade: "HORAS" } },
    ] } } });
  await tx.protocolo.update({ where: { id: protocolo.id }, data: { publicado: true, publicadoEm: new Date() } });
  const visita = await criarVisitaTx(tx, { propriedadeId: sitio.id, nome: "Inícios selecionados", data: "2026-10-14" }, null);
  const atividade = await adicionarAtividadeTx(tx, visita.id, atividadeSchema.parse({ propriedadeId: sitio.id, nome: "Turma da visita", tipo: "INICIAR_IATF",
    contexto: { protocoloId: protocolo.id }, participantes: animais.map(a => ({ animalId: a.id })) }), null);
  const confirmar = (indices: number[], dados: Record<string, unknown> = {}, chave = randomUUID()) => confirmarAtividadeTx(tx, visita.id, atividade.id,
    confirmacaoVisitaSchema.parse({ propriedadeId: sitio.id, chave, itens: indices.map(i => ({ participanteId: atividade.participantes[i].id, versaoRascunho: 0,
      dados: { inicioEfetivo: "2026-10-14", ...dados } })) }), null);
  const pendente = async (animalId = animais[0].id, protocoloId = protocolo.id) => {
    const programa = await criarProgramacaoReprodutivaTx(tx, { data: { propriedadeId: sitio.id, protocoloId, nome: "Turma existente", inicioPrevisto: new Date("2026-10-14"), precisaoTemporal: "DIA" } });
    return criarParticipacaoPlanejadaTx(tx, programa.id, animalId, "2026-10-14", null);
  };
  return { sitio, animais, protocolo, visita, atividade, confirmar, pendente };
}

suite("início IATF pela visita — núcleo comum, fixtures em rollback", () => {
  it("prepara sem efeitos; confirma dois blocos na mesma programação, conserva DIA/HORA e retorna retry após CAS", async () => comRollback(async tx => {
    const f = await fixture(tx);
    expect(await tx.programacaoProtocolo.count({ where: { propriedadeId: f.sitio.id } })).toBe(0);
    expect(await tx.participacaoProtocolo.count({ where: { animalId: { in: f.animais.map(a => a.id) } } })).toBe(0);
    const chave = randomUUID();
    const primeiro = await f.confirmar([0], {}, chave);
    expect(JSON.parse(JSON.stringify(await f.confirmar([0], {}, chave)))).toEqual(JSON.parse(JSON.stringify(primeiro)));
    await f.confirmar([1], { inicioEfetivo: "2026-10-14T12:00:00-03:00" });
    const participacoes = await tx.participacaoProtocolo.findMany({ where: { propriedadeId: f.sitio.id }, include: { tarefas: { orderBy: { etapa: { ordem: "asc" } } } } });
    expect(participacoes).toHaveLength(2);
    expect(new Set(participacoes.map(p => p.rodadaId)).size).toBe(1);
    const dia = participacoes.find(p => p.animalId === f.animais[0].id)!;
    const hora = participacoes.find(p => p.animalId === f.animais[1].id)!;
    expect(dia.precisaoInicioEfetivo).toBe("DIA"); expect(hora.precisaoInicioEfetivo).toBe("HORA");
    expect(dia.tarefas.map(t => t.previsaoPendente)).toEqual([false, true]);
    expect(hora.tarefas.map(t => t.previsaoPendente)).toEqual([false, false]);
    expect(await tx.tentativaReprodutiva.count({ where: { animalId: { in: f.animais.map(a => a.id) } } })).toBe(0);
    expect(await tx.movimentoEstoque.count({ where: { propriedadeId: f.sitio.id } })).toBe(0);
    expect((await tx.atividadeVisita.findUniqueOrThrow({ where: { id: f.atividade.id } })).contexto).toMatchObject({ inicioIatf: { protocoloId: f.protocolo.id, programacaoId: dia.rodadaId, criadaPorId: null } });
    await expect(f.confirmar([0])).rejects.toMatchObject({ code: "CONFLITO" });
    expect(await tx.participacaoProtocolo.count({ where: { animalId: f.animais[2].id } })).toBe(0);
  }));

  it("reutiliza a pendência única, exige escolha entre várias e recusa outro animal/versão/início anterior", async () => comRollback(async tx => {
    const f = await fixture(tx);
    const a = await f.pendente();
    await f.confirmar([0]);
    expect((await tx.participanteVisita.findUniqueOrThrow({ where: { id: f.atividade.participantes[0].id } })).fatoId).toBe(a.id);
    const b = await f.pendente(f.animais[1].id), c = await f.pendente(f.animais[1].id);
    await expect(f.confirmar([1])).rejects.toThrow("várias participações");
    await expect(f.confirmar([1], { participanteIatfId: a.id })).rejects.toThrow("incompatível");
    await f.confirmar([1], { participanteIatfId: c.id });
    expect((await tx.participacaoProtocolo.findUniqueOrThrow({ where: { id: b.id } })).inicioEfetivo).toBeNull();
  }));

  it("recusa versão inativada e versão do rascunho superada antes de criar programação", async () => comRollback(async tx => {
    const f = await fixture(tx);
    await tx.participanteVisita.update({ where: { id: f.atividade.participantes[0].id }, data: { versaoRascunho: 1 } });
    await expect(f.confirmar([0])).rejects.toMatchObject({ code: "CONFLITO" });
    await tx.protocolo.update({ where: { id: f.protocolo.id }, data: { ativo: false } });
    await expect(f.confirmar([1])).rejects.toThrow("publicado e ativo");
    expect(await tx.programacaoProtocolo.count({ where: { propriedadeId: f.sitio.id } })).toBe(0);
  }));

  it.each(["ADIADO", "NAO_ATENDIDO"] as const)("%s avança versão, recusa edição antiga e preserva replay após nova edição", async status => comRollback(async tx => {
    const f = await fixture(tx);
    const participanteId = f.atividade.participantes[0].id;
    const original = confirmacaoVisitaSchema.parse({ propriedadeId: f.sitio.id, chave: randomUUID(),
      itens: [{ participanteId, versaoRascunho: 0, status, motivo: "Animal indisponível neste atendimento" }] });
    const confirmar = (input: typeof original) => confirmarAtividadeTx(tx, f.visita.id, f.atividade.id, input, null);
    const primeiro = await confirmar(original);
    expect(primeiro.participantes[0]).toMatchObject({ status, versaoRascunho: 1 });
    expect(JSON.parse(JSON.stringify(await confirmar(original)))).toEqual(JSON.parse(JSON.stringify(primeiro)));
    const outroStatus = status === "ADIADO" ? "NAO_ATENDIDO" : "ADIADO";
    const alterado = { ...original, chave: randomUUID(), itens: [{ ...original.itens[0], status: outroStatus as typeof status,
      motivo: "Situação administrativa revista no retorno" }] };
    await expect(confirmar(alterado)).rejects.toMatchObject({ code: "CONFLITO", campo: "itens.0.versaoRascunho" });
    expect(await tx.participanteVisita.findUniqueOrThrow({ where: { id: participanteId } })).toMatchObject({
      status, versaoRascunho: 1, motivo: original.itens[0].motivo });
    alterado.itens[0].versaoRascunho = 1;
    expect((await confirmar(alterado)).participantes[0]).toMatchObject({ status: outroStatus, versaoRascunho: 2 });
    // A chave original continua respondendo seu resultado, sem sobrescrever a edição posterior.
    expect(JSON.parse(JSON.stringify(await confirmar(original)))).toEqual(JSON.parse(JSON.stringify(primeiro)));
    expect(await tx.participanteVisita.findUniqueOrThrow({ where: { id: participanteId } })).toMatchObject({ status: outroStatus, versaoRascunho: 2 });
    expect(await tx.programacaoProtocolo.count({ where: { propriedadeId: f.sitio.id } })).toBe(0);
    expect(await tx.participacaoProtocolo.count({ where: { propriedadeId: f.sitio.id } })).toBe(0);
  }));

  it("adia/ausenta sem criar participação; legado sem protocolo exige participação explícita", async () => comRollback(async tx => {
    const f = await fixture(tx);
    await confirmarAtividadeTx(tx, f.visita.id, f.atividade.id, confirmacaoVisitaSchema.parse({ propriedadeId: f.sitio.id, chave: randomUUID(),
      itens: [{ participanteId: f.atividade.participantes[0].id, status: "ADIADO", motivo: "Animal ficará para retorno" },
        { participanteId: f.atividade.participantes[1].id, status: "NAO_ATENDIDO", motivo: "Animal ausente neste atendimento" }] }), null);
    expect(await tx.participacaoProtocolo.count({ where: { propriedadeId: f.sitio.id } })).toBe(0);
    await tx.atividadeVisita.update({ where: { id: f.atividade.id }, data: { contexto: {} } });
    await expect(f.confirmar([2])).rejects.toThrow("selecione uma participação explicitamente");
    const existente = await f.pendente(f.animais[2].id);
    await f.confirmar([2], { participanteIatfId: existente.id });
    expect((await tx.participacaoProtocolo.findUniqueOrThrow({ where: { id: existente.id } })).precisaoInicioEfetivo).toBe("DIA");
  }));
});

suite("atomicidade do bloco de início IATF — transação sempre revertida", () => {
  it("erro na segunda linha reverte início da primeira, programação, tarefas e vínculo contextual", async () => {
    exigirBancoIntegracaoPecuaria();
    let sitioId = 0;
    let atividadeId = "";
    let animalIds: string[] = [];
    await expect(prisma.$transaction(async tx => {
      const f = await fixture(tx);
      sitioId = f.sitio.id; atividadeId = f.atividade.id; animalIds = f.animais.map(a => a.id);
      try {
        await confirmarAtividadeTx(tx, f.visita.id, f.atividade.id, confirmacaoVisitaSchema.parse({ propriedadeId: f.sitio.id, chave: randomUUID(),
          itens: [
            { participanteId: f.atividade.participantes[0].id, dados: { inicioEfetivo: "2026-10-14" } },
            { participanteId: f.atividade.participantes[1].id, dados: { inicioEfetivo: "2099-01-01" } },
          ] }), null);
        throw new Error("A fixture deveria rejeitar a segunda linha");
      } catch (erro) {
        // Confirma que a primeira linha chegou a gravar antes da falha que aborta todo o bloco.
        expect((await tx.participanteVisita.findUniqueOrThrow({ where: { id: f.atividade.participantes[0].id } })).status).toBe("CONFIRMADO");
        expect(await tx.programacaoProtocolo.count({ where: { propriedadeId: sitioId } })).toBe(1);
        throw erro;
      }
    }, { timeout: 60000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable })).rejects.toThrow("Linha 2");
    expect(sitioId).toBeGreaterThan(0);
    expect(await prisma.propriedade.count({ where: { id: sitioId } })).toBe(0);
    expect(await prisma.atividadeVisita.count({ where: { id: atividadeId } })).toBe(0);
    expect(await prisma.programacaoProtocolo.count({ where: { propriedadeId: sitioId } })).toBe(0);
    expect(await prisma.participacaoProtocolo.count({ where: { animalId: { in: animalIds } } })).toBe(0);
  });
});
