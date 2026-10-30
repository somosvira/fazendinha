import { carregarFilasAptidaoTx } from "./filas-aptidao.js";
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
import { fingerprintGrupoPlanner, identidadeGrupoProtocolo, janelaPlanner, ordenarMembrosPorBrinco, paginarPlanner, type JanelaPlanner } from "./planner.calc.js";
import { serializarDataIatf } from "./horarios.calc.js";
import { ampliarContextosSelecaoTx, referenciasFiltrosSelecaoTx } from "./selecao-contexto.js";
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

async function carregarBaseTx(tx: Prisma.TransactionClient, propriedadeId: number, data: string, apenasContextos = false) {
  const referencia = dia(data);
  const locais = await tx.localizacaoAnimal.findMany({ where: { propriedadeId, desde: { lte: referencia }, OR: [{ ate: null }, { ate: { gt: referencia } }],
    animal: { dataEntrada: { lte: referencia }, dataNascimento: { lte: referencia }, baixas: { none: { estornadaEm: null, data: { lt: referencia } } } } }, orderBy: { animalId: "asc" } });
  const ids = [...new Set(locais.map(l => l.animalId))];
  const cache = await carregarContextosVisitaTx(tx, ids, referencia);
  const contextos = new Map<string, Contexto>();
  for (const id of ids) contextos.set(id, { ...await contextoAnimalVisitaTx(tx, id, propriedadeId, referencia, cache), animalId: id });
  if (apenasContextos) return { contextos, grupos: new Map<string, Grupo>() };
  const tarefas = await tx.tarefaProtocolo.findMany({ where: { AND: [condicaoSituacaoTarefa("PENDENTE")],
    execucao: { animalId: { in: ids }, propriedadeId, OR: [{ rodadaId: null }, { rodada: { status: "ABERTA" } }] } },
    include: { etapa: true, execucao: { include: { protocolo: true, rodada: true } } }, orderBy: [{ previstaPara: "asc" }, { id: "asc" }] });
  const participantesVisita = tarefas.length ? await tx.participanteVisita.findMany({ where: { tarefaId: { in: tarefas.map(t => t.id) } }, select: { tarefaId: true, atividadeId: true } }) : [];
  const atividades = participantesVisita.length ? await tx.atividadeVisita.findMany({ where: { id: { in: participantesVisita.map(p => p.atividadeId) } }, select: { id: true, visitaId: true } }) : [];
  const visitas = atividades.length ? await tx.visitaVeterinaria.findMany({ where: { id: { in: atividades.map(a => a.visitaId) }, encerradaEm: null, propriedadeId }, select: { id: true, nome: true } }) : [];
  const grupos = new Map<string, Grupo>();
  const avaliacoes = await tx.avaliacaoReprodutiva.findMany({ where: { animalId: { in: ids }, status: "VALIDO", data: { lte: referencia } }, orderBy: [{ data: "desc" }, { criadoEm: "desc" }, { id: "desc" }] });
  const demandas=await tx.demandaAcompanhamentoReprodutivo.findMany({where:{animalId:{in:ids},estado:"PENDENTE",dataReferencia:{lte:referencia}},orderBy:[{previstaPara:"asc"},{ocorrencia:"asc"},{id:"asc"}]});
  const examesRetorno=avaliacoes.length?await tx.interpretacaoReprodutiva.findMany({where:{id:{in:avaliacoes.map(a=>a.id)}},select:{id:true,exame:{select:{tipoExameId:true,finalidadePrincipal:true,formatoSnapshot:true,demandaAcompanhamentoId:true}}}}):[];
  const origemCompativel=(d:(typeof demandas)[number],a:(typeof avaliacoes)[number])=>{
    const exame=examesRetorno.find(e=>e.id===a.id)?.exame;
    const regra=d.regraSnapshot as Record<string,unknown>;
    return (d.tentativaId?d.tentativaId===a.tentativaId:d.gestacaoId===a.gestacaoId)&&exame?.finalidadePrincipal===d.finalidade&&(!regra.tipoExameId||(exame.tipoExameId===regra.tipoExameId&&(exame.formatoSnapshot as Record<string,unknown>).versao===regra.tipoExameVersao));
  };
  const compativel=(d:(typeof demandas)[number],a:(typeof avaliacoes)[number])=>{
    if(!origemCompativel(d,a))return false;
    const explicita=examesRetorno.find(e=>e.id===a.id)?.exame.demandaAcompanhamentoId;
    return explicita?explicita===d.id:demandas.find(c=>origemCompativel(c,a))?.id===d.id;
  };
  for (const tarefa of tarefas) {
    const execucao = tarefa.execucao, protocolo = execucao.protocolo;
    const demanda=demandas.find(d=>d.tarefaId===tarefa.id);
    const retornoInformado=demanda?avaliacoes.find(a=>a.retornoEm&&compativel(demanda,a))?.retornoEm:null;
    const previstaAgenda=retornoInformado??tarefa.previstaPara;
    const identidade = identidadeGrupoProtocolo({ protocoloId: protocolo.id, versao: protocolo.versao, tipo: protocolo.tipo,
      programacaoId: execucao.rodadaId, participacaoId: execucao.id, etapaId: tarefa.etapaId, previstaPara: previstaAgenda,
      precisaoTemporal: tarefa.precisaoTemporal, previsaoPendente: tarefa.previsaoPendente });
    let grupo = grupos.get(identidade);
    if (!grupo) {
      const tipo: TipoAtividade = protocolo.tipo === "REPRODUTIVO" ? "TAREFA_IATF" : tarefa.etapa.tipo === "EXAME" ? "EXAME_SANITARIO" : "APLICACAO_SANITARIA";
      grupo = { grupo: { origem: "PROTOCOLO", identidade }, nome: `${protocolo.nome} · ${tarefa.etapa.nome}`,
        secao: protocolo.tipo === "REPRODUTIVO" ? "REPRODUCAO" : "SANIDADE", janela: janelaPlanner(previstaAgenda, retornoInformado?"DIA":tarefa.precisaoTemporal,retornoInformado?false:tarefa.previsaoPendente,data), tipo,
        protocolo: { id: protocolo.id, nome: protocolo.nome, versao: protocolo.versao },
        turma: { id: execucao.rodadaId ?? execucao.id, nome: execucao.rodada?.nome ?? "Participação individual" },
        etapa: { id: tarefa.etapaId, nome: tarefa.etapa.nome, ordem: tarefa.etapa.ordem },
        previstaPara: retornoInformado?retornoInformado.toISOString().slice(0,10):tarefa.previsaoPendente ? null : serializarDataIatf(tarefa.previstaPara, tarefa.precisaoTemporal), precisaoTemporal: retornoInformado?"DIA":tarefa.precisaoTemporal,
        criterios: null, contexto: { protocoloId: protocolo.id, programacaoId: execucao.rodadaId, etapaId: tarefa.etapaId }, membros: [] };
      grupos.set(identidade, grupo);
    }
    const contexto = {...contextos.get(execucao.animalId)!,...(demanda?{acompanhamento:demanda}:{})};
    const visitasAbertas = [...new Map(participantesVisita.filter(p => p.tarefaId === tarefa.id).flatMap(p => {
      const atividade = atividades.find(a => a.id === p.atividadeId), visita = visitas.find(v => v.id === atividade?.visitaId);
      return visita ? [[visita.id, visita] as const] : [];
    })).values()];
    grupo.membros.push({ animalId: execucao.animalId, tarefaId: tarefa.id, contexto, motivos: [`${protocolo.nome}, ${tarefa.etapa.nome}`, `Previsão: ${grupo.previstaPara ?? "não definida"}`,...(retornoInformado?[`Retorno informado prevalece na agenda; tarefa planejada para ${tarefa.previstaPara.toISOString().slice(0,10)}`]:[])], visitasAbertas,
      estadoTarefa: { acompanhamento:demanda??null,retornoInformadoEm:retornoInformado??null,previstaParaAgenda:previstaAgenda,previstaPara: tarefa.previstaPara, previsaoPendente: tarefa.previsaoPendente, precisaoTemporal: tarefa.precisaoTemporal,
        parametros: tarefa.parametros, execucaoId: execucao.id, inicio: execucao.inicio, inicioEfetivo: execucao.inicioEfetivo, precisaoInicioEfetivo: execucao.precisaoInicioEfetivo } });
  }
  for(const demanda of demandas){
    if(demanda.tarefaId&&tarefas.some(t=>t.id===demanda.tarefaId))continue;
    const manual=avaliacoes.find(a=>a.retornoEm&&compativel(demanda,a));
    const prevista=manual?.retornoEm??demanda.previstaPara;
    const regra=demanda.regraSnapshot as Record<string,unknown>;
    const identidade=hashDados({origem:"RETORNO",finalidade:demanda.finalidade,ocorrencia:demanda.ocorrencia,politicaId:demanda.politicaId,tipoExameId:regra.tipoExameId,previstaPara:prevista});
    let grupo=grupos.get(identidade);
    if(!grupo){grupo={grupo:{origem:"RETORNO",identidade},nome:demanda.finalidade==="DIAGNOSTICO"?"Diagnóstico pendente":`Reconfirmação ${demanda.ocorrencia}`,secao:"REPRODUCAO",janela:prevista?janelaPlanner(prevista,"DIA",false,data):"SEM_PREVISAO",tipo:"AVALIACAO_REPRODUTIVA",protocolo:null,turma:null,etapa:null,previstaPara:prevista?.toISOString().slice(0,10)??null,precisaoTemporal:"DIA",criterios:null,contexto:{demandasPorAnimal:{}},membros:[]};grupos.set(identidade,grupo);}
    (grupo.contexto.demandasPorAnimal as Record<string,string>)[demanda.animalId]=demanda.id;
    grupo.membros.push({animalId:demanda.animalId,tarefaId:null,contexto:{...contextos.get(demanda.animalId)!,acompanhamento:demanda},motivos:[`${grupo.nome}; regra versão ${regra.politicaVersao}`,demanda.previstaPara?`Previsão da regra: ${demanda.previstaPara.toISOString().slice(0,10)}`:"Sem data definida",...(manual?.retornoEm?[`Retorno informado: ${manual.retornoEm.toISOString().slice(0,10)}`]:[])],estadoTarefa:{demandaId:demanda.id,versao:demanda.versao,regraSnapshot:demanda.regraSnapshot,retornoInformadoEm:manual?.retornoEm??null},visitasAbertas:[]});
  }
  const vistos = new Set<string>();
  for (const avaliacao of avaliacoes) {
    const exameRetorno=examesRetorno.find(e=>e.id===avaliacao.id)?.exame;
    const finalidade=exameRetorno?.finalidadePrincipal??"NAO_IDENTIFICADA";
    const ancora=finalidade==="DIAGNOSTICO"?avaliacao.tentativaId:avaliacao.gestacaoId;
    const necessidade=hashDados({animalId:avaliacao.animalId,ancora:ancora??`SEM_VINCULO:${avaliacao.id}`,finalidade,tipoExameId:exameRetorno?.tipoExameId??null,demandaId:exameRetorno?.demandaAcompanhamentoId??null});
    if (vistos.has(necessidade)) continue;
    vistos.add(necessidade);
    if (!avaliacao.retornoEm||demandas.some(d=>compativel(d,avaliacao))) continue;
    const retorno = avaliacao.retornoEm.toISOString().slice(0, 10), identidade = hashDados({ origem: "RETORNO", data: retorno });
    let grupo = grupos.get(identidade);
    if (!grupo) {
      grupo = { grupo: { origem: "RETORNO", identidade }, nome: "Retornos agendados", secao: "REPRODUCAO", janela: janelaPlanner(avaliacao.retornoEm, "DIA", false, data),
        tipo: "AVALIACAO_REPRODUTIVA", protocolo: null, turma: null, etapa: null, previstaPara: retorno, precisaoTemporal: "DIA", criterios: null, contexto: {}, membros: [] };
      grupos.set(identidade, grupo);
    }
    grupo.membros.push({ animalId: avaliacao.animalId, tarefaId: null, contexto: {...contextos.get(avaliacao.animalId)!,retornoOrigem:{avaliacaoId:avaliacao.id,tentativaId:avaliacao.tentativaId,gestacaoId:avaliacao.gestacaoId,finalidade,tipoExameId:exameRetorno?.tipoExameId??null}}, motivos: [`Retorno agendado para ${retorno}`],
      estadoTarefa: { avaliacaoId: avaliacao.id, retornoEm: avaliacao.retornoEm }, visitasAbertas: [] });
  }
  const aptidoes = await carregarFilasAptidaoTx(tx, ids, propriedadeId, referencia);
  for (const a of aptidoes) {
    if (!a.tipoExameId || !["AVALIACAO_DEVIDA", "RETORNO", "AGENDAMENTO"].includes(a.fila)) continue;
    const retorno = a.fila === "RETORNO" ? a.clinica?.retornoEm ?? null : null;
    const identidade = hashDados({ origem: "APTIDAO", fila: a.fila, retorno, tipoExameId: a.tipoExameId });
    let grupo = grupos.get(identidade);
    if (!grupo) {
      grupo = { grupo: { origem: "APTIDAO", identidade }, nome: a.fila === "RETORNO" ? "Retorno de aptidão" : a.fila === "AGENDAMENTO" ? "Avaliação de aptidão em visita aberta" : "Avaliação de aptidão devida",
        secao: "REPRODUCAO", janela: retorno ? janelaPlanner(dia(retorno), "DIA", false, data) : "SEM_PREVISAO", tipo: "EXAME_SANITARIO",
        protocolo: null, turma: null, etapa: null, previstaPara: retorno, precisaoTemporal: "DIA", criterios: null,
        contexto: { finalidade: "APTIDAO_REPRODUTIVA", tipoExameId: a.tipoExameId, necessidadesPorAnimal: {} }, membros: [] };
      grupos.set(identidade, grupo);
    }
    (grupo.contexto.necessidadesPorAnimal as Record<string, string>)[a.animalId] = a.necessidadeId;
    grupo.membros.push({ animalId: a.animalId, tarefaId: null, contexto: { ...contextos.get(a.animalId)!, necessidadeAptidaoId: a.necessidadeId, aptidaoClinica: a.clinica, necessidadeAptidao: a.necessidade },
      motivos: [a.fila === "RETORNO" ? `Retorno de aptidão informado para ${retorno}` : "Avaliação devida não comprova aptidão nem agendamento"], estadoTarefa: { necessidadeId: a.necessidadeId, clinica: a.clinica }, visitasAbertas: a.visitasAbertas });
  }
  return { contextos, grupos };
}
function grupoSelecao(grupo: GrupoPlannerInput, nome: string, criterios: CriteriosSelecao, contextos: Map<string, Contexto>): Grupo {
  const tipo = (grupo.origem === "EXTRA" || grupo.origem === "LIVRE") ? grupo.tipo : "AVALIACAO_REPRODUTIVA";
  const reprodutivo = ["AVALIACAO_REPRODUTIVA", "INICIAR_IATF", "TAREFA_IATF"].includes(tipo);
  const membros: Membro[] = ordenarAnimaisSelecao([...contextos.values()].filter(c => grupo.origem === "LIVRE" || !reprodutivo || c.sexo === "F"), criterios).flatMap(contexto => {
    const resultado = avaliarSelecaoAnimal(contexto, criterios);
    return resultado.incluido ? [{ animalId: contexto.animalId, tarefaId: null, contexto, motivos: resultado.motivos, visitasAbertas: [] }] : [];
  });
  return { grupo, nome, secao: ["APLICACAO_SANITARIA", "EXAME_SANITARIO", "INICIAR_SANITARIO"].includes(tipo) ? "SANIDADE" : "REPRODUCAO", janela: (grupo.origem === "EXTRA" || grupo.origem === "LIVRE") ? "EXTRA" : "HABITUAL", tipo,
    protocolo: null, turma: null, etapa: null, previstaPara: null, precisaoTemporal: null, criterios,
    contexto: (grupo.origem === "EXTRA" || grupo.origem === "LIVRE") ? grupo.contexto : {}, membros };
}
async function resolverGrupoTx(tx: Prisma.TransactionClient, propriedadeId: number, data: string, input: GrupoPlannerInput, base?: Awaited<ReturnType<typeof carregarBaseTx>>) {
  const dados = base ?? await carregarBaseTx(tx, propriedadeId, data, input.origem === "LIVRE");
  if (input.origem === "PROTOCOLO" || input.origem === "RETORNO" || input.origem === "APTIDAO") {
    const grupo = dados.grupos.get(input.identidade);
    if (!grupo || grupo.grupo.origem !== input.origem) throw new RebanhoError("CONFLITO", "O grupo mudou ou não tem mais pendências. Atualize o planner");
    return { ...grupo, membros: ordenarMembrosPorBrinco(grupo.membros) };
  }
  if (input.origem === "LIVRE") {
    if (input.criterios.versao === 2) await ampliarContextosSelecaoTx(tx, dados.contextos, propriedadeId, dia(data));
    if (input.incluidosManualmente.some(id => !dados.contextos.has(id))) throw new RebanhoError("VALIDACAO", "Inclusão manual fora do sítio ou da data da visita", "incluidosManualmente");
    const grupo = grupoSelecao(input, input.nome, input.criterios, dados.contextos);
    const referencias = await referenciasFiltrosSelecaoTx(tx, input.criterios, propriedadeId);
    const nomes = new Map(referencias.map(r => [r.id, r.nome]));
    grupo.membros.forEach(m => { m.motivos = m.motivos.map(motivo => motivo.replace(/[a-f0-9]{8}-[a-f0-9-]{27}/gi, id => nomes.get(id) ?? id)); });
    grupo.contexto = { ...grupo.contexto, referenciasSelecao: referencias };
    const camposFiltrados = new Set([...input.criterios.todas,...input.criterios.qualquer.flatMap(b=>b.todas)].map(c=>c.campo));
    grupo.membros.forEach(m=>{
      if(camposFiltrados.has("PESO_KG") && m.contexto.pesoKg != null) m.motivos.push(`Última pesagem: ${m.contexto.pesoKg} kg em ${m.contexto.pesagemData} (${m.contexto.diasPesagem} dias antes da visita)`);
      if(camposFiltrados.has("IDADE_DIAS")) m.motivos.push(`Idade: ${m.contexto.idadeDias} dias; nascimento ${m.contexto.nascimentoEstimado === "SIM" ? "estimado" : "conhecido"}`);
    });
    const incluidos = new Set(grupo.membros.map(m => m.animalId));
    for (const id of [...new Set(input.incluidosManualmente)]) if (!incluidos.has(id)) grupo.membros.push({ animalId: id, tarefaId: null, contexto: dados.contextos.get(id)!, motivos: ["Inclusão manual fora dos filtros"], visitasAbertas: [] });
    grupo.membros = ordenarAnimaisSelecao(grupo.membros.map(m => ({...m, ...m.contexto})), input.criterios);
    // Outras visitas são avisos, não mudam a assinatura clínica da prévia.
    const visitas = await tx.visitaVeterinaria.findMany({ where: { propriedadeId, encerradaEm: null }, select: { id: true, nome: true } });
    const atividades = await tx.atividadeVisita.findMany({ where: { visitaId: { in: visitas.map(v => v.id) } }, select: { id: true, visitaId: true } });
    const participantes = await tx.participanteVisita.findMany({ where: { animalId: { in: grupo.membros.map(m => m.animalId) }, atividadeId: { in: atividades.map(a => a.id) } }, select: { animalId: true, atividadeId: true } });
    grupo.membros.forEach(m => { m.visitasAbertas = [...new Map(participantes.filter(p => p.animalId === m.animalId).flatMap(p => {
      const atividade = atividades.find(a => a.id === p.atividadeId), visita = visitas.find(v => v.id === atividade?.visitaId);
      return visita ? [[visita.id, visita] as const] : [];
    })).values()]; });
    return grupo;
  }
  if (input.origem === "EXTRA") {
    if (input.criterios.versao === 2) await ampliarContextosSelecaoTx(tx, dados.contextos, propriedadeId, dia(data));
    return grupoSelecao(input, input.nome, input.criterios, dados.contextos);
  }
  const versao = await obterVersaoSelecaoTx(tx, input.selecaoVersaoId, propriedadeId);
  if (versao.criterios.versao === 2) await ampliarContextosSelecaoTx(tx, dados.contextos, propriedadeId, dia(data));
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
  const campos = ["sexo", "origem", "idadeDias", "nascimentoEstimado", "diasAptidao", "pesoKg", "pesagemData", "diasPesagem", "composicaoSelecao", "participacoesAtivas", "historicoParto", "animalId", "brinco", "nome", "propriedadeId", "situacao", "partos", "tentativasCiclo", "categoria", "lote", "aptidao", "papelReprodutivo", "papelReprodutivoEstado", "dataReferencia", "versaoContexto", "convencaoDel", "del", "situacaoProdutiva", "diasPosParto", "diasDesdeConfirmacao", "idadeGestacionalDias", "baseIdadeGestacional", "pendenciasContexto", "retencaoPlacenta", "diasTentativa", "diasParto", "diasGestacao", "retornoEm", "retornoInformado", "diasAteRetorno"];
  return { ...Object.fromEntries(campos.map(campo => [campo, membro.contexto[campo]])), animalId: membro.animalId, tarefaId: membro.tarefaId, motivos: membro.motivos, visitasAbertas: membro.visitasAbertas };
}
export async function consultarPlanner(input: z.infer<typeof consultaPlannerSchema>) {
  return transacaoPecuaria(tx => consultarPlannerTx(tx, input));
}
export async function consultarPlannerTx(tx: Prisma.TransactionClient, input: z.infer<typeof consultaPlannerSchema>, apenasAgenda = false) {
    const base = await carregarBaseTx(tx, input.propriedadeId, input.data);
    const selecoes = apenasAgenda ? { selecoes: [] } : await listarSelecoes(input.propriedadeId, false, tx);
    if (selecoes.selecoes.some(s => s.versaoAtual && criteriosSelecaoSchema.parse(s.versaoAtual.criterios).versao === 2))
      await ampliarContextosSelecaoTx(tx, base.contextos, input.propriedadeId, dia(input.data));
    const grupos = [...base.grupos.values()];
    for (const selecao of selecoes.selecoes) if (selecao.versaoAtual) grupos.push(grupoSelecao({ origem: "SELECAO", selecaoVersaoId: selecao.versaoAtual.id }, selecao.nome, criteriosSelecaoSchema.parse(selecao.versaoAtual.criterios), base.contextos));
    const ordem = { DIA: 0, ANTERIOR: 1, FUTURA: 2, SEM_PREVISAO: 3, HABITUAL: 4, EXTRA: 5 };
    grupos.sort((a, b) => ordem[a.janela] - ordem[b.janela] || a.secao.localeCompare(b.secao) || (a.previstaPara ?? "").localeCompare(b.previstaPara ?? "") || a.nome.localeCompare(b.nome, "pt-BR"));
    return { data: input.data, propriedadeId: input.propriedadeId, grupos: paginarPlanner(grupos, input.pagina, input.tamanhoPagina).map(resumoGrupo), totalGrupos: grupos.length,
      totais: { animaisUnicos: new Set(grupos.flatMap(g => g.membros.map(m => m.animalId))).size, procedimentos: grupos.reduce((n, g) => n + g.membros.length, 0) }, pagina: input.pagina, tamanhoPagina: input.tamanhoPagina };
}
export async function consultarAgenda(input: z.infer<typeof consultaPlannerSchema>) {
  return transacaoPecuaria(tx => consultarPlannerTx(tx, input, true));
}
export async function previaGrupoPlanner(input: z.infer<typeof previaGrupoPlannerSchema>) {
  return transacaoPecuaria(tx => previaGrupoPlannerTx(tx, input));
}
export async function previaGrupoPlannerTx(tx: Prisma.TransactionClient, input: z.infer<typeof previaGrupoPlannerSchema>) {
    const grupo = await resolverGrupoTx(tx, input.propriedadeId, input.data, input.grupo);
    const porSituacao = new Map<string,number>();
    if(input.grupo.origem === "LIVRE") for(const membro of grupo.membros) {
      const situacao = typeof membro.contexto.situacao === "string" ? membro.contexto.situacao : "NAO_INFORMADA";
      porSituacao.set(situacao,(porSituacao.get(situacao) ?? 0)+1);
    }
    return { ...(input.grupo.origem === "LIVRE" ? {assinaturaContexto:hashDados(grupo.membros.map(m=>({animalId:m.animalId,tarefaId:m.tarefaId,contexto:m.contexto,estadoTarefa:m.estadoTarefa}))),resumoSelecao:{porSituacao:[...porSituacao].map(([situacao,animais])=>({situacao,animais}))}} : {}), grupo: resumoGrupo(grupo), animais: paginarPlanner(grupo.membros, input.pagina, input.tamanhoPagina).map(animalPrevia), total: grupo.membros.length,
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
    const baseAntes = await carregarBaseTx(tx, input.propriedadeId, data, input.grupo.origem === "LIVRE");
    const antes = await resolverGrupoTx(tx, input.propriedadeId, data, input.grupo, baseAntes);
    // Trava todos os candidatos juntos, inclusive os que ainda não satisfaziam os critérios.
    await travarAnimais(tx, [...baseAntes.contextos.keys()]);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-visita:${visitaId}`}))`;
    const atual = await tx.visitaVeterinaria.findFirstOrThrow({ where: { id: visitaId, propriedadeId: input.propriedadeId } });
    if (atual.encerradaEm) throw new RebanhoError("VALIDACAO", "Visita encerrada não recebe grupos");
    if (input.grupo.origem === "SELECAO" || input.grupo.origem === "EXTRA" || input.grupo.origem === "LIVRE") {
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
    if (input.grupo.origem === "LIVRE") {
      const incompativeis = ["AVALIACAO_REPRODUTIVA", "INICIAR_IATF"].includes(grupo.tipo) ? membros.filter(m => m.contexto.sexo !== "F") : [];
      if (incompativeis.length) throw new RebanhoError("VALIDACAO", `Atividade reprodutiva exige fêmeas. Ajuste os animais: ${incompativeis.map(m => m.contexto.brinco ?? m.animalId).join(", ")}`, "participantes");
      if (grupo.tipo === "EXAME_SANITARIO") {
        const exame = typeof grupo.contexto.tipoExameId === "string" ? await tx.tipoExame.findFirst({ where: { id: grupo.contexto.tipoExameId, ativo: true, contexto: { in: ["SANITARIO", "COMPARTILHADO"] } } }) : null;
        if (!exame) throw new RebanhoError("VALIDACAO", "Escolha um tipo de exame sanitário ativo", "tipoExameId");
      }
      if (["INICIAR_IATF", "INICIAR_SANITARIO"].includes(grupo.tipo)) {
        const protocolo = typeof grupo.contexto.protocoloId === "string" ? await tx.protocolo.findFirst({ where: { id: grupo.contexto.protocoloId, ativo: true, publicadoEm: { not: null }, tipo: grupo.tipo === "INICIAR_IATF" ? "REPRODUTIVO" : "SANITARIO" } }) : null;
        if (!protocolo) throw new RebanhoError("VALIDACAO", "Escolha um protocolo publicado do domínio da atividade", "protocoloId");
      }
    }
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
      const atividade = atividadeSchema.parse({ propriedadeId: input.propriedadeId, tipo: grupo.tipo, nome, extra: input.grupo.origem === "EXTRA" || input.grupo.origem === "LIVRE",
        contexto: { ...grupo.contexto, retornosPorAnimal:Object.fromEntries(lote.filter(m=>m.contexto.retornoOrigem).map(m=>[m.animalId,m.contexto.retornoOrigem])), percursoVisita: { versao: 1, origem: input.grupo.origem === "PROTOCOLO" || input.grupo.origem === "RETORNO" || input.grupo.origem === "APTIDAO" ? "AGENDA" : "LIVRE" }, assinaturaPreparacao: hashDados({ fingerprint: input.fingerprint, excluidos: [...excluidos].sort() }), grupoPlanner: input.grupo, fingerprint: input.fingerprint, selecaoCriterios: grupo.criterios, excluidos: input.excluidos,
          ajustesManuais: { incluidos: input.grupo.origem === "LIVRE" ? grupo.membros.filter(m=>input.grupo.origem === "LIVRE" && input.grupo.incluidosManualmente.includes(m.animalId)).map(m=>({animalId:m.animalId,brinco:m.contexto.brinco,nome:m.contexto.nome})) : [],
            excluidos: grupo.membros.filter(m=>excluidos.has(m.animalId)).map(m=>({animalId:m.animalId,brinco:m.contexto.brinco,nome:m.contexto.nome})) } },
        participantes: lote.map(m => ({ animalId: m.animalId, ...(m.tarefaId ? grupo.tipo === "TAREFA_IATF" ? { tarefaIatfId: m.tarefaId } : { tarefaSanitariaId: m.tarefaId } : {}), motivos: m.motivos.slice(0, 20).map(motivo => motivo.slice(0, 300)) })) });
      // Os limites de motivos da entrada manual não cortam a explicação calculada no servidor.
      atividade.participantes.forEach((participante, i) => { participante.motivos = lote[i].motivos; });
      atividades.push(await adicionarAtividadeTx(tx, visitaId, atividade, usuarioId, input.grupo.origem === "LIVRE" ? new Map(lote.map(m => [m.animalId, m.contexto])) : undefined));
    }
    await auditar(tx, { entidade: "VisitaVeterinaria", entidadeId: visitaId, propriedadeId: input.propriedadeId, usuarioId, acao: "INCLUSAO_GRUPO", depois: { grupo: input.grupo, fingerprint: input.fingerprint, excluidos: input.excluidos, atividades: atividades.map(a => a.id) } });
    return { atividades, totalAnimais: new Set(membros.map(m => m.animalId)).size, totalProcedimentos: membros.length };
  });
}
