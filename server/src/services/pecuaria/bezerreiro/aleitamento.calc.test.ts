import { describe, expect, it } from 'vitest';
import { conferirProgramacao, distribuirQuantidade, quantidadePorOferta } from './aleitamento.calc.js';
describe('programação e atribuição coletiva do bezerreiro',()=>{
 it('horários são opcionais e podem se repetir; identidade permanece distinta',()=>{expect(()=>conferirProgramacao('4',[{identidadeId:'a',ordem:1,percentual:50,horarioPrevisto:null},{identidadeId:'b',ordem:2,percentual:50,horarioPrevisto:null}],true)).not.toThrow();expect(()=>conferirProgramacao(4,[{identidadeId:'a',ordem:1,percentual:100}],true)).not.toThrow()});
 it('rotina publicada exige 100%, rascunho preserva incompletude',()=>{expect(()=>conferirProgramacao(4,[{identidadeId:'a',ordem:1,percentual:40}],true)).toThrow('100%');expect(()=>conferirProgramacao(4,[],false)).not.toThrow();expect(()=>conferirProgramacao(0,[],true)).not.toThrow()});
 it('conserva mililitros e centavos com desempate determinístico',()=>{expect(distribuirQuantidade('0.005',[{id:'b',peso:1},{id:'a',peso:1},{id:'c',peso:1}]).map(x=>[x.id,x.quantidade.toFixed(3)])).toEqual([['a','0.002'],['b','0.002'],['c','0.001']]);const valores=distribuirQuantidade('23.60',[{id:'v',peso:12},{id:'g',peso:4}],2);expect(valores.reduce((n,x)=>n+x.quantidade.toNumber(),0)).toBe(23.6)});
 it('não inventa base para leite positivo',()=>{expect(()=>distribuirQuantidade(1,[])).toThrow('base comprovada');expect(()=>distribuirQuantidade(1,[{id:'a',peso:0}])).toThrow()});
 it('reparte o volume diário sem duplicar necessidade',()=>{const r=quantidadePorOferta('16',[{id:'a',percentual:'33.34'},{id:'b',percentual:'33.33'},{id:'c',percentual:'33.33'}]);expect(r.reduce((n,x)=>n.plus(x.quantidade),r[0].quantidade.mul(0)).toFixed(3)).toBe('16.000')});
});
