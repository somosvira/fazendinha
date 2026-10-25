import { prisma } from '../../src/db.js';
import * as registros from '../../src/services/pecuaria/reproducao/registros.js';
import * as iatf from '../../src/services/pecuaria/reproducao/iatf.js';
import { tentativaSchema, avaliacaoSchema, partoSchema, protocoloSchema, programacaoSchema } from '../../src/services/pecuaria/reproducao/schemas.js';
import { criarTipoExame } from '../../src/services/pecuaria/sanidade/exames.js';
import { criarDoenca } from '../../src/services/pecuaria/sanidade/ocorrencias.js';
import { criarPoliticaElegibilidade, vincularPoliticaCiclo, decidirElegibilidadeCiclo } from '../../src/services/pecuaria/reproducao/elegibilidade.js';
import { criarPoliticaAcompanhamento } from '../../src/services/pecuaria/reproducao/acompanhamento.js';
import { registrarLactacaoHistorica } from '../../src/services/pecuaria/reproducao/lactacoes.js';
import { registrarColostro } from '../../src/services/pecuaria/reproducao/colostro.js';
import { chave, dia, type Contexto } from './contexto.js';
import { AVISO, animaisSeed, faixa, brincoSeed, acaoPecuaria } from './rebanho.js';

/** Negativos são fatos anteriores à repetição; nenhuma regra operacional é ampliada. */
export function sequenciaTentativas(quantidade: number, ultima = -10) {
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 4) throw new Error('Informe de uma a quatro tentativas.');
  return faixa(1, quantidade).map((ordem) => { const data = ultima - (quantidade - ordem) * 50; return { ordem, dia: data, negativoEm: ordem < quantidade ? data + 30 : null }; });
}
export const dadosPartosSeed = [
  { matriz: 1, dia: 0, crias: [65, 66] }, { matriz: 2, dia: -1, crias: [67] }, { matriz: 3, dia: -1, crias: [68] }, { matriz: 4, dia: -2, crias: [69] },
  { matriz: 5, dia: -4, crias: [70] }, { matriz: 6, dia: -7, crias: [71] }, { matriz: 7, dia: -12, crias: [72] }, { matriz: 8, dia: -20, crias: [] },
] as const;

