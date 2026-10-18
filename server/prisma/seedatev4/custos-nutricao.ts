import { prisma } from '../../src/db.js';
import { criarDieta, publicarDieta, atribuirDieta } from '../../src/services/pecuaria/nutricao/dietas.js';
import { previaConsumo, confirmarConsumo } from '../../src/services/pecuaria/nutricao/consumo.js';
import { criarAplicacao } from '../../src/services/pecuaria/sanidade/aplicacoes.js';
import { classificarCusto, vincularPreparo } from '../../src/services/pecuaria/custos/custos.js';
import { classificacaoCustoSchema, type ClassificacaoCustoInput } from '../../src/services/pecuaria/custos/custos.schemas.js';
import type { Contexto } from '../seedatev3/contexto.js';
import { AVISO, nomeV4 } from './catalogo.js';
import { acao, animal, id, key, ref, sitio, uid } from './base.js';
import { tentativa } from './reproducao.js';
import { idsDoManifesto } from './seguranca.js';

async function classificar(c: Contexto, nome: string, tipo: ClassificacaoCustoInput['tipo'], fonteId: string, extras: Partial<ClassificacaoCustoInput> = {}) {
  await acao(c, nome, () => classificarCusto(classificacaoCustoSchema.parse({ chave: key(nome), propriedadeId: sitio(c), tipo, fonteId, versao: 0,
    motivo: 'Classificação demonstrativa V4 com origem e componentes explícitos.', finalidade: 'REPRODUCAO', materialNaoAplicavel: false, servicoNaoAplicavel: true, coberturaServico: 'PROCEDIMENTO', ...extras,
  }), uid(c)));
}
export async function custosNutricao(c: Contexto) {
  // Operação atual com baixa real, separada das tentativas históricas documentadas.
  await tentativa(c, 27, 1, 0, { origem: 'ESTOQUE', partidaId: id(c, 'partida:semen') });
  const idsPreparados = idsDoManifesto(c.manifesto.ids, ref('tentativa:'));
  const fatos = await prisma.tentativaReprodutiva.findMany({ where: { propriedadeId: sitio(c), id: { in: idsPreparados }, status: 'VALIDO' } });
  for (const f of fatos) await classificar(c, `classificacao:tentativa:${f.id}`, 'TENTATIVA', f.id, {
    servicoNaoAplicavel: !f.operacaoServicoId && !(f.animalId === animal(c, 2) && f.id === id(c, 'tentativa:2:2')),
    ...(f.origemMaterial === 'SERVICO' ? { coberturaServico: 'AMBOS' } : {}),
    ...(f.origemMaterial === 'DOCUMENTADA' && f.tipo !== 'COBERTURA' ? { materialDocumentado: { valor: f.animalId === animal(c, 2) ? '0.00' : f.tipo === 'TE' ? '250.00' : '50.00', referencia: 'Registro demonstrativo V4', evidencia: AVISO } } : {}),
    ...(f.tipo === 'COBERTURA' ? { materialNaoAplicavel: true } : {}),
  });
  await c.registro(ref('preparo:compartilhado'), i => prisma.aplicacaoProduto.findFirst({ where: i ? { id: i } : { animalId: animal(c, 3), nomeProdutoAplicado: nomeV4('Preparo documentado') } }), () => criarAplicacao({
    chave: key('preparo:compartilhado'), animalId: animal(c, 3), propriedadeId: sitio(c), data: c.dias(-125), nomeProdutoAplicado: nomeV4('Preparo documentado'), origemInsumo: 'SEM_ORIGEM_JUSTIFICADA',
    justificativaSemOrigem: AVISO, dose: '1', unidadeDose: 'ML', estadoCarenciaLeite: 'NAO_APLICAVEL', estadoCarenciaCarne: 'NAO_APLICAVEL',
    justificativaCarenciaLeite: AVISO, justificativaCarenciaCarne: AVISO,
  }, uid(c)));
  await classificar(c, 'classificacao:preparo', 'APLICACAO', id(c, 'preparo:compartilhado'), { materialDocumentado: { valor: '30.00', referencia: 'Preparo fictício V4', evidencia: AVISO } });
  for (const ordem of [1, 2, 3]) await acao(c, `vinculo:preparo:${ordem}`, () => vincularPreparo({ chave: key(`vinculo:preparo:${ordem}`), propriedadeId: sitio(c), tentativaId: id(c, `tentativa:3:${ordem}`),
    tipo: 'APLICACAO', fonteId: id(c, 'preparo:compartilhado'), modo: 'PARCELA', valorMaterial: '10.00', motivo: 'Atribuição explícita de um terço do preparo fictício, sem duplicar o valor da origem.',
  }, uid(c)));
  await c.registro(ref('dieta'), i => prisma.dieta.findFirst({ where: i ? { id: i } : { nome: nomeV4('Receita de demonstração') } }),
    () => criarDieta({ nome: nomeV4('Receita de demonstração'), observacao: AVISO, itens: [{ produtoId: id(c, 'produto:racao'), quantidadeCabecaDia: 2 }] }, uid(c)));
  await c.acao(ref('publicar:dieta'), async () => !!(await prisma.dieta.findUniqueOrThrow({ where: { id: id(c, 'dieta') } })).publicadaEm, () => publicarDieta(id(c, 'dieta'), uid(c)));
  await c.registro(ref('vigencia:dieta'), i => prisma.vigenciaDietaLote.findFirst({ where: i ? { id: i } : { loteId: id(c, 'lote:Ciclos individuais'), dietaId: id(c, 'dieta') } }),
    () => atribuirDieta({ loteId: id(c, 'lote:Ciclos individuais'), propriedadeId: sitio(c), dietaId: id(c, 'dieta'), desde: c.dias(-7) }, uid(c)));
  await c.registro(ref('fechamento:nutricao'), i => prisma.fechamentoConsumo.findFirst({ where: i ? { id: i } : { loteId: id(c, 'lote:Ciclos individuais'), inicio: new Date(c.dias(-7)) } }), async () => {
    const input = { loteId: id(c, 'lote:Ciclos individuais'), propriedadeId: sitio(c), inicio: c.dias(-7), fim: c.dias(-1) };
    const previa = await previaConsumo(input);
    await confirmarConsumo({ ...input, itens: previa.itens.map(i => ({ produtoId: i.produtoId, modoEstoque: 'BAIXA_ESTOQUE' as const })) }, uid(c));
    return prisma.fechamentoConsumo.findFirstOrThrow({ where: { loteId: input.loteId, inicio: new Date(input.inicio), fim: new Date(input.fim) } });
  });
  for (const p of await prisma.participacaoConsumoAnimal.findMany({ where: { fechamentoId: id(c, 'fechamento:nutricao') } }))
    await classificar(c, `classificacao:nutricao:${p.id}`, 'NUTRICAO', p.id, { finalidade: 'ROTINA', materialNaoAplicavel: false, servicoNaoAplicavel: false });
}
