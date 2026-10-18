import { prisma } from '../../src/db.js';
import * as iatf from '../../src/services/pecuaria/reproducao/iatf.js';
import * as sanitario from '../../src/services/pecuaria/sanidade/protocolos.js';
import { criarRodada } from '../../src/services/pecuaria/sanidade/rodadas.js';
import { criarAplicacao, anularAplicacao } from '../../src/services/pecuaria/sanidade/aplicacoes.js';
import { protocoloSchema, programacaoSchema, type EtapaIatf } from '../../src/services/pecuaria/reproducao/schemas.js';
import type { Contexto } from '../seedatev3/contexto.js';
import { AVISO, faixa, nomeV4 } from './catalogo.js';
import { acao, animal, id, key, ref, sitio, uid } from './base.js';
import { exigirUnico, idsDoManifesto } from './seguranca.js';

function etapas(c: Contexto, tipo: string): EtapaIatf[] {
  const ia = { tipo: 'IA' as const, materialId: id(c, 'material:semen'), quantidade: 1 };
  const dg = { tipo: 'DIAGNOSTICO' as const, tipoExameId: id(c, 'exame:Avaliação completa') };
  if (tipo === 'diagnostico') return [
    { nome: 'Manejo inicial', tipo: 'MANEJO', intervalo: 0, unidade: 'DIAS' },
    { nome: 'Inseminação', tipo: 'TENTATIVA', intervalo: 10, unidade: 'DIAS', planoTentativa: ia },
    { nome: 'Diagnóstico coletivo', tipo: 'AVALIACAO', intervalo: 40, unidade: 'DIAS', planoAvaliacao: dg },
  ];
  if (tipo === 'te') return [
    { nome: 'Manejo da receptora', tipo: 'MANEJO', intervalo: 0, unidade: 'DIAS' },
    { nome: 'Transferência de embrião', tipo: 'TENTATIVA', intervalo: 7, unidade: 'DIAS', planoTentativa: { tipo: 'TE', materialId: id(c, 'material:embriao'), quantidade: 1 } },
    { nome: 'Diagnóstico da receptora', tipo: 'AVALIACAO', intervalo: 37, unidade: 'DIAS', planoAvaliacao: dg },
  ];
  if (tipo === 'horas') return [
    { nome: 'Manejo inicial', tipo: 'MANEJO', intervalo: 0, unidade: 'DIAS' },
    { nome: 'Retirada — previsão horária pendente', tipo: 'RETIRADA', intervalo: 48, unidade: 'HORAS' },
    { nome: 'IA com orientação temporal', tipo: 'TENTATIVA', intervalo: 240, unidade: 'HORAS', planoTentativa: ia,
      orientacaoTemporal: { versao: 1, referencia: 'INICIO_EFETIVO', intervaloHoras: 240, toleranciaAntesMinutos: 60, toleranciaDepoisMinutos: 60, efeito: 'ALERTA' } },
  ];
  return [
    { nome: 'Aplicação inicial', tipo: 'APLICACAO', intervalo: 0, unidade: 'DIAS', planoAplicacao: { produtoId: id(c, 'produto:sanitario'), dose: '2', unidadeDose: 'ML', via: 'Demonstrativa' } },
    { nome: 'Retirada', tipo: 'RETIRADA', intervalo: 7, unidade: 'DIAS' },
    { nome: 'Inseminação', tipo: 'TENTATIVA', intervalo: 10, unidade: 'DIAS', planoTentativa: ia },
    { nome: 'Diagnóstico', tipo: 'AVALIACAO', intervalo: 40, unidade: 'DIAS', planoAvaliacao: dg },
  ];
}
async function programar(c: Contexto, nome: string, protocolo: string, numeros: number[], inicio: number, iniciar = true) {
  await c.registro(ref(`programacao:${nome}`), i => prisma.programacaoProtocolo.findFirst({ where: i ? { id: i } : { nome: nomeV4(nome) } }), () => iatf.criarProgramacao(programacaoSchema.parse({
    chave: key(`programacao:${nome}`), propriedadeId: sitio(c), protocoloId: id(c, `protocolo:${protocolo}`), nome: nomeV4(nome), inicioPrevisto: c.dias(inicio),
    animais: numeros.slice(0, 100).map(n => ({ animalId: animal(c, n) })),
  }), uid(c)));
  const programacaoId = id(c, `programacao:${nome}`);
  if (numeros.length > 100) await acao(c, `adicionar:${nome}`, () => iatf.adicionarParticipantes(programacaoId, { chave: key(`adicionar:${nome}`), propriedadeId: sitio(c),
    animais: numeros.slice(100).map(n => ({ animalId: animal(c, n), inicioPrevisto: c.dias(inicio) })),
  }, uid(c)));
  for (const n of numeros) await c.registro(ref(`participante:${nome}:${n}`), async i => {
    if (i) return prisma.participanteIatf.findUnique({ where: { id: i } });
    const encontrados = await prisma.participanteIatf.findMany({ where: { programacaoId, animalId: animal(c, n) } });
    return exigirUnico(encontrados, `Participação ${nome}/${n}`);
  }, async () => { throw new Error('Participação criada não encontrada; não recriar.'); });
  const participantes = await prisma.participanteIatf.findMany({ where: { id: { in: numeros.map(n => id(c, `participante:${nome}:${n}`)) } } });
  if (iniciar) for (const p of participantes) await c.acao(ref(`iniciar:${p.id}`), async () => !!(await prisma.participanteIatf.findUniqueOrThrow({ where: { id: p.id } })).inicioEfetivo,
    () => iatf.iniciarParticipante(p.id, sitio(c), c.dias(inicio), uid(c)));
  return participantes;
}
async function executarAte(c: Contexto, programa: string, etapa: number) {
  const participantes = idsDoManifesto(c.manifesto.ids, ref(`participante:${programa}:`));
  const tarefas = await prisma.tarefaIatf.findMany({ where: { participanteId: { in: participantes }, etapa: { lte: etapa } },
    orderBy: [{ participanteId: 'asc' }, { etapa: 'asc' }] });
  for (const t of tarefas) {
    let dados: Record<string, unknown> = { observacao: AVISO };
    if (t.tipo === 'APLICACAO') dados = {
      produtoId: id(c, 'produto:sanitario'), nomeProdutoAplicado: nomeV4('sanitario'), origemInsumo: 'BAIXA_ESTOQUE', dose: '2', unidadeDose: 'ML', via: 'Demonstrativa',
      tipoAplicacaoId: c.id('aplicacao:Tratamento'), estadoCarenciaLeite: 'INFORMADO', estadoCarenciaCarne: 'INFORMADO', carenciaLeiteHoras: 0, carenciaCarneHoras: 0, referenciaCarencia: AVISO,
    };
    if (t.tipo === 'TENTATIVA') dados = { tipo: 'IA', materialId: id(c, 'material:semen'), origem: 'DOCUMENTADA', justificativaSemOrigem: AVISO, quantidade: 1, observacao: AVISO };
    await acao(c, `executar:${t.id}`, () => iatf.executarTarefa(t.id, { chave: key(`executar:${t.id}`), propriedadeId: sitio(c), realizadaEm: t.previstaEm.toISOString().slice(0, 10), dados }, uid(c)));
  }
}

