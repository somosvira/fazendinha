// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {htmlDocumentoIndicadores} from './DocumentoIndicadores';
import PreviaIndicadoresPDF from './PreviaIndicadoresPDF';
import {exemploDocumento} from './indicadores-documento.fixture';
import {writeFileSync} from 'node:fs';
vi.mock('./documento-indicadores.css?raw',async()=>{const{readFileSync}=await import('node:fs');return {default:readFileSync('src/pecuaria/rebanho/reproducao/documento-indicadores.css','utf8')}});
afterEach(cleanup);
it('prévia não grava emissão; imprimir exige emissão e iframe carregado',()=>{
 const snapshot=exemploDocumento(),preservar=vi.fn();const {rerender}=render(<PreviaIndicadoresPDF snapshot={snapshot} emissao={null} fechar={vi.fn()} preservar={preservar} ocupado={false}/>);
 const frame=screen.getByTitle('Documento completo para impressão');fireEvent.load(frame);
 expect(screen.getByRole('button',{name:'Imprimir / salvar PDF'})).toHaveProperty('disabled',true);expect(preservar).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Preservar emissão'}));expect(preservar).toHaveBeenCalledOnce();
 rerender(<PreviaIndicadoresPDF snapshot={snapshot} emissao={{id:'original',criadoEm:'2026-02-02T12:00:00Z',snapshot}} fechar={vi.fn()} ocupado={false}/>);
 fireEvent.load(screen.getByTitle('Documento completo para impressão'));expect(screen.getByRole('button',{name:'Imprimir / salvar PDF'})).toHaveProperty('disabled',false);
 expect(screen.getByTitle('Documento completo para impressão').getAttribute('srcdoc')).toContain('Emissão original');
});
it('escapa conteúdo de usuário e conserva estilos e conteúdo de todas as páginas',()=>{
 const s=exemploDocumento();s.metodologia.regras=['<script>alert("x")</script>'];const {html,paginas}=htmlDocumentoIndicadores(s,null);
 expect(html).not.toContain('<script>');expect(html).toContain('&lt;script&gt;');expect(html).toContain('.taxas>div');expect(html).not.toContain('.taxas&gt;div');expect(html.match(/class="folha"/g)).toHaveLength(paginas.length);
 expect(html).toContain('VERSAO_ORIGINAL');expect(html).toContain('lote-original');
 // Artefato opcional de QA, sem banco ou alteração de fatos operacionais.
 if(process.env.INDICADORES_HTML_QA)writeFileSync(process.env.INDICADORES_HTML_QA,html);
});
