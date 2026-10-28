import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { acompanharColostragemTx, vincularFornecimentoColostragemTx } from './acompanhamento.js';
const d=(v:number|string)=>new Prisma.Decimal(v);
function banco(){return{acompanhamentoColostragem:{findUnique:vi.fn(),create:vi.fn(async({data}: {data:Record<string,unknown>})=>({id:'acomp',...data}))},configuracaoBezerreiro:{findFirst:vi.fn()},criaParto:{findFirst:vi.fn(),findUnique:vi.fn()},vinculoPesagemParto:{findFirst:vi.fn()},vinculoFornecimentoColostragem:{findUnique:vi.fn(),create:vi.fn()}};}
// O helper só depende dos delegates declarados; o banco real permanece fora desta suíte.
let tx:ReturnType<typeof banco>;
const input={animalId:'cria',criaId:'cria-parto',propriedadeId:1,data:new Date('2026-10-20')};
beforeEach(()=>{tx=banco();tx.acompanhamentoColostragem.findUnique.mockResolvedValue(null);tx.configuracaoBezerreiro.findFirst.mockResolvedValue({id:'config',versao:1,percentualPesoColostro:d(10)});tx.criaParto.findFirst.mockResolvedValue({id:'cria-parto',filiacaoSnapshot:{pesoKg:40}})});
function chamar<T>(fn:(db:Prisma.TransactionClient)=>Promise<T>){return fn(tx as unknown as Prisma.TransactionClient)}
describe('referência histórica da colostragem',()=>{
 it('guarda peso comprovado do parto e meta10% sem confirmar o volume fornecido',async()=>{await chamar(db=>acompanharColostragemTx(db,input,4));const arg=tx.acompanhamentoColostragem.create.mock.calls[0][0];expect(arg.data.pesoReferenciaKg).toEqual(d(40));expect(arg.data.metaLitros).toEqual(d(4));expect(arg.data.politicaSnapshot).toMatchObject({percentualPesoColostro:'10.00',pesoFonte:'PESO_DECLARADO_PARTO',metaLitros:'4.000'});expect(tx.vinculoFornecimentoColostragem.create).not.toHaveBeenCalled()});
 it('não substitui referência histórica por configuração nova',async()=>{const historico={id:'acomp',propriedadeId:1,metaLitros:d(4)};tx.acompanhamentoColostragem.findUnique.mockResolvedValue(historico);expect(await chamar(db=>acompanharColostragemTx(db,input,4))).toEqual(historico);expect(tx.configuracaoBezerreiro.findFirst).not.toHaveBeenCalled();expect(tx.acompanhamentoColostragem.create).not.toHaveBeenCalled()});
 it('peso desconhecido não recebe peso atual nem meta presumida',async()=>{tx.criaParto.findFirst.mockResolvedValue({id:'cria-parto',filiacaoSnapshot:{pesoKg:'não informado'}});tx.vinculoPesagemParto.findFirst.mockResolvedValue(null);await chamar(db=>acompanharColostragemTx(db,input,4));expect(tx.acompanhamentoColostragem.create.mock.calls[0][0].data.metaLitros).toBeNull()});
 it('reutiliza vínculo histórico após regularização sem alterar política',async()=>{tx.acompanhamentoColostragem.findUnique.mockResolvedValue({id:'acomp',propriedadeId:1});tx.vinculoFornecimentoColostragem.findUnique.mockResolvedValue({id:'vinculo',acompanhamentoId:'acomp'});await chamar(db=>vincularFornecimentoColostragemTx(db,{...input,fornecimentoId:'f'},4));expect(tx.vinculoFornecimentoColostragem.create).not.toHaveBeenCalled()});
});