export async function protocolos(c: Contexto) {
  for (const tipo of ['dias', 'horas', 'te', 'diagnostico', 'rascunho']) await c.registro(ref(`protocolo:${tipo}`), i => prisma.protocolo.findFirst({ where: i ? { id: i } : { nome: nomeV4(`Protocolo ${tipo}`) } }),
    () => iatf.criarProtocolo(protocoloSchema.parse({ nome: nomeV4(`Protocolo ${tipo}`), descricao: AVISO, versao: 1, publicado: tipo !== 'rascunho', etapas: etapas(c, tipo) }), uid(c)));
  for (const [nome, tipo, numeros, inicio, iniciar, etapa] of [
    ['120 diagnósticos hoje', 'diagnostico', faixa(101, 220), -40, true, 1],
    ['IA prevista hoje', 'dias', faixa(37, 42), -10, true, 1],
    ['IATF em evolução', 'dias', faixa(31, 36), -5, true, 0],
    ['Hora desconhecida', 'horas', faixa(43, 48), -1, true, 0],
    ['TE prevista hoje', 'te', faixa(49, 54), -7, true, 0],
    ['Aguardando início', 'dias', faixa(55, 60), 3, false, -1],
    ['Regularização pendente', 'dias', [62], -2, true, 0],
  ] as const) {
    await programar(c, nome, tipo, [...numeros], inicio, iniciar);
    if (etapa >= 0) await executarAte(c, nome, etapa);
  }
  const p = (await programar(c, 'Participação retirada', 'dias', [30], -10, false))[0];
  await c.acao(ref('retirar:30'), async () => !!(await prisma.participanteIatf.findUniqueOrThrow({ where: { id: p.id } })).encerradoEm,
    () => iatf.retirarParticipante(p.id, sitio(c), 'Retirada demonstrativa preservada; nova participação tem identidade própria.', uid(c)));
  await programar(c, 'Reentrada planejada', 'dias', [30], 2, false);
  const participante = await prisma.participanteIatf.findUniqueOrThrow({ where: { id: id(c, 'participante:Regularização pendente:62') } });
  const tarefa = await prisma.tarefaIatf.findFirstOrThrow({ where: { participanteId: participante.id, tipo: 'APLICACAO' } });
  if (!tarefa.aplicacaoId) throw new Error('Aplicação da tarefa de regularização não encontrada.');
  const aplicacaoId = tarefa.aplicacaoId;
  await c.acao(ref('anular:62'), async () => (await prisma.aplicacaoProduto.findUniqueOrThrow({ where: { id: aplicacaoId } })).status === 'ANULADO',
    () => anularAplicacao(aplicacaoId, sitio(c), 'Anulação fictícia mantendo administração e consumo; origem aguarda decisão explícita.', uid(c), 'MANTER_CONSUMO', true));

  await c.registro(ref('protocolo:sanitario'), i => prisma.protocolo.findFirst({ where: i ? { id: i } : { nome: nomeV4('Sanitário coletivo') } }), () => sanitario.criarProtocolo({
    nome: nomeV4('Sanitário coletivo'), descricao: AVISO, etapas: [
      { diaRelativo: 0, tipo: 'APLICACAO', produtoId: id(c, 'produto:sanitario'), tipoAplicacaoId: c.id('aplicacao:Tratamento'), dose: 2, unidade: 'ML', via: 'Demonstrativa' },
      { diaRelativo: 7, tipo: 'EXAME', tipoExameId: id(c, 'exame:Triagem') },
    ],
  }, uid(c)));
  await c.acao(ref('publicar:sanitario'), async () => !!(await prisma.protocolo.findUniqueOrThrow({ where: { id: id(c, 'protocolo:sanitario') } })).publicado,
    () => sanitario.publicarProtocolo(id(c, 'protocolo:sanitario'), uid(c)));
  await c.registro(ref('programacao:sanitaria'), i => prisma.programacaoProtocolo.findFirst({ where: i ? { id: i } : { nome: nomeV4('Sanidade em andamento') } }), async () => {
    await criarRodada({ chave: key('rodada:sanitaria'), nome: nomeV4('Sanidade em andamento'), protocoloId: id(c, 'protocolo:sanitario'), propriedadeId: sitio(c), inicioReferencia: c.dias(-2),
      itens: [63, 64].map(n => ({ animalId: animal(c, n) })),
    }, uid(c));
    return prisma.programacaoProtocolo.findFirstOrThrow({ where: { nome: nomeV4('Sanidade em andamento') } });
  });
  const t = await prisma.tarefaProtocolo.findFirstOrThrow({ where: { execucao: { animalId: animal(c, 63), rodadaId: id(c, 'programacao:sanitaria') }, etapa: { tipo: 'APLICACAO' } } });
  await acao(c, `sanitaria:${t.id}`, () => criarAplicacao({ chave: key(`sanitaria:${t.id}`), animalId: animal(c, 63), propriedadeId: sitio(c), data: c.dias(-2), tarefaId: t.id,
    produtoId: id(c, 'produto:sanitario'), nomeProdutoAplicado: nomeV4('sanitario'), origemInsumo: 'BAIXA_ESTOQUE', tipoAplicacaoId: c.id('aplicacao:Tratamento'), dose: '2', unidadeDose: 'ML', via: 'Demonstrativa',
    estadoCarenciaLeite: 'INFORMADO', estadoCarenciaCarne: 'INFORMADO', carenciaLeiteHoras: 0, carenciaCarneHoras: 0, referenciaCarencia: AVISO,
  }, uid(c)));
}
