// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {ResumoAlertas} from "./ResumoAlertas";
import {resumirAlertas,type ConsultaAlertas} from "./api";
vi.mock('./api',()=>({resumirAlertas:vi.fn()}));
const consultar=vi.mocked(resumirAlertas);
const vazio:ConsultaAlertas={itens:[],total:0,pagina:1,tamanho:3,totaisGerais:{cuidados:0,necessidades:0,animais:0},totaisFiltrados:{cuidados:0,necessidades:0,animais:0},tiposDisponiveis:['IDADE','DATA_FIXA'],cobertura:{estado:'FALHA',diaCoberto:null,ultimaConclusao:null,erro:'Falha'}};
beforeEach(()=>{vi.clearAllMocks();window.history.replaceState(null,'','/pecuaria/rebanho');});afterEach(cleanup);
describe('resumo de alertas',()=>{
 it('cobertura falha não é apresentada como tudo em dia mesmo com lista vazia',async()=>{consultar.mockResolvedValue(vazio);render(<ResumoAlertas/>);await screen.findByText('A avaliação dos alertas falhou. A lista pode estar incompleta.');expect(screen.queryByText('Tudo em dia')).toBeNull();});
 it('falha de consulta não apresenta zero e permite recuperar dados',async()=>{consultar.mockRejectedValueOnce(new Error('Falha de conexão')).mockResolvedValueOnce({...vazio,cobertura:{...vazio.cobertura,estado:'ATUALIZADA'}});render(<ResumoAlertas/>);await screen.findByText('Falha de conexão');expect(screen.queryByText(/0 cuidados/)).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Tentar novamente'}));await waitFor(()=>expect(consultar).toHaveBeenCalledTimes(2));await screen.findByText('Nenhum cuidado pendente no rebanho.');});
 it('sem cuidados, a seção se identifica como Alertas e mantém Abrir alertas',async()=>{consultar.mockResolvedValue({...vazio,cobertura:{...vazio.cobertura,estado:'ATUALIZADA'}});render(<ResumoAlertas propriedadeId={7}/>);await screen.findByText('Nenhum cuidado pendente no rebanho.');expect(screen.getByRole('heading',{name:'Alertas'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Abrir alertas'}));expect(window.location.pathname).toBe('/pecuaria/rebanho/alertas');expect(new URLSearchParams(window.location.search).get('disposicao')).toBe('ATENCAO');});
 it('regras ainda não avaliadas recebem mensagem própria',async()=>{consultar.mockResolvedValue({...vazio,cobertura:{...vazio.cobertura,estado:'NAO_AVALIADO'}});render(<ResumoAlertas/>);await screen.findByText('As regras de alerta ainda não foram avaliadas neste rebanho.');expect(screen.queryByText('Nenhum cuidado pendente no rebanho.')).toBeNull();});
});
