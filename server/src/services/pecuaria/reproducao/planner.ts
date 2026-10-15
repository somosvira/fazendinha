import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { z } from "zod";
import { auditar, RebanhoError, travarAnimais } from "../rebanho/regras.js";
import { transacaoPecuaria, conflitoTransacaoPecuaria } from "../transacao.js";
import { condicaoSituacaoTarefa } from "../protocolos/situacao.js";
import { dia } from "./registros.js";
import { adicionarAtividadeTx, carregarContextosVisitaTx, contextoAnimalVisitaTx } from "./visitas.js";
import { hashDados, operacaoIdempotenteTx } from "./operacoes.js";
import { avaliarSelecaoAnimal, ordenarAnimaisSelecao, type AnimalSelecao } from "./selecoes.calc.js";
import { listarSelecoes, obterVersaoSelecaoTx } from "./selecoes.js";
import { criteriosSelecaoSchema, type CriteriosSelecao } from "./selecoes.schemas.js";
import { consultaPlannerSchema, previaGrupoPlannerSchema, incluirGrupoPlannerSchema, type GrupoPlannerInput } from "./planner.schemas.js";
import { fingerprintGrupoPlanner, identidadeGrupoProtocolo, janelaPlanner, paginarPlanner, type JanelaPlanner } from "./planner.calc.js";
import { serializarDataIatf } from "./horarios.calc.js";
import { atividadeSchema } from "./schemas.js";

type TipoAtividade = z.infer<typeof atividadeSchema>["tipo"];
type Contexto = AnimalSelecao & Record<string, unknown>;
type Membro = { animalId: string; tarefaId: string | null; contexto: Contexto; motivos: string[]; estadoTarefa?: unknown; visitasAbertas: { id: string; nome: string }[] };
type Grupo = { grupo: GrupoPlannerInput; nome: string; secao: "REPRODUCAO" | "SANIDADE"; janela: JanelaPlanner | "HABITUAL" | "EXTRA";
  tipo: TipoAtividade; protocolo: { id: string; nome: string; versao: number } | null;
  turma: { id: string; nome: string } | null; etapa: { id: string; nome: string; ordem: number } | null;
  previstaPara: string | null; precisaoTemporal: "DIA" | "HORA" | null; criterios: CriteriosSelecao | null;
  contexto: Record<string, unknown>; membros: Membro[] };
const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v));