async function catalogos(c: Contexto) {
  const uid = c.numero('usuario:dono');
  await c.registro('exame:Avaliação completa', id => prisma.tipoExame.findFirst({ where: id ? { id } : { nome: 'Avaliação reprodutiva demonstrativa' } }), () => criarTipoExame({ nome: 'Avaliação reprodutiva demonstrativa', tipoResultado: 'MULTIPLO', campos: [
    { codigo: 'CONCLUSAO_GESTACIONAL', rotulo: 'Conclusão', tipo: 'OPCAO', obrigatorio: false, opcoes: ['POSITIVO', 'NEGATIVO', 'INCONCLUSIVO'] },
    { codigo: 'SEXO_FETAL', rotulo: 'Sexo fetal', tipo: 'OPCAO', obrigatorio: false, opcoes: ['M', 'F'] },
    { codigo: 'ANOTACAO', rotulo: 'Observação', tipo: 'TEXTO', obrigatorio: false },
  ] }, uid, 'REPRODUTIVO'));
  await c.registro('doenca:Retenção de placenta', id => prisma.doenca.findFirst({ where: id ? { id } : { nome: 'Retenção de placenta' } }), () => criarDoenca('Retenção de placenta', null, uid));
  for (const sitio of ['Principal', 'Arrendado', 'Test']) {
    const propriedadeId = c.numero(`sitio:${sitio}`);
    await acaoPecuaria(c, `politica:elegibilidade:${sitio}`, () => criarPoliticaElegibilidade({ chave: chave(`politica:elegibilidade:${sitio}`), propriedadeId, vigenteDesde: c.dias(-700), parametros: {
      versao: 1, metodologia: 'IDEAGRI_IILB_BASE_V1', pevPrimiparasDias: 30, pevMultiparasDias: 30, aborto: 'PEV_CONFIGURADO', pevAposAbortoDias: 15,
      descarte: 'EXCLUIR', restricoes: 'EXCLUIR', perdaGestacional: 'RETOMAR_CICLO', papeisIncluidos: ['NENHUM', 'DOADORA', 'RECEPTORA'],
    } }, uid));
    await acaoPecuaria(c, `politica:acompanhamento:${sitio}`, () => criarPoliticaAcompanhamento({ chave: chave(`politica:acompanhamento:${sitio}`), propriedadeId, vigenteDesde: c.dias(-700), parametros: {
      versao: 1, efeito: 'ALERTA', diagnostico: { diasAposTentativa: 30 }, reconfirmacoes: [{ ocorrencia: 1, diasAposPrimeiroPositivo: 30 }, { ocorrencia: 2, diasAposPrimeiroPositivo: 60 }],
    } }, uid));
  }
}
export async function tentativa(c: Contexto, n: number, ordem: number, data: number, extras: Partial<Parameters<typeof registros.criarTentativa>[0]> = {}) {
  const nome = `tentativa:${n}:${ordem}`;
  const propriedadeId = c.numero(`sitio:${animaisSeed.find(a => a.numero === n)!.sitio}`);
  await c.registro(nome, id => prisma.tentativaReprodutiva.findFirst({ where: id ? { id } : { animalId: c.id(`animal:${n}`), data: dia(c.dias(data)), status: 'VALIDO' } }), () => registros.criarTentativa(tentativaSchema.parse({ chave: chave(nome), animalId: c.id(`animal:${n}`), propriedadeId, data: c.dias(data), tipo: 'IA', materialId: c.id('material:semen'), partidaId: data <= -30 ? null : c.id('partida:semen'), quantidade: 1, origem: data <= -30 ? 'DOCUMENTADA' : 'ESTOQUE', ...(data <= -30 ? { justificativaSemOrigem: 'Histórico sintético documentado de até dois anos, sem baixa retroativa de estoque nem custo presumido.' } : {}), responsavel: 'Equipe demonstrativa', observacao: AVISO, ...extras }), c.numero('usuario:dono')));
  return c.id(nome);
}
export async function avaliar(c: Contexto, n: number, nome: string, data: number, resultado: Parameters<typeof registros.criarAvaliacao>[0]['resultado'], extras: Partial<Parameters<typeof registros.criarAvaliacao>[0]> = {}) {
  const propriedadeId = c.numero(`sitio:${animaisSeed.find(a => a.numero === n)!.sitio}`);
  await c.registro(nome, id => prisma.avaliacaoReprodutiva.findFirst({ where: id ? { id } : { animalId: c.id(`animal:${n}`), data: dia(c.dias(data)), resultado, status: 'VALIDO' } }), () => registros.criarAvaliacao(avaliacaoSchema.parse({ chave: chave(nome), animalId: c.id(`animal:${n}`), propriedadeId, data: c.dias(data), resultado, tipoExameId: c.id('exame:Avaliação completa'), resultados: [{ campo: 'ANOTACAO', valor: AVISO }], observacao: AVISO, ...extras }), c.numero('usuario:dono')));
}
async function gestacao(c: Contexto, n: number, data: number, tipo: 'IA' | 'TE' = 'IA', sufixo = '') {
  const tentativaId = await tentativa(c, n, 1, data, tipo === 'TE' ? { tipo, materialId: c.id('material:embriao'), partidaId: data <= -30 ? null : c.id('partida:embriao') } : {});
  await avaliar(c, n, `positivo:${n}${sufixo}`, data + 30, 'POSITIVO', { tentativaId, previsaoParto: c.dias(data + (tipo === 'TE' ? 275 : 283)) });
  await c.registro(`gestacao:${n}${sufixo}`, id => prisma.gestacaoAnimal.findFirst({ where: id ? { id } : { animalId: c.id(`animal:${n}`), tentativaId } }), async () => { throw new Error('Diagnóstico não gerou gestação; não fabricar registro.'); });
}

