import { prisma } from '../../src/db.js';
import * as registros from '../../src/services/pecuaria/reproducao/registros.js';
import { tentativaSchema, avaliacaoSchema, partoSchema } from '../../src/services/pecuaria/reproducao/schemas.js';
import { criarOcorrencia } from '../../src/services/pecuaria/sanidade/ocorrencias.js';
import { registrarColostro } from '../../src/services/pecuaria/reproducao/colostro.js';
import { movimentar } from '../../src/services/pecuaria/rebanho/animais.js';
import type { Contexto } from '../seedatev3/contexto.js';
import { AVISO, sequenciaTentativas } from './catalogo.js';
import { acao, animal, id, key, ref, sitio, uid } from './base.js';

type TentativaExtras = Partial<Parameters<typeof registros.criarTentativa>[0]>;
export async function tentativa(c: Contexto, numero: number, ordem: number, data: number, extra: TentativaExtras = {}) {
  const nome = `tentativa:${numero}:${ordem}`;
  await c.registro(ref(nome), i => prisma.tentativaReprodutiva.findFirst({ where: i ? { id: i } : { animalId: animal(c, numero), data: new Date(c.dias(data)), status: 'VALIDO' } }), () => registros.criarTentativa(tentativaSchema.parse({
    chave: key(nome), animalId: animal(c, numero), propriedadeId: sitio(c), data: c.dias(data), tipo: 'IA', materialId: id(c, 'material:semen'),
    origem: 'DOCUMENTADA', justificativaSemOrigem: 'Histórico demonstrativo V4 com material documentado, sem baixa retroativa de estoque.', quantidade: 1, responsavel: 'Equipe de demonstração V4', observacao: AVISO, ...extra,
  }), uid(c)));
  return id(c, nome);
}
type AvaliacaoExtras = Partial<Parameters<typeof registros.criarAvaliacao>[0]>;
export async function avaliar(c: Contexto, numero: number, nome: string, data: number, resultado: Parameters<typeof registros.criarAvaliacao>[0]['resultado'], extra: AvaliacaoExtras = {}) {
  await c.registro(ref(nome), i => prisma.avaliacaoReprodutiva.findFirst({ where: i ? { id: i } : { animalId: animal(c, numero), data: new Date(c.dias(data)), resultado, status: 'VALIDO' } }), async () => {
    const demanda = await prisma.demandaAcompanhamentoReprodutivo.findFirst({ where: { animalId: animal(c, numero), estado: 'PENDENTE',
      ...(extra.tentativaId ? { tentativaId: extra.tentativaId, finalidade: 'DIAGNOSTICO' } : extra.gestacaoId && resultado === 'RECONFIRMACAO' ? { gestacaoId: extra.gestacaoId, finalidade: 'RECONFIRMACAO' } : { id: 'sem-demanda' }),
    }, orderBy: { ocorrencia: 'asc' } });
    return registros.criarAvaliacao(avaliacaoSchema.parse({ chave: key(nome), animalId: animal(c, numero), propriedadeId: sitio(c), data: c.dias(data), resultado,
      tipoExameId: id(c, 'exame:Avaliação completa'), resultados: [{ campo: 'ANOTACAO', valor: AVISO }],
      ...(demanda ? { demandaAcompanhamentoId: demanda.id } : {}), responsavel: 'Equipe de demonstração V4', observacao: AVISO, ...extra,
    }), uid(c));
  });
}
export async function gestacao(c: Contexto, n: number, ultima: number, quantidade = 1, tipo: 'IA' | 'TE' = 'IA') {
  let tentativaId = '';
  for (const [i, t] of sequenciaTentativas(quantidade, ultima).entries()) {
    tentativaId = await tentativa(c, n, i + 1, t.dia, tipo === 'TE' ? { tipo, materialId: id(c, 'material:embriao'), partidaId: id(c, 'partida:embriao') }
      : n === 6 && i === quantidade - 1 ? { origem: 'SERVICO', operacaoServicoId: id(c, 'servico'), valorServicoAtribuido: 80 } : {});
    if (t.negativoEm !== null) await avaliar(c, n, `negativo:${n}:${i + 1}`, t.negativoEm, 'NEGATIVO', { tentativaId });
  }
  await avaliar(c, n, `positivo:${n}`, ultima + 30, 'POSITIVO', { tentativaId, previsaoParto: c.dias(ultima + (tipo === 'TE' ? 275 : 283)) });
  await c.registro(ref(`gestacao:${n}`), i => prisma.gestacaoAnimal.findFirst({ where: i ? { id: i } : { animalId: animal(c, n), tentativaId } }), async () => { throw new Error('Gestação não criada pelo diagnóstico'); });
}

