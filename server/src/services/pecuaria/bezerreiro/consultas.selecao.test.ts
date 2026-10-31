import { beforeEach, describe, expect, it, vi } from 'vitest';
const f=vi.hoisted(()=>({tx:{partoAnimal:{count:vi.fn(),findMany:vi.fn(),findFirst:vi.fn()}}}));
vi.mock('../../../db.js',()=>({prisma:{$transaction:(executar:(tx:unknown)=>unknown)=>executar(f.tx)}}));
import { consultarPartosColostro } from './consultas.js';
const data=new Date('2026-10-20T00:00:00Z');
const parto={id:'parto-121',propriedadeId:7,data,animalId:'matriz',animal:{id:'matriz',brinco:'M121',nome:'Mãe'},CriaParto:[{id:'cria-121',animalId:'animal',Animal:{id:'animal',brinco:'121',nome:'Lua'}}]};
beforeEach(()=>{vi.clearAllMocks();f.tx.partoAnimal.count.mockResolvedValue(121);f.tx.partoAnimal.findMany.mockResolvedValue([parto]);f.tx.partoAnimal.findFirst.mockResolvedValue(parto);});
describe('seletores históricos de colostro',()=>{
 it('pagina no banco além dos 100 partos e resolve ID fora da página sem aplicar a busca ao selecionado',async()=>{
  const r=await consultarPartosColostro(7,{data:'2026-10-20',alvo:'MATRIZ',busca:'Lua',pagina:7,porPagina:20,partoId:'parto-121'});
  expect(r).toMatchObject({total:121,pagina:7,selecionado:{id:'parto-121'}});
  expect(f.tx.partoAnimal.findMany).toHaveBeenCalledWith(expect.objectContaining({skip:120,take:20,where:expect.objectContaining({propriedadeId:7,data:{lte:data},OR:expect.any(Array)})}));
  const w=f.tx.partoAnimal.findFirst.mock.calls[0][0].where;
  expect(w).toMatchObject({id:'parto-121',propriedadeId:7,status:'VALIDO',animal:{localizacoes:{some:{propriedadeId:7,desde:{lte:data}}}}});
  expect(w.OR).toBeUndefined();
 });
 it('revalida seleção na data e não abre parto externo pelo sítio atual da matriz',async()=>{
  f.tx.partoAnimal.findFirst.mockResolvedValue(null);
  const r=await consultarPartosColostro(7,{data:'2026-10-19',alvo:'MATRIZ',pagina:1,porPagina:20,partoId:'externo'});
  expect(r.selecionado).toBeNull();expect(f.tx.partoAnimal.findFirst.mock.calls[0][0].where).toMatchObject({propriedadeId:7,data:{lte:new Date('2026-10-19')}});
 });
 it('mantém cria transferida elegível sem expor matriz nem buscar seu nome externo',async()=>{
  f.tx.partoAnimal.findMany.mockResolvedValue([{...parto,propriedadeId:99}]);f.tx.partoAnimal.findFirst.mockResolvedValue({...parto,propriedadeId:99});
  const r=await consultarPartosColostro(7,{data:'2026-10-20',alvo:'CRIA',busca:'Lua',pagina:1,porPagina:20,criaId:'cria-121'});
  expect(r.selecionado).toMatchObject({matrizId:null,matriz:{brinco:'Origem registrada',nome:null},crias:[{id:'cria-121'}]});
  expect(JSON.stringify(r)).not.toContain('M121');
  const where=f.tx.partoAnimal.findMany.mock.calls[0][0].where;
  expect(where.propriedadeId).toBeUndefined();expect(where.CriaParto.some.Animal.localizacoes.some.propriedadeId).toBe(7);
  expect(where.OR[0]).toMatchObject({propriedadeId:7});
 });
});
