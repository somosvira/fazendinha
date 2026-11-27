// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {AgendaCuidados,prazoCuidado,type ItemAgendaCuidado} from "./AgendaCuidados";
import {reqSanidade} from "./api";
vi.mock('./api',()=>({reqSanidade:vi.fn()}));
vi.mock('../api',()=>({listarLotes:vi.fn().mockResolvedValue([])}));
vi.mock('../alertas/DetalheAlerta',()=>({DetalheAlerta:()=>null}));
const item:ItemAgendaCuidado={id:'alerta:1',origem:'ALERTA',origemId:'n1',alertaId:'a1',animalId:'animal',brinco:'026',nome:'Estrela',titulo:'Cuidado A',situacao:'PENDENTE',dataReferencia:null,precisao:'MES',inicioJanela:'2026-11-01T00:00:00Z',fimJanela:'2026-11-30T00:00:00Z',propriedadeId:1};
const f={de:'',ate:'',busca:'',animalId:'',loteId:'',pagina:1};
afterEach(cleanup);beforeEach(()=>{vi.clearAllMocks();localStorage.clear();window.history.replaceState(null,'','/pecuaria/sanidade?aba=agenda&visaoAgenda=cuidados')});
describe('consulta unificada dos cuidados',()=>{
 it('preserva precisão mensal e dados sem dia, com total do servidor',async()=>{vi.mocked(reqSanidade).mockResolvedValue({itens:[item,{...item,id:'alerta:2',titulo:'Conferência inicial',precisao:'SEM_DATA',inicioJanela:null,fimJanela:null}],total:561,pagina:1,tamanho:50});render(<AgendaCuidados filtros={f} onFiltros={vi.fn()}/>);expect(await screen.findByText('561 cuidados neste recorte')).toBeTruthy();expect(screen.getByText('11/2026 · dia a definir')).toBeTruthy();expect(screen.getByText('Sem data definida')).toBeTruthy();expect(prazoCuidado(item)).not.toContain('01/11');expect(prazoCuidado({...item,precisao:'DIA',situacao:'CONFERENCIA_INICIAL',dataReferencia:'2025-01-01'})).toBe('Sem prazo definido');});
 it('falha não vira resultado vazio e permite repetir',async()=>{vi.mocked(reqSanidade).mockRejectedValueOnce(new Error('Falha de cobertura')).mockResolvedValueOnce({itens:[],total:0,pagina:1,tamanho:50});render(<AgendaCuidados filtros={f} onFiltros={vi.fn()}/>);await screen.findByText('Falha de cobertura');expect(screen.queryByText('Nenhum cuidado neste recorte.')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Tentar novamente'}));expect(await screen.findByText('Nenhum cuidado neste recorte.')).toBeTruthy();});
});
