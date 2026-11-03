import {expect,it} from 'vitest';
import {camposFiltroRelatorio,validarFiltrosRelatorio,linhaAtendeFiltros} from './filtros.js';
const validar=(f:unknown)=>validarFiltrosRelatorio('animais',f,true);
it('distingue ausência de zero, falso e texto vazio',()=>{
 for(const v of [0,false,''])expect(linhaAtendeFiltros({peso:v},[{campo:'peso',operador:'informado'}],camposFiltroRelatorio('animais',true))).toBe(true);
 expect(linhaAtendeFiltros({peso:null},[{campo:'peso',operador:'diferente',valor:0}],camposFiltroRelatorio('animais',true))).toBe(false);
 expect(linhaAtendeFiltros({},[{campo:'peso',operador:'naoInformado'}],camposFiltroRelatorio('animais',true))).toBe(true);
});
it('valida o tipo e rejeita intervalo invertido ou critérios incompletos',()=>{
 for(const f of [[{campo:'peso',operador:'igual',valor:'0'}],[{campo:'peso',operador:'entre',valor:5,ate:2}],[{campo:'peso',operador:'umDe'}],[{campo:'peso',operador:'informado',valor:0}],[{campo:'nascimento',operador:'igual',valor:'2026-02-30'}],[{campo:'nascimentoEstimado',operador:'igual',valor:'false'}],Array.from({length:21},()=>({campo:'peso',operador:'informado'}))])expect(()=>validar(f)).toThrow();
 expect(validar([{campo:'peso',operador:'igual',valor:0},{campo:'nascimentoEstimado',operador:'igual',valor:false}])).toHaveLength(2);
});
it('compara texto sem acento/caixa, números decimais e data ISO com instante',()=>{
 const regras=validar([{campo:'nome',operador:'contem',valor:'AGUA'},{campo:'peso',operador:'entre',valor:0,ate:4},{campo:'nascimento',operador:'maiorIgual',valor:'2026-01-01'}]);
 expect(linhaAtendeFiltros({nome:'Água Clara',peso:'2.5',nascimento:'2026-02-01T12:00:00Z'},regras,camposFiltroRelatorio('animais',true))).toBe(true);
 expect(linhaAtendeFiltros({nome:'Água Clara',peso:null,nascimento:'2026-02-01'},regras,camposFiltroRelatorio('animais',true))).toBe(false);
});
it('autoriza toda regra monetária incluindo informação e campos correlatos',()=>{
 for(const [fonte,campo] of [['vendas','valor'],['consumos','cobertura'],['custos','origemId'],['estoque','custoPendente']]){
  expect(()=>validarFiltrosRelatorio(fonte,[{campo,operador:'informado'}],false)).toThrow('Sem permissão');
  expect(camposFiltroRelatorio(fonte,false).some(c=>c.id===campo)).toBe(false);
 }
});
it('aplica seleção múltipla e comparadores inclusivos',()=>{
 const campos=camposFiltroRelatorio('animais',true);
 expect(linhaAtendeFiltros({sexo:'FEMEA',peso:5},validar([{campo:'sexo',operador:'umDe',valores:['FEMEA','MACHO']},{campo:'peso',operador:'menorIgual',valor:5}]),campos)).toBe(true);
});
it('compara dinheiro com precisão decimal sem arredondar o valor persistido',()=>{
 const campos=camposFiltroRelatorio('vendas',true);
 const regras=validarFiltrosRelatorio('vendas',[{campo:'valor',operador:'igual',valor:9007199254740992}],true);
 expect(linhaAtendeFiltros({valor:'9007199254740993'},regras,campos)).toBe(false);
 expect(linhaAtendeFiltros({valor:'12.50'},validarFiltrosRelatorio('vendas',[{campo:'valor',operador:'entre',valor:12.5,ate:13}],true),campos)).toBe(true);
});

it('preserva centavos monetários em critério decimal textual e valida seus intervalos',()=>{
 const campos=camposFiltroRelatorio('vendas',true);
 const regras=validarFiltrosRelatorio('vendas',[{campo:'valor',operador:'igual',valor:'9007199254740992.01'}],true);
 expect(linhaAtendeFiltros({valor:'9007199254740992.02'},regras,campos)).toBe(false);
 expect(linhaAtendeFiltros({valor:'9007199254740992.01'},regras,campos)).toBe(true);
 expect(()=>validarFiltrosRelatorio('vendas',[{campo:'valor',operador:'entre',valor:'9',ate:'10'}],true)).not.toThrow();
 expect(()=>validarFiltrosRelatorio('vendas',[{campo:'valor',operador:'entre',valor:'10',ate:'9'}],true)).toThrow();
 expect(()=>validarFiltrosRelatorio('vendas',[{campo:'valor',operador:'igual',valor:'12,34'}],true)).toThrow();
});
it('filtra previsão de protocolo por São Paulo para HORA e dia civil preservado para DIA',()=>{
 const campos=camposFiltroRelatorio('protocolos',true),regras=validarFiltrosRelatorio('protocolos',[{campo:'previsao',operador:'igual',valor:'2026-10-27'}],true);
 expect(linhaAtendeFiltros({previsao:'2026-10-28T01:00:00.000Z',precisao:'HORA'},regras,campos)).toBe(true);
 expect(linhaAtendeFiltros({previsao:'2026-10-28T01:00:00.000Z',precisao:'DIA'},regras,campos)).toBe(false);
});
it('compara instantes pelo dia exibido em São Paulo e conserva datas civis',()=>{
 for(const [fonte,campo] of [['animais','registradoEm'],['dietas','publicadaEm'],['vigencias','registradaEm'],['consumos','confirmadoEm'],['consumos','estornadoEm'],['baixas','estornadaEm'],['movimentos','desfeitoEm'],['protocolos','realizacao'],['protocolos','dispensa'],['aplicacoes','aplicadaEm']]){
  const campos=camposFiltroRelatorio(fonte,true),regras=validarFiltrosRelatorio(fonte,[{campo,operador:'igual',valor:'2026-10-27'}],true);
  expect(linhaAtendeFiltros({[campo]:'2026-10-28T01:00:00.000Z'},regras,campos)).toBe(true);
  expect(linhaAtendeFiltros({[campo]:'2026-10-27'},regras,campos)).toBe(true);
 }
 const regras=validarFiltrosRelatorio('gestacoes',[{campo:'confirmacao',operador:'igual',valor:'2026-10-28'}],true);
 expect(linhaAtendeFiltros({confirmacao:'2026-10-28T00:00:00.000Z'},regras,camposFiltroRelatorio('gestacoes',true))).toBe(true);
});
