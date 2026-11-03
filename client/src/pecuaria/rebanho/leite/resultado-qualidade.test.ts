import {expect,it} from 'vitest';
import {valorResultadoQualidade} from './resultado-qualidade';
it('formata números conhecidos sem reinterpretar texto do laudo',()=>{expect(valorResultadoQualidade('3.8','NUMERO')).toBe('3,8');expect(valorResultadoQualidade(0,'NUMERO')).toBe('0');expect(valorResultadoQualidade('3.8','TEXTO')).toBe('3.8');expect(valorResultadoQualidade('ROTINA','OPCAO')).toBe('ROTINA');expect(valorResultadoQualidade(false,'BOOLEANO')).toBe('Não')});
