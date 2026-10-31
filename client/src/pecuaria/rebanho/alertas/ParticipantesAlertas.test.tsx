// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {ParticipantesAlertas} from './ParticipantesAlertas';
import {consultarParticipantes} from './api';
import {getUsuario} from '../../../lib/auth';
vi.mock('./api',async original=>({...await original<typeof import('./api')>(),consultarParticipantes:vi.fn()}));
vi.mock('../api',()=>({listarLotes:vi.fn().mockResolvedValue([])}));
vi.mock('../../../lib/auth',()=>({getUsuario:vi.fn()}));
vi.mock('./DetalheAlerta',()=>({DetalheAlerta:()=>null}));
vi.mock('./AplicacaoColetivaAlertas',()=>({AplicacaoColetivaAlertas:()=>null}));
afterEach(cleanup);beforeEach(()=>{vi.clearAllMocks();window.history.replaceState(null,'','/pecuaria/rebanho/alertas/participantes?cuidado=grupo');vi.mocked(consultarParticipantes).mockResolvedValue({itens:[{id:'a1',necessidadeId:'n1',animalId:'animal',brinco:'026',nome:'Estrela',loteId:null,loteNome:null,titulo:'Cuidado A',motivo:'Data fixa',situacao:'PENDENTE',dataReferencia:null,dataAtencao:null,revisao:1,chaveAgrupamento:'grupo',propriedadeId:1}],total:561,pagina:1,tamanho:20,totaisGerais:{cuidados:1,necessidades:561,animais:561},totaisFiltrados:{cuidados:1,necessidades:561,animais:561}})});
describe('participantes do cuidado',()=>{
 it('leitor consulta sem seleção nem ação de escrita',async()=>{vi.mocked(getUsuario).mockReturnValue(null);render(<ParticipantesAlertas/>);await screen.findByText('561 participantes neste recorte');expect(screen.queryByRole('checkbox')).toBeNull();expect(screen.queryByRole('button',{name:'Registrar seleção'})).toBeNull()});
 it('seleção é explícita e muda de contexto ao buscar',async()=>{vi.mocked(getUsuario).mockReturnValue({id:7,nome:'Operador QA',email:'qa@example.test',papel:'OPERADOR',abas:[],status:'ATIVO',dono:true,flags:[],areas:['pecuaria']});render(<ParticipantesAlertas/>);await screen.findByText('561 participantes neste recorte');fireEvent.click(screen.getAllByRole('checkbox',{name:'Selecionar 026'})[0]);expect(screen.getByText('1 selecionados')).toBeTruthy();fireEvent.change(screen.getByRole('searchbox'),{target:{value:'Outro'}});await waitFor(()=>expect(screen.getByText('0 selecionados')).toBeTruthy());expect(consultarParticipantes).toHaveBeenLastCalledWith('grupo',expect.objectContaining({busca:'Outro',pagina:1}),expect.any(AbortSignal));});
 it('permite selecionar participante atrasado para o atendimento coletivo',async()=>{vi.mocked(getUsuario).mockReturnValue({id:7,nome:'Operador QA',email:'qa@example.test',papel:'OPERADOR',abas:[],status:'ATIVO',dono:true,flags:[],areas:['pecuaria']});const resposta=await vi.mocked(consultarParticipantes).getMockImplementation()!('grupo',{});resposta.itens[0].situacao='ATRASADO';vi.mocked(consultarParticipantes).mockResolvedValue(resposta);render(<ParticipantesAlertas/>);await screen.findByText('561 participantes neste recorte');const selecionar=screen.getAllByRole('checkbox',{name:'Selecionar 026'})[0];expect(selecionar.hasAttribute('disabled')).toBe(false);fireEvent.click(selecionar);expect(screen.getByText('1 selecionados')).toBeTruthy();});

});
