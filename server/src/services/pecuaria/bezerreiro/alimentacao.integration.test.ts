import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { prisma } from '../../../db.js';
import { exigirBancoIntegracaoPecuaria } from '../../../lib/banco-pecuaria-integration.fixture.js';
import { confirmarOfertaTx, previsaoTx } from './aleitamento.js';
import { confirmarConsumoTx } from '../nutricao/consumo.js';
import { confirmarOfertaSchema } from './schemas.js';
import { travarAlimentacaoLeiteTx } from './alimentacao-compartilhada.js';

const suite = process.env.PECUARIA_DB_INTEGRATION === '1' ? describe : describe.skip;
const data = new Date('2026-10-26T00:00:00Z'), desde = new Date('2026-10-25T00:00:00Z');
const rollback = new Error('ROLLBACK_EXCLUSIVO_FIXTURE_ALIMENTACAO');

/** Todas as fixtures ficam na transação, inclusive os fatos imutáveis. Jamais
 * remove fatos do seed, desabilita triggers ou deixa registros commitados. */
async function comFixture(teste: (tx: Prisma.TransactionClient, f: Awaited<ReturnType<typeof preparar>>) => Promise<void>) {
  exigirBancoIntegracaoPecuaria();
  try {
    await prisma.$transaction(async tx => {
      const fixture = await preparar(tx);
      await conferir(tx);
      await teste(tx, fixture);
      await conferir(tx);
      throw rollback;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
    throw new Error('A transação de fixture deveria ter sido desfeita');
  } catch (erro) { if (erro !== rollback) throw erro; }
}
async function conferir(tx: Prisma.TransactionClient) {
  await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
  await tx.$executeRawUnsafe('SET CONSTRAINTS ALL DEFERRED');
}
async function preparar(tx: Prisma.TransactionClient) {
  const nome = `Alimentação R01 ${randomUUID()}`;
  const sitio = await tx.propriedade.create({ data: { nome } });
  const centro = await tx.centroCusto.create({ data: { nome } });
  const lote = await tx.lote.create({ data: { propriedadeId: sitio.id, nome, centroCustoId: centro.id } });
  const animal = await tx.animal.create({ data: { brinco: randomUUID(), sexo: 'F', dataNascimento: new Date('2026-10-01'), dataEntrada: desde, origem: 'COMPRADO' } });
  await tx.localizacaoAnimal.create({ data: { animalId: animal.id, propriedadeId: sitio.id, loteId: lote.id, desde } });
  const perfil = await tx.perfilBezerreiro.create({ data: { propriedadeId: sitio.id, loteId: lote.id } });
  const fase = await tx.faseBezerreiroVersao.create({ data: { propriedadeId: sitio.id, identidadeId: randomUUID(), versao: 1, nome, publicada: true, litrosDia: 4,
    ofertas: { create: [{ identidadeId: randomUUID(), ordem: 0, percentual: 100 }] } }, include: { ofertas: true } });
  const participacao = await tx.participacaoBezerreiro.create({ data: { perfilId: perfil.id, animalId: animal.id, desde, fases: { create: { faseVersaoId: fase.id, desde } } }, include: { fases: true } });
  const leite = await tx.produto.create({ data: { nome: `${nome} leite`, unidade: 'L', usoNutricional: true } });
  const racao = await tx.produto.create({ data: { nome: `${nome} ração`, unidade: 'KG', usoNutricional: true } });
  const dieta = await tx.dieta.create({ data: { nome, versao: 1, publicadaEm: new Date(), itens: { create: [
    { produtoId: leite.id, unidade: 'L', quantidadeCabecaDia: 4 }, { produtoId: racao.id, unidade: 'KG', quantidadeCabecaDia: 1 },
  ] } } });
  await tx.vigenciaDietaLote.create({ data: { loteId: lote.id, dietaId: dieta.id, desde } });
  const config = await tx.configuracaoOrdenha.create({ data: { propriedadeId: sitio.id, vigenteDesde: desde, fonteProducao: 'GERAL', ordenhas: { create: { posicaoId: randomUUID(), nome: 'Fixture', ordem: 1 } } }, include: { ordenhas: true } });
  const dia = await tx.diaProducaoLeite.create({ data: { propriedadeId: sitio.id, dataOperacional: data, configuracaoId: config.id } });
  const sessao = await tx.sessaoOrdenha.create({ data: { diaId: dia.id, posicaoId: config.ordenhas[0].posicaoId, nome: 'Fixture', ordem: 1 } });
  const criterio = { configuracaoId: config.id, criterio: null, partos: [], primeiraOrdenhaColostro: null };
  const medicao = await tx.medicaoGeralLeite.create({ data: { sessaoId: sessao.id, recipiente: nome, litros: 100, origemLitros: 'LITROS_INFORMADOS', natureza: 'COMERCIAL', animaisOrigem: [], criterioColostroSnapshot: criterio, responsavel: 'Fixture R01' } });
  const movimento = await tx.movimentoEstoque.create({ data: { propriedadeId: sitio.id, produtoId: leite.id, tipo: 'ENTRADA', origem: 'PRODUCAO', data, quantidade: 100, metodoValorizacao: 'LEITE_FIFO_V1' } });
  const entrada = await tx.entradaProducaoLeite.create({ data: { sessaoId: sessao.id, versaoSessao: 1, medicaoGeralId: medicao.id, movimentoId: movimento.id, chave: randomUUID(), hash: 'fixture',
    snapshot: { fonte: 'GERAL', medicaoGeralId: medicao.id, litros: '100.000', versaoMedicaoGeral: 1, recipiente: nome, tanqueId: null, natureza: 'COMERCIAL', declaracaoDireta: null, criterioColostroSnapshot: criterio, primeiraOrdenhaColostro: null } } });
  await tx.classificacaoEntradaLeite.create({ data: { entradaId: entrada.id, versao: 1, natureza: 'NAO_INFORMADA', motivo: 'Natureza inicial da fixture' } });
  await tx.classificacaoEntradaLeite.create({ data: { entradaId: entrada.id, versao: 2, natureza: 'COMERCIAL', motivo: 'Natureza comercial explicitamente comprovada na fixture' } });
  return { sitio, centro, lote, animal, perfil, fase, participacao, leite, racao, entrada };
}
async function oferta(tx: Prisma.TransactionClient, f: Awaited<ReturnType<typeof preparar>>) {
  const previa = await previsaoTx(tx, f.sitio.id, data, f.perfil.id);
  return { ...confirmarOfertaSchema.parse({ chave: randomUUID(), contextoToken: previa.contextoToken, perfilId: f.perfil.id, data: '2026-10-26', ofertaProgramadaId: f.fase.ofertas[0].id, responsavel: 'Fixture R01', grupos: [{ quantidadeLitros: '4', entradaIds: [f.entrada.id] }] }), propriedadeId: f.sitio.id };
}
function fechamento(f: Awaited<ReturnType<typeof preparar>>, leite = 4) {
  return { chave: randomUUID(), propriedadeId: f.sitio.id, loteId: f.lote.id, inicio: '2026-10-26', fim: '2026-10-26', itens: [
    { produtoId: f.leite.id, quantidadeConfirmada: leite, motivoAjuste: leite === 0 ? 'Leite já fornecido pelo Bezerreiro' : undefined, modoEstoque: 'BAIXA_ESTOQUE' as const, origensLeite: [f.entrada.id] },
    { produtoId: f.racao.id, quantidadeConfirmada: 1, modoEstoque: 'SEM_BAIXA_JUSTIFICADA' as const, justificativaSemBaixa: 'Alimento próprio conferido pela fixture' },
  ] };
}
suite('alimentação íntegra com PostgreSQL real', () => {
  it('troca A→B com dose igual invalida token sem gravar oferta, parcela ou baixa', async () => comFixture(async (tx, f) => {
    const entrada = await oferta(tx, f);
    await tx.periodoFaseBezerreiro.update({ where: { id: f.participacao.fases[0].id }, data: { ate: data } });
    await tx.participacaoBezerreiro.update({ where: { id: f.participacao.id }, data: { ate: data, versao: { increment: 1 } } });
    const b = await tx.animal.create({ data: { brinco: randomUUID(), sexo: 'F', dataNascimento: new Date('2026-10-01'), dataEntrada: desde, origem: 'COMPRADO' } });
    await tx.localizacaoAnimal.create({ data: { animalId: b.id, propriedadeId: f.sitio.id, loteId: f.lote.id, desde } });
    await tx.participacaoBezerreiro.create({ data: { perfilId: f.perfil.id, animalId: b.id, desde: data, fases: { create: { faseVersaoId: f.fase.id, desde: data } } } });
    await conferir(tx);
    await expect(confirmarOfertaTx(tx, entrada, null)).rejects.toMatchObject({ code: 'CONFLITO', campo: 'contextoToken' });
    expect(await tx.ofertaBezerreiro.count({ where: { propriedadeId: f.sitio.id } })).toBe(0);
    expect(await tx.movimentoEstoque.count({ where: { produtoId: f.leite.id, tipo: 'SAIDA' } })).toBe(0);
  }));
  it('oferta → fechamento impede outra baixa e permite zero justificado com os outros ingredientes', async () => comFixture(async (tx, f) => {
    const entrada = await oferta(tx, f), original = await confirmarOfertaTx(tx, entrada, null); await conferir(tx);
    await expect(confirmarConsumoTx(tx, fechamento(f), null)).rejects.toMatchObject({ code: 'CONFLITO' });
    expect(await tx.fechamentoConsumo.count({ where: { propriedadeId: f.sitio.id } })).toBe(0);
    const salvo = await confirmarConsumoTx(tx, fechamento(f, 0), null); await conferir(tx);
    expect(salvo.itens.map(i => i.quantidadeConfirmada.toString())).toEqual(['0', '1']);
    expect(await confirmarOfertaTx(tx, entrada, null)).toEqual(original);
    expect(await tx.movimentoEstoque.count({ where: { produtoId: f.leite.id, tipo: 'SAIDA' } })).toBe(1);
  }));
  it('fechamento → oferta impede baixa repetida e aceita adicional explícito com conservação SQL', async () => comFixture(async (tx, f) => {
    await confirmarConsumoTx(tx, fechamento(f), null); await conferir(tx);
    const entrada = await oferta(tx, f);
    await expect(confirmarOfertaTx(tx, entrada, null)).rejects.toMatchObject({ code: 'CONFLITO' });
    expect(await tx.ofertaBezerreiro.count({ where: { propriedadeId: f.sitio.id } })).toBe(0);
    await confirmarOfertaTx(tx, { ...entrada, grupos: entrada.grupos.map(g => ({ ...g, consumoAdicional: true, justificativa: 'Novo fornecimento real além do fechamento' })) }, null);
    await conferir(tx);
    const totais = await tx.fornecimentoNutricionalLeite.aggregate({ where: { propriedadeId: f.sitio.id }, _sum: { quantidadeLitros: true } });
    expect(totais._sum.quantidadeLitros?.toFixed(3)).toBe('8.000');
    expect(await tx.movimentoEstoque.count({ where: { produtoId: f.leite.id, tipo: 'SAIDA' } })).toBe(2);
  }));
  it('a primitiva comum serializa duas conexões e libera a disputa após rollback', async () => {
    exigirBancoIntegracaoPecuaria(); const sitio = -Math.floor(Math.random() * 1_000_000_000) - 1;
    let liberar!: () => void, adquirido!: () => void;
    const liberacao = new Promise<void>(resolve => { liberar = resolve; }), aquisicao = new Promise<void>(resolve => { adquirido = resolve; });
    const primeiro = prisma.$transaction(async tx => { await travarAlimentacaoLeiteTx(tx, sitio); adquirido(); await liberacao; throw rollback; }, { timeout: 10_000 }).catch(erro => { if (erro !== rollback) throw erro; });
    try {
      await aquisicao;
      await prisma.$transaction(async tx => {
        const [r] = await tx.$queryRaw<Array<{ livre: boolean }>>`SELECT pg_try_advisory_xact_lock(hashtext(${`pec-alimentacao-leite:${sitio}`})) AS livre`;
        expect(r.livre).toBe(false);
      });
    } finally { liberar(); await primeiro; }
    await prisma.$transaction(async tx => { const [r] = await tx.$queryRaw<Array<{ livre: boolean }>>`SELECT pg_try_advisory_xact_lock(hashtext(${`pec-alimentacao-leite:${sitio}`})) AS livre`; expect(r.livre).toBe(true); });
  });
});
