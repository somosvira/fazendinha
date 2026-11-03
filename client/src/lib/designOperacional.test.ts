import {describe,it,expect} from 'vitest';
import {usaDesignOperacional} from './designOperacional';
describe('escopo visual aprovado',()=>{
 it.each(['dashboard','gastos','lancar','caixinha','plano','relatorio','cadastros'] as const)('preserva Financeiro em %s',tab=>expect(usaDesignOperacional(tab,'/financeiro')).toBe(false));
 it.each(['pec-rebanho','pec-sanidade','pec-nutricao','pec-leite','pec-reproducao','pec-visitas','pec-relatorios','estoque','gerencial','acessos','sitios'] as const)('inclui %s',tab=>expect(usaDesignOperacional(tab,'/')).toBe(true));
 it('só inclui configurações de Pecuária, sem atingir categorias financeiras',()=>{expect(usaDesignOperacional('config','/configuracoes/pecuaria')).toBe(true);expect(usaDesignOperacional('config','/configuracoes')).toBe(false);expect(usaDesignOperacional('config','/financeiro/configuracoes')).toBe(false)});
});
