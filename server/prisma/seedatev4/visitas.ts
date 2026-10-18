import { prisma } from '../../src/db.js';
import { z } from 'zod';
import { criarVisita, salvarRascunho, imprimirVisita, confirmarAtividade, encerrarVisita } from '../../src/services/pecuaria/reproducao/visitas.js';
import { consultarAgenda, previaGrupoPlanner, incluirGrupoPlanner } from '../../src/services/pecuaria/reproducao/planner.js';
import { criarSelecao, criarSelecaoSchema } from '../../src/services/pecuaria/reproducao/selecoes.js';
import { grupoLivreSchema, type GrupoPlannerInput } from '../../src/services/pecuaria/reproducao/planner.schemas.js';
import type { Contexto } from '../seedatev3/contexto.js';
import { AVISO, brincoV4, faixa, nomeV4 } from './catalogo.js';
import { acao, animal, id, key, ref, sitio, uid } from './base.js';
import { exigirAtendimentoIntocado, exigirMesmaComposicao, exigirUnico } from './seguranca.js';

async function atividadesPreparadas(acao: string) {
  const requisicao = await prisma.requisicaoPecuaria.findUniqueOrThrow({ where: { chave: key(acao) } });
  return z.object({ atividades: z.array(z.object({ id: z.string().uuid() })).min(1) }).parse(requisicao.resultadoIds).atividades.map(a => a.id);
}

async function participantePreparado(c: Contexto, visita: string, numero: number, atividades: string[]) {
  await c.registro(ref(`participante-visita:${visita}:${numero}`), async i => {
    if (i) return prisma.participanteVisita.findUnique({ where: { id: i } });
    return exigirUnico(await prisma.participanteVisita.findMany({ where: { atividadeId: { in: atividades }, animalId: animal(c, numero) } }), `Participante da visita ${visita}/${numero}`);
  }, async () => { throw new Error('Participante preparado não encontrado; não recriar.'); });
  return prisma.participanteVisita.findUniqueOrThrow({ where: { id: id(c, `participante-visita:${visita}:${numero}`) } });
}

