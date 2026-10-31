import { describe, expect, it } from 'vitest';
import { consultaBezerreiro } from './api';
import { brixFornecimentoColostro, faseParticipacao, horarioRealizado, saldoUnidadeColostro, validarOfertas, volumePrevisto } from './modelo';
import type { Fase, Participacao, Previsao } from './types';
describe('Planejamento operacional do bezerreiro',()=>{
  it('preserva a diferença entre volume coletivo da oferta e litros por animal/dia',()=>{
    const grupo:Previsao['grupos'][number]={coleiraId:'vermelha',nome:'Vermelha',cor:'#bc4749',litrosDia:'12',fornecidoLitros:'6',restanteLitros:'6',participantes:[1,2,3].map(id=>({animalId:String(id),participacaoId:String(id),faseVersaoId:'fase',litrosDia:'4',ofertas:[{identidadeId:'manha',ordem:0,percentual:'50'},{identidadeId:'tarde',ordem:1,percentual:'50'}]}))};
    expect(volumePrevisto(grupo,'manha')).toBe(6);expect(volumePrevisto(grupo,'')).toBe(12); // Oferta avulsa não infere consumo real subtraindo o previsto.
    expect(volumePrevisto({...grupo,participantes:grupo.participantes.map(p=>({...p,litrosDia:'0'}))},'manha')).toBe(0);
  });
  it('exige 100% com leite e conserva os percentuais ao adicionar ou excluir ofertas',()=>{
    const oferta=(id:string,p:string)=>({identidadeId:id,ordem:0,percentual:p});
    expect(validarOfertas([oferta('a','50'),oferta('b','50')],4)).toBeNull();
    expect(validarOfertas([oferta('a','50')],4)).toMatch('100%');
    expect(validarOfertas([oferta('a','50'),oferta('a','50')],4)).toMatch('identidade');
    expect(validarOfertas([],0)).toBeNull();
  });
  it('preserva horário ausente e consultas de fase/coleira na URL',()=>{
    expect(horarioRealizado('2026-10-28','')).toBeNull();
    expect(consultaBezerreiro({historico:true,coleiraId:'a/b',faseVersaoId:'fase',pagina:2,busca:''})).toBe('?historico=true&coleiraId=a%2Fb&faseVersaoId=fase&pagina=2');
  });
});

describe('Brix aplicado e saldo remanescente',()=>{
  it('conserva o Brix do colostro aplicado quando o campo legado não foi preenchido',()=>{
    expect(brixFornecimentoColostro({qualidadeBrix:null,origens:[{origemId:'origem',unidadeId:'embalagem',ativo:true,brixAplicado:{resultado:'26.4'}}]})).toBe('26,4%');
    expect(brixFornecimentoColostro({qualidadeBrix:'0',origens:[{origemId:'origem',unidadeId:null,ativo:true,brixAplicado:{resultado:'26.4'}}]})).toBe('0%');
    expect(brixFornecimentoColostro({qualidadeBrix:null,origens:[{origemId:'origem',unidadeId:null,ativo:false,brixAplicado:{resultado:'25'}}]})).toBe('25%');
    expect(brixFornecimentoColostro({qualidadeBrix:null,origens:[]})).toBe('Não aferido');
  });
  it('usa o saldo da embalagem e conserva zero',()=>{
    expect(saldoUnidadeColostro({saldoRestanteLitros:'0.5'})).toBe(.5);expect(saldoUnidadeColostro({saldoRestanteLitros:'0'})).toBe(0);
  });
});

describe('Vigência da fase e coleira histórica',()=>{
  const antiga:Fase={id:'atual',identidadeId:'fase',nome:'Fase atual',coleiraId:'coleira',coleira:{id:'coleira',nome:'Coleira renomeada',cor:'#000000'},coleiraSnapshot:{id:'coleira',nome:'Vermelha histórica',cor:'#bc4749'},litrosDia:'4',publicada:true,ofertas:[]};
  const futura:Fase={...antiga,id:'futura',nome:'Próxima fase',litrosDia:'2'};
  const participacao:Participacao={id:'p',animalId:'a',animal:{id:'a',brinco:'601',nome:null},perfilId:'perfil',perfil:{id:'perfil',loteId:'lote',ativo:true,lote:{id:'lote',nome:'Bezerreiro'}},desde:'2026-10-01',ate:null,motivoSaida:null,versao:2,fases:[{id:'futura',desde:'2026-10-29',ate:null,motivo:null,faseVersao:futura},{id:'atual',desde:'2026-10-01',ate:'2026-10-29',motivo:null,faseVersao:antiga}]};
  it('não antecipa a fase futura e preserva nome/cor do snapshot',()=>{
    expect(faseParticipacao(participacao,'2026-10-28')?.id).toBe('atual');
    expect(faseParticipacao(participacao,'2026-10-29')?.id).toBe('futura');
    expect(faseParticipacao(participacao,'2026-10-28')?.coleira?.nome).toBe('Vermelha histórica');
    expect(faseParticipacao(participacao,'2026-10-28')?.coleira?.cor).toBe('#bc4749');
  });
  it('após a saída conserva a última fase vigente antes da saída',()=>{
    expect(faseParticipacao({...participacao,ate:'2026-10-29'},'2026-11-02')?.id).toBe('atual');
  });
});