async function carregarBaseTx(tx: Prisma.TransactionClient, propriedadeId: number, data: string) {
  const referencia = dia(data);
  const locais = await tx.localizacaoAnimal.findMany({ where: { propriedadeId, desde: { lte: referencia }, OR: [{ ate: null }, { ate: { gt: referencia } }],
    animal: { dataEntrada: { lte: referencia }, dataNascimento: { lte: referencia }, baixas: { none: { estornadaEm: null, data: { lt: referencia } } } } }, orderBy: { animalId: "asc" } });
  const ids = [...new Set(locais.map(l => l.animalId))];
  const cache = await carregarContextosVisitaTx(tx, ids, referencia);
  const contextos = new Map<string, Contexto>();
  for (const id of ids) contextos.set(id, { ...await contextoAnimalVisitaTx(tx, id, propriedadeId, referencia, cache), animalId: id });
  const tarefas = await tx.tarefaProtocolo.findMany({ where: { AND: [condicaoSituacaoTarefa("PENDENTE")],
    execucao: { animalId: { in: ids }, propriedadeId, OR: [{ rodadaId: null }, { rodada: { status: "ABERTA" } }] } },
    include: { etapa: true, execucao: { include: { protocolo: true, rodada: true } } }, orderBy: [{ previstaPara: "asc" }, { id: "asc" }] });
  const participantesVisita = tarefas.length ? await tx.participanteVisita.findMany({ where: { tarefaId: { in: tarefas.map(t => t.id) } }, select: { tarefaId: true, atividadeId: true } }) : [];
  const atividades = participantesVisita.length ? await tx.atividadeVisita.findMany({ where: { id: { in: participantesVisita.map(p => p.atividadeId) } }, select: { id: true, visitaId: true } }) : [];
  const visitas = atividades.length ? await tx.visitaVeterinaria.findMany({ where: { id: { in: atividades.map(a => a.visitaId) }, encerradaEm: null, propriedadeId }, select: { id: true, nome: true } }) : [];
  const grupos = new Map<string, Grupo>();
  for (const tarefa of tarefas) {
    const execucao = tarefa.execucao, protocolo = execucao.protocolo;
    const identidade = identidadeGrupoProtocolo({ protocoloId: protocolo.id, versao: protocolo.versao, tipo: protocolo.tipo,
      programacaoId: execucao.rodadaId, participacaoId: execucao.id, etapaId: tarefa.etapaId, previstaPara: tarefa.previstaPara,
      precisaoTemporal: tarefa.precisaoTemporal, previsaoPendente: tarefa.previsaoPendente });
    let grupo = grupos.get(identidade);
    if (!grupo) {
      const tipo: TipoAtividade = protocolo.tipo === "REPRODUTIVO" ? "TAREFA_IATF" : tarefa.etapa.tipo === "EXAME" ? "EXAME_SANITARIO" : "APLICACAO_SANITARIA";
      grupo = { grupo: { origem: "PROTOCOLO", identidade }, nome: `${protocolo.nome} · ${tarefa.etapa.nome}`,
        secao: protocolo.tipo === "REPRODUTIVO" ? "REPRODUCAO" : "SANIDADE", janela: janelaPlanner(tarefa.previstaPara, tarefa.precisaoTemporal, tarefa.previsaoPendente, data), tipo,
        protocolo: { id: protocolo.id, nome: protocolo.nome, versao: protocolo.versao },
        turma: { id: execucao.rodadaId ?? execucao.id, nome: execucao.rodada?.nome ?? "Participação individual" },
        etapa: { id: tarefa.etapaId, nome: tarefa.etapa.nome, ordem: tarefa.etapa.ordem },
        previstaPara: tarefa.previsaoPendente ? null : serializarDataIatf(tarefa.previstaPara, tarefa.precisaoTemporal), precisaoTemporal: tarefa.precisaoTemporal,
        criterios: null, contexto: { protocoloId: protocolo.id, programacaoId: execucao.rodadaId, etapaId: tarefa.etapaId }, membros: [] };
      grupos.set(identidade, grupo);
    }
    const contexto = contextos.get(execucao.animalId)!;
    const visitasAbertas = [...new Map(participantesVisita.filter(p => p.tarefaId === tarefa.id).flatMap(p => {
      const atividade = atividades.find(a => a.id === p.atividadeId), visita = visitas.find(v => v.id === atividade?.visitaId);
      return visita ? [[visita.id, visita] as const] : [];
    })).values()];
    grupo.membros.push({ animalId: execucao.animalId, tarefaId: tarefa.id, contexto, motivos: [`${protocolo.nome}, ${tarefa.etapa.nome}`, `Previsão: ${grupo.previstaPara ?? "não definida"}`], visitasAbertas,
      estadoTarefa: { previstaPara: tarefa.previstaPara, previsaoPendente: tarefa.previsaoPendente, precisaoTemporal: tarefa.precisaoTemporal,
        parametros: tarefa.parametros, execucaoId: execucao.id, inicio: execucao.inicio, inicioEfetivo: execucao.inicioEfetivo, precisaoInicioEfetivo: execucao.precisaoInicioEfetivo } });
  }
  const avaliacoes = await tx.avaliacaoReprodutiva.findMany({ where: { animalId: { in: ids }, status: "VALIDO", data: { lte: referencia } }, orderBy: [{ data: "desc" }, { criadoEm: "desc" }, { id: "desc" }] });
  const vistos = new Set<string>();
  for (const avaliacao of avaliacoes) {
    if (vistos.has(avaliacao.animalId)) continue;
    vistos.add(avaliacao.animalId);
    if (!avaliacao.retornoEm) continue;
    const retorno = avaliacao.retornoEm.toISOString().slice(0, 10), identidade = hashDados({ origem: "RETORNO", data: retorno });
    let grupo = grupos.get(identidade);
    if (!grupo) {
      grupo = { grupo: { origem: "RETORNO", identidade }, nome: "Retornos agendados", secao: "REPRODUCAO", janela: janelaPlanner(avaliacao.retornoEm, "DIA", false, data),
        tipo: "AVALIACAO_REPRODUTIVA", protocolo: null, turma: null, etapa: null, previstaPara: retorno, precisaoTemporal: "DIA", criterios: null, contexto: {}, membros: [] };
      grupos.set(identidade, grupo);
    }
    grupo.membros.push({ animalId: avaliacao.animalId, tarefaId: null, contexto: contextos.get(avaliacao.animalId)!, motivos: [`Retorno agendado para ${retorno}`],
      estadoTarefa: { avaliacaoId: avaliacao.id, retornoEm: avaliacao.retornoEm }, visitasAbertas: [] });
  }
  return { contextos, grupos };
}
function grupoSelecao(grupo: GrupoPlannerInput, nome: string, criterios: CriteriosSelecao, contextos: Map<string, Contexto>): Grupo {
  const tipo = grupo.origem === "EXTRA" ? grupo.tipo : "AVALIACAO_REPRODUTIVA";
  const reprodutivo = ["AVALIACAO_REPRODUTIVA", "INICIAR_IATF", "TAREFA_IATF"].includes(tipo);
  const membros: Membro[] = ordenarAnimaisSelecao([...contextos.values()].filter(c => !reprodutivo || c.sexo === "F"), criterios).flatMap(contexto => {
    const resultado = avaliarSelecaoAnimal(contexto, criterios);
    return resultado.incluido ? [{ animalId: contexto.animalId, tarefaId: null, contexto, motivos: resultado.motivos, visitasAbertas: [] }] : [];
  });
  return { grupo, nome, secao: ["APLICACAO_SANITARIA", "EXAME_SANITARIO", "INICIAR_SANITARIO"].includes(tipo) ? "SANIDADE" : "REPRODUCAO", janela: grupo.origem === "EXTRA" ? "EXTRA" : "HABITUAL", tipo,
    protocolo: null, turma: null, etapa: null, previstaPara: null, precisaoTemporal: null, criterios,
    contexto: grupo.origem === "EXTRA" ? grupo.contexto : {}, membros };
}
async function resolverGrupoTx(tx: Prisma.TransactionClient, propriedadeId: number, data: string, input: GrupoPlannerInput, base?: Awaited<ReturnType<typeof carregarBaseTx>>) {
  const dados = base ?? await carregarBaseTx(tx, propriedadeId, data);
  if (input.origem === "PROTOCOLO" || input.origem === "RETORNO") {
    const grupo = dados.grupos.get(input.identidade);
    if (!grupo || grupo.grupo.origem !== input.origem) throw new RebanhoError("CONFLITO", "O grupo mudou ou não tem mais pendências. Atualize o planner");
    return grupo;
  }
  if (input.origem === "EXTRA") return grupoSelecao(input, input.nome, input.criterios, dados.contextos);
  const versao = await obterVersaoSelecaoTx(tx, input.selecaoVersaoId, propriedadeId);
  return grupoSelecao(input, versao.selecao.nome, versao.criterios, dados.contextos);
}
function resumoGrupo(grupo: Grupo) {
  const { membros, ...dados } = grupo;
  return { ...dados, totalAnimais: new Set(membros.map(m => m.animalId)).size, totalProcedimentos: membros.length,
    emVisitaAberta: membros.filter(m => m.visitasAbertas.length > 0).length };
}
function fingerprint(grupo: Grupo, propriedadeId: number, data: string) {
  return fingerprintGrupoPlanner({ ...resumoGrupo(grupo), emVisitaAberta: undefined }, propriedadeId, data,
    grupo.membros.map(({ visitasAbertas: _avisos, ...membro }) => membro));
}
/** Contexto legível sem projetar custos ou payloads de fatos de outros sítios. */
function animalPrevia(membro: Membro) {
  const campos = ["animalId", "brinco", "nome", "propriedadeId", "situacao", "partos", "tentativasCiclo", "categoria", "lote", "aptidao", "papelReprodutivo", "papelReprodutivoEstado", "dataReferencia", "versaoContexto", "convencaoDel", "del", "situacaoProdutiva", "diasPosParto", "diasDesdeConfirmacao", "idadeGestacionalDias", "baseIdadeGestacional", "pendenciasContexto", "retencaoPlacenta", "diasTentativa", "diasParto", "diasGestacao", "retornoEm", "retornoInformado", "diasAteRetorno"];
  return { ...Object.fromEntries(campos.map(campo => [campo, membro.contexto[campo]])), animalId: membro.animalId, tarefaId: membro.tarefaId, motivos: membro.motivos, visitasAbertas: membro.visitasAbertas };
}
export async function consultarPlanner(input: z.infer<typeof consultaPlannerSchema>) {
  return transacaoPecuaria(tx => consultarPlannerTx(tx, input));
}
export async function consultarPlannerTx(tx: Prisma.TransactionClient, input: z.infer<typeof consultaPlannerSchema>) {
    const base = await carregarBaseTx(tx, input.propriedadeId, input.data);
    const selecoes = await listarSelecoes(input.propriedadeId, false, tx);
    const grupos = [...base.grupos.values()];
    for (const selecao of selecoes.selecoes) if (selecao.versaoAtual) grupos.push(grupoSelecao({ origem: "SELECAO", selecaoVersaoId: selecao.versaoAtual.id }, selecao.nome, criteriosSelecaoSchema.parse(selecao.versaoAtual.criterios), base.contextos));
    const ordem = { DIA: 0, ANTERIOR: 1, FUTURA: 2, SEM_PREVISAO: 3, HABITUAL: 4, EXTRA: 5 };
    grupos.sort((a, b) => ordem[a.janela] - ordem[b.janela] || a.secao.localeCompare(b.secao) || (a.previstaPara ?? "").localeCompare(b.previstaPara ?? "") || a.nome.localeCompare(b.nome, "pt-BR"));
    return { data: input.data, propriedadeId: input.propriedadeId, grupos: paginarPlanner(grupos, input.pagina, input.tamanhoPagina).map(resumoGrupo), totalGrupos: grupos.length,
      totais: { animaisUnicos: new Set(grupos.flatMap(g => g.membros.map(m => m.animalId))).size, procedimentos: grupos.reduce((n, g) => n + g.membros.length, 0) }, pagina: input.pagina, tamanhoPagina: input.tamanhoPagina };
}
export async function previaGrupoPlanner(input: z.infer<typeof previaGrupoPlannerSchema>) {
  return transacaoPecuaria(tx => previaGrupoPlannerTx(tx, input));
}
export async function previaGrupoPlannerTx(tx: Prisma.TransactionClient, input: z.infer<typeof previaGrupoPlannerSchema>) {
    const grupo = await resolverGrupoTx(tx, input.propriedadeId, input.data, input.grupo);
    return { grupo: resumoGrupo(grupo), animais: paginarPlanner(grupo.membros, input.pagina, input.tamanhoPagina).map(animalPrevia), total: grupo.membros.length,
      pagina: input.pagina, tamanhoPagina: input.tamanhoPagina, fingerprint: fingerprint(grupo, input.propriedadeId, input.data) };
}
export async function incluirGrupoPlanner(visitaId: string, input: z.infer<typeof incluirGrupoPlannerSchema>, usuarioId: number | null) {
  // A primeira leitura descobre quem travar. READ COMMITTED permite reler os fatos
  // já confirmados enquanto a transação aguardava as travas, sem snapshot antigo.
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await prisma.$transaction(tx => incluirGrupoPlannerTx(tx, visitaId, input, usuarioId), {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30_000,
      });
    } catch (erro) { if (!conflitoTransacaoPecuaria(erro) || tentativa >= 3) throw erro; }
  }
}
export async function incluirGrupoPlannerTx(tx: Prisma.TransactionClient, visitaId: string, input: z.infer<typeof incluirGrupoPlannerSchema>, usuarioId: number | null) {
  return operacaoIdempotenteTx(tx, input, usuarioId, `VISITA_GRUPO:${visitaId}`, async () => {
    const visita = await tx.visitaVeterinaria.findFirst({ where: { id: visitaId, propriedadeId: input.propriedadeId } });
    if (!visita) throw new RebanhoError("NAO_ENCONTRADO", "Visita não encontrada neste sítio");
    const data = visita.data.toISOString().slice(0, 10);
    const baseAntes = await carregarBaseTx(tx, input.propriedadeId, data);
    const antes = await resolverGrupoTx(tx, input.propriedadeId, data, input.grupo, baseAntes);
    // Trava todos os candidatos juntos, inclusive os que ainda não satisfaziam os critérios.
    await travarAnimais(tx, [...baseAntes.contextos.keys()]);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-visita:${visitaId}`}))`;
    const atual = await tx.visitaVeterinaria.findFirstOrThrow({ where: { id: visitaId, propriedadeId: input.propriedadeId } });
    if (atual.encerradaEm) throw new RebanhoError("VALIDACAO", "Visita encerrada não recebe grupos");
    if (input.grupo.origem === "SELECAO" || input.grupo.origem === "EXTRA") {
      const anteriores = await tx.atividadeVisita.findMany({ where: { visitaId }, select: { contexto: true } });
      if (anteriores.some(a => {
        const contexto = a.contexto && typeof a.contexto === "object" && !Array.isArray(a.contexto) ? a.contexto : {};
        return contexto.grupoPlanner && hashDados(contexto.grupoPlanner) === hashDados(input.grupo);
      })) throw new RebanhoError("CONFLITO", "Este grupo já foi preparado nesta visita. Revise a atividade existente.");
    }

    const idsTarefas = antes.membros.flatMap(m => m.tarefaId ? [m.tarefaId] : []);
    if (idsTarefas.length) await tx.$queryRaw(Prisma.sql`SELECT id FROM pecuaria."TarefaProtocolo" WHERE id IN (${Prisma.join(idsTarefas)}) ORDER BY id FOR UPDATE`);
    const grupo = await resolverGrupoTx(tx, input.propriedadeId, data, input.grupo);
    if (fingerprint(grupo, input.propriedadeId, data) !== input.fingerprint) throw new RebanhoError("CONFLITO", "O grupo ou o contexto dos animais mudou. Revise uma nova prévia", "fingerprint");
    const ids = new Set(grupo.membros.map(m => m.animalId)), excluidos = new Set(input.excluidos);
    if (input.excluidos.some(id => !ids.has(id))) throw new RebanhoError("VALIDACAO", "Animal excluído não pertence à prévia deste grupo", "excluidos");
    const membros = grupo.membros.filter(m => !excluidos.has(m.animalId));
    if (!membros.length) throw new RebanhoError("VALIDACAO", "O grupo precisa de ao menos um animal após a revisão", "excluidos");
    // Um animal pode ter duas tarefas no mesmo grupo: atividades distintas preservam o contrato individual.
    const lotes: Membro[][] = [];
    for (const membro of membros) {
      let lote = lotes.find(l => l.length < 1000 && !l.some(m => m.animalId === membro.animalId));
      if (!lote) { lote = []; lotes.push(lote); }
      lote.push(membro);
    }
    const atividades: Awaited<ReturnType<typeof adicionarAtividadeTx>>[] = [];
    for (const [indice, lote] of lotes.entries()) {
      const nome = grupo.nome.slice(0, lotes.length > 1 ? 95 : 120) + (lotes.length > 1 ? ` (${indice + 1}/${lotes.length})` : "");
      const atividade = atividadeSchema.parse({ propriedadeId: input.propriedadeId, tipo: grupo.tipo, nome, extra: input.grupo.origem === "EXTRA",
        contexto: { ...grupo.contexto, grupoPlanner: input.grupo, fingerprint: input.fingerprint, selecaoCriterios: grupo.criterios, excluidos: input.excluidos },
        participantes: lote.map(m => ({ animalId: m.animalId, ...(m.tarefaId ? grupo.tipo === "TAREFA_IATF" ? { tarefaIatfId: m.tarefaId } : { tarefaSanitariaId: m.tarefaId } : {}), motivos: m.motivos.slice(0, 20).map(motivo => motivo.slice(0, 300)) })) });
      // Os limites de motivos da entrada manual não cortam a explicação calculada no servidor.
      atividade.participantes.forEach((participante, i) => { participante.motivos = lote[i].motivos; });
      atividades.push(await adicionarAtividadeTx(tx, visitaId, atividade, usuarioId));
    }
    await auditar(tx, { entidade: "VisitaVeterinaria", entidadeId: visitaId, propriedadeId: input.propriedadeId, usuarioId, acao: "INCLUSAO_GRUPO", depois: { grupo: input.grupo, fingerprint: input.fingerprint, excluidos: input.excluidos, atividades: atividades.map(a => a.id) } });
    return { atividades, totalAnimais: new Set(membros.map(m => m.animalId)).size, totalProcedimentos: membros.length };
  });
}