export async function reproducao(c: Contexto) {
  await catalogos(c);
  const uid = c.numero('usuario:dono'), propriedadeId = c.numero('sitio:Principal');
  for (const a of animaisSeed.filter(a => a.sexo === 'F' && a.idade > 1000 && !a.criaParto)) {
    const p = c.numero(`sitio:${a.sitio}`), data = [35, 36].includes(a.numero) ? -650 : -690;
    await c.registro(`inicial:${a.numero}`, id => prisma.situacaoInicialReprodutiva.findFirst({ where: id ? { id } : { animalId: c.id(`animal:${a.numero}`), data: dia(c.dias(data)) } }), () => registros.criarSituacaoInicial({ chave: chave(`inicial:${a.numero}`), animalId: c.id(`animal:${a.numero}`), propriedadeId: p, data: c.dias(data), situacao: [33, 34, 35, 36].includes(a.numero) ? 'APTA' : 'VAZIA', ...([33, 34, 35, 36].includes(a.numero) ? { aptaDesde: c.dias(data) } : {}), observacao: AVISO }, uid));
    await acaoPecuaria(c, `ciclo:${a.numero}`, () => vincularPoliticaCiclo({ chave: chave(`ciclo:${a.numero}`), animalId: c.id(`animal:${a.numero}`), propriedadeId: p, situacaoInicialId: c.id(`inicial:${a.numero}`) }, uid));
  }
  for (const n of faixa(9, 48)) await acaoPecuaria(c, `lactacao:${n}`, () => registrarLactacaoHistorica({ chave: chave(`lactacao:${n}`), animalId: c.id(`animal:${n}`), propriedadeId, inicio: c.dias(-450), ...(n >= 37 ? { encerradaEm: c.dias(-70) } : {}), motivo: 'Intervalo histórico sintético conhecido; parto anterior não documentado.' }, uid));
  for (const p of dadosPartosSeed) {
    await gestacao(c, p.matriz, p.dia - (p.matriz === 7 ? 275 : 283), p.matriz === 7 ? 'TE' : 'IA');
    // TE exige papel receptora desde a entrada; selecionamos a matriz 7 como receptora no catálogo.
    const nome = `parto:${p.matriz}`;
    await c.registro(nome, id => prisma.partoAnimal.findFirst({ where: id ? { id } : { animalId: c.id(`animal:${p.matriz}`), data: dia(c.dias(p.dia)), status: 'VALIDO' } }), () => registros.criarParto(partoSchema.parse({ chave: chave(nome), animalId: c.id(`animal:${p.matriz}`), propriedadeId, data: c.dias(p.dia), gestacaoId: c.id(`gestacao:${p.matriz}`), desfecho: 'NASCIMENTO', iniciarLactacao: true,
      dificuldade: p.matriz === 1, retencaoPlacenta: p.matriz === 1, ...(p.matriz === 1 ? { assistenciaDescricao: AVISO, ocorrenciaRetencao: { acao: 'CRIAR', doencaId: c.id('doenca:Retenção de placenta'), inicio: c.dias(p.dia), observacao: AVISO } } : {}),
      pesoMatriz: { acao: 'REGISTRAR', data: c.dias(p.dia), pesoKg: 510 }, escoreMatriz: { acao: 'REGISTRAR', data: c.dias(p.dia), valor: 3, escalaMin: 1, escalaMax: 5, escalaDescricao: 'Demonstração' },
      crias: p.crias.length ? p.crias.map(n => ({ viva: true, brinco: brincoSeed(n), nome: `Cria ${n}`, sexo: animaisSeed.find(a => a.numero === n)!.sexo, aptidao: 'LEITE', loteId: c.id('lote:Crias'), pesoKg: 34 })) : [{ viva: false, sexo: 'F', aptidao: 'LEITE', pesoKg: 30 }], observacao: AVISO,
    }), uid));
    for (const n of p.crias) {
      await c.registro(`animal:${n}`, id => prisma.animal.findFirst({ where: id ? { id } : { brinco: brincoSeed(n) } }), async () => { throw new Error('Cria não criada pelo parto; não duplicar.'); });
      const cria = await prisma.criaParto.findFirstOrThrow({ where: { partoId: c.id(nome), animalId: c.id(`animal:${n}`) } });
      await c.registro(`cria:${n}`, id => prisma.criaParto.findUnique({ where: { id: id ?? cria.id } }), async () => { throw new Error('Cria ausente.'); });
      await acaoPecuaria(c, `colostro:${n}`, () => registrarColostro({ chave: chave(`colostro:${n}`), propriedadeId, criaId: cria.id, data: c.dias(p.dia), quantidade: 3, unidade: 'L', metodoQualidade: 'REFRATOMETRO_BRIX', qualidadeBrix: 23, tipo: 'FRESCO', forma: 'MAMADEIRA', observacao: AVISO }, uid));
    }
  }
  for (const n of faixa(15, 20)) for (const t of sequenciaTentativas(n <= 17 ? 3 : 4)) {
    const tentativaId = await tentativa(c, n, t.ordem, t.dia);
    if (t.negativoEm !== null) await avaliar(c, n, `negativo:${n}:${t.ordem}`, t.negativoEm, 'NEGATIVO', { tentativaId });
  }
  for (const n of [...faixa(21, 32), ...faixa(37, 48)]) await gestacao(c, n, n >= 37 ? -200 : -100);
  await tentativa(c, 101, 1, -40, { tipo: 'COBERTURA', materialId: null, partidaId: null, quantidade: null, touroId: c.id('animal:127'), origem: 'DOCUMENTADA', justificativaSemOrigem: AVISO });
  await acaoPecuaria(c, 'exposicao:touro', () => registros.criarExposicao({ chave: chave('exposicao:touro'), propriedadeId: c.numero('sitio:Arrendado'), loteId: c.id('lote:Receptoras arrendado'), touroId: c.id('animal:127'), inicio: c.dias(-35), observacao: AVISO }, uid));
  await avaliar(c, 21, 'reconfirmacao:21', -10, 'RECONFIRMACAO', { gestacaoId: c.id('gestacao:21'), sexoFetal: 'F' });
  // Aborto reinicia ciclo; perda preserva a classificação própria sem inventar aborto.
  for (const [n, desfecho] of [[59, 'ABORTO'], [60, 'PERDA']] as const) {
    await gestacao(c, n, -500);
    if (desfecho === 'ABORTO') await acaoPecuaria(c, 'aborto:59', () => registros.criarParto(partoSchema.parse({ chave: chave('aborto:59'), animalId: c.id('animal:59'), propriedadeId, data: c.dias(-350), gestacaoId: c.id('gestacao:59'), desfecho: 'ABORTO', iniciarLactacao: false, observacao: AVISO, crias: [] }), uid));
    else await acaoPecuaria(c, 'perda:60', () => registros.registrarPerda({ chave: chave('perda:60'), animalId: c.id('animal:60'), propriedadeId, data: c.dias(-350), gestacaoId: c.id('gestacao:60'), motivo: AVISO, causaClinica: { estado: 'DESCONHECIDA', evidencias: [AVISO] } }, uid));
    await tentativa(c, n, 2, -30);
  }
  const t = await tentativa(c, 61, 1, -40);
  await avaliar(c, 61, 'inconclusivo:61', -5, 'INCONCLUSIVO', { tentativaId: t, conduta: 'AGUARDAR', retornoEm: c.dias(5) });
  await avaliar(c, 62, 'negativo:62', -3, 'NEGATIVO', { conduta: 'AGUARDAR', retornoEm: c.dias(5) });
  // Novilha explicitamente liberada, sem converter ausência de dados em aptidão.
  await c.registro('inicial:49', id => prisma.situacaoInicialReprodutiva.findFirst({ where: id ? { id } : { animalId: c.id('animal:49') } }), () => registros.criarSituacaoInicial({ chave: chave('inicial:49'), animalId: c.id('animal:49'), propriedadeId, data: c.dias(-100), situacao: 'VAZIA', observacao: AVISO }, uid));
  await acaoPecuaria(c, 'ciclo:49', () => vincularPoliticaCiclo({ chave: chave('ciclo:49'), animalId: c.id('animal:49'), propriedadeId, situacaoInicialId: c.id('inicial:49') }, uid));
  const ciclo = await prisma.vinculoPoliticaCiclo.findFirstOrThrow({ where: { animalId: c.id('animal:49'), chaveCiclo: 'INICIAL' } });
  await acaoPecuaria(c, 'liberacao:49', () => decidirElegibilidadeCiclo({ chave: chave('liberacao:49'), propriedadeId, vinculoCicloId: ciclo.id, data: c.dias(-30), tipo: 'LIBERAR', aptaDesde: c.dias(-30), motivo: AVISO }, uid));
  await protocolosReprodutivos(c);
}

