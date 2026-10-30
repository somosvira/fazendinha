import {beforeEach,expect,it,vi} from 'vitest';
import {Hono} from 'hono';
vi.mock('../../services/pecuaria/relatorios/anteriores.js',()=>({consultarRelatoriosAnteriores:vi.fn(async()=>null)}));
const mocks=vi.hoisted(()=>({escopo:vi.fn(),rebanho:vi.fn(),sanidade:vi.fn(),nutricao:vi.fn(),animaisHistoricos:vi.fn()}));
vi.mock('../../services/pecuaria/relatorios/animais-historicos.js',()=>({buscarAnimaisHistoricosRelatorio:mocks.animaisHistoricos}));
vi.mock('../../services/propriedade.js',()=>({resolverEscopoLeitura:mocks.escopo}));
vi.mock('../../services/pecuaria/relatorios/rebanho.js',()=>({consultarRelatoriosRebanho:mocks.rebanho}));
vi.mock('../../services/pecuaria/relatorios/sanidade-leite.js',()=>({consultarRelatoriosSanidadeLeite:mocks.sanidade}));
vi.mock('../../services/pecuaria/relatorios/nutricao-custos.js',()=>({consultarRelatoriosNutricaoCustos:mocks.nutricao}));
vi.mock('./reproducao.js',()=>({falhaV4:(c:{json:(v:unknown,s:number)=>Response},e:Error)=>c.json({error:e.message},422)}));
import {relatoriosOperacionaisRouter} from './relatorios-operacionais';
const url='/consulta?fonte=animais&inicio=2026-01-01&fim=2026-10-27';
function app(areas:string[]=['pecuaria'],flags:string[]=[]){return new Hono<{Variables:{usuario:{id:number;dono:boolean;areas:string[];flags:string[];abas:string[];propriedadeIds:number[]}}}>().use('*',async(c,next)=>{c.set('usuario',{id:1,dono:false,areas,flags,abas:[],propriedadeIds:[1]});await next()}).route('/',relatoriosOperacionaisRouter)}
beforeEach(()=>{vi.clearAllMocks();mocks.escopo.mockResolvedValue(1);mocks.rebanho.mockResolvedValue(null);mocks.sanidade.mockResolvedValue(null);mocks.nutricao.mockResolvedValue(null)});
it('bloqueia usuário sem Pecuária antes de ler dados',async()=>{expect((await app(['financeiro']).request(url)).status).toBe(403);expect(mocks.rebanho).not.toHaveBeenCalled()});
it('valida período e página antes de acessar serviços',async()=>{expect((await app().request(url+'&pagina=0')).status).toBe(422);expect((await app().request('/consulta?fonte=animais&inicio=2026-10-27&fim=2026-01-01')).status).toBe(422);expect(mocks.rebanho).not.toHaveBeenCalled()});
it('não aceita sítio divergente nem consulta consolidada silenciosa',async()=>{expect((await app().request(url+'&propriedadeId=2')).status).toBe(403);mocks.escopo.mockResolvedValue(null);expect((await app().request(url)).status).toBe(422);expect(mocks.rebanho).not.toHaveBeenCalled()});
it('delega leitura no sítio autorizado e sem valores para perfil de consulta',async()=>{mocks.rebanho.mockResolvedValue({linhas:[{id:'a',animal:'Camila'}],total:1,pagina:1,porPagina:12,paginado:true,consultadoEm:''});const r=await app().request(url);expect(r.status).toBe(200);expect(await r.json()).toMatchObject({propriedadeId:1,total:1});expect(mocks.rebanho).toHaveBeenCalledWith(expect.objectContaining({propriedadeId:1,podeVerValores:false}));expect(mocks.sanidade).not.toHaveBeenCalled()});
it('recusa fonte inexistente sem devolver página vazia',async()=>{expect((await app().request(url.replace('animais','inexistente'))).status).toBe(422)});

