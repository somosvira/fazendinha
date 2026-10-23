// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CatalogoModelosProtocolos } from "./CatalogoModelosProtocolos";
import { DetalheModeloProtocolo, intervaloProcedimento } from "./DetalheModeloProtocolo";
import { type CadastroProtocoloMeta, type PaginaCadastro } from "./cadastros-api";
import { obterEstruturaCadastro, obterProcedimentosEtapaCadastro, type EtapaEstruturaCadastro, type ProcedimentoCadastro } from "./estrutura-cadastro-api";
vi.mock("./estrutura-cadastro-api",()=>({obterEstruturaCadastro:vi.fn(),obterProcedimentosEtapaCadastro:vi.fn()}));
const pagina=<T,>(itens:T[],total=itens.length,atual=1):PaginaCadastro<T>=>({itens,total,pagina:atual,porPagina:10});
const modelo:CadastroProtocoloMeta={id:"p",nome:"Modelo IATF",tipo:"REPRODUTIVO",versao:2,finalidade:"IATF",ativo:true,publicado:true,publicadoEm:"2026-10-23T12:00:00Z",atualizadoEm:"2026-10-23T12:00:00Z",descricao:null,utilizada:true,totalEtapas:12,totalMomentos:2,totalAcoesSemEtapa:0,previaEstrutura:[{id:"m",nome:"Preparo",agrupada:true,totalProcedimentos:11},{id:"m2",nome:"Inseminação",agrupada:true,totalProcedimentos:1}]};
const procedimento:ProcedimentoCadastro={id:"a",nome:"Aplicação inicial",procedimento:"Aplicação de produto",intervalo:0,unidadeIntervalo:"DIAS",referencia:"Produto congelado",quantidade:"2",unidadeQuantidade:"ML",definirMaterialNoAtendimento:false,via:null,orientacaoUso:null};
const etapa:EtapaEstruturaCadastro={id:"m",nome:"Preparo",agrupada:true,modoAtendimento:"AUTOMATIZADA",instrucoesGerais:"Conferir identificação",procedimentos:pagina([procedimento])};
function props(tipo:CadastroProtocoloMeta["tipo"]="REPRODUTIVO") {return {tipo,protocolos:[{...modelo,tipo}],total:11,pagina:1,carregando:false,erro:null,ocupado:false,podeLancar:false,busca:"preparo",situacao:"ATIVA",onBusca:vi.fn(),onSituacao:vi.fn(),onPagina:vi.fn(),onRecarregar:vi.fn(),onNovo:vi.fn(),onNovaVersao:vi.fn(),onConcluir:vi.fn(),onInativar:vi.fn()};}
beforeEach(()=>{vi.resetAllMocks();localStorage.clear();window.history.replaceState(null,"","/configuracoes/pecuaria/reproducao/protocolos");vi.mocked(obterEstruturaCadastro).mockResolvedValue(pagina([etapa]));});
afterEach(cleanup);
it("apresenta intervalos fracionários sem arredondar o calendário cadastrado",()=>{
  expect(intervaloProcedimento(1.23456,"HORAS")).toBe("H1,23456");
  expect(intervaloProcedimento(7.5,"DIAS")).toBe("D7,5");
});
it.each(["SANITARIO","REPRODUTIVO"] as const)("%s: alterna cards/tabela preservando recorte e permite ao leitor consultar o modal",async tipo=>{
  const p=props(tipo);render(<CatalogoModelosProtocolos {...p}/>);
  expect(screen.getByText("Preparo")).toBeTruthy();expect(obterEstruturaCadastro).not.toHaveBeenCalled();
  expect(screen.queryByRole("button",{name:/Nova versão de/})).toBeNull();expect(screen.queryByRole("button",{name:/Inativar/})).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Tabela"}));
  expect(screen.getByRole("table",{name:tipo==="SANITARIO"?"Protocolos sanitários":"Protocolos reprodutivos"})).toBeTruthy();
  expect(screen.getByRole("searchbox")).toHaveProperty("value","preparo");expect(p.onPagina).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole("table")).getByRole("button",{name:/Ver detalhes de/}));
  expect(await screen.findByRole("dialog")).toBeTruthy();expect(await screen.findAllByText("Produto congelado")).toBeTruthy();
  expect(screen.getAllByText("2 mL")).toBeTruthy();expect(screen.queryByText(/Via:/)).toBeNull();
  expect(screen.getByText("Confirmação do previsto")).toBeTruthy();expect(screen.getByText("Conferir identificação")).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Fechar detalhes"}));expect(screen.queryByRole("dialog")).toBeNull();
});
it("inclui inativos sem oferecer publicação e mantém ações explícitas de conclusão/versão",()=>{
  const p={...props(),podeLancar:true,protocolos:[{...modelo,publicado:false,publicadoEm:null,utilizada:false}]};render(<CatalogoModelosProtocolos {...p}/>);
  expect(screen.queryByRole("combobox",{name:"Situação"})).toBeNull();expect(screen.queryByRole("button",{name:"Atualizar protocolos"})).toBeNull();expect(screen.queryByRole("button",{name:/Publicar/})).toBeNull();
  fireEvent.click(screen.getByRole("checkbox",{name:"Mostrar inativos"}));expect(p.onSituacao).toHaveBeenCalledWith("TODAS");
  fireEvent.click(screen.getByRole("button",{name:/Concluir cadastro de/}));expect(p.onConcluir).toHaveBeenCalledWith(p.protocolos[0]);
  fireEvent.click(screen.getByRole("button",{name:/Nova versão de/}));expect(p.onNovaVersao).toHaveBeenCalledWith(p.protocolos[0]);
});
it("pagina estrutura e procedimentos separadamente em até10, preservando modo e material definido no atendimento",async()=>{
  const muitas=Array.from({length:10},(_,i)=>({...procedimento,id:`a${i}`,nome:`Aplicação ${i}`}));
  vi.mocked(obterEstruturaCadastro).mockImplementation(async(_origem,p)=>p===1?pagina([{...etapa,procedimentos:pagina(muitas,11)}],11):pagina([{...etapa,id:"ia",nome:"Inseminação",modoAtendimento:"MANUAL",procedimentos:pagina([{...procedimento,id:"ia",procedimento:"Inseminação artificial",definirMaterialNoAtendimento:true,referencia:null,quantidade:null}])}],11,2));
  vi.mocked(obterProcedimentosEtapaCadastro).mockResolvedValue(pagina([{...procedimento,id:"a11",nome:"Último procedimento"}],11,2));
  render(<DetalheModeloProtocolo origem={modelo} onClose={vi.fn()}/>);
  const tabela=await screen.findByRole("table",{name:"Procedimentos de Preparo"});expect(within(tabela).getAllByRole("row")).toHaveLength(11);
  fireEvent.click(within(screen.getByRole("navigation",{name:"Paginação de procedimentos de Preparo"})).getByRole("button",{name:"Próxima"}));
  await screen.findAllByText("Último procedimento");expect(obterProcedimentosEtapaCadastro).toHaveBeenCalledWith(modelo,"m",2);
  fireEvent.click(within(screen.getByRole("navigation",{name:"Paginação de etapas e procedimentos individuais"})).getByRole("button",{name:"Próxima"}));
  await screen.findByText("Inseminação");expect(await screen.findAllByText(/Material genético definido no atendimento/)).toBeTruthy();expect(screen.getByText("Preenchimento no atendimento")).toBeTruthy();
});
it("resposta atrasada de uma página de procedimentos não substitui a primeira após voltar",async()=>{
  let resolver!:(p:PaginaCadastro<ProcedimentoCadastro>)=>void;
  vi.mocked(obterEstruturaCadastro).mockResolvedValue(pagina([{...etapa,procedimentos:pagina([procedimento],11)}]));
  vi.mocked(obterProcedimentosEtapaCadastro).mockReturnValue(new Promise(resolve=>{resolver=resolve;}));
  render(<DetalheModeloProtocolo origem={modelo} onClose={vi.fn()}/>);
  fireEvent.click(within(await screen.findByRole("navigation",{name:"Paginação de procedimentos de Preparo"})).getByRole("button",{name:"Próxima"}));
  fireEvent.click(within(screen.getByRole("navigation",{name:"Paginação de procedimentos de Preparo"})).getByRole("button",{name:"Anterior"}));
  resolver(pagina([{...procedimento,id:"tardia",referencia:"Resposta tardia"}],11,2));
  await waitFor(()=>expect(screen.getAllByText("Produto congelado")).toBeTruthy());expect(screen.queryByText("Resposta tardia")).toBeNull();
});
