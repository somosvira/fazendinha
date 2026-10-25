import { prisma } from '../../src/db.js';
import { criarDieta, publicarDieta, atribuirDieta } from '../../src/services/pecuaria/nutricao/dietas.js';
import { previaConsumo, confirmarConsumo, estornarFechamento } from '../../src/services/pecuaria/nutricao/consumo.js';
import { chave, dia, type Contexto } from './contexto.js';

const LOTES_DIETAS = [
  ['Lactantes', 'Principal', 'matrizes'], ['Novilhas', 'Principal', 'crescimento'],
  ['Novilhas arrendado', 'Arrendado', 'crescimento'], ['Receptoras arrendado', 'Arrendado', 'matrizes'], ['Matrizes test', 'Test', 'matrizes'],
] as const;
const INGREDIENTES = ['racao', 'mineral', 'silagem'] as const;
export async function nutricaoGeral(c: Contexto) {
  const uid = c.numero('usuario:dono');
  for (const [ref, nome, racao] of [['matrizes', 'Dieta de lactação demonstrativa', 3], ['crescimento', 'Dieta de crescimento demonstrativa', 2], ['rascunho', 'Dieta em estudo demonstrativa', 2.5]] as const) {
    await c.registro(`dieta:${ref}`, id => prisma.dieta.findFirst({ where: id ? { id } : { nome } }), () => criarDieta({ nome, observacao: 'Quantidades sintéticas de teste; não são recomendação nutricional.', itens: [
      { produtoId: c.id('produto:racao'), quantidadeCabecaDia: racao }, { produtoId: c.id('produto:mineral'), quantidadeCabecaDia: 0.1 }, { produtoId: c.id('produto:silagem'), quantidadeCabecaDia: 1 },
    ] }, uid));
    if (ref !== 'rascunho') await c.acao(`dieta:publicar:${ref}`, async () => !!(await prisma.dieta.findUniqueOrThrow({ where: { id: c.id(`dieta:${ref}`) } })).publicadaEm, () => publicarDieta(c.id(`dieta:${ref}`), uid));
  }
  for (const [lote, sitio, dieta] of LOTES_DIETAS) {
    const loteId = c.id(`lote:${lote}`), propriedadeId = c.numero(`sitio:${sitio}`), desde = c.dias(-100);
    await c.registro(`dieta:vigencia:${lote}`, id => prisma.vigenciaDietaLote.findFirst({ where: id ? { id } : { loteId, desde: dia(desde) } }), () => atribuirDieta({ loteId, propriedadeId, dietaId: c.id(`dieta:${dieta}`), desde }, uid));
  }
  // O ensaio de estorno antecede os demais fatos dos mesmos produtos/sítio.
  const loteId = c.id('lote:Lactantes'), propriedadeId = c.numero('sitio:Principal');
  const inicio = c.dias(-80), fim = c.dias(-79), nome = 'nutricao:estorno';
  await c.registro(nome, id => prisma.fechamentoConsumo.findFirst({ where: id ? { id } : { loteId, inicio: dia(inicio), fim: dia(fim) } }), async () => {
    await confirmarConsumo({ chave: chave(nome), loteId, propriedadeId, inicio, fim, itens: INGREDIENTES.map(ref => ({
      produtoId: c.id(`produto:${ref}`), quantidadeConfirmada: ref === 'racao' ? 10 : 0, motivoAjuste: 'Fornecimento sintético para estorno; demais ingredientes explicitamente não fornecidos.', modoEstoque: 'BAIXA_ESTOQUE' as const,
      ...(ref === 'racao' ? { partidas: [{ partidaId: c.id('partida:racao'), quantidade: 10 }] } : {}),
    })) }, uid);
    return prisma.fechamentoConsumo.findFirstOrThrow({ where: { loteId, inicio: dia(inicio), fim: dia(fim) } });
  });
  await c.acao('nutricao:estornar', async () => (await prisma.fechamentoConsumo.findUniqueOrThrow({ where: { id: c.id(nome) } })).status === 'ESTORNADO', () => estornarFechamento(c.id(nome), propriedadeId, 'Estorno demonstrativo com estoque preservado.', uid));
  // Período primeiro: dois lotes do mesmo sítio não podem criar saídas retroativas entre si.
  for (const [inicioPeriodo, fimPeriodo] of [[c.mes(-1, 1), c.mes(0, 0)], [c.mes(0, 1), c.dias(-1)]]) {
    if (inicioPeriodo > fimPeriodo) continue;
    for (const [lote, sitio] of LOTES_DIETAS) {
      const loteIdPeriodo = c.id(`lote:${lote}`), propriedadeIdPeriodo = c.numero(`sitio:${sitio}`);
      const refFechamento = `nutricao:${lote}:${inicioPeriodo}`;
      await c.registro(refFechamento, id => prisma.fechamentoConsumo.findFirst({ where: id ? { id } : { loteId: loteIdPeriodo, inicio: dia(inicioPeriodo), fim: dia(fimPeriodo) } }), async () => {
        const previa = await previaConsumo({ loteId: loteIdPeriodo, propriedadeId: propriedadeIdPeriodo, inicio: inicioPeriodo, fim: fimPeriodo });
        const itens = previa.itens.map(i => {
          const ref = INGREDIENTES.find(r => c.id(`produto:${r}`) === i.produtoId);
          if (!ref) throw new Error('Receita demonstrativa alterada.');
          return { produtoId: i.produtoId, modoEstoque: 'BAIXA_ESTOQUE' as const, partidas: [{ partidaId: c.id(`partida:${sitio}:${ref}`), quantidade: i.quantidadePrevista }] };
        });
        await confirmarConsumo({ chave: chave(refFechamento), loteId: loteIdPeriodo, propriedadeId: propriedadeIdPeriodo, inicio: inicioPeriodo, fim: fimPeriodo, itens, centroCustoId: c.id('centro:Pecuária') }, uid);
        return prisma.fechamentoConsumo.findFirstOrThrow({ where: { loteId: loteIdPeriodo, inicio: dia(inicioPeriodo), fim: dia(fimPeriodo) } });
      });
    }
  }
}
