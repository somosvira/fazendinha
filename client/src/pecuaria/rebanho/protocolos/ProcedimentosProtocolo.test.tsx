// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import {ProcedimentosProtocolo,linkFatoProcedimento} from "./ProcedimentosProtocolo";
import {reqProtocolo} from "./api";
vi.mock("./api",async original=>({...await original<typeof import("./api")>(),reqProtocolo:vi.fn()}));
vi.mock("./DetalheManejoProtocolar",()=>({DetalheManejoProtocolar:({id}:{id:string})=><section>Manejo de origem {id}</section>}));
vi.mock("../../../lib/auth",()=>({getUsuario:()=>({dono:true,areas:[],flags:[]})}));
afterEach(cleanup);beforeEach(()=>vi.clearAllMocks());
const dados=()=>({itens:[{chave:"MANEJO:m",fonteId:"m",tipoFonte:"MANEJO",animalId:"a",data:"2026-10-20",descricao:"Retirada de dispositivo",valor:"10.00",componentes:[{chave:"s:m",natureza:"SERVICO",estado:"CONHECIDO",valor:"10.00",origemId:null}]}],total:11,pagina:1,porPagina:10,resumo:{situacao:"PARCIAL",totalConhecido:"99.00",componentesPendentes:1,limitacoes:[]},estimativa:{situacao:"PARCIAL",total:null,totalConhecido:"120.00",referencias:{itens:[{tarefaId:"t",participacaoId:"p",natureza:"SERVICO",origem:"Cotação 20",data:"2026-10-20",unidade:"POR_ATENDIMENTO",valorUnitario:"10.00",quantidade:"1",valor:"10.00"}],total:11,pagina:1,porPagina:10}}});
it("abre manejo como manejo e mantém totais integrais ao paginar",async()=>{
 vi.mocked(reqProtocolo).mockResolvedValue(dados());render(<ProcedimentosProtocolo contexto={{participacaoId:"p"}} propriedadeId={1} revisao={0}/>);
 await waitFor(()=>expect(reqProtocolo).toHaveBeenCalled());fireEvent.click(screen.getByText("Procedimentos e custos"));
 await screen.findByText("Retirada de dispositivo");fireEvent.click(screen.getByRole("button",{name:"Ver composição e origem"}));
 expect(screen.getByText("Manejo de origem m")).toBeTruthy();expect(screen.queryByRole("link",{name:"Ver fato de origem"})).toBeNull();
 fireEvent.click(within(screen.getByLabelText("Paginação de procedimentos")).getByRole("button",{name:"Próxima"}));
 await waitFor(()=>expect(reqProtocolo).toHaveBeenLastCalledWith(expect.stringContaining("pagina=2"),1));
 expect((await screen.findByText(/99,00/)).textContent).toMatch(/99,00/);
});
it("identifica origem e data da referência com paginação independente",async()=>{
 vi.mocked(reqProtocolo).mockResolvedValue(dados());render(<ProcedimentosProtocolo contexto={{participacaoId:"p"}} propriedadeId={1} revisao={0}/>);
 await waitFor(()=>expect(reqProtocolo).toHaveBeenCalled());fireEvent.click(screen.getByText("Procedimentos e custos"));fireEvent.click(await screen.findByText("Referências usadas na estimativa"));
 expect(screen.getByText("Cotação 20")).toBeTruthy();expect(screen.getByText(/Referência de 20\/10\/2026/)).toBeTruthy();
 const nav=screen.getByLabelText("Paginação de referências");fireEvent.click(within(nav).getByRole("button",{name:"Próxima"}));
 await waitFor(()=>expect(reqProtocolo).toHaveBeenLastCalledWith(expect.stringContaining("referenciasPagina=2"),1));
});
it("links de manejo nunca usam rota de exame",()=>{expect(linkFatoProcedimento({tipoFonte:"MANEJO",fonteId:"m",animalId:"a"},1)).toBe("/pecuaria/rebanho/animais/a");});