it('busca animais históricos somente no sítio autorizado e devolve identificação mínima',async()=>{
 mocks.animaisHistoricos.mockResolvedValue([{id:'animal-transferido',brinco:'42',nome:'Violeta'}]);
 const r=await app().request('/animais-historicos?propriedadeId=1&busca=42');
 expect(r.status).toBe(200);expect(await r.json()).toEqual({propriedadeId:1,itens:[{id:'animal-transferido',brinco:'42',nome:'Violeta'}]});
 expect(mocks.animaisHistoricos).toHaveBeenCalledWith(1,'42');
});
it('protege a busca histórica contra área ausente, sítio divergente e busca excessiva',async()=>{
 expect((await app(['financeiro']).request('/animais-historicos')).status).toBe(403);
 expect((await app().request('/animais-historicos?propriedadeId=2')).status).toBe(403);
 expect((await app().request('/animais-historicos?busca='+ 'a'.repeat(101))).status).toBe(422);
 mocks.escopo.mockResolvedValue(null);expect((await app().request('/animais-historicos')).status).toBe(422);
 expect(mocks.animaisHistoricos).not.toHaveBeenCalled();
});
it('fornece campos autorizados e bloqueia critérios monetários antes da leitura',async()=>{
 const r=await app().request('/filtros?fonte=vendas');expect(r.status).toBe(200);
 const body=await r.json() as {campos:{id:string}[]};expect(body.campos.some(c=>c.id==='valor')).toBe(false);
 const negado=await app().request(url.replace('animais','vendas')+'&filtros='+encodeURIComponent(JSON.stringify([{campo:'valor',operador:'informado'}])));
 expect(negado.status).toBe(403);expect(mocks.sanidade).not.toHaveBeenCalled();
});
it('recusa filtros malformados, campos desconhecidos e operador incompatível',async()=>{
 for(const filtros of ['{',JSON.stringify([{campo:'x',operador:'igual',valor:'a'}]),JSON.stringify([{campo:'peso',operador:'contem',valor:'5'}])]){
  expect((await app().request(url+'&filtros='+encodeURIComponent(filtros))).status).toBe(422);
 }
 expect(mocks.rebanho).not.toHaveBeenCalled();
});
it('filtra o conjunto inteiro antes da página final e conserva zero e falso',async()=>{
 // A primeira página contém cem registros; a correspondência está além dela.
 mocks.rebanho.mockImplementation(async(q:{pagina:number;porPagina:number})=>({linhas:q.pagina===1?Array.from({length:100},(_,i)=>({id:String(i),peso:10,nascimentoEstimado:true})):[{id:'fim',peso:0,nascimentoEstimado:false}],total:101,pagina:q.pagina,porPagina:q.porPagina,paginado:true,consultadoEm:''}));
 const filtros=[{campo:'peso',operador:'igual',valor:0},{campo:'nascimentoEstimado',operador:'igual',valor:false}];
 const r=await app().request(url+'&filtros='+encodeURIComponent(JSON.stringify(filtros)));
 expect(r.status).toBe(200);expect(await r.json()).toMatchObject({total:1,linhas:[{id:'fim',peso:0,nascimentoEstimado:false}]});expect(mocks.rebanho).toHaveBeenCalledTimes(2);
});
it('valida população nativa com limites e preserva zero',async()=>{
 for(const consulta of ['&corte=2025-01-01','&deslocamentoTeDias=31','&janelaPerdaDias=0','&tiposTentativa=IA,IA','&papeis=INVALIDO','&concepcaoEstimada=101'])expect((await app().request(url+consulta)).status).toBe(422);
 mocks.rebanho.mockResolvedValue({linhas:[],total:0,pagina:1,porPagina:12,paginado:true,consultadoEm:''});
 expect((await app().request(url.replace('fonte=animais','fonte=indicadores')+'&concepcaoEstimada=0&deslocamentoTeDias=0')).status).toBe(200);
 expect(mocks.rebanho).toHaveBeenCalledWith(expect.objectContaining({concepcaoEstimada:0,deslocamentoTeDias:0}));
});
it('protege metadados por área e sítio e recusa fonte desconhecida',async()=>{
 expect((await app(['financeiro']).request('/filtros?fonte=animais')).status).toBe(403);
 expect((await app().request('/filtros?fonte=animais&propriedadeId=2')).status).toBe(403);
 expect((await app().request('/filtros?fonte=inexistente')).status).toBe(422);
 mocks.escopo.mockResolvedValue(null);expect((await app().request('/filtros?fonte=animais')).status).toBe(422);
});
it('recusa parâmetros nativos fora da fonte antes de consultar serviços',async()=>{
 const casos=[['perdas','tiposTentativa=IA'],['iep','tiposTentativa=IA'],['animais','papeis=RECEPTORA'],['ordenhas','corte=2026-10-27'],['espera','janelaPerdaDias=30'],['perdas','iepModo=TODOS_PARTOS'],['concepcoes','deslocamentoTeDias=0'],['tentativas','concepcaoEstimada=0']];
 for(const [fonte,parametro] of casos)expect((await app().request(url.replace('fonte=animais',`fonte=${fonte}`)+'&'+parametro)).status).toBe(422);
 expect(mocks.rebanho).not.toHaveBeenCalled();expect(mocks.sanidade).not.toHaveBeenCalled();expect(mocks.nutricao).not.toHaveBeenCalled();expect(mocks.escopo).not.toHaveBeenCalled();
});
