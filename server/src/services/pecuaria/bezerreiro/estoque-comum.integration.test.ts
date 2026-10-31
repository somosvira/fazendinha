import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { prisma } from '../../../db.js';
import { exigirBancoIntegracaoPecuaria } from '../../../lib/banco-pecuaria-integration.fixture.js';
import { criarEntradaValorizadaFixtureTx } from '../../../test/estoque-valorizado.fixture.js';
const suite=process.env.PECUARIA_DB_INTEGRATION==='1'?describe:describe.skip;
const rollback=new Error('ROLLBACK_FIXTURE_MOVIMENTO_COMUM_COLOSTRO');

/** Regressão do trigger global em MovimentoEstoque. Usa só fixtures privadas na
 * transação, sem migrations, seed, limpeza global ou desabilitação de triggers. */
suite('estoque comum após instalar os triggers de colostro',()=>{
 it('confere INSERT e UPDATE de movimento sem origem de colostro e conserva sua valorização',async()=>{
  exigirBancoIntegracaoPecuaria();
  try{
   await prisma.$transaction(async tx=>{
    const sitio=await tx.propriedade.create({data:{nome:`Físico R07 ${randomUUID()}`}});
    const produto=await tx.produto.create({data:{nome:`Produto comum R07 ${randomUUID()}`,unidade:'UN'}});
    const movimento=await criarEntradaValorizadaFixtureTx(tx,{data:{produtoId:produto.id,propriedadeId:sitio.id,tipo:'ENTRADA',origem:'INVENTARIO_INICIAL',data:new Date('2026-10-20'),quantidade:10,custoUnitario:2,valorTotal:20}});
    await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
    await tx.$executeRawUnsafe('SET CONSTRAINTS ALL DEFERRED');
    await tx.movimentoEstoque.update({where:{id:movimento.id},data:{observacao:'Conferido sem qualquer origem leiteira'}});
    await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
    const atual=await tx.movimentoEstoque.findUniqueOrThrow({where:{id:movimento.id}});
    expect(atual.quantidade.eq(10)).toBe(true);expect(atual.valorTotal?.eq(20)).toBe(true);
    expect(await tx.entradaProducaoLeite.count({where:{movimentoId:movimento.id}})).toBe(0);
    expect(await tx.loteColostro.count({where:{propriedadeId:sitio.id}})).toBe(0);
    const bases=await tx.parcelaValorizacaoEstoque.aggregate({where:{movimentoEstoqueId:movimento.id},_sum:{quantidade:true,valorTotal:true}});
    expect(bases._sum.quantidade?.eq(10)).toBe(true);expect(bases._sum.valorTotal?.eq(20)).toBe(true);
    throw rollback;
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30_000});
   throw new Error('A fixture não pode ser commitada');
  }catch(erro){if(erro!==rollback)throw erro;}
 });
});
