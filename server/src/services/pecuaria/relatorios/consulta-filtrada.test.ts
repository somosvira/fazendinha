import {expect,it,vi} from 'vitest';
import {consultarRelatorioFiltrado} from './consulta-filtrada.js';
import type {ConsultaRelatorio,ResultadoRelatorio} from './tipos.js';
const q:ConsultaRelatorio={fonte:'animais',propriedadeId:1,inicio:'2026-01-01',fim:'2026-12-31',pagina:1,porPagina:1,podeVerValores:false,podeConsultarCustos:true,filtros:[{campo:'nome',operador:'igual',valor:'Violeta'}]};
const resultado:ResultadoRelatorio={linhas:[{nome:'Violeta'}],total:1,pagina:1,porPagina:100,paginado:true,consultadoEm:'agora'};
it('sem critérios consulta somente a página pedida uma vez',async()=>{
 const consultar=vi.fn(async()=>resultado);expect(await consultarRelatorioFiltrado({...q,filtros:[]},[consultar])).toBe(resultado);expect(consultar).toHaveBeenCalledOnce();
});
it('recusa conjunto acima do limite antes de percorrer todas páginas',async()=>{
 const consultar=vi.fn(async()=>({...resultado,total:10001}));await expect(consultarRelatorioFiltrado(q,[consultar])).rejects.toThrow('dez mil');expect(consultar).toHaveBeenCalledOnce();
});
it('recusa paginação inconsistente sem apresentar resultado parcial',async()=>{
 const consultar=vi.fn().mockResolvedValueOnce({...resultado,total:101}).mockResolvedValueOnce({...resultado,linhas:[]});
 await expect(consultarRelatorioFiltrado(q,[consultar])).rejects.toThrow('mudaram');
});
it('marca resumo como população e pagina somente o refinamento completo',async()=>{
 const consultar=vi.fn(async()=>({...resultado,linhas:[{nome:'Violeta'},{nome:'Outra'},{nome:'Violeta'}],total:3,resumo:[{nome:'Média',valor:3}]}));
 const r=await consultarRelatorioFiltrado({...q,pagina:2},[consultar]);expect(r).toMatchObject({linhas:[{nome:'Violeta'}],total:2,pagina:2,resumo:[{nome:'Média',valor:3}],resumoEscopo:'POPULACAO'});
});