async function protocolosReprodutivos(c: Contexto) {
  const uid = c.numero('usuario:dono'), propriedadeId = c.numero('sitio:Principal');
  for (const publicado of [true, false]) {
    const nome = `Protocolo reprodutivo ${publicado ? 'publicado' : 'rascunho'}`;
    await c.registro(`protocolo:reprodutivo:${publicado}`, id => prisma.protocolo.findFirst({ where: id ? { id } : { nome } }), () => iatf.criarProtocolo(protocoloSchema.parse({ nome, versao: 1, descricao: AVISO, publicado, etapas: [
      { nome: 'Manejo inicial', tipo: 'MANEJO', intervalo: 0, unidade: 'DIAS' },
      { nome: 'Inseminação', tipo: 'TENTATIVA', intervalo: 10, unidade: 'DIAS', planoTentativa: { tipo: 'IA', materialId: c.id('material:semen'), quantidade: 1 } },
      { nome: 'Diagnóstico', tipo: 'AVALIACAO', intervalo: 40, unidade: 'DIAS', planoAvaliacao: { tipo: 'DIAGNOSTICO', tipoExameId: c.id('exame:Avaliação completa') } },
    ] }), uid));
  }
  for (const [nome, numeros, inicio, iniciar] of [['ativo', faixa(9, 14), -5, true], ['programado', [63, 64], 5, false], ['interrompido', [58], -10, false]] as const) {
    await c.registro(`programacao:${nome}`, id => prisma.programacaoProtocolo.findFirst({ where: id ? { id } : { nome: `Reprodução ${nome}` } }), () => iatf.criarProgramacao(programacaoSchema.parse({ chave: chave(`programacao:${nome}`), propriedadeId, protocoloId: c.id('protocolo:reprodutivo:true'), nome: `Reprodução ${nome}`, inicioPrevisto: c.dias(inicio), animais: numeros.map(n => ({ animalId: c.id(`animal:${n}`) })) }), uid));
    for (const n of numeros) {
      const p = await c.registro(`participacao:${nome}:${n}`, id => prisma.participacaoProtocolo.findFirst({ where: id ? { id } : { rodadaId: c.id(`programacao:${nome}`), animalId: c.id(`animal:${n}`) } }), async () => { throw new Error('Participação não criada; não recriar.'); });
      if (iniciar) {
        await c.acao(`iniciar:${nome}:${n}`, async () => !!(await prisma.participacaoProtocolo.findUniqueOrThrow({ where: { id: String(p.id) } })).inicioEfetivo, () => iatf.iniciarParticipante(String(p.id), propriedadeId, c.dias(inicio), uid));
        const tarefa = await prisma.tarefaProtocolo.findFirstOrThrow({ where: { execucaoId: String(p.id), etapa: { ordem: 1 } } });
        await acaoPecuaria(c, `manejo:protocolo:${n}`, () => iatf.executarTarefa(tarefa.id, { chave: chave(`manejo:protocolo:${n}`), propriedadeId, realizadaEm: c.dias(inicio), dados: { observacao: AVISO } }, uid));
      }
      if (nome === 'interrompido') await c.acao('retirar:58', async () => !!(await prisma.participacaoProtocolo.findUniqueOrThrow({ where: { id: String(p.id) } })).canceladaEm, () => iatf.retirarParticipante(String(p.id), propriedadeId, AVISO, uid));
    }
  }
}
