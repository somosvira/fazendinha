import { prisma } from '../../src/db.js';
import { criarOcorrencia } from '../../src/services/pecuaria/sanidade/ocorrencias.js';
import { criarProtocolo, publicarProtocolo } from '../../src/services/pecuaria/sanidade/protocolos.js';
import { criarRodada } from '../../src/services/pecuaria/sanidade/rodadas.js';
import { criarAplicacao, anularAplicacao, type AplicacaoInput } from '../../src/services/pecuaria/sanidade/aplicacoes.js';
import { registrarExame } from '../../src/services/pecuaria/sanidade/exames.js';
import { chave, dia, type Contexto } from './contexto.js';
import { AVISO, faixa, type SitioSeed } from './rebanho.js';

export const carenciasSeed = faixa(9, 13).map(numero => ({ numero, dia: -1, estado: numero === 13 ? 'NAO_INFORMADO' as const : 'INFORMADO' as const, horas: numero === 13 ? null : 96 }));
export const vacinacoesSeed = [
  ...faixa(21, 32).map(numero => ({ numero, sitio: 'Principal' as const })),
  ...faixa(101, 112).map(numero => ({ numero, sitio: 'Arrendado' as const })),
  ...faixa(201, 212).map(numero => ({ numero, sitio: 'Test' as const })),
];
async function rodada(c: Contexto, nome: string, protocolo: string, sitio: SitioSeed, inicio: number, numeros: readonly number[], ocorrencia = false) {
  await c.registro(`rodada:${nome}`, id => prisma.programacaoProtocolo.findFirst({ where: id ? { id } : { nome: `Demonstração ${nome}`, propriedadeId: c.numero(`sitio:${sitio}`) } }), async () => {
    const salvo = await criarRodada({ chave: chave(`rodada:${nome}`), nome: `Demonstração ${nome}`, protocoloId: c.id(`protocolo:${protocolo}`), propriedadeId: c.numero(`sitio:${sitio}`), inicioReferencia: c.dias(inicio), itens: numeros.map(n => ({ animalId: c.id(`animal:${n}`), ...(ocorrencia ? { ocorrenciaId: c.id(`ocorrencia:tratamento:${n}`) } : {}) })) }, c.numero('usuario:dono'));
    return { id: salvo.id };
  });
}
export async function sanidade(c: Contexto) {
  const uid = c.numero('usuario:dono');
  for (const [ref, produto, tipo] of [['vacina', 'vacina', 'Vacina'], ['tratamento', 'medicamento', 'Tratamento']] as const) {
    const nome = `Protocolo ${ref} demonstrativo`;
    await c.registro(`protocolo:${ref}`, id => prisma.protocolo.findFirst({ where: id ? { id } : { nome } }), () => criarProtocolo({ nome, descricao: AVISO, etapas: [
      { diaRelativo: 0, tipo: 'APLICACAO', produtoId: c.id(`produto:${produto}`), tipoAplicacaoId: c.id(`aplicacao:${tipo}`), dose: 2, unidade: 'ML', via: 'Intramuscular' },
      ...(ref === 'tratamento' ? [{ diaRelativo: 7, tipo: 'EXAME' as const, tipoExameId: c.id('exame:Triagem demonstrativa') }] : []),
    ] }, uid));
    await c.acao(`publicar:${ref}`, async () => !!(await prisma.protocolo.findUniqueOrThrow({ where: { id: c.id(`protocolo:${ref}`) } })).publicadoEm, () => publicarProtocolo(c.id(`protocolo:${ref}`), uid));
  }
  for (const a of carenciasSeed) await c.registro(`ocorrencia:tratamento:${a.numero}`, id => prisma.ocorrenciaSanitaria.findFirst({ where: id ? { id } : { animalId: c.id(`animal:${a.numero}`), inicio: dia(c.dias(-2)), doencaId: c.id('doenca:Mastite') } }), () => criarOcorrencia({ animalId: c.id(`animal:${a.numero}`), propriedadeId: c.numero('sitio:Principal'), inicio: c.dias(-2), doencaId: c.id('doenca:Mastite'), observacao: AVISO }, uid));
  await rodada(c, 'tratamentos ativos', 'tratamento', 'Principal', -1, carenciasSeed.map(a => a.numero), true);
  const aplicar = async (nome: string, numero: number, sitio: SitioSeed, produto: 'vacina' | 'medicamento', data: number, extras: Partial<AplicacaoInput> = {}) => {
    const p = await prisma.produto.findUniqueOrThrow({ where: { id: c.id(`produto:${produto}`) } });
    await c.registro(`fato:aplicacao:${nome}`, id => prisma.aplicacaoProduto.findFirst({ where: id ? { id } : { animalId: c.id(`animal:${numero}`), data: dia(c.dias(data)), nomeProdutoAplicado: p.nome } }), () => criarAplicacao({ chave: chave(`aplicacao:${nome}`), animalId: c.id(`animal:${numero}`), propriedadeId: c.numero(`sitio:${sitio}`), data: c.dias(data), aplicadaEm: `${c.dias(data)}T13:00:00Z`,
      produtoId: p.id, nomeProdutoAplicado: p.nome, origemInsumo: 'BAIXA_ESTOQUE', tipoAplicacaoId: c.id(`aplicacao:${produto === 'vacina' ? 'Vacina' : 'Tratamento'}`), dose: '2', unidadeDose: 'ML', via: 'Intramuscular',
      ...(p.rastrearPartidas ? { partidaId: c.id(`partida:${sitio}:${produto}`) } : {}), estadoCarenciaLeite: 'INFORMADO', estadoCarenciaCarne: 'INFORMADO', carenciaLeiteHoras: 0, carenciaCarneHoras: 0, referenciaCarencia: AVISO, ...extras,
    }, uid));
  };
  for (const sitio of ['Principal', 'Arrendado', 'Test'] as const) {
    const numeros = vacinacoesSeed.filter(v => v.sitio === sitio).map(v => v.numero);
    await rodada(c, `vacinacao ${sitio}`, 'vacina', sitio, -25, numeros);
    for (const numero of numeros) {
      const tarefa = await prisma.tarefaProtocolo.findFirstOrThrow({ where: { execucao: { rodadaId: c.id(`rodada:vacinacao ${sitio}`), animalId: c.id(`animal:${numero}`) }, etapa: { ordem: 1 } } });
      await aplicar(`vacina-${numero}`, numero, sitio, 'vacina', -25, { tarefaId: tarefa.id });
    }
    await rodada(c, `vacinacao futura ${sitio}`, 'vacina', sitio, 15, numeros);
  }
  await aplicar('anulada', 14, 'Principal', 'medicamento', -20);
  await c.acao('anular:aplicacao', async () => (await prisma.aplicacaoProduto.findUniqueOrThrow({ where: { id: c.id('fato:aplicacao:anulada') } })).status === 'ANULADO', () => anularAplicacao(c.id('fato:aplicacao:anulada'), c.numero('sitio:Principal'), AVISO, uid, 'MANTER_CONSUMO', true));
  for (const a of carenciasSeed) {
    const tarefa = await prisma.tarefaProtocolo.findFirstOrThrow({ where: { execucao: { rodadaId: c.id('rodada:tratamentos ativos'), animalId: c.id(`animal:${a.numero}`) }, etapa: { ordem: 1 } } });
    await aplicar(`carencia-${a.numero}`, a.numero, 'Principal', 'medicamento', a.dia, { tarefaId: tarefa.id, ocorrenciaId: c.id(`ocorrencia:tratamento:${a.numero}`), estadoCarenciaLeite: a.estado, carenciaLeiteHoras: a.horas, ...(a.estado === 'NAO_INFORMADO' ? { justificativaCarenciaLeite: 'Prazo não documentado; leite bloqueado até revisão técnica.' } : {}) });
    const nome = `exame:tratamento:${a.numero}`;
    await c.registro(nome, id => prisma.exameAnimal.findFirst({ where: id ? { id } : { animalId: c.id(`animal:${a.numero}`), tipoExameId: c.id('exame:Triagem demonstrativa'), data: dia(c.dias(-1)) } }), () => registrarExame({ chave: chave(nome), animalId: c.id(`animal:${a.numero}`), propriedadeId: c.numero('sitio:Principal'), tipoExameId: c.id('exame:Triagem demonstrativa'), data: c.dias(-1), ocorrenciaId: c.id(`ocorrencia:tratamento:${a.numero}`), ...(a.numero % 2 ? {} : { resultadoTexto: 'Positivo demonstrativo; não constitui diagnóstico automático.' }), observacao: AVISO }, uid));
  }
}
