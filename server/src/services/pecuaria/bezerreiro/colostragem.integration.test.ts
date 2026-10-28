import { randomInt, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { prisma } from '../../../db.js';
import { exigirBancoIntegracaoPecuaria } from '../../../lib/banco-pecuaria-integration.fixture.js';
import { baixarLeiteTx, saldosOrigensLeiteTx } from '../../estoque/leite.js';
import { confirmarProducaoGeralTx } from '../leite/estoque.js';
import { registrarColostroTx } from '../reproducao/colostro.js';
import { operacaoIdempotenteTx } from '../reproducao/operacoes.js';
import { vincularFornecimentoColostragemTx } from './acompanhamento.js';

const suite = process.env.PECUARIA_DB_INTEGRATION === '1' ? describe : describe.skip;
const data = new Date('2026-10-20T00:00:00Z');
const rollback = new Error('ROLLBACK_EXCLUSIVO_FIXTURE_COLOSTRAGEM');
async function conferir(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
  await tx.$executeRaw`SET CONSTRAINTS ALL DEFERRED`;
}
function sqlstate(erro: unknown) {
  const registro = (v: unknown): Record<string, unknown> | undefined => v != null && typeof v === 'object' ? v as Record<string, unknown> : undefined;
  const e = registro(erro), meta = registro(e?.meta), causa = registro(registro(meta?.driverAdapterError)?.cause) ?? registro(e?.cause);
  return meta?.code ?? causa?.originalCode ?? e?.code;
}

async function preparar(tx: Prisma.TransactionClient, sitioId: number) {
  const nome = `Colostragem SQL ${randomUUID()}`;
  await tx.propriedade.create({ data: { id: sitioId, nome } });
  const matriz = await tx.animal.create({ data: { brinco: randomUUID(), sexo: 'F', dataNascimento: new Date('2020-01-01'),
    dataEntrada: new Date('2026-01-01'), origem: 'COMPRADO' } });
  await tx.localizacaoAnimal.create({ data: { animalId: matriz.id, propriedadeId: sitioId, desde: new Date('2026-01-01') } });
  await tx.finalidadeAnimal.create({ data: { animalId: matriz.id, aptidao: 'LEITE', desde: new Date('2026-01-01') } });
  const parto = await tx.partoAnimal.create({ data: { animalId: matriz.id, propriedadeId: sitioId, data, tipo: 'NASCIMENTO' } });
  await tx.lactacaoAnimal.create({ data: { animalId: matriz.id, propriedadeId: sitioId, partoId: parto.id, inicio: data } });
  const animal = await tx.animal.create({ data: { brinco: randomUUID(), sexo: 'F', dataNascimento: data, dataEntrada: data, origem: 'NASCIDO' } });
  await tx.localizacaoAnimal.create({ data: { animalId: animal.id, propriedadeId: sitioId, desde: data } });
  const cria = await tx.criaParto.create({ data: { partoId: parto.id, animalId: animal.id, viva: true, sexo: 'F', ordem: 1, filiacaoSnapshot: { pesoKg: 40 } } });
  const politica = await tx.configuracaoBezerreiro.create({ data: { propriedadeId: sitioId, versao: 1, brixReferencia: 25, percentualPesoColostro: 10 } });
  const produto = await tx.produto.create({ data: { nome, unidade: 'L', usoNutricional: true } });
  const config = await tx.configuracaoOrdenha.create({ data: { propriedadeId: sitioId, vigenteDesde: new Date('2026-01-01'),
    fonteProducao: 'GERAL', criterioColostro: { tipo: 'PRIMEIRA_ORDENHA' },
    ordenhas: { create: { posicaoId: randomUUID(), nome: 'Manhã', ordem: 1 } } }, include: { ordenhas: true } });
  const dia = await tx.diaProducaoLeite.create({ data: { propriedadeId: sitioId, dataOperacional: data, configuracaoId: config.id } });
  const sessao = await tx.sessaoOrdenha.create({ data: { diaId: dia.id, posicaoId: config.ordenhas[0].posicaoId, nome: 'Manhã', ordem: 1 } });
  const medicao = await tx.medicaoGeralLeite.create({ data: { sessaoId: sessao.id, recipiente: nome, litros: 6,
    origemLitros: 'LITROS_INFORMADOS', natureza: 'COLOSTRO', animaisOrigem: [matriz.id], primeiraOrdenhaColostro: true,
    criterioColostroSnapshot: { configuracaoId: config.id, criterio: { tipo: 'PRIMEIRA_ORDENHA' },
      partos: [{ id: parto.id, animalId: matriz.id, versao: parto.versao, data: '2026-10-20' }], primeiraOrdenhaColostro: true }, responsavel: 'Fixture SQL' } });
  const entrada = await confirmarProducaoGeralTx(tx, { chave: randomUUID(), medicaoId: medicao.id, versaoEsperada: medicao.versao,
    produtoId: produto.id, motivoNatureza: 'Colostro da primeira ordenha comprovada nesta fixture' }, { propriedadeId: sitioId, usuarioId: null });
  const retirada = await tx.loteColostro.create({ data: { propriedadeId: sitioId, partoId: parto.id, matrizId: matriz.id,
    medicaoGeralId: medicao.id, entradaId: entrada.id, data, primeiraRetirada: true, quantidadeLitros: 6, status: 'CONFIRMADO',
    origemFisicaSnapshot: { versaoMedicao: medicao.versao, recipiente: nome }, chave: randomUUID(), hash: 'fixture privada' } });
  const origem = await tx.origemColostro.create({ data: { propriedadeId: sitioId, loteColostroId: retirada.id, quantidadeLitros: 6 } });
  return { sitioId, produto, entrada, retirada, origem, cria, animal, politica };
}

/** Exercita SQL e núcleos Tx públicos na mesma conexão. Os wrappers HTTP e os
 * wrappers que abrem outra transação não são simulados por esta regressão. */
async function destinar(tx: Prisma.TransactionClient, f: Awaited<ReturnType<typeof preparar>>, chave: string) {
  const comando = { chave, propriedadeId: f.sitioId, origemId: f.origem.id, quantidadeLitros: '4', codigo: `U-${chave}` };
  return operacaoIdempotenteTx(tx, comando, null, 'FIXTURE_COLOSTRAGEM_SQL', async () => {
    const destino = await tx.destinacaoColostro.create({ data: { propriedadeId: f.sitioId, origemId: f.origem.id, data,
      chave, hash: 'fixture privada', responsavel: 'Fixture SQL' } });
    const fornecimento = await registrarColostroTx(tx, { chave: randomUUID(), propriedadeId: f.sitioId, criaId: f.cria.id,
      data: '2026-10-20', quantidade: 4, unidade: 'L', tipo: 'FRESCO', responsavel: 'Fixture SQL' }, null);
    const movimento = await baixarLeiteTx(tx, { produtoId: f.produto.id, propriedadeId: f.sitioId, data, quantidade: 4,
      entradaIds: [f.entrada.id], origem: 'NUTRICAO', observacao: 'Fornecimento da fixture de colostragem', usuarioId: null, permitirOrigemColostro: true });
    await tx.alocacaoFornecimentoColostro.create({ data: { destinacaoId: destino.id, fornecimentoId: fornecimento.id,
      origemId: f.origem.id, quantidadeLitros: 4, movimentoId: movimento.id } });
    const acompanhamento = await vincularFornecimentoColostragemTx(tx, { animalId: f.animal.id, criaId: f.cria.id,
      fornecimentoId: fornecimento.id, propriedadeId: f.sitioId, data, motivoExcecao: 'Brix não medido: exceção explícita desta fixture SQL' }, null);
    const unidade = await tx.unidadeBancoColostro.create({ data: { destinacaoId: destino.id, origemId: f.origem.id, propriedadeId: f.sitioId,
      codigo: comando.codigo, volumeLitros: 2, dataCongelamento: data, chave: `${chave}:${comando.codigo}` } });
    await tx.destinacaoColostro.update({ where: { id: destino.id }, data: { snapshot: { fornecimentosCriados: [fornecimento.id],
      excecaoBrix: { motivo: 'Brix não medido: exceção explícita desta fixture SQL', responsavel: 'Fixture SQL' } } } });
    await tx.origemColostro.update({ where: { id: f.origem.id }, data: { versao: { increment: 1 } } });
    return { destinoId: destino.id, fornecimentoId: fornecimento.id, movimentoId: movimento.id, unidadeId: unidade.id, acompanhamentoId: acompanhamento.acompanhamentoId };
  });
}

suite('colostragem central com PostgreSQL e rollback de todas as fixtures', () => {
  it('conserva 6 L em 4 L à cria e unidade de 2 L, com acompanhamento e reenvio sem duplicação', async () => {
    exigirBancoIntegracaoPecuaria();
    const sitioId = -randomInt(1, 2_000_000_000);
    try {
      await prisma.$transaction(async tx => {
        const f = await preparar(tx, sitioId); await conferir(tx);
        const chave = randomUUID(), resultado = await destinar(tx, f, chave); await conferir(tx);
        expect(await destinar(tx, f, chave)).toEqual(resultado); await conferir(tx);
        const saldo = (await saldosOrigensLeiteTx(tx, f.produto.id, sitioId)).find(o => o.entradaId === f.entrada.id);
        expect(saldo?.quantidade.toFixed(3)).toBe('2.000');
        const alocacoes = await tx.alocacaoFornecimentoColostro.findMany({ where: { origemId: f.origem.id, ativo: true } });
        const unidades = await tx.unidadeBancoColostro.findMany({ where: { origemId: f.origem.id } });
        expect(alocacoes).toHaveLength(1); expect(alocacoes[0].quantidadeLitros.toFixed(3)).toBe('4.000');
        expect(unidades).toHaveLength(1); expect(unidades[0]).toMatchObject({ id: resultado.unidadeId, status: 'CONGELADA', dataRetirada: null });
        expect(unidades[0].volumeLitros.plus(alocacoes[0].quantidadeLitros).toFixed(3)).toBe('6.000');
        expect(await tx.movimentoEstoque.count({ where: { produtoId: f.produto.id, tipo: 'ENTRADA' } })).toBe(1);
        expect(await tx.movimentoEstoque.count({ where: { produtoId: f.produto.id, tipo: 'SAIDA' } })).toBe(1);
        expect(await tx.fornecimentoColostro.count({ where: { criaId: f.cria.id } })).toBe(1);
        expect(await tx.destinacaoColostro.count({ where: { origemId: f.origem.id } })).toBe(1);
        const acompanhamento = await tx.acompanhamentoColostragem.findUniqueOrThrow({ where: { animalId_propriedadeId: { animalId: f.animal.id, propriedadeId: sitioId } }, include: { fornecimentos: true } });
        expect(acompanhamento).toMatchObject({ id: resultado.acompanhamentoId, configuracaoId: f.politica.id });
        expect(acompanhamento.metaLitros?.toFixed(3)).toBe('4.000');
        expect(acompanhamento.fornecimentos).toHaveLength(1);
        expect(acompanhamento.fornecimentos[0].fornecimentoId).toBe(resultado.fornecimentoId);
        // UPDATE sem mudança também percorre o observador físico com origem real.
        await tx.$executeRaw`UPDATE public."MovimentoEstoque" SET observacao=observacao WHERE id=${resultado.movimentoId}`;
        await conferir(tx);
        await tx.$executeRaw`SAVEPOINT excesso_reserva`;
        try {
          let erro: unknown;
          try {
            await baixarLeiteTx(tx, { produtoId: f.produto.id, propriedadeId: sitioId, data, quantidade: 1, entradaIds: [f.entrada.id],
              origem: 'NUTRICAO', observacao: 'Tentativa inválida sobre os dois litros reservados', usuarioId: null, permitirOrigemColostro: true });
            await conferir(tx);
          } catch (falha) { erro = falha; }
          expect(sqlstate(erro)).toBe('23514');
        } finally {
          await tx.$executeRaw`ROLLBACK TO SAVEPOINT excesso_reserva`;
          await tx.$executeRaw`RELEASE SAVEPOINT excesso_reserva`;
        }
        await conferir(tx);
        expect(await tx.movimentoEstoque.count({ where: { produtoId: f.produto.id, tipo: 'SAIDA' } })).toBe(1);
        throw rollback;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
      throw new Error('A fixture de colostragem deveria sempre sofrer rollback');
    } catch (erro) { if (erro !== rollback) throw erro; }
    finally { expect(await prisma.propriedade.count({ where: { id: sitioId } })).toBe(0); }
  }, 35_000);
});
