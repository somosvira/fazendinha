import {expect,it} from 'vitest';
import {paginarTabela,criarPaginasIndicadores} from './indicadores-documento';
import {exemploDocumento} from './indicadores-documento.fixture';
it('pagina todo o conteúdo longo sem perder caracteres e repete os cabeçalhos',()=>{
 const texto='<script>alert(1)</script> '+ 'evidência longa '.repeat(300);
 const paginas=paginarTabela('Evidências',['Animal','Motivos'],[['animal-final',texto]], [24,60]);
 expect(paginas.length).toBeGreaterThan(1);
 expect(paginas.every(p=>p.cabecalho.join()==='Animal,Motivos')).toBe(true);
 expect(paginas.flatMap(p=>p.linhas).map(l=>l[1]).join('')).toBe(texto);
});
it('documento inclui todas as janelas, filtros, pendências e valores ausentes distintos de zero',()=>{
 const s=exemploDocumento();s.periodos=Array.from({length:25},(_,i)=>({...s.periodos[0],id:`janela-${i}`,pendencias:[`PENDENCIA_${i}`]}));
 const texto=JSON.stringify(criarPaginasIndicadores(s));
 expect(texto).toContain('pendencia 24');expect(texto).toContain('lote-original');expect(texto).toContain('RECEPTORA');expect(texto).toContain('VERSAO_ORIGINAL');expect(texto).toContain('Não informado');expect(texto).toContain('Não calculável');expect(texto).toContain('0');
 expect(s.periodos).toHaveLength(25);
});
it('não inventa acompanhamento para snapshot V1',()=>{
 const titulos=criarPaginasIndicadores(exemploDocumento()).map(p=>p.titulo);
 expect(titulos).not.toContain('Ciclos e espera');expect(titulos).toContain('Critérios e parâmetros');
});
