// @vitest-environment jsdom
import{afterEach,beforeEach,expect,it,vi}from'vitest';
import{cleanup,render,screen,fireEvent,waitFor}from'@testing-library/react';
import{BuilderRelatorio}from'./BuilderRelatorio';
import{consultarFonte}from'./fontes';
vi.mock('./ContextoRelatorio',()=>({ContextoRelatorio:({onChange}:{onChange:(id:string)=>void})=><button onClick={()=>onChange('animal-a')}>Escolher animal</button>}));
vi.mock('./fontes',()=>({consultarFonte:vi.fn()}));
vi.mock('@/lib/auth',()=>({getUsuario:()=>({id:7})}));
beforeEach(()=>{localStorage.clear();vi.mocked(consultarFonte).mockResolvedValue({linhas:[{id:'p',matriz:'Matriz real',data:'26/10/2026',crias:0,placenta:null}],total:1,pagina:1,porPagina:12,paginado:false,consultadoEm:'2026-10-27T12:00:00Z'})});afterEach(()=>{cleanup();vi.clearAllMocks()});
it('consulta a fonte autorizada e a seleção altera a prévia sem refazer a consulta',async()=>{render(<BuilderRelatorio propriedadeId={1} podeExportar={false} voltar={vi.fn()}/>);await screen.findByText('Matriz real');expect(screen.getByText(/Sítio 1 ·/).closest('.rel-identificacao-impressao')).toBeTruthy();expect(consultarFonte).toHaveBeenCalledWith('partos',1,expect.any(String),expect.any(String),1,{});fireEvent.click(screen.getByRole('checkbox',{name:'Matriz'}));expect(screen.queryByText('Matriz real')).toBeNull();expect(consultarFonte).toHaveBeenCalledTimes(1);expect(screen.queryByRole('button',{name:/Exportar resultado/})).toBeNull()});
it('salva apenas configuração, separada por sítio, sem copiar dados consultados',async()=>{const{rerender}=render(<BuilderRelatorio propriedadeId={1} podeExportar voltar={vi.fn()}/>);await screen.findByText('Matriz real');fireEvent.click(screen.getByRole('button',{name:'Salvar modelo'}));const salvo=localStorage.getItem('terrano:relatorios:modelos:v1:7:1')!;expect(salvo).toContain('partos');expect(salvo).not.toContain('Matriz real');rerender(<BuilderRelatorio propriedadeId={2} podeExportar voltar={vi.fn()}/>);await waitFor(()=>expect(screen.getByText('Nenhum modelo neste navegador.')).toBeTruthy())});
it('ignora resposta atrasada de outro sítio',async()=>{let resolver!:(v:Awaited<ReturnType<typeof consultarFonte>>)=>void;vi.mocked(consultarFonte).mockImplementationOnce(()=>new Promise(r=>resolver=r)).mockResolvedValue({linhas:[],total:0,pagina:1,porPagina:12,paginado:false,consultadoEm:''});const{rerender}=render(<BuilderRelatorio propriedadeId={1} podeExportar voltar={vi.fn()}/>);rerender(<BuilderRelatorio propriedadeId={2} podeExportar voltar={vi.fn()}/>);await screen.findByText('Nenhum registro neste recorte');resolver({linhas:[{matriz:'Dado de outro sítio'}],total:1,pagina:1,porPagina:12,paginado:false,consultadoEm:''});await waitFor(()=>expect(screen.queryByText('Dado de outro sítio')).toBeNull())});
it('abrir uma fonte complementar conserva o período da consulta na URL',async()=>{
 window.history.replaceState(null,'','/pecuaria/relatorios?tipo=builder&fonte=iep&inicio=2026-01-01&fim=2026-09-30');
 render(<BuilderRelatorio propriedadeId={1} podeExportar voltar={vi.fn()} fonteInicial="iep"/>);
 await waitFor(()=>expect(consultarFonte).toHaveBeenCalledWith('iep',1,'2026-01-01','2026-09-30',1,{}));
 fireEvent.click(screen.getByRole('button',{name:'Período e filtros'}));
 expect((screen.getByLabelText('Início') as HTMLInputElement).value).toBe('01/01/2026');
 window.history.replaceState(null,'','/pecuaria/relatorios');
});

it('fonte de custos exige contexto e envia o animal selecionado',async()=>{render(<BuilderRelatorio propriedadeId={1} podeExportar={false} voltar={vi.fn()} fonteInicial="custos"/>);expect(consultarFonte).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Escolher animal'}));await waitFor(()=>expect(consultarFonte).toHaveBeenCalledWith('custos',1,expect.any(String),expect.any(String),1,{animalId:'animal-a'}))});
it('cadastros atuais não exibem filtros de período',async()=>{render(<BuilderRelatorio propriedadeId={1} podeExportar={false} voltar={vi.fn()} fonteInicial="dietas"/>);await screen.findByText('Cadastro compartilhado');expect(screen.queryByLabelText('Início')).toBeNull()});
