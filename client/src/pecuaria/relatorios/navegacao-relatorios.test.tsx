// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {RelatoriosPecuaria} from '../rebanho/reproducao/RelatoriosPecuaria';
import type {ReactNode} from 'react';
vi.mock('../rebanho/reproducao/ConsultaPorSitio',()=>({ConsultaPorSitio:({children,cabecalho}:{children:(id:number)=>ReactNode;cabecalho?:(controle:ReactNode)=>ReactNode})=><>{cabecalho?.(null)}{children(2)}</>}));
vi.mock('../rebanho/reproducao/RelatorioPartos',()=>({RelatorioPartos:()=> <p>Consulta de partos</p>}));
vi.mock('../rebanho/reproducao/IndicadoresReprodutivos',()=>({IndicadoresReprodutivos:()=> <p>Consulta de indicadores</p>}));
vi.mock('../rebanho/leite/RelatoriosLeite',()=>({RelatoriosLeite:()=>null}));
vi.mock('./CatalogoRelatorios',()=>({CatalogoRelatorios:({fonte,personalizar}:{fonte:string;personalizar:()=>void})=><button onClick={personalizar}>Abrir catálogo {fonte}</button>}));
vi.mock('./RelatoriosComplementares',()=>({RelatoriosComplementares:({fonte,personalizar}:{fonte:string;personalizar:()=>void})=><button onClick={personalizar}>Personalizar {fonte}</button>}));
vi.mock('./BuilderRelatorio',()=>({BuilderRelatorio:({fonteInicial}:{fonteInicial:string})=><p>Builder {fonteInicial}</p>}));
afterEach(cleanup);
it('deep-link e histórico mantêm a aba indicada na URL sem retornar a partos',()=>{
 window.history.replaceState(null,'','/pecuaria/relatorios?tipo=indicadores&sitio=2');
 render(<RelatoriosPecuaria podeLancar={false}/>);
 expect(screen.getByText('Consulta de indicadores')).toBeTruthy();
 expect(screen.getByRole('tab',{name:'Indicadores reprodutivos'}).getAttribute('aria-selected')).toBe('true');
 expect(screen.getByRole('tablist').getAttribute('data-variant')).toBe('line');
 window.history.pushState(null,'','/pecuaria/relatorios?tipo=partos&sitio=2');fireEvent(window,new PopStateEvent('popstate'));
 expect(screen.getByText('Consulta de partos')).toBeTruthy();
});
it('abre o relatório escolhido no builder preservando o sítio da URL',()=>{
 window.history.replaceState(null,'','/pecuaria/relatorios?tipo=acompanhamento&relatorio=perdas&sitio=2');
 render(<RelatoriosPecuaria podeLancar={false}/>);
 fireEvent.click(screen.getByRole('button',{name:'Personalizar perdas'}));
 expect(screen.getByText('Builder perdas')).toBeTruthy();
 expect(new URLSearchParams(window.location.search).get('sitio')).toBe('2');
});

it('catálogo preserva fonte, sítio, período e animal ao abrir o builder',()=>{window.history.replaceState(null,'','/pecuaria/relatorios?tipo=catalogo&relatorio=custos&sitio=1&inicio=2026-01-01&fim=2026-10-27&animalId=animal-a');render(<RelatoriosPecuaria podeLancar={false}/>);fireEvent.click(screen.getByRole('button',{name:'Abrir catálogo custos'}));expect(screen.getByText('Builder custos')).toBeTruthy();const p=new URLSearchParams(window.location.search);expect(p.get('animalId')).toBe('animal-a');expect(p.get('inicio')).toBe('2026-01-01');expect(p.get('sitio')).toBe('1')});
