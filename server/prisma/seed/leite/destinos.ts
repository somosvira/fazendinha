import { prisma } from '../../../src/db.js';
import type { Contexto } from '../contexto.js';
import { dia } from '../contexto.js';
import { listarOrigensDestino, registrarDestinoInterno, estornarDestinoInterno } from '../../../src/services/pecuaria/leite/destinos.js';
import { registrarDescarteLeite, estornarDescarteLeite } from '../../../src/services/pecuaria/leite/descartes.js';
import { criarDieta, publicarDieta, atribuirDieta } from '../../../src/services/pecuaria/nutricao/dietas.js';
import { confirmarConsumo } from '../../../src/services/pecuaria/nutricao/consumo.js';
import { revisarReferenciaLeite } from '../../../src/services/pecuaria/leite/referencias.js';
import { apurarValorProducaoLeite } from '../../../src/services/pecuaria/leite/estoque.js';
import { AVISO, key, nome, ref } from './catalogo.js';
import { ctx, executar, guardar, id, sitio, uid } from './base.js';

export async function origem(c: Contexto, produto: string, quantidade: number) {
  const r = await listarOrigensDestino(sitio(c), id(c, `produto:${produto}`), c.manifesto.dataBase);
  const o = r.itens.find(o => o.quantidadeDisponivelLitros >= quantidade);
  if (!o) throw new Error(`Origem demonstrativa ${produto} insuficiente.`);
  return o;
}
export async function destinos(c: Contexto) {
  const data = c.manifesto.dataBase;
  const cria = { animalId: id(c, 'animal:cria'), criaId: id(c, 'cria:parto') };
  if (!cria) throw new Error('É necessária uma cria viva já cadastrada no sítio. A seed V5 não cria animais ou partos.');
  await guardar(c, 'animal:cria', cria.animalId);
  for (const [tipo, natureza] of [['comercial', 'LEITE_COMUM'], ['nao-comercial', 'LEITE_NAO_COMERCIAL'], ['colostro', 'COLOSTRO']] as const) {
    await executar(c, `destino:${tipo}`, async () => {
      const o = await origem(c, tipo, 3);
      return registrarDestinoInterno({ chave: key(`destino:${tipo}`), propriedadeId: sitio(c), entradaId: o.entradaId, data,
        natureza, declaracaoOrigem: AVISO, quantidadeDisponivelEsperadaLitros: o.quantidadeDisponivelLitros,
        parcelas: [{ animalId: cria.animalId, quantidadeLitros: 3, ...(tipo === 'colostro' ? { criaId: cria.criaId } : {}) }],
        responsavel: 'Equipe demonstrativa V5', observacao: AVISO }, uid(c));
    });
  }
  await executar(c, 'destino:estornado', async () => {
    const o = await origem(c, 'nao-comercial', 1);
    return registrarDestinoInterno({ chave: key('destino:estornado'), propriedadeId: sitio(c), entradaId: o.entradaId, data, natureza: 'LEITE_NAO_COMERCIAL', declaracaoOrigem: AVISO,
      quantidadeDisponivelEsperadaLitros: o.quantidadeDisponivelLitros, parcelas: [{ animalId: cria.animalId, quantidadeLitros: 1 }] }, uid(c));
  });
  await executar(c, 'destino:estornar', () => estornarDestinoInterno(id(c, 'destino:estornado'), { chave: key('destino:estornar'), propriedadeId: sitio(c), versaoEsperada: 1, motivo: AVISO }, uid(c)));
  for (const tipo of ['valido', 'estornado']) await executar(c, `descarte:${tipo}`, async () => {
    const o = await origem(c, 'nao-comercial', 2);
    return registrarDescarteLeite({ chave: key(`descarte:${tipo}`), propriedadeId: sitio(c), entradaId: o.entradaId, data, quantidadeLitros: 2,
      quantidadeDisponivelEsperadaLitros: o.quantidadeDisponivelLitros, motivo: AVISO }, uid(c));
  });
  await executar(c, 'descarte:estornar', () => estornarDescarteLeite(id(c, 'descarte:estornado'), { chave: key('descarte:estornar'), propriedadeId: sitio(c), versaoEsperada: 1, motivo: AVISO }, uid(c)));
}
export async function nutricao(c: Contexto) {
  const data = c.manifesto.dataBase;
  let loteId = c.manifesto.ids[ref('lote:nutricao')];
  if (!loteId) {
    const locais = await prisma.localizacaoAnimal.findMany({ where: { propriedadeId: sitio(c), animalId: id(c, 'animal:cria'), desde: { lte: dia(data) }, OR: [{ ate: null }, { ate: { gt: dia(data) } }] } });
    if (locais.length !== 1 || !locais[0].loteId) throw new Error('Cria precisa ter localização/lote comprovados. Nenhum lote será criado.');
    loteId = locais[0].loteId;
    if (await prisma.vigenciaDietaLote.count({ where: { loteId, OR: [{ ate: null }, { ate: { gt: dia(data) } }] } })) throw new Error('O lote da cria já tem dieta. Não será substituída pela seed. Escolha explicitamente outro lote demonstrativo antes de continuar.');
    await guardar(c, 'lote:nutricao', loteId);
  }
  await c.registro(ref('dieta'), i => prisma.dieta.findFirst({ where: i ? { id: i } : { nome: nome('Leite no bezerreiro') } }), () => criarDieta({ nome: nome('Leite no bezerreiro'), observacao: AVISO,
    itens: [{ produtoId: id(c, 'produto:comercial'), quantidadeCabecaDia: 4 }] }, uid(c)));
  await c.acao(ref('dieta:publicar'), async () => !!(await prisma.dieta.findUniqueOrThrow({ where: { id: id(c, 'dieta') } })).publicadaEm, () => publicarDieta(id(c, 'dieta'), uid(c)));
  const vigencias = await prisma.vigenciaDietaLote.findMany({ where: { loteId, OR: [{ ate: null }, { ate: { gt: dia(data) } }] } });
  if (vigencias.some(v => v.dietaId !== id(c, 'dieta'))) throw new Error('O lote recebeu outra dieta após a preparação. Não será substituída.');
  await c.registro(ref('dieta:vigencia'), i => prisma.vigenciaDietaLote.findFirst({ where: i ? { id: i } : { loteId, dietaId: id(c, 'dieta') } }), () => atribuirDieta({ loteId: loteId!, propriedadeId: sitio(c), dietaId: id(c, 'dieta'), desde: data }, uid(c)));
  await executar(c, 'nutricao:fechamento', async () => {
    const nc = (await listarOrigensDestino(sitio(c), id(c, 'produto:nao-comercial'), data)).itens.find(o => o.quantidadeDisponivelLitros === 40);
    const comercial = await origem(c, 'comercial', 60);
    if (!nc) throw new Error('Cenário misto exige origem separada com 40 L não comerciais.');
    return confirmarConsumo({ chave: key('nutricao:fechamento'), propriedadeId: sitio(c), loteId: loteId!, inicio: data, fim: data, centroCustoId: c.id('centro:Pecuária'),
      itens: [{ produtoId: id(c, 'produto:comercial'), quantidadeConfirmada: 60, motivoAjuste: AVISO, modoEstoque: 'BAIXA_ESTOQUE', origensLeite: [nc.entradaId, comercial.entradaId] }] }, uid(c));
  });
  const itens = await prisma.itemFechamentoConsumo.findMany({ where: { fechamentoId: id(c, 'nutricao:fechamento') }, select: { id: true } });
  const f = await prisma.fornecimentoNutricionalLeite.findFirstOrThrow({ where: { itemId: { in: itens.map(i => i.id) } } });
  await guardar(c, 'nutricao:fornecimento', f.id);
}
export async function regularizacoes(c: Contexto) {
  await executar(c, 'nutricao:revisar-referencia', async () => {
    const atual = await prisma.referenciaGerencialLeite.findFirst({ where: { fornecimentoId: id(c, 'nutricao:fornecimento') }, orderBy: { versao: 'desc' } });
    return revisarReferenciaLeite(id(c, 'nutricao:fornecimento'), { chave: key('nutricao:revisar-referencia'), propriedadeId: sitio(c), fechamentoId: id(c, 'comercial:atual:fechamento'), versaoEsperada: atual?.versao ?? 0, motivo: AVISO }, uid(c));
  });
  // Valor documentado após as saídas: custo real não se confunde com o preço R07.
  const entradaId = id(c, `entrada:medicao:${c.mes(-1, 20)}:0:principal`);
  for (const [n, versao, valor] of [['apuracao', 0, 588], ['apuracao:revisao', 1, 609]] as const) {
    await c.registro(ref(n), i => prisma.apuracaoValorLeite.findFirst({ where: i ? { id: i } : { chave: key(n) } }),
      () => apurarValorProducaoLeite({ chave: key(n), entradaId, versaoEsperada: versao, valorTotal: valor, referencia: 'Planilha sintética de custos', evidencia: AVISO, motivo: AVISO }, ctx(c)));
  }
}