function grupoLivre(c: Contexto, nome: string, numeros: number[], tipo = 'AVALIACAO_REPRODUTIVA') {
  return grupoLivreSchema.parse({ origem: 'LIVRE', nome: nomeV4(nome), tipo,
    contexto: tipo === 'INICIAR_IATF' ? { protocoloId: id(c, 'protocolo:dias') } : {},
    criterios: { versao: 2, todas: [{ tipo: 'VALORES', campo: 'BUSCA', valores: numeros.map(brincoV4) }], qualquer: [],
      politicaDesconhecidos: 'EXCLUIR', ordenacao: [{ campo: 'BRINCO', direcao: 'ASC' }] },
  });
}
async function preparar(c: Contexto, visita: string, grupo: GrupoPlannerInput) {
  await acao(c, `grupo:${visita}`, async () => {
    const previa = await previaGrupoPlanner({ propriedadeId: sitio(c), data: c.dias(0), grupo, pagina: 1, tamanhoPagina: 200 });
    if (previa.total === 0) throw new Error(`Grupo ${visita} ficou vazio; nenhuma preparação será inventada.`);
    return incluirGrupoPlanner(id(c, `visita:${visita}`), { chave: key(`grupo:${visita}`), propriedadeId: sitio(c), grupo, fingerprint: previa.fingerprint, excluidos: [] }, uid(c));
  });
}
export async function visitas(c: Contexto) {
  for (const [nome, condicao] of [
    ['Três tentativas no ciclo', { tipo: 'FAIXA', campo: 'TENTATIVAS_CICLO', min: 3, max: 3 }],
    ['Pós-parto com RP', { tipo: 'VALORES', campo: 'RP', valores: ['SIM'] }],
    ['Gestantes', { tipo: 'VALORES', campo: 'SITUACAO', valores: ['GESTANTE'] }],
    ['Lactação desconhecida', { tipo: 'DESCONHECIDO', campo: 'DEL' }],
    ['Aptas ou vazias após liberação', { tipo: 'FAIXA', campo: 'DIAS_APTIDAO', min: 15, incluirMin: false }],
  ]) await c.registro(ref(`selecao:${nome}`), i => prisma.selecaoVisita.findFirst({ where: i ? { id: i } : { propriedadeId: sitio(c), nome: nomeV4(String(nome)) } }),
    () => criarSelecao(criarSelecaoSchema.parse({ propriedadeId: sitio(c), nome: nomeV4(String(nome)), criterios: { versao: 2,
      todas: [condicao, ...(nome === 'Aptas ou vazias após liberação' ? [{ tipo: 'VALORES', campo: 'SITUACAO', valores: ['APTA', 'VAZIA'] }] : [])], qualquer: [],
      ordenacao: [{ campo: 'BRINCO', direcao: 'ASC' }], politicaDesconhecidos: 'EXCLUIR',
    } }), uid(c)));
  for (const nome of ['Agenda — 120 diagnósticos', 'Seleção livre — atendimento individual', 'Iniciar IATF pela visita', 'Encerrada com ausentes', 'Nova visita para planejar'])
    await c.registro(ref(`visita:${nome}`), i => prisma.visitaVeterinaria.findFirst({ where: i ? { id: i } : { nome: nomeV4(nome), propriedadeId: sitio(c) } }),
      () => criarVisita({ chave: key(`visita:${nome}`), propriedadeId: sitio(c), data: c.dias(0), nome: nomeV4(nome), responsavel: 'Equipe de demonstração V4' }, uid(c)));
  await acao(c, 'agenda:preparar', async () => {
    const agenda = await consultarAgenda({ propriedadeId: sitio(c), data: c.dias(0), pagina: 1, tamanhoPagina: 200 });
    const grupo = agenda.grupos.find(g => g.turma?.id === id(c, 'programacao:120 diagnósticos hoje'));
    if (!grupo) throw new Error('Os 120 diagnósticos não apareceram na agenda.');
    const previa = await previaGrupoPlanner({ propriedadeId: sitio(c), data: c.dias(0), grupo: grupo.grupo, pagina: 1, tamanhoPagina: 200 });
    if (previa.total !== 120) throw new Error(`Esperados 120 participantes; encontrados ${previa.total}.`);
    return incluirGrupoPlanner(id(c, 'visita:Agenda — 120 diagnósticos'), { chave: key('agenda:preparar'), propriedadeId: sitio(c), grupo: grupo.grupo, fingerprint: previa.fingerprint, excluidos: [] }, uid(c));
  });
  const livre = 'Seleção livre — atendimento individual';
  await preparar(c, livre, grupoLivre(c, 'Diagnósticos individuais', [1, 2, 3, 15, 23, 24]));
  await preparar(c, 'Iniciar IATF pela visita', grupoLivre(c, 'Início de protocolo', [...faixa(55, 60), 26], 'INICIAR_IATF'));
  await preparar(c, 'Encerrada com ausentes', grupoLivre(c, 'Adiamento e ausência', [27, 30]));
  const visitaId = id(c, `visita:${livre}`);
  const atividadesLivres = await atividadesPreparadas(`grupo:${livre}`);
  for (const n of [1, 2]) {
    const participante = await participantePreparado(c, livre, n, atividadesLivres);
    await c.acao(ref(`rascunho:${n}`), async () => (await prisma.participanteVisita.findUniqueOrThrow({ where: { id: participante.id } })).versaoRascunho > 0,
      () => salvarRascunho(visitaId, participante.id, sitio(c), { resultado: n === 1 ? 'NEGATIVO' : 'INCONCLUSIVO', data: c.dias(0), observacao: AVISO, tipoExameId: id(c, 'exame:Avaliação completa') }, uid(c), participante.versaoRascunho));
  }
  const encerrada = id(c, 'visita:Encerrada com ausentes');
  const atividadesEncerrada = await atividadesPreparadas('grupo:Encerrada com ausentes');
  const atividadeId = exigirUnico(atividadesEncerrada, 'Atividade da visita encerrada');
  // Contexto.registro persiste o mesmo manifesto: as gravações devem ser sequenciais.
  const participantesEncerrada: Awaited<ReturnType<typeof participantePreparado>>[] = [];
  for (const n of [27, 30]) participantesEncerrada.push(await participantePreparado(c, 'Encerrada com ausentes', n, atividadesEncerrada));
  await acao(c, 'encerrada:ausentes', async () => {
    const atuais = await prisma.participanteVisita.findMany({ where: { id: { in: participantesEncerrada.map(p => p.id) } } });
    exigirAtendimentoIntocado(atuais);
    return confirmarAtividade(encerrada, atividadeId, { chave: key('encerrada:ausentes'), propriedadeId: sitio(c), itens: participantesEncerrada.map((p, i) => ({
      participanteId: p.id, versaoRascunho: 0, status: i ? 'NAO_ATENDIDO' as const : 'ADIADO' as const, motivo: 'Estado administrativo fictício, sem procedimento clínico.' })),
    }, uid(c));
  });
  await c.acao(ref('encerrar:visita'), async () => !!(await prisma.visitaVeterinaria.findUniqueOrThrow({ where: { id: encerrada } })).encerradaEm,
    async () => {
      const atividades = await prisma.atividadeVisita.findMany({ where: { visitaId: encerrada }, select: { id: true } });
      const participantes = await prisma.participanteVisita.findMany({ where: { atividadeId: { in: atividadesEncerrada } }, select: { id: true } });
      exigirMesmaComposicao(atividades.map(a => a.id), atividadesEncerrada, 'Atividades da visita');
      exigirMesmaComposicao(participantes.map(p => p.id), participantesEncerrada.map(p => p.id), 'Participantes da visita');
      return encerrarVisita(encerrada, sitio(c), uid(c));
    });
  for (const nome of ['Agenda — 120 diagnósticos', livre, 'Encerrada com ausentes']) {
    const visitaId = id(c, `visita:${nome}`);
    await c.acao(ref(`impressao:${nome}`), async () => !!await prisma.impressaoVisita.findFirst({ where: { visitaId } }), () => imprimirVisita(visitaId, sitio(c), uid(c)));
  }
}
