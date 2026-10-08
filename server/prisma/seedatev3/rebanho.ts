import { prisma } from '../../src/db.js';
import { cadastrar, movimentar, darBaixa, definirCategoriaManual } from '../../src/services/pecuaria/rebanho/animais.js';
import { cadastrarAnimalSchema } from '../../src/services/pecuaria/rebanho/schemas.js';
import { criarLote } from '../../src/services/pecuaria/rebanho/lotes.js';
import { criarGenitor } from '../../src/services/pecuaria/rebanho/genitores.js';
import { criarMaterialGenetico } from '../../src/services/pecuaria/rebanho/materialGenetico.js';
import { registrarManejo, registrarPesagensColetivas } from '../../src/services/pecuaria/manejo/manejo.js';
import { chave, dia, type Contexto } from './contexto.js';

export const LOTES = [
  ['Principal', 'Matrizes'], ['Principal', 'Novilhas'], ['Principal', 'Cria'], ['Principal', 'Machos'],
  ['Destino', 'Recria'], ['Destino', 'Matrizes destino'],
] as const;

export async function rebanho(c: Contexto) {
  const uid = c.numero('usuario:dono');
  for (const [sitio, nome] of LOTES) {
    const propriedadeId = c.numero(`sitio:${sitio}`);
    await c.registro(`lote:${nome}`, id => prisma.lote.findFirst({ where: id ? { id } : { nome, propriedadeId } }), () => criarLote({ nome, propriedadeId, centroCustoId: c.id('centro:Pecuária'), observacao: 'Cenário fictício seedatev3' }, uid));
  }
  for (const [ref, nome, sexo, raca] of [['touro', 'Atlas externo', 'M', 'HO'], ['matriz', 'Gira externa', 'F', 'GO']] as const) {
    await c.registro(`genitor:${ref}`, id => prisma.genitorExterno.findFirst({ where: id ? { id } : { nome, sexo } }), () => criarGenitor({ nome, sexo, codigo: `DEV-${ref}`, fornecedorId: c.id('parceiro:fornecedor'), composicao: [{ racaId: c.id(`raca:${raca}`), fracao64: 64 }] }, uid));
  }
  // Genitores são criados antes dos descendentes. Nada nesta massa simula reprodução/leite pós-V3.
  const animais = [
    { n: 1, nome: 'Aurora', sexo: 'F', idade: 2190, lote: 'Matrizes', partos: 3, papel: 'DOADORA', raca: 'HO' },
    { n: 2, nome: 'Brisa', sexo: 'F', idade: 1825, lote: 'Matrizes', partos: 2, papel: 'RECEPTORA', raca: 'GO' },
    { n: 3, nome: 'Clara', sexo: 'F', idade: 1460, lote: 'Matrizes', partos: 1, raca: 'JE' },
    { n: 4, nome: 'Dália', sexo: 'F', idade: 1825, lote: 'Matrizes', partos: 2, raca: 'HO' },
    { n: 5, nome: 'Estrela', sexo: 'F', idade: 730, lote: 'Novilhas', raca: 'HO' },
    { n: 6, nome: 'Flora', sexo: 'F', idade: 550, lote: 'Novilhas', raca: 'GO' },
    { n: 7, nome: 'Gaia', sexo: 'F', idade: 450, lote: 'Novilhas', raca: 'JE' },
    { n: 8, nome: 'Hera', sexo: 'F', idade: 220, lote: 'Cria', mae: 1, paiExterno: true },
    { n: 9, nome: 'Íris', sexo: 'F', idade: 130, lote: 'Cria', mae: 2, paiExterno: true },
    { n: 10, nome: 'Jade', sexo: 'F', idade: 95, lote: 'Cria', mae: 3, paiExterno: true },
    { n: 11, nome: 'Kairo', sexo: 'M', idade: 500, lote: 'Machos', raca: 'NE' },
    { n: 12, nome: 'Luar', sexo: 'M', idade: 420, lote: 'Machos', raca: 'AN' },
    { n: 13, nome: 'Monte', sexo: 'M', idade: 1825, lote: 'Machos', raca: 'HO', reprodutor: true },
    { n: 14, nome: 'Nina', sexo: 'F', idade: 180, lote: 'Recria', sitio: 'Destino', maeExterna: true, pai: 13 },
    { n: 15, nome: 'Olívia', sexo: 'F', idade: 600, lote: 'Recria', sitio: 'Destino', raca: 'PS' },
    { n: 16, nome: 'Pérola', sexo: 'F', idade: 1825, lote: 'Matrizes destino', sitio: 'Destino', partos: 2, raca: 'GU' },
    { n: 17, nome: 'Rubí', sexo: 'F', idade: 2190, lote: 'Matrizes', partos: 3, raca: 'HO', baixa: 'VENDA' },
    { n: 18, nome: 'Sol', sexo: 'M', idade: 400, lote: 'Recria', sitio: 'Destino', raca: 'NE', baixa: 'MORTE' },
  ] as const;
  for (const a of animais) {
    const brinco = `DEV-${String(a.n).padStart(3, '0')}`;
    const filho = 'mae' in a || 'maeExterna' in a;
    await c.registro(`animal:${a.n}`, id => prisma.animal.findFirst({ where: id ? { id } : { brinco } }), () => cadastrar(cadastrarAnimalSchema.parse({
      brinco, nome: a.nome, sexo: a.sexo, dataNascimento: c.dias(-a.idade),
      // Nascidos ficam com entrada no nascimento; os demais trazem histórico anterior à janela financeira.
      dataEntrada: filho ? c.dias(-a.idade) : c.dias(Math.max(-900, -a.idade + 30)),
      origem: filho ? 'NASCIDO' : 'COMPRADO', partosAntesDaEntrada: 'partos' in a ? a.partos : 0,
      propriedadeId: c.numero(`sitio:${'sitio' in a ? a.sitio : 'Principal'}`), loteId: c.id(`lote:${a.lote}`),
      aptidao: a.sexo === 'M' && !('reprodutor' in a) ? 'CORTE' : 'LEITE', papelReprodutivo: 'papel' in a ? a.papel : 'NENHUM',
      observacao: 'Dados fictícios. Doadora/receptora são papéis, não eventos de gestação ou filiação.',
      ...('raca' in a ? { composicao: [{ racaId: c.id(`raca:${a.raca}`), fracao64: 64 }] } : {}),
      ...('mae' in a ? { maeId: c.id(`animal:${a.mae}`) } : {}),
      ...('pai' in a ? { paiId: c.id(`animal:${a.pai}`) } : {}),
      ...('maeExterna' in a ? { maeExternaId: c.id('genitor:matriz') } : {}),
      ...('paiExterno' in a ? { paiExternoId: c.id('genitor:touro') } : {}),
    }), uid));
  }
  const categoria = await prisma.categoriaAnimal.findUniqueOrThrow({ where: { chavePadrao: 'M_REPRODUTOR' } });
  await c.acao('categoria:reprodutor', async () => !!await prisma.categoriaManualAnimal.findFirst({ where: { animalId: c.id('animal:13') } }), () => definirCategoriaManual(c.id('animal:13'), { categoriaId: categoria.id, data: c.mes(-2, 2), motivo: 'Reprodutor do cenário demonstrativo' }, uid));
  for (const [ref, tipo, nome] of [['semen', 'SEMEN', 'Sêmen Atlas — demonstração'], ['embriao', 'EMBRIAO', 'Embrião Aurora × Atlas — demonstração']] as const) {
    const material = await c.registro(`material:${ref}`, id => prisma.materialGenetico.findFirst({ where: id ? { id } : { produto: { nome } } }), () => criarMaterialGenetico({
      tipo, touro: { tipo: 'EXTERNO', id: c.id('genitor:touro') }, ...(tipo === 'EMBRIAO' ? { doadora: { tipo: 'ANIMAL' as const, id: c.id('animal:1') } } : { tipoSemen: 'SEXADO_FEMEA' as const }),
      produto: { nome, categoriaId: c.id('categoria:Sêmen e embriões'), centroCustoIds: [c.id('centro:Pecuária')], fornecedorIds: [c.id('parceiro:fornecedor')] }, observacao: 'Material fictício; não representa prescrição ou evento reprodutivo.',
    }, uid));
    const linha = await prisma.materialGenetico.findUniqueOrThrow({ where: { id: String(material.id) } });
    c.manifesto.ids[`produto:${ref}`] = linha.produtoId; await c.salvar();
  }
  // Pesos históricos antes das movimentações e baixas; duas datas por animal para o GMD.
  for (const [data, ganho] of [[c.mes(-1, 2), 0], [c.mes(-1, 16), 8]] as const) {
    for (const sitio of ['Principal', 'Destino']) {
      const key = `pesagem:${data}:${sitio}`;
      await c.acao(key, async () => !!await prisma.requisicaoPecuaria.findUnique({ where: { chave: chave(key) } }), () => registrarPesagensColetivas({
        chave: chave(key), propriedadeId: c.numero(`sitio:${sitio}`), data, tipo: 'ROTINA', origem: 'BALANCA',
        itens: animais.filter(a => ('sitio' in a ? a.sitio : 'Principal') === sitio).map(a => ({ animalId: c.id(`animal:${a.n}`), pesoKg: (a.idade > 1000 ? 480 : a.idade > 350 ? 260 : 90) + a.n + ganho })),
      }, uid));
    }
  }
  for (const [n, lote, sitio, data, motivo] of [
    [6, 'Matrizes', 'Principal', c.mes(-1, 6), 'Troca de lote durante o período nutricional'],
    [7, 'Recria', 'Destino', c.mes(-1, 20), 'Transferência entre Principal e Destino'],
  ] as const) {
    const key = `movimentar:${n}`;
    await c.acao(key, async () => !!await prisma.localizacaoAnimal.findFirst({ where: { animalId: c.id(`animal:${n}`), desde: dia(data), loteId: c.id(`lote:${lote}`) } }), () => movimentar({ animalIds: [c.id(`animal:${n}`)], propriedadeId: c.numero(`sitio:${sitio}`), loteId: c.id(`lote:${lote}`), data, motivo }, uid));
  }
  for (const [n, tipo, data, pesoKg] of [[8, 'DESMAMA', c.mes(-1, 18), 112], [11, 'CASTRACAO', c.mes(-1, 18), 279]] as const) {
    const key = `manejo:${n}:${tipo}`;
    await c.acao(key, async () => !!await prisma.manejoAnimal.findFirst({ where: { animalId: c.id(`animal:${n}`), tipo } }), () => registrarManejo({ chave: chave(key), animalId: c.id(`animal:${n}`), propriedadeId: c.numero('sitio:Principal'), data, tipo, pesoKg, responsavel: 'Equipe demonstrativa' }, uid));
  }
  for (const [n, tipo, motivo, sitio] of [[17, 'VENDA', 'Excedente de animais', 'Principal'], [18, 'MORTE', 'Acidente', 'Destino']] as const) {
    await c.acao(`baixa:${n}`, async () => !!await prisma.baixaAnimal.findFirst({ where: { animalId: c.id(`animal:${n}`) } }), () => darBaixa({ animalId: c.id(`animal:${n}`), tipo, motivoId: c.id(`motivo:${motivo}`), data: c.mes(-1, 25), observacao: tipo === 'VENDA' ? 'Venda demonstrativa DEV-017; operação seedatev3 — venda de Rubí.' : 'Acidente fictício, sem ocorrência clínica.' }, uid, c.numero(`sitio:${sitio}`)));
  }
}
