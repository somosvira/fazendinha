import {expect,it,vi} from 'vitest';
const db=vi.hoisted(()=>({buscar:vi.fn()}));
vi.mock('../../../db.js',()=>({prisma:{animal:{findMany:db.buscar}}}));
import {buscarAnimaisHistoricosRelatorio} from './animais-historicos.js';
it('seleciona também localizações encerradas e preserva o limite e a identificação mínima',async()=>{
 db.buscar.mockResolvedValue([{id:'a',brinco:'42',nome:'Violeta'}]);
 expect(await buscarAnimaisHistoricosRelatorio(7,'Violeta')).toEqual([{id:'a',brinco:'42',nome:'Violeta'}]);
 expect(db.buscar).toHaveBeenCalledWith({where:{localizacoes:{some:{propriedadeId:7}},OR:[{brinco:{contains:'Violeta',mode:'insensitive'}},{nome:{contains:'Violeta',mode:'insensitive'}}]},select:{id:true,brinco:true,nome:true},orderBy:[{brinco:'asc'},{id:'asc'}],take:20});
});
