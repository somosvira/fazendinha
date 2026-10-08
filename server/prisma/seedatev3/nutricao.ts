import { prisma } from '../../src/db.js';
import { criarDieta, publicarDieta, atribuirDieta } from '../../src/services/pecuaria/nutricao/dietas.js';
import { previaConsumo, confirmarConsumo, estornarFechamento } from '../../src/services/pecuaria/nutricao/consumo.js';
import { dia, type Contexto } from './contexto.js';

export async function nutricao(c: Contexto) {
  const uid = c.numero('usuario:dono');
  for (const [ref, nome, racao, mineral] of [['crescimento', 'Crescimento demonstrativo', 2, 0.1], ['matrizes', 'Matrizes demonstrativas', 3, 0.15], ['transicao', 'Transição demonstrativa', 1.5, 0.1], ['rascunho', 'Receita em estudo — demonstração', 2.5, 0.12]] as const) {
    await c.registro(`dieta:${ref}`, id => prisma.dieta.findFirst({ where: id ? { id } : { nome } }), () => criarDieta({ nome, observacao: 'Quantidades fictícias; não são recomendação zootécnica.', itens: [
      { produtoId: c.id('produto:racao'), quantidadeCabecaDia: racao }, { produtoId: c.id('produto:mineral'), quantidadeCabecaDia: mineral },
      { produtoId: c.id('produto:silagem'), quantidadeCabecaDia: 1 },
    ] }, uid));
    if (ref !== 'rascunho') await c.acao(`publicar:dieta:${ref}`, async () => !!(await prisma.dieta.findUniqueOrThrow({ where: { id: c.id(`dieta:${ref}`) } })).publicadaEm, () => publicarDieta(c.id(`dieta:${ref}`), uid));
  }
  for (const [lote, sitio, dieta, desde] of [
    ['Matrizes', 'Principal', 'matrizes', c.mes(-1, 1)], ['Novilhas', 'Principal', 'crescimento', c.mes(-1, 1)],
    ['Recria', 'Destino', 'crescimento', c.mes(-1, 1)], ['Matrizes destino', 'Destino', 'matrizes', c.mes(-1, 1)],
    ['Novilhas', 'Principal', 'transicao', c.mes(-1, 16)],
  ] as const) await c.registro(`vigencia:${lote}:${desde}`, id => prisma.vigenciaDietaLote.findFirst({ where: id ? { id } : { loteId: c.id(`lote:${lote}`), desde: dia(desde) } }), () => atribuirDieta({ loteId: c.id(`lote:${lote}`), propriedadeId: c.numero(`sitio:${sitio}`), dietaId: c.id(`dieta:${dieta}`), desde }, uid));
  for (const [ref, lote, sitio, inicio, fim] of [
    ['movimentacao', 'Novilhas', 'Principal', c.mes(-1, 1), c.mes(-1, 10)],
    ['dieta-nova', 'Novilhas', 'Principal', c.mes(-1, 16), c.mes(-1, 24)],
    ['matrizes', 'Matrizes', 'Principal', c.mes(-1, 1), c.mes(-1, 10)],
    ['destino', 'Recria', 'Destino', c.mes(-1, 18), c.mes(-1, 24)],
    ['matrizes-destino', 'Matrizes destino', 'Destino', c.mes(-1, 1), c.mes(-1, 10)],
    ['estornado', 'Matrizes', 'Principal', c.mes(-1, 12), c.mes(-1, 14)],
  ] as const) {
    await c.registro(`fechamento:${ref}`, id => prisma.fechamentoConsumo.findFirst({ where: id ? { id } : { loteId: c.id(`lote:${lote}`), inicio: dia(inicio), fim: dia(fim) } }), async () => {
      const input = { loteId: c.id(`lote:${lote}`), propriedadeId: c.numero(`sitio:${sitio}`), inicio, fim };
      const previa = await previaConsumo(input);
      const itens = await Promise.all(previa.itens.map(async i => {
        const ref = ['racao', 'mineral', 'silagem'].find(ref => c.id(`produto:${ref}`) === i.produtoId);
        if (!ref) throw new Error('Ingrediente fora do cenário; receita foi alterada manualmente.');
        const partida = await prisma.partidaProduto.findUniqueOrThrow({ where: { id: c.id(`partida:${ref}`) } });
        return { produtoId: i.produtoId, modoEstoque: 'BAIXA_ESTOQUE' as const, partidas: [{ partidaId: partida.id, quantidade: i.quantidadePrevista }] };
      }));
      await confirmarConsumo({ ...input, itens }, uid);
      return prisma.fechamentoConsumo.findFirstOrThrow({ where: { loteId: input.loteId, inicio: dia(inicio), fim: dia(fim) } });
    });
  }
  await c.acao('estornar:fechamento', async () => (await prisma.fechamentoConsumo.findUniqueOrThrow({ where: { id: c.id('fechamento:estornado') } })).status === 'ESTORNADO', () => estornarFechamento(c.id('fechamento:estornado'), c.numero('sitio:Principal'), 'Reversão demonstrativa; estoque e histórico preservados.', uid));
}
