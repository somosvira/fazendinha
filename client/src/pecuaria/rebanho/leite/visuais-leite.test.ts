import { expect, it } from 'vitest';
import { situacaoOrdenha, segmentosNatureza, pontosSerieQualidade } from './visuais-leite';
it('prioriza ausência de aferição, sem convertê-la em classificação ou zero',()=>{
 expect(situacaoOrdenha({situacao:'SEM_AFERICAO',porNatureza:[{natureza:'A_CLASSIFICAR',litros:null}]})).toBe('Sem aferição');
 expect(segmentosNatureza([{natureza:'COMERCIAL',litros:null}])).toEqual([]);
 expect(segmentosNatureza([{natureza:'COMERCIAL',litros:0}])).toEqual([]);
 expect(segmentosNatureza([{natureza:'COMERCIAL',litros:3},{natureza:'NAO_COMERCIAL',litros:1}]).map(s=>s.percentual)).toEqual([75,25]);
});
it('não une origens, unidades ou resultados textuais em uma série numérica',()=>{
 const rows=[{serie:'a',amostraId:'1',dataAmostra:'2026-10-02',valor:0},{serie:'b',amostraId:'2',dataAmostra:'2026-10-01',valor:9},{serie:'a',amostraId:'3',dataAmostra:'2026-10-01',valor:'3,8'},{serie:'a',amostraId:'4',dataAmostra:'2026-10-03',valor:4}];
 expect(pontosSerieQualidade(rows,'a').map(r=>r.valor)).toEqual([0,4]);
});

it('converte texto decimal apenas quando o formato identifica o parâmetro como NUMERO',()=>{
 expect(pontosSerieQualidade([{serie:'a',amostraId:'1',dataAmostra:'2026-10-01',tipo:'NUMERO',valor:'0'},{serie:'a',amostraId:'2',dataAmostra:'2026-10-02',tipo:'TEXTO',valor:'12'}],'a').map(r=>r.valor)).toEqual([0]);
});
