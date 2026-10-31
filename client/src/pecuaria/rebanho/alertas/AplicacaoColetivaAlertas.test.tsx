// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {AplicacaoColetivaAlertas} from './AplicacaoColetivaAlertas';
import {consultarDetalhe,type ParticipanteAlerta} from './api';
import {reqSanidade,type AplicacaoInput} from '../sanidade/api';
vi.mock('./api',()=>({consultarDetalhe:vi.fn()}));
vi.mock('../sanidade/api',()=>({reqSanidade:vi.fn().mockResolvedValue({aplicacoes:['fato']})}));
vi.mock('../sanidade/FormAplicacaoServico',()=>({FormAplicacaoServico:({onConferirConjunto}:{onConferirConjunto:(itens:AplicacaoInput[])=>Promise<void>})=><button onClick={()=>void onConferirConjunto([{animalId:'animal',propriedadeId:1,produtoId:'produto'} as AplicacaoInput])}>Confirmar animais selecionados</button>}));
afterEach(()=>{cleanup();vi.clearAllMocks()});
it('confirma somente seleção com revisão e capacidade conferidas na origem',async()=>{
 vi.mocked(consultarDetalhe).mockResolvedValue({revisao:2,origem:{produto:{id:'produto',nome:'Produto A',ativo:true}},acoes:['REGISTRAR_APLICACAO']} as Awaited<ReturnType<typeof consultarDetalhe>>);
 const salvo=vi.fn();render(<AplicacaoColetivaAlertas participantes={[{id:'alerta',animalId:'animal',brinco:'026',revisao:2,propriedadeId:1} as ParticipanteAlerta]} onFechar={vi.fn()} onSalvo={salvo}/>);
 const confirmar=await screen.findByRole('button',{name:'Confirmar animais selecionados'});expect(screen.queryByRole('dialog')).toBeNull();fireEvent.click(confirmar);await waitFor(()=>expect(salvo).toHaveBeenCalledTimes(1));
 const payload=JSON.parse(vi.mocked(reqSanidade).mock.calls[0][1]!.body as string);expect(payload.chave).toMatch(/^[a-f0-9-]{36}$/);expect(payload.itens).toEqual([{animalId:'animal',propriedadeId:1,produtoId:'produto',alertaId:'alerta',alertaRevisao:2,confirmarCuidadoAlerta:true}]);
});