export async function reproducao(c: Contexto) {
  for (const n of [1, 2, 3]) for (const [i, t] of sequenciaTentativas(n).entries()) {
    const tentativaId = await tentativa(c, n, i + 1, t.dia, n === 1 ? { operacaoServicoId: id(c, 'servico'), valorServicoAtribuido: 25 } : {});
    if (t.negativoEm !== null) await avaliar(c, n, `negativo:${n}:${i + 1}`, t.negativoEm, 'NEGATIVO', { tentativaId });
  }
  for (const n of [4, 5, 6]) await gestacao(c, n, -100, n - 3);
  for (const [n, data] of [[4, -40], [4, -10], [6, -40]] as const) await avaliar(c, n, `reconfirmacao:${n}:${data}`, data, 'RECONFIRMACAO', { gestacaoId: id(c, `gestacao:${n}`), sexoFetal: 'F' });
  await gestacao(c, 7, -180);
  await acao(c, 'aborto:7', () => registros.criarParto(partoSchema.parse({ chave: key('aborto:7'), animalId: animal(c, 7), propriedadeId: sitio(c), data: c.dias(-60), gestacaoId: id(c, 'gestacao:7'),
    desfecho: 'ABORTO', iniciarLactacao: false, retencaoPlacenta: null, observacao: 'Aborto fictício observado no cenário V4, causa desconhecida; registro preservado para conferência.', crias: [],
  }), uid(c)));
  await tentativa(c, 7, 2, -10);
  await gestacao(c, 8, -140);
  await acao(c, 'perda:8', () => registros.registrarPerda({ chave: key('perda:8'), animalId: animal(c, 8), propriedadeId: sitio(c), data: c.dias(-30), gestacaoId: id(c, 'gestacao:8'),
    motivo: 'Perda gestacional fictícia documentada na revisão V4, sem classificação como aborto.', causaClinica: { estado: 'DESCONHECIDA', evidencias: ['Observação demonstrativa da equipe, sem anexo R2.'] },
  }, uid(c)));
  for (const n of [9, 10, 11, 12]) {
    await gestacao(c, n, -300, 1, n === 12 ? 'TE' : 'IA');
    const data = c.dias(n === 9 ? -30 : n === 10 ? -20 : n === 11 ? -10 : -15);
    await c.registro(ref(`parto:${n}`), i => prisma.partoAnimal.findFirst({ where: i ? { id: i } : { animalId: animal(c, n), gestacaoId: id(c, `gestacao:${n}`) } }), () => registros.criarParto(partoSchema.parse({
      chave: key(`parto:${n}`), animalId: animal(c, n), propriedadeId: sitio(c), data, gestacaoId: id(c, `gestacao:${n}`), desfecho: 'NASCIMENTO', iniciarLactacao: true,
      induzido: false, dificuldade: n === 11, assistenciaDescricao: n === 11 ? 'Assistência fictícia no parto gemelar.' : null,
      retencaoPlacenta: n === 11 ? true : n === 12 ? null : false,
      ...(n === 11 ? { ocorridoEm: `${data}T06:30:00-03:00`, horarioEstimado: true, ocorrenciaRetencao: { acao: 'CRIAR', doencaId: id(c, 'doenca:Retenção de placenta'), inicio: data, observacao: AVISO } } : {}),
      pesoMatriz: { acao: 'REGISTRAR', data, pesoKg: 510 }, escoreMatriz: { acao: 'REGISTRAR', data, valor: 3, escalaMin: 1, escalaMax: 5, escalaDescricao: 'Escala demonstrativa' },
      crias: Array.from({ length: n === 11 ? 2 : 1 }, (_, i) => ({ viva: n !== 9, sexo: i ? 'M' : 'F', aptidao: 'LEITE', loteId: id(c, 'lote:Cria'),
        brinco: n === 12 || n === 9 ? null : `V4-CR-${n}-${i + 1}`, nome: `Cria demonstrativa V4 ${n}.${i + 1}`, pesoKg: 34 + i })),
      observacao: AVISO, responsavel: 'Equipe de demonstração V4',
    }), uid(c)));
    const crias = await prisma.criaParto.findMany({ where: { partoId: id(c, `parto:${n}`), viva: true } });
    for (const cria of crias) for (const fornecimento of [1, 2]) await acao(c, `colostro:${cria.id}:${fornecimento}`, () => registrarColostro({
      chave: key(`colostro:${cria.id}:${fornecimento}`), propriedadeId: sitio(c), criaId: cria.id, data,
      quantidade: fornecimento === 1 ? 3 : 2000, unidade: fornecimento === 1 ? 'L' : 'ML', metodoQualidade: 'REFRATOMETRO_BRIX', qualidadeBrix: 23,
      tipo: 'FRESCO', forma: 'MAMADEIRA', responsavel: 'Equipe de demonstração V4', observacao: AVISO,
    }, uid(c)));
  }
  await avaliar(c, 13, 'positivo:13', -80, 'POSITIVO', { motivoVinculoDesconhecido: 'Gestação fictícia conhecida sem tentativa comprovada.', previsaoParto: c.dias(150) });
  await avaliar(c, 14, 'negativo:14', -2, 'NEGATIVO', { conduta: 'AGUARDAR', retornoEm: c.dias(5) });
  const t15 = await tentativa(c, 15, 1, -40);
  await avaliar(c, 15, 'inconclusivo:15', -5, 'INCONCLUSIVO', { tentativaId: t15, conduta: 'AGUARDAR', retornoEm: c.dias(0) });
  await acao(c, 'restricao:19', () => registros.criarRestricao({ chave: key('restricao:19'), animalId: animal(c, 19), propriedadeId: sitio(c), data: c.dias(-5), tipo: 'DESCARTE', acoes: ['IA', 'TE', 'COBERTURA', 'IATF'], motivo: 'Decisão reprodutiva fictícia, mantendo a vaca no rebanho e em lactação.' }, uid(c)));
  for (const [n, nome, efeito] of [[20, 'Alerta demonstrativo', 'ALERTAR'], [21, 'Bloqueio demonstrativo', 'BLOQUEAR']] as const) {
    for (const acaoRegra of ['IA', 'TE', 'IATF'] as const) await c.registro(ref(`regra:${n}:${acaoRegra}`), i => prisma.regraSanitariaReprodutiva.findFirst({ where: i ? { id: i } : { propriedadeId: sitio(c), doencaId: id(c, `doenca:${nome}`), acao: acaoRegra } }),
      () => registros.configurarRegraSanitaria({ propriedadeId: sitio(c), doencaId: id(c, `doenca:${nome}`), acao: acaoRegra, efeito, motivo: AVISO, ativo: true }, uid(c)));
    await c.registro(ref(`ocorrencia:${n}`), i => prisma.ocorrenciaSanitaria.findFirst({ where: i ? { id: i } : { animalId: animal(c, n), doencaId: id(c, `doenca:${nome}`) } }),
      () => criarOcorrencia({ propriedadeId: sitio(c), animalId: animal(c, n), doencaId: id(c, `doenca:${nome}`), inicio: c.dias(-5), observacao: AVISO }, uid(c)));
  }
  await tentativa(c, 23, 1, -20, { tipo: 'TE', materialId: id(c, 'material:embriao'), partidaId: id(c, 'partida:embriao') });
  await tentativa(c, 24, 1, -20, { tipo: 'COBERTURA', materialId: null, partidaId: null, quantidade: null, touroId: animal(c, 61), origem: 'DOCUMENTADA', justificativaSemOrigem: AVISO });
  await acao(c, 'exposicao', () => registros.criarExposicao({ chave: key('exposicao'), propriedadeId: sitio(c), loteId: id(c, 'lote:Exposição de touro'), touroId: animal(c, 61), inicio: c.dias(-40), observacao: AVISO }, uid(c)));
  await gestacao(c, 28, -100);
  for (const [n, ida, volta] of [[28, -15, false], [29, -25, true]] as const) {
    await c.acao(ref(`transferencia:${n}`), async () => !!await prisma.localizacaoAnimal.findFirst({ where: { animalId: animal(c, n), propriedadeId: sitio(c, 'Destino') } }), () => movimentar({
      animalIds: [animal(c, n)], propriedadeId: sitio(c, 'Destino'), loteId: id(c, 'lote:Matrizes destino'), data: c.dias(ida), motivo: AVISO,
    }, uid(c), sitio(c)));
    if (volta) await c.acao(ref('retorno:29'), async () => !!await prisma.localizacaoAnimal.findFirst({ where: { animalId: animal(c, 29), propriedadeId: sitio(c), desde: new Date(c.dias(-5)) } }), () => movimentar({
      animalIds: [animal(c, 29)], propriedadeId: sitio(c), loteId: id(c, 'lote:Ciclos individuais'), data: c.dias(-5), motivo: AVISO,
    }, uid(c), sitio(c, 'Destino')));
  }
  await avaliar(c, 28, 'reconfirmacao:28', -5, 'RECONFIRMACAO', { gestacaoId: id(c, 'gestacao:28'), propriedadeId: sitio(c, 'Destino') });
}
