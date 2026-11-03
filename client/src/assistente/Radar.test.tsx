// @vitest-environment jsdom
import {render,screen,waitFor,fireEvent,cleanup} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {Radar} from './Radar';
const consultar=vi.hoisted(()=>vi.fn());
vi.mock('./radar-api',()=>({consultarRadar:consultar}));
afterEach(cleanup);
const resposta={dia:'2026-11-03',geradoEm:'2026-11-03T12:00:00Z',escopo:{propriedadeId:1,nome:'Sítio A'},sintese:{modo:'deterministica',texto:'Somente fatos registrados.'},prioridades:[{id:'a',titulo:'Conferir cuidado',descricao:'Uma necessidade',fonte:{titulo:'Fonte exata',url:'/pecuaria/rebanho/alertas/participantes?cuidado=a'},pergunta:'Como conferir?'}],leitura:[],cobertura:[]};
beforeEach(()=>{vi.clearAllMocks();consultar.mockResolvedValue(resposta);});
it('identifica fallback sem alegar síntese IA e abre pergunta',async()=>{const perguntar=vi.fn();render(<Radar propriedadeId={1} onPerguntar={perguntar}/>);await screen.findByText('Somente fatos registrados.');expect(screen.getByText('Leitura automática dos registros')).toBeTruthy();fireEvent.click(screen.getByText('Perguntar à IA'));expect(perguntar).toHaveBeenCalledWith('Como conferir?');expect(screen.getByText('Fonte exata').getAttribute('href')).toContain('cuidado=a');});
it('limpa resultado anterior ao trocar sítio mesmo durante consulta',async()=>{const {rerender}=render(<Radar propriedadeId={1} onPerguntar={()=>{}}/>);await screen.findByText('Conferir cuidado');consultar.mockImplementation(()=>new Promise(()=>{}));rerender(<Radar propriedadeId={2} onPerguntar={()=>{}}/>);expect(screen.queryByText('Conferir cuidado')).toBeNull();await waitFor(()=>expect(consultar).toHaveBeenCalledTimes(2));});
it('mostra falha sem inventar leitura',async()=>{consultar.mockRejectedValue(new Error('Radar indisponível.'));render(<Radar propriedadeId={1} onPerguntar={()=>{}}/>);expect((await screen.findByRole('alert')).textContent).toContain('Radar indisponível.');expect(screen.queryByText('Conferir cuidado')).toBeNull();});
