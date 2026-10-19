import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { prisma } from '../../db.js';
import { listarMovimentos, estornarMovimentoTx } from './estoque.js';
import { atualizarProduto } from './produtos.js';
import { estornarOperacao } from '../financeiro/operacoes.js';
const comBanco=process.env.PECUARIA_DB_INTEGRATION==='1'?describe:describe.skip;
comBanco('integração estoque/reprodução — somente banco descartável',()=>{
  it('preserva tentativa, consumo e Serviço até a anulação, e conserva link histórico no inverso',async()=>{
    const token=randomUUID();
    const sitio=await prisma.propriedade.create({data:{nome:`Estoque reprodução ${token}`}});
    const categoria=await prisma.categoria.create({data:{nome:`Genética reprodução ${token}`,classificacao:'CUSTEIO',usoGenetico:true}});
    const produto=await prisma.produto.create({data:{nome:`Sêmen reprodução ${token}`,unidade:'DOSE',categoriaId:categoria.id,usoGenetico:true}});
    const touro=await prisma.genitorExterno.create({data:{nome:`Touro ${token}`,sexo:'M'}});
    const material=await prisma.materialGenetico.create({data:{tipo:'SEMEN',produtoId:produto.id,touroExternoId:touro.id}});
    const animal=await prisma.animal.create({data:{brinco:`ER-${token}`,sexo:'F',origem:'COMPRADO',dataNascimento:new Date('2020-01-01'),dataEntrada:new Date('2024-01-01')}});
    const servico=await prisma.operacao.create({data:{tipo:'SERVICO',status:'CONFIRMADA',propriedadeId:sitio.id,data:new Date('2026-10-01'),valorTotal:50}});
    const movimento=await prisma.movimentoEstoque.create({data:{produtoId:produto.id,propriedadeId:sitio.id,data:new Date('2026-10-02'),tipo:'SAIDA',origem:'REPRODUCAO',quantidade:1,custoUnitario:10,valorTotal:10}});
    const tentativa=await prisma.tentativaReprodutiva.create({data:{animalId:animal.id,propriedadeId:sitio.id,data:new Date('2026-10-02'),tipo:'IA',ciclo:0,ordem:1,materialId:material.id,origemMaterial:'ESTOQUE',quantidade:1,movimentoEstoqueId:movimento.id,operacaoServicoId:servico.id,geneticaSnapshot:{materialId:material.id}}});
    await expect(prisma.$transaction(tx=>estornarMovimentoTx(tx,movimento.id))).rejects.toMatchObject({code:'CONFLITO'});
    await expect(estornarOperacao(servico.id,'Cancelar serviço incorreto',{propriedadeId:sitio.id})).rejects.toMatchObject({code:'CONFLITO'});
    await expect(atualizarProduto(produto.id,{usoGenetico:false})).rejects.toMatchObject({code:'CONFLITO',campo:'usoGenetico'});
    expect((await prisma.movimentoEstoque.findUniqueOrThrow({where:{id:movimento.id}})).status).toBe('CONFIRMADO');
    expect((await prisma.operacao.findUniqueOrThrow({where:{id:servico.id}})).status).toBe('CONFIRMADA');
    const inverso=await prisma.$transaction(async tx=>{
      await tx.tentativaReprodutiva.update({where:{id:tentativa.id},data:{status:'ANULADO',anuladoEm:new Date(),motivoAnulacao:'Procedimento lançado indevidamente'}});
      return (await estornarMovimentoTx(tx,movimento.id,{propriedadeId:sitio.id})).inverso;
    });
    const historico=await listarMovimentos({produtoId:produto.id,propriedadeId:sitio.id});
    expect(historico.itens).toHaveLength(2);
    for(const item of historico.itens)expect(item.vinculo).toEqual({tipo:'TENTATIVA_REPRODUTIVA',id:tentativa.id,animalId:animal.id});
    expect(historico.itens.some(m=>m.id===inverso.id && m.reversaoDeId===movimento.id)).toBe(true);
    const financeiro=await listarMovimentos({produtoId:produto.id,propriedadeId:sitio.id,vinculosVisiveis:{pecuaria:false}});
    for(const item of financeiro.itens){expect(item.vinculo).toBeNull();expect(item.materialGeneticoId).toBeNull();expect(item.observacao).toBeNull();}
    await estornarOperacao(servico.id,'Tentativa anulada, cancelar serviço',{propriedadeId:sitio.id});
    expect((await prisma.operacao.findUniqueOrThrow({where:{id:servico.id}})).status).toBe('CANCELADA');
  },30000);
});
