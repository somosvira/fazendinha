// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { parseRotaVisita, urlEtapaVisita } from "../../../router";
import { PlannerVisita } from "./PlannerVisita";
import { carregarPreviaCompleta, chaveGrupo, consultarAgenda, incluirGrupo, listarSelecoes, obterOpcoesSelecao, previaGrupo, type GrupoPlanner, type PreviaPlanner } from "./planner-api";
import { criteriosVazios } from "./EditorSelecaoVisita";
import { grupoLivre } from "./SelecaoLivreVisita";
import { obterVisita, type Visita } from "./visitas-api";

vi.mock("../../../financeiro/PainelCadastro", () => ({ classeInput: "", PainelCadastro: ({ titulo, children }: { titulo: string; children: React.ReactNode }) => <div><h2>{titulo}</h2>{children}</div> }));
vi.mock("./planner-api", async importar => ({ ...await importar<typeof import("./planner-api")>(), consultarAgenda: vi.fn(), obterOpcoesSelecao: vi.fn(), previaGrupo: vi.fn(), listarSelecoes: vi.fn(), carregarPreviaCompleta: vi.fn(), incluirGrupo: vi.fn() }));
vi.mock("./visitas-api", async importar => ({ ...await importar<typeof import("./visitas-api")>(), obterVisita: vi.fn() }));
const grupo = (n: number): GrupoPlanner => ({ grupo: { origem: "PROTOCOLO", identidade: String(n) }, nome: `Protocolo ${n}`, secao: "REPRODUCAO", janela: "DIA", tipo: "TAREFA_IATF", protocolo: { id: String(n), nome: `Protocolo ${n}`, versao: 1 }, turma: { id: String(n), nome: `Turma ${n}` }, etapa: { id: String(n), nome: "Avaliação", ordem: 1 }, previstaPara: "2026-10-14", precisaoTemporal: "DIA", criterios: null, totalAnimais: 1, totalProcedimentos: 1, emVisitaAberta: 0 });
const previa = (g: GrupoPlanner): PreviaPlanner => ({ grupo: g, animais: [{ animalId: `vaca-${g.nome}`, brinco: "100", tarefaId: null, motivos: ["Motivo do teste"], visitasAbertas: [], categoria: { id: "cat", nome: "Vaca" }, lote: { id: "lote", nome: "Lote A" }, tentativasCiclo: 2, diasTentativa: 10, partos: 1, retencaoPlacenta: false }], total: 1, pagina: 1, tamanhoPagina: 200, fingerprint: `fingerprint-${g.nome}` });
const visita: Visita = { id: "visita", propriedadeId: 1, data: "2026-10-14", nome: "Visita", status: "ABERTA", atividades: [], impressoes: [] };
function Harness() {
  const [etapa, setEtapa] = useState<import("../../../router").EtapaVisita>("planejamento");
  const [grupoAtivo, setGrupoAtivo] = useState<string | null>(null);
  return <PlannerVisita visita={visita} podeLancar etapa={etapa} grupo={grupoAtivo} onEtapa={(e, opcoes) => { setEtapa(e); setGrupoAtivo(opcoes?.grupo ?? null); }} onMudou={async () => {}}/>;
}
beforeEach(() => {
  sessionStorage.clear(); localStorage.clear(); vi.clearAllMocks();
  vi.mocked(consultarAgenda).mockResolvedValue({ grupos: [grupo(1), grupo(2)], totalGrupos: 2, totais: { animaisUnicos: 2, procedimentos: 2 }, pagina: 1, tamanhoPagina: 200 });
  vi.mocked(listarSelecoes).mockResolvedValue({ selecoes: [] });
  vi.mocked(obterVisita).mockResolvedValue({ ...visita, atividades: [{ id: "atividade-nova", nome: "Atendimento", tipo: "TAREFA_IATF", extra: false, participantes: [] }] });
  vi.mocked(carregarPreviaCompleta).mockImplementation(async (_p, _d, g) => previa(grupo(g.origem === "PROTOCOLO" ? Number(g.identidade) : 1)));
});
afterEach(cleanup);
async function abrirRevisao(n: number) {
  await screen.findAllByRole("button", { name: "Revisar animais" });
  fireEvent.click(screen.getAllByRole("button", { name: "Revisar animais" })[n - 1]);
  await screen.findByText("100");
}
async function salvarRevisao() {
  fireEvent.click(screen.getByRole("button", { name: "Salvar grupo revisado" }));
  await screen.findByText(/Grupos revisados \(1\)/);
}
describe("planner da visita", () => {
  it("seleciona um grupo sem abrir revisão e retoma a seleção após recarga", async () => {
    const { unmount } = render(<Harness/>);
    const checkbox = await screen.findByRole("checkbox", { name: "Selecionar Protocolo 1" });
    fireEvent.click(checkbox);
    await waitFor(() => expect((checkbox as HTMLInputElement).checked).toBe(true));
    expect(screen.getByRole("heading", {name: "Agenda do dia"})).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(incluirGrupo).not.toHaveBeenCalled();
    unmount(); render(<Harness/>);
    await waitFor(() => expect((screen.getByRole("checkbox", {name:"Selecionar Protocolo 1"}) as HTMLInputElement).checked).toBe(true));
    fireEvent.click(screen.getByRole("button", { name:"Revisar seleção" }));
    await screen.findByRole("table");
    expect(screen.getByRole("heading", {name:"Revisar animais"})).toBeTruthy();
  });
  it("abre a revisão em página inteira com contexto tabular e preserva exclusões", async () => {
    render(<Harness/>);
    await abrirRevisao(1);
    expect(screen.getByText("Lote A")).toBeTruthy();
    expect(screen.getAllByText("Dias desde tentativa").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Motivo do teste")).toHaveLength(1);
    expect(screen.getByText("Motivos comuns do grupo")).toBeTruthy();
    expect(vi.mocked(carregarPreviaCompleta)).toHaveBeenCalledWith(1, "2026-10-14", grupo(1).grupo);
    fireEvent.click(screen.getByLabelText("Somente com atenção"));
    expect(screen.getByText("0 resultados · 1 animais no grupo · 1 incluídos")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Somente com atenção"));
    await salvarRevisao();
    expect(screen.getByText(/1 animais únicos · 1 procedimentos$/)).toBeTruthy();
  });
  it("preserva exclusões em revisão pendente ao trocar de grupo e voltar", async () => {
    render(<Harness/>);
    await abrirRevisao(1);
    fireEvent.click(screen.getByRole("checkbox", { name: "Incluir 100" }));
    expect((screen.getByRole("checkbox", { name: "Incluir 100" }) as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Voltar à agenda" }));
    await abrirRevisao(2);
    fireEvent.click(screen.getByRole("button", { name: "Voltar à agenda" }));
    await abrirRevisao(1);
    expect((screen.getByRole("checkbox", { name: "Incluir 100" }) as HTMLInputElement).checked).toBe(false);
  });
  it("ignora uma prévia que termina depois de desmontar o planner", async () => {
    let concluir!: (value: PreviaPlanner) => void;
    vi.mocked(carregarPreviaCompleta).mockImplementationOnce(() => new Promise(resolve => { concluir = resolve; }));
    const onEtapa = vi.fn();
    const { unmount } = render(<PlannerVisita visita={visita} podeLancar etapa="planejamento" onEtapa={onEtapa}/>);
    await screen.findAllByRole("button", { name: "Revisar animais" });
    fireEvent.click(screen.getAllByRole("button", { name: "Revisar animais" })[0]);
    await waitFor(() => expect(concluir).toBeTypeOf("function"));
    unmount();
    await act(async () => { concluir(previa(grupo(1))); });
    expect(onEtapa).not.toHaveBeenCalled();
  });
  it("mantém grupos incluídos se uma preparação parcial falhar e repete com a mesma chave", async () => {
    vi.mocked(incluirGrupo).mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("Rede indisponível")).mockResolvedValueOnce({});
    render(<Harness/>);
    await abrirRevisao(1); await salvarRevisao();
    fireEvent.click(screen.getAllByRole("button", { name: "Revisar animais" })[1]);
    await screen.findByText("100");
    fireEvent.click(screen.getByRole("button", { name: "Salvar grupo revisado" }));
    await screen.findByText(/Grupos revisados \(2\)/);
    fireEvent.click(screen.getByRole("button", { name: "Revisar seleção" }));
    await screen.findByText("100");
    fireEvent.click(screen.getByRole("button", { name: "Preparar visita e ir ao atendimento" }));
    await screen.findByText(/Rede indisponível/);
    await waitFor(() => expect(incluirGrupo).toHaveBeenCalledTimes(2));
    const chavePendente = vi.mocked(incluirGrupo).mock.calls[1]?.[1].chave;
    expect(screen.getByText(/Grupos revisados \(1\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Revisar seleção" }));
    await screen.findByText("100");
    fireEvent.click(screen.getByRole("button", { name: "Preparar visita e ir ao atendimento" }));
    await waitFor(() => expect(incluirGrupo).toHaveBeenCalledTimes(3));
    expect(vi.mocked(incluirGrupo).mock.calls[2]?.[1].chave).toBe(chavePendente);
  });
  it("mantém a consulta sem ações de escrita para perfil somente leitura", async () => {
    render(<PlannerVisita visita={visita} podeLancar={false}/>);
    await screen.findByText("Protocolo 1");
    expect(screen.queryByRole("button", { name: "Preparar visita e ir ao atendimento" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Gerenciar seleções" })).toBeNull();
  });
});

describe("percurso livre independente",()=>{
  function Livre({pode=true}:{pode?:boolean}={}){const [etapa,setEtapa]=useState<import("../../../router").EtapaVisita>("selecao");const [g,setG]=useState<string|null>(null);return <PlannerVisita visita={visita} podeLancar={pode} modo="livre" etapa={etapa} grupo={g} onEtapa={(e,o)=>{setEtapa(e);setG(o?.grupo??null);}}/>;}
  function configurar(){
    vi.mocked(obterOpcoesSelecao).mockResolvedValue({lotes:[],categorias:[],racas:[],protocolos:[],tiposExame:[]});
    const p=(g:import("./planner-api").GrupoPlannerInput)=>{const livre=g.origem==="LIVRE"?g:null;const r=previa({...grupo(1),grupo:g,nome:livre?.nome??"Livre",tipo:livre?.tipo??"AVALIACAO_REPRODUTIVA",protocolo:null,etapa:null,janela:"EXTRA",criterios:livre?.criterios??null});r.animais[0].sexo="F";return r;};
    vi.mocked(previaGrupo).mockImplementation(async(_s,_d,g)=>p(g));vi.mocked(carregarPreviaCompleta).mockImplementation(async(_s,_d,g)=>p(g));
  }
  it("revê o grupo, define atividade depois e prepara pelo núcleo comum sem consultar agenda",async()=>{
    configurar();render(<Livre/>);
    const revisar=await screen.findByRole("button",{name:"Revisar 1 animais"});await waitFor(()=>expect((revisar as HTMLButtonElement).disabled).toBe(false));
    expect(consultarAgenda).not.toHaveBeenCalled();expect(incluirGrupo).not.toHaveBeenCalled();
    fireEvent.click(revisar);await screen.findByRole("table");await waitFor(()=>expect(screen.queryByRole("alert")).toBeNull());fireEvent.click(screen.getByRole("button",{name:"Definir atividade e visita"}));
    await screen.findByRole("heading",{name:"O que será feito neste grupo?"});
    expect(incluirGrupo).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("radio",{name:/Aplicação sanitária/}));
    fireEvent.click(screen.getByRole("button",{name:"Incluir grupo na visita"}));
    await waitFor(()=>expect(incluirGrupo).toHaveBeenCalledOnce());
    expect(vi.mocked(incluirGrupo).mock.calls[0][1].grupo).toMatchObject({origem:"LIVRE",tipo:"APLICACAO_SANITARIA",criterios:{versao:2},incluidosManualmente:[]});
    expect(consultarAgenda).not.toHaveBeenCalled();
  });
  it("usa filtro salvo na data da visita e não importa escolhas da agenda",async()=>{
    configurar();const criterios={versao:1 as const,todas:[],qualquer:[],ordenacao:[{campo:"BRINCO" as const,direcao:"ASC" as const}],politicaDesconhecidos:"EXCLUIR" as const};
    vi.mocked(listarSelecoes).mockResolvedValue({selecoes:[{id:"s",nome:"Rotina da fazenda",ativo:true,versaoAtual:{id:"v",numero:1,criterios}}]});
    render(<Livre/>);fireEvent.click(screen.getByRole("button",{name:"Usar filtros salvos"}));await screen.findByText("Rotina da fazenda");fireEvent.click(screen.getByRole("button",{name:"Usar filtros"}));
    await waitFor(()=>expect(previaGrupo).toHaveBeenCalledWith(1,"2026-10-14",expect.objectContaining({origem:"LIVRE",criterios:{...criterios,versao:2}})));
    expect(consultarAgenda).not.toHaveBeenCalled();expect(incluirGrupo).not.toHaveBeenCalled();
  });
  it("exige nova revisão se o contexto muda ao definir a atividade",async()=>{
    configurar();const original=vi.mocked(carregarPreviaCompleta).getMockImplementation()!;
    vi.mocked(carregarPreviaCompleta).mockImplementation(async(...args)=>({...await original(...args),assinaturaContexto:args[2].origem==="LIVRE"&&args[2].tipo==="APLICACAO_SANITARIA"?"mudou":"conferido"}));
    render(<Livre/>);const revisar=await screen.findByRole("button",{name:"Revisar 1 animais"});await waitFor(()=>expect((revisar as HTMLButtonElement).disabled).toBe(false));fireEvent.click(revisar);await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button",{name:"Definir atividade e visita"}));await screen.findByRole("heading",{name:"O que será feito neste grupo?"});fireEvent.click(screen.getByRole("radio",{name:/Aplicação sanitária/}));fireEvent.click(screen.getByRole("button",{name:"Incluir grupo na visita"}));
    await screen.findByText(/A composição ou o contexto do grupo mudou/);expect(screen.getByRole("heading",{name:"Revisar animais"})).toBeTruthy();expect(incluirGrupo).not.toHaveBeenCalled();
  });

 it("consulta revisa os animais sem liberar preparação",async()=>{
   configurar();render(<Livre pode={false}/>);const revisar=await screen.findByRole("button",{name:"Revisar 1 animais"});await waitFor(()=>expect((revisar as HTMLButtonElement).disabled).toBe(false));fireEvent.click(revisar);await screen.findByRole("table");
   expect((screen.getByRole("button",{name:"Definir atividade e visita"}) as HTMLButtonElement).disabled).toBe(true);expect(incluirGrupo).not.toHaveBeenCalled();
 });

  it("invalida revisão pelos filtros, pelo stepper e pela URL antiga; ignora resposta atrasada",async()=>{
    configurar();
    const antigo=chaveGrupo(grupoLivre(criteriosVazios()));
    const machos={...criteriosVazios(),todas:[{tipo:"VALORES" as const,campo:"SEXO" as const,valores:["M"]}]};
    vi.mocked(listarSelecoes).mockResolvedValue({selecoes:[{id:"filtro",nome:"Somente machos",ativo:true,versaoAtual:{id:"versao",numero:1,criterios:machos}}]});
    let concluirAntiga!: (p:PreviaPlanner)=>void;
    vi.mocked(previaGrupo).mockImplementation((_s,_d,g)=>g.origem==="LIVRE"&&g.criterios.todas.length===0?new Promise(resolve=>{concluirAntiga=resolve;}):Promise.resolve({...previa(grupo(1)),grupo:{...grupo(1),grupo:g,criterios:g.origem==="LIVRE"?g.criterios:null},total:4,animais:[...Array(4)].map((_,i)=>({...previa(grupo(1)).animais[0],animalId:`macho-${i}`,brinco:String(i+1),sexo:"M"}))}));
    vi.mocked(carregarPreviaCompleta).mockImplementation(async(_s,_d,g)=>({...previa(grupo(1)),grupo:{...grupo(1),grupo:g,criterios:g.origem==="LIVRE"?g.criterios:null},total:g.origem==="LIVRE"&&g.criterios.todas.length?4:1,animais:g.origem==="LIVRE"&&g.criterios.todas.length?[...Array(4)].map((_,i)=>({...previa(grupo(1)).animais[0],animalId:`macho-${i}`,brinco:String(i+1),sexo:"M"})):[{...previa(grupo(1)).animais[0],sexo:"F"}]}));
    function Rotas(){const [etapa,setEtapa]=useState<import("../../../router").EtapaVisita>("selecao");const [g,setG]=useState<string|null>(null);return <><button onClick={()=>{setEtapa("atividade");setG(antigo);}}>URL antiga</button><PlannerVisita visita={visita} podeLancar modo="livre" etapa={etapa} grupo={g} onEtapa={(e,o)=>{setEtapa(e);setG(o?.grupo??null);}}/></>;}
    render(<Rotas/>);
    await waitFor(()=>expect(concluirAntiga).toBeTypeOf("function"));
    fireEvent.click(screen.getByRole("button",{name:"Usar filtros salvos"}));
    fireEvent.click(await screen.findByRole("button",{name:"Usar filtros"}));
    await act(async()=>{concluirAntiga({...previa(grupo(1)),grupo:{...grupo(1),grupo:grupoLivre(criteriosVazios())}});});
    const revisar=await screen.findByRole("button",{name:"Revisar 4 animais"});
    expect((revisar as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button",{name:"URL antiga"}));
    await screen.findByRole("heading",{name:"Selecionar animais por filtros"});
    expect(screen.queryByRole("heading",{name:"O que será feito neste grupo?"})).toBeNull();
    expect((screen.getByRole("button",{name:/AtividadeDefinir o atendimento/}) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(await screen.findByRole("button",{name:"Revisar 4 animais"}));
    await screen.findByRole("table");
    expect(screen.getByText(/4 animais na lista/)).toBeTruthy();
  });

  it("erro na prévia dos filtros novos não libera a revisão anterior",async()=>{
    configurar();
    const novos={...criteriosVazios(),todas:[{tipo:"VALORES" as const,campo:"SEXO" as const,valores:["M"]}]};
    vi.mocked(listarSelecoes).mockResolvedValue({selecoes:[{id:"filtro",nome:"Machos",ativo:true,versaoAtual:{id:"v",numero:1,criterios:novos}}]});
    const original=vi.mocked(previaGrupo).getMockImplementation()!;
    vi.mocked(previaGrupo).mockImplementation((...args)=>args[2].origem==="LIVRE"&&args[2].criterios.todas.length?Promise.reject(new Error("Prévia indisponível")):original(...args));
    render(<Livre/>);
    fireEvent.click(await screen.findByRole("button",{name:"Revisar 1 animais"}));await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button",{name:"Voltar aos filtros"}));
    fireEvent.click(screen.getByRole("button",{name:"Usar filtros salvos"}));
    fireEvent.click(await screen.findByRole("button",{name:"Usar filtros"}));
    await screen.findByText("Prévia indisponível");
    expect((screen.getByRole("button",{name:"Revisar 0 animais"}) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button",{name:/AtividadeDefinir o atendimento/}) as HTMLButtonElement).disabled).toBe(true);
  });

  it("URL direta da atividade exige revisão se a assinatura salva mudou",async()=>{
    configurar();
    const g=grupoLivre(criteriosVazios());
    const chave=chaveGrupo(g);
    sessionStorage.setItem("fazendinha:visitas:livre:sessao:1:visita",JSON.stringify({versao:2,data:"2026-10-14",grupos:[],criterios:g.criterios,revisao:{grupo:g,fingerprint:"assinatura-antiga",excluidos:[],chave:"rascunho"}}));
    const onEtapa=vi.fn();
    function Rota(){const [etapa,setEtapa]=useState<import("../../../router").EtapaVisita>("atividade");return <PlannerVisita visita={visita} podeLancar modo="livre" etapa={etapa} grupo={chave} onEtapa={(e,o)=>{onEtapa(e,o);setEtapa(e);}}/>;}
    render(<Rota/>);
    await waitFor(()=>expect(onEtapa).toHaveBeenCalledWith("revisao",expect.objectContaining({grupo:chave,modo:"livre"})));
    expect(screen.queryByRole("heading",{name:"O que será feito neste grupo?"})).toBeNull();
    expect(incluirGrupo).not.toHaveBeenCalled();
  });

  it("isola critérios e rascunho da seleção por usuário e sítio",async()=>{
    configurar();
    localStorage.setItem("rionovo:usuario",JSON.stringify({id:11}));
    const chave="fazendinha:visitas:livre:11:1:visita";
    sessionStorage.setItem(chave,JSON.stringify({versao:2,data:"2026-10-14",grupos:[],criterios:{...criteriosVazios(),todas:[{tipo:"VALORES",campo:"SEXO",valores:["M"]}]},atividade:{nome:"Grupo privado",tipo:"EXAME_SANITARIO",referencia:"exame-1"}}));
    const outroSitio={...visita,propriedadeId:2};
    const {unmount}=render(<PlannerVisita visita={outroSitio} podeLancar modo="livre" etapa="selecao"/>);
    await waitFor(()=>expect(previaGrupo).toHaveBeenCalledWith(2,"2026-10-14",expect.objectContaining({origem:"LIVRE",criterios:criteriosVazios()})));
    unmount();vi.mocked(previaGrupo).mockClear();
    localStorage.setItem("rionovo:usuario",JSON.stringify({id:12}));
    render(<PlannerVisita visita={visita} podeLancar modo="livre" etapa="selecao"/>);
    await waitFor(()=>expect(previaGrupo).toHaveBeenCalledWith(1,"2026-10-14",expect.objectContaining({origem:"LIVRE",criterios:criteriosVazios()})));
    expect(sessionStorage.getItem(chave)).toContain("Grupo privado");
  });

  it("preserva nome, tipo e referência ao voltar e recarregar o percurso livre",async()=>{
    configurar();
    vi.mocked(obterOpcoesSelecao).mockResolvedValue({lotes:[],categorias:[],racas:[],protocolos:[],tiposExame:[{id:"exame-1",nome:"Exame da manhã",contexto:"SANITARIO"}]});
    const {unmount}=render(<Livre/>);
    fireEvent.click(await screen.findByRole("button",{name:"Revisar 1 animais"}));await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button",{name:"Definir atividade e visita"}));
    await screen.findByRole("heading",{name:"O que será feito neste grupo?"});
    fireEvent.change(screen.getByRole("textbox",{name:"Nome do grupo"}),{target:{value:"Sanidade grupo manhã"}});
    fireEvent.click(screen.getByRole("radio",{name:/Exame sanitário/}));
    fireEvent.change(screen.getByRole("combobox",{name:"Tipo de exame"}),{target:{value:"exame-1"}});
    fireEvent.click(screen.getAllByRole("button",{name:"Rever animais"}).at(-1)!);
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button",{name:"Definir atividade e visita"}));
    expect((screen.getByRole("textbox",{name:"Nome do grupo"}) as HTMLInputElement).value).toBe("Sanidade grupo manhã");
    await waitFor(()=>expect((screen.getByRole("combobox",{name:"Tipo de exame"}) as HTMLSelectElement).value).toBe("exame-1"));
    await waitFor(()=>expect(sessionStorage.getItem("fazendinha:visitas:livre:sessao:1:visita")).toContain("Sanidade grupo manhã"));
    unmount();render(<Livre/>);
    fireEvent.click(await screen.findByRole("button",{name:"Revisar 1 animais"}));await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button",{name:"Definir atividade e visita"}));
    expect((screen.getByRole("textbox",{name:"Nome do grupo"}) as HTMLInputElement).value).toBe("Sanidade grupo manhã");
    await waitFor(()=>expect((screen.getByRole("combobox",{name:"Tipo de exame"}) as HTMLSelectElement).value).toBe("exame-1"));
    fireEvent.click(screen.getAllByRole("button",{name:"Rever animais"}).at(-1)!);
    fireEvent.click(screen.getByRole("button",{name:"Voltar aos filtros"}));
    fireEvent.click(await screen.findByRole("button",{name:"Novo grupo"}));
    fireEvent.click(await screen.findByRole("button",{name:"Revisar 1 animais"}));
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button",{name:"Definir atividade e visita"}));
    expect((screen.getByRole("textbox",{name:"Nome do grupo"}) as HTMLInputElement).value).toBe("Grupo montado por filtros");
    expect((screen.getByRole("radio",{name:/Avaliação reprodutiva/}) as HTMLInputElement).checked).toBe(true);
  });

  it("preserva exclusão ao ajustar filtros, recarregar e revisar sem mudar critérios",async()=>{
    configurar();
    const chave="fazendinha:visitas:livre:sessao:1:visita";
    const {unmount}=render(<Livre/>);
    fireEvent.click(await screen.findByRole("button",{name:"Revisar 1 animais"}));
    const incluir=await screen.findByRole("checkbox",{name:"Incluir 100"}) as HTMLInputElement;
    fireEvent.click(incluir);
    expect(incluir.checked).toBe(false);
    fireEvent.click(screen.getByRole("button",{name:"Ajustar filtros"}));
    await screen.findByRole("heading",{name:"Selecionar animais por filtros"});
    await waitFor(()=>expect(JSON.parse(sessionStorage.getItem(chave)!).revisoesPendentes?.at(-1)?.excluidos).toEqual(["vaca-Grupo montado por filtros"]));
    unmount();
    render(<Livre/>);
    fireEvent.click(await screen.findByRole("button",{name:"Revisar 1 animais"}));
    expect((await screen.findByRole("checkbox",{name:"Incluir 100"}) as HTMLInputElement).checked).toBe(false);
  });

  it("revalida protocolo restaurado e limpa referência ao trocar para tipo incompatível",async()=>{
    configurar();
    const protocolo={id:"protocolo-1",nome:"IATF manhã",tipo:"REPRODUTIVO" as const,publicadoEm:"2026-10-01",ativo:true};
    vi.mocked(obterOpcoesSelecao).mockResolvedValue({lotes:[],categorias:[],racas:[],protocolos:[protocolo],tiposExame:[]});
    const {unmount}=render(<Livre/>);
    fireEvent.click(await screen.findByRole("button",{name:"Revisar 1 animais"}));await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button",{name:"Definir atividade e visita"}));
    fireEvent.click(screen.getByRole("radio",{name:/Iniciar protocolo reprodutivo/}));
    await waitFor(()=>expect(screen.getByRole("option",{name:"IATF manhã"})).toBeTruthy());
    fireEvent.change(screen.getByRole("combobox",{name:"Protocolo"}),{target:{value:"protocolo-1"}});
    fireEvent.click(screen.getAllByRole("button",{name:"Rever animais"}).at(-1)!);
    fireEvent.click(screen.getByRole("button",{name:"Definir atividade e visita"}));
    await waitFor(()=>expect((screen.getByRole("combobox",{name:"Protocolo"}) as HTMLSelectElement).value).toBe("protocolo-1"));
    unmount();
    vi.mocked(obterOpcoesSelecao).mockResolvedValue({lotes:[],categorias:[],racas:[],protocolos:[],tiposExame:[]});
    render(<Livre/>);
    fireEvent.click(await screen.findByRole("button",{name:"Revisar 1 animais"}));await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button",{name:"Definir atividade e visita"}));
    await screen.findByText(/A referência anterior não está disponível/);
    expect((screen.getByRole("combobox",{name:"Protocolo"}) as HTMLSelectElement).value).toBe("protocolo-1");
    expect((screen.getByRole("button",{name:"Incluir grupo na visita"}) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("radio",{name:/Aplicação sanitária/}));
    fireEvent.click(screen.getByRole("radio",{name:/Iniciar protocolo reprodutivo/}));
    expect((screen.getByRole("combobox",{name:"Protocolo"}) as HTMLSelectElement).value).toBe("");
  });

  it("leva a ordem alterada na revisão e as exclusões para a preparação",async()=>{
    configurar();
    const original=vi.mocked(carregarPreviaCompleta).getMockImplementation()!;
    vi.mocked(carregarPreviaCompleta).mockImplementation(async(...args)=>{
      const p=await original(...args); const g=args[2];
      const direcao=g.origem==="LIVRE"?g.criterios.ordenacao[0].direcao:"ASC";
      return {...p,animais:[{...p.animais[0],animalId:"a",brinco:"2",sexo:"F"},{...p.animais[0],animalId:"b",brinco:"10",sexo:"F"}].sort((a,b)=>direcao==="DESC"?Number(b.brinco)-Number(a.brinco):Number(a.brinco)-Number(b.brinco)),total:2,fingerprint:`ordem-${direcao}`};
    });
    render(<Livre/>);fireEvent.click(await screen.findByRole("button",{name:"Revisar 1 animais"}));await screen.findByRole("table");
    fireEvent.click(screen.getByRole("checkbox",{name:"Incluir 2"}));
    fireEvent.click(screen.getByRole("button",{name:"Ordenar por Animal"}));
    await waitFor(()=>expect(screen.getByRole("button",{name:"Ordenar por Animal"}).textContent).toContain("↓"));
    expect((screen.getByRole("checkbox",{name:"Incluir 2"}) as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole("button",{name:"Definir atividade e visita"}));await screen.findByRole("heading",{name:"O que será feito neste grupo?"});
    fireEvent.click(screen.getByRole("button",{name:"Incluir grupo na visita"}));
    await waitFor(()=>expect(incluirGrupo).toHaveBeenCalledOnce());
    expect(vi.mocked(incluirGrupo).mock.calls[0][1].grupo).toMatchObject({origem:"LIVRE",criterios:{ordenacao:[{campo:"BRINCO",direcao:"DESC"}]}});
    expect(vi.mocked(incluirGrupo).mock.calls[0][1].excluidos).toEqual(["a"]);
  });

  it("ignora a ordenação atrasada após voltar aos filtros e mudar o sexo",async()=>{
    configurar();
    const machos={...criteriosVazios(),todas:[{tipo:"VALORES" as const,campo:"SEXO" as const,valores:["M"]}]};
    vi.mocked(listarSelecoes).mockResolvedValue({selecoes:[{id:"filtro",nome:"Machos",ativo:true,versaoAtual:{id:"v",numero:1,criterios:machos}}]});
    const original=vi.mocked(carregarPreviaCompleta).getMockImplementation()!;
    let concluir!: (p:PreviaPlanner)=>void;
    vi.mocked(carregarPreviaCompleta).mockImplementation((...args)=>args[2].origem==="LIVRE"&&args[2].criterios.ordenacao[0]?.direcao==="DESC"?new Promise(resolve=>{concluir=resolve;}):original(...args));
    render(<Livre/>);
    fireEvent.click(await screen.findByRole("button",{name:"Revisar 1 animais"}));await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button",{name:"Ordenar por Animal"}));
    await waitFor(()=>expect(concluir).toBeTypeOf("function"));
    fireEvent.click(screen.getByRole("button",{name:"Ajustar filtros"}));
    fireEvent.click(screen.getByRole("button",{name:"Usar filtros salvos"}));
    fireEvent.click(await screen.findByRole("button",{name:"Usar filtros"}));
    await act(async()=>{concluir({...await original(1,"2026-10-14",{...grupoLivre(criteriosVazios()),criterios:{...criteriosVazios(),ordenacao:[{campo:"BRINCO",direcao:"DESC"}]}})});});
    expect(screen.getByRole("heading",{name:"Selecionar animais por filtros"})).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(JSON.parse(sessionStorage.getItem("fazendinha:visitas:livre:sessao:1:visita")!).criterios).toEqual(machos);
    expect(incluirGrupo).not.toHaveBeenCalled();
  });

  it("mantém revisão ao navegar pela URL quando a API reordena as chaves dos critérios",async()=>{
    configurar();
    const resposta=(g:import("./planner-api").GrupoPlannerInput)=>{
      const c=g.origem==="LIVRE"?g.criterios:criteriosVazios();
      const criterios={politicaDesconhecidos:c.politicaDesconhecidos,ordenacao:c.ordenacao,qualquer:c.qualquer,todas:c.todas,versao:c.versao};
      const grupoApi=g.origem==="LIVRE"?{...g,criterios}:g;
      return {...previa(grupo(1)),grupo:{...grupo(1),grupo:grupoApi,criterios},animais:[{...previa(grupo(1)).animais[0],sexo:"F"}]};
    };
    vi.mocked(previaGrupo).mockImplementation(async(_s,_d,g)=>resposta(g));
    vi.mocked(carregarPreviaCompleta).mockImplementation(async(_s,_d,g)=>resposta(g));
    window.history.replaceState(null,"",urlEtapaVisita(visita.id,"selecao",{modo:"livre"}));
    function RotaReal(){const [rota,setRota]=useState(()=>parseRotaVisita(location.pathname,location.search)!);if(rota.tipo!=="visita")return null;return <PlannerVisita visita={visita} podeLancar modo="livre" etapa={rota.etapa??"selecao"} grupo={rota.grupo} onEtapa={(etapa,opcoes)=>{window.history.pushState(null,"",urlEtapaVisita(visita.id,etapa,opcoes));setRota(parseRotaVisita(location.pathname,location.search)!);}}/>;}
    render(<RotaReal/>);
    fireEvent.click(await screen.findByRole("button",{name:"Revisar 1 animais"}));
    await screen.findByRole("table");
    expect(new URLSearchParams(location.search).get("etapa")).toBe("revisao");
    expect(new URLSearchParams(location.search).get("grupo")).toBe(chaveGrupo(grupoLivre(criteriosVazios())));
    expect(screen.getByRole("heading",{name:"Revisar animais"})).toBeTruthy();
  });

  it("carga antiga de grupos não substitui a revisão iniciada pelos filtros atuais",async()=>{
    configurar();
    const femeas={...criteriosVazios(),todas:[{tipo:"VALORES" as const,campo:"SEXO" as const,valores:["F"]}]};
    const machos={...criteriosVazios(),todas:[{tipo:"VALORES" as const,campo:"SEXO" as const,valores:["M"]}]};
    const grupoAntigo=grupoLivre(machos);
    sessionStorage.setItem("fazendinha:visitas:livre:sessao:1:visita",JSON.stringify({versao:2,data:"2026-10-14",grupos:[],criterios:femeas,desatualizados:[{grupo:grupoAntigo,fingerprint:"antigo",excluidos:[],chave:"antiga"}]}));
    const original=vi.mocked(previaGrupo).getMockImplementation()!;
    let concluirAntiga!: (p:PreviaPlanner)=>void;
    vi.mocked(previaGrupo).mockImplementation((...args)=>args[2].origem==="LIVRE"&&args[2].criterios.todas[0]?.tipo==="VALORES"&&args[2].criterios.todas[0].valores[0]==="M"?new Promise(resolve=>{concluirAntiga=resolve;}):original(...args));
    render(<Livre/>);
    await waitFor(()=>expect(concluirAntiga).toBeTypeOf("function"));
    fireEvent.click(await screen.findByRole("button",{name:"Revisar 1 animais"}));
    await screen.findByRole("table");
    await act(async()=>{concluirAntiga({...previa(grupo(1)),grupo:{...grupo(1),grupo:grupoAntigo}});});
    expect(screen.getByRole("heading",{name:"Revisar animais"})).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.queryByText(/O grupo da URL não corresponde/)).toBeNull();
  });

  it("não restaura grupo antigo quando os filtros mudam durante a leitura da revisão salva",async()=>{
    configurar();
    const femeas={...criteriosVazios(),todas:[{tipo:"VALORES" as const,campo:"SEXO" as const,valores:["F"]}]};
    const grupoAntigo=grupoLivre(femeas);
    const chave="fazendinha:visitas:livre:sessao:1:visita";
    sessionStorage.setItem(chave,JSON.stringify({versao:2,data:"2026-10-14",grupos:[{grupo:grupoAntigo,fingerprint:"fingerprint-Grupo montado por filtros",excluidos:[],chave:"antiga"}],criterios:femeas}));
    const original=vi.mocked(carregarPreviaCompleta).getMockImplementation()!;
    let concluir!: (p:PreviaPlanner)=>void;
    vi.mocked(carregarPreviaCompleta).mockImplementation((...args)=>args[2].origem==="LIVRE"&&args[2].criterios.todas[0]?.tipo==="VALORES"&&args[2].criterios.todas[0].valores[0]==="F"?new Promise(resolve=>{concluir=resolve;}):original(...args));
    render(<Livre/>);
    await waitFor(()=>expect(concluir).toBeTypeOf("function"));
    const sexo=[...document.querySelectorAll("fieldset")].find(f=>f.querySelector("legend")?.textContent==="Sexo")!;
    fireEvent.click(sexo.querySelectorAll("input")[0]);
    fireEvent.click(sexo.querySelectorAll("input")[1]);
    await act(async()=>{concluir(await original(1,"2026-10-14",grupoAntigo));});
    await waitFor(()=>expect(JSON.parse(sessionStorage.getItem(chave)!).criterios.todas[0].valores).toEqual(["M"]));
    expect(JSON.parse(sessionStorage.getItem(chave)!).grupos).toEqual([]);
    expect(screen.queryByText(/Grupos revisados \(1\)/)).toBeNull();
  });

  it("revê grupo preparado com critérios históricos sem substituir o próximo rascunho",async()=>{
    configurar();
    const criterios={...criteriosVazios(),todas:[{tipo:"VALORES" as const,campo:"SEXO" as const,valores:["M"]}]};
    const grupo=grupoLivre(criterios);
    const chave=chaveGrupo(grupo);
    const visitaPreparada:Visita={...visita,atividades:[{id:"preparada",nome:"Machos preparados",tipo:"AVALIACAO_REPRODUTIVA",extra:false,participantes:[],contexto:{grupoPlanner:grupo,percursoVisita:{versao:1,origem:"LIVRE"}}}]};
    const chaveEstado="fazendinha:visitas:livre:sessao:1:visita";
    sessionStorage.setItem(chaveEstado,JSON.stringify({versao:2,data:"2026-10-14",grupos:[],criterios:criteriosVazios()}));
    function Caminho(){const [etapa,setEtapa]=useState<import("../../../router").EtapaVisita>("revisao");const historico=etapa==="revisao";return <PlannerVisita key={historico?"historico":"rascunho"} visita={visitaPreparada} podeLancar modo="livre" etapa={etapa} grupo={historico?chave:null} onEtapa={e=>setEtapa(e)}/>;}
    render(<Caminho/>);
    await screen.findByRole("table");
    expect(screen.getByText(/Este grupo já foi preparado/)).toBeTruthy();
    expect(JSON.parse(sessionStorage.getItem(chaveEstado)!).criterios).toEqual(criteriosVazios());
    fireEvent.click(screen.getByRole("button",{name:"Ajustar filtros"}));
    await screen.findByRole("heading",{name:"Selecionar animais por filtros"});
    await waitFor(()=>expect(previaGrupo).toHaveBeenCalledWith(1,"2026-10-14",expect.objectContaining({origem:"LIVRE",criterios:criteriosVazios()})));
  });

});


it.each([false, true])("consulta o grupo preparado pelo servidor, com exclusões e blocos (rascunho conflitante: %s)", async (comRascunho) => {
  const g = grupoLivre(criteriosVazios());
  const chave = "fazendinha:visitas:livre:sessao:1:visita";
  const rascunho = JSON.stringify({ versao: 2, data: visita.data, grupos: [], criterios: g.criterios,
    revisao: { grupo: g, fingerprint: "atual", excluidos: ["a"], chave: "rascunho" } });
  if (comRascunho) sessionStorage.setItem(chave, rascunho);
  // Uma prévia atual falharia (ex.: inclusão manual agora fora do sítio).
  vi.mocked(previaGrupo).mockRejectedValue(new Error("Grupo atual indisponível"));
  vi.mocked(carregarPreviaCompleta).mockRejectedValue(new Error("Grupo atual indisponível"));
  const contexto = { grupoPlanner: g, fingerprint: "original", excluidos: ["b"],
    ajustesManuais: { incluidos: [], excluidos: [{ animalId: "b", brinco: "200" }] } };
  const preparada: Visita = { ...visita, atividades: [
    { id: "bloco-1", nome: "Grupo (1/2)", tipo: g.tipo, extra: true, contexto,
      participantes: [{ id: "pa", animalId: "a", ordem: 1, status: "PENDENTE", rascunho: null,
        snapshot: { brinco: "100", del: 25, lote: { id: "antigo", nome: "Lote preservado" } } }] },
    { id: "bloco-2", nome: "Grupo (2/2)", tipo: g.tipo, extra: true, contexto,
      participantes: [{ id: "pc", animalId: "c", ordem: 1, status: "PENDENTE", rascunho: null,
        snapshot: { brinco: "300" } }] },
  ] };
  const abrir = () => render(<PlannerVisita visita={preparada} podeLancar modo="livre" etapa="revisao" grupo={chaveGrupo(g)}/>);
  const tela = abrir();
  await screen.findByRole("table");
  const verificar = () => {
    const checks = ["100", "300", "200"].map(brinco => screen.getByRole("checkbox", { name: `Incluir ${brinco}` }) as HTMLInputElement);
    expect(checks.map(c => c.checked)).toEqual([true, true, false]);
    expect(checks.every(c => c.disabled)).toBe(true);
    expect(screen.getByText("2 de 3 animais incluídos neste grupo")).toBeTruthy();
    expect(screen.getByText("Lote preservado")).toBeTruthy();
    expect(screen.getByText("25")).toBeTruthy();
    expect(screen.queryByText("Incluir animal fora dos filtros")).toBeNull();
    expect((screen.getByRole("button", { name: "Excluir todos os filtrados" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Definir atividade e visita" }) as HTMLButtonElement).disabled).toBe(true);
    expect(previaGrupo).not.toHaveBeenCalled();
    expect(carregarPreviaCompleta).not.toHaveBeenCalled();
    expect(incluirGrupo).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(chave)).toBe(comRascunho ? rascunho : null);
  };
  verificar();
  tela.unmount(); abrir(); await screen.findByRole("table"); verificar();
});
