import {expect,it} from 'vitest';
import type {AcompanhamentoIndicadores} from '../rebanho/reproducao/IndicadoresAcompanhamento';
import {prepararAcompanhamento,fontesAcompanhamento} from './acompanhamento';

export function acompanhamentoExemplo():AcompanhamentoIndicadores {
 return {versao:2,versaoMetodologia:'v2',identificacoes:[{id:'a',brinco:'1036',nome:'Camila'}],pendenciasOrigemCiclo:[],
 espera:{coorte:[{animalId:'a',cicloId:'c',inicio:'2026-10-01',primeiraLiberacao:null,primeiroServico:null,diasPartoServico:null,diasFimPevServico:null,diasLiberacaoServico:null,diasEsperaObservada:0,esperaObservadaAte:'2026-10-01',repeticoes:0,restricoesIntermediarias:[],pendencias:['SEM_SERVICO'],saidaEm:null,antecipacoes:[]}],filaAtual:[],pendenciasFila:[],resumoCoorte:{ciclos:1,comServico:0,semServico:1,saidas:0,repeticoes:0,mediaDiasLiberacaoServico:null}},
 perdas:{janelaDias:null,numerador:null,denominador:null,percentual:null,contagens:{gestacoes:1,perdasAteCorte:0,perdasRegistradas:0,abortos:0,incompletos:1,semPrimeiroDg:0,encerramentosNaoIdentificados:0},composicaoNumerador:{perdasRegistradas:0,abortos:0},coorte:[{gestacaoId:'g',animalId:'a',estado:'SEM_JANELA',primeiroDgPositivo:{id:'dg',data:'2026-10-05'},fimJanela:null,encerramento:null,motivos:['DURACAO_NAO_ESCOLHIDA'],lacunas:[],evidenciaIds:['dg']}]},
 iep:{modo:'VIVOS_NATIMORTOS',mediaDias:410,pares:[{animalId:'a',anteriorId:'p1',atualId:'p2',anteriorEm:'2025-09-10',atualEm:'2026-10-25',dias:410,abortosIntermediarios:[]}],abortos:[],pendencias:[],semAnterior:['p3']},
 tentativasPorConcepcao:{estado:'CALCULADO',mediaTentativas:2,linhas:[{concepcaoId:'g',animalId:'a',tentativaId:'t2',servicoEm:'2026-10-02',confirmadaEm:'2026-10-26',numeroTentativas:2,tentativaIds:['t1','t2'],tipos:['IA','IA'],evidenciaIds:['dg'],pendencias:[]}]}};
}
it('conserva pares e a média do servidor sem recalcular ou contar animais como pares',()=>{
 const a=acompanhamentoExemplo();a.iep.mediaDias=399;
 const r=prepararAcompanhamento('iep',a);
 expect(r.linhas[0]).toMatchObject({animal:'1036 · Camila',intervalo:410,partoAnterior:'10/09/2025',partoAtual:'25/10/2026',anteriorId:'p1',atualId:'p2'});
 expect(r.resumo.find(v=>v.nome==='Intervalo médio')?.valor).toBe(399);
});
it('não mistura a fila atual com os ciclos iniciados no período e preserva zero e desconhecido',()=>{
 const a=acompanhamentoExemplo();a.espera.filaAtual=[{...a.espera.coorte[0],cicloId:'fora'}];
 const r=prepararAcompanhamento('espera',a);
 expect(r.linhas).toHaveLength(1);expect(r.linhas[0]).toMatchObject({id:'c',diasLiberacaoServico:null,esperaObservada:0,servico:null});
});
it('perdas sem janela não inventam percentual nem desfecho e mantêm as evidências',()=>{
 const r=prepararAcompanhamento('perdas',acompanhamentoExemplo());
 expect(r.linhas[0]).toMatchObject({situacao:'Sem janela de seguimento',desfecho:null,fimJanela:null,evidencias:'dg'});
 expect(r.resumo.some(v=>v.unidade==='%')).toBe(false);
});
it('parto não é rotulado como perda por um subtipo genérico do envelope',()=>{
 const a=acompanhamentoExemplo();a.perdas.coorte[0].encerramento={tipo:'PARTO',subtipo:'PERDA_REGISTRADA',data:'2026-10-25',fatoId:'p2'};
 expect(prepararAcompanhamento('perdas',a).linhas[0].desfecho).toBe('Parto');
});
it('concepções mantêm a contagem acumulada e os IDs de tentativas da origem',()=>{
 const r=prepararAcompanhamento('concepcoes',acompanhamentoExemplo());
 expect(r.linhas[0]).toMatchObject({tentativas:2,tentativaIds:'t1; t2',confirmacao:'26/10/2026'});
});
it('ausência ou método indisponível é falha explícita, sem lista vazia falsa',()=>{
 expect(()=>prepararAcompanhamento('iep',undefined)).toThrow('acompanhamento');
 const a=acompanhamentoExemplo();a.tentativasPorConcepcao={estado:'NAO_CALCULADO'};
 expect(()=>prepararAcompanhamento('concepcoes',a)).toThrow('não está disponível');
});
it('campos extras e referências de todos os relatórios estão selecionáveis no builder',()=>{
 for(const fonte of Object.values(fontesAcompanhamento)){
  expect(fonte.campos.some(c=>c.id==='animalId')).toBe(true);
  expect(fonte.padrao.every(id=>fonte.campos.some(c=>c.id===id))).toBe(true);
 }
});
