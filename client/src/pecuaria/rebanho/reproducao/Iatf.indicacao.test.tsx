import { reqProtocolo } from "../protocolos/api";
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Iatf } from "./Iatf";
import { reqV4, type AnimalReprodutivo } from "./api";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
import { esperarOpcoes, mudarCampo } from "@/lib/controles.fixture";

vi.mock("./api", () => ({ reqV4: vi.fn() }));
vi.mock("../protocolos/api", async original => ({ ...await original<typeof import("../protocolos/api")>(), reqProtocolo: vi.fn().mockImplementation(async (path: string) => path.startsWith("/versoes") ? { itens: [{ id: "protocolo", nome: "Protocolo publicado", versao: 2 }], total: 1, pagina: 1, porPagina: 10 } : { itens: [], total: 0, pagina: 1, porPagina: 10 }) }));
vi.mock("../../../estoque/api", () => ({ listarProdutos: vi.fn().mockResolvedValue([]) }));
vi.mock("../api", () => ({ listarMaterialGenetico: vi.fn().mockResolvedValue([]) }));

vi.mock("../protocolos/useAcoesInicioProtocolo",()=>({useAcoesInicioProtocolo:()=>({etapas:[],erro:null,recarregar:vi.fn()})}));
const animal = (i: number): AnimalReprodutivo => ({
  animalId: `a${i}`, brinco: String(100 + i), nome: null, situacao: "VAZIA",
  partos: 0, tentativasCiclo: 0, gestacao: null, restricoes: [],
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(reqProtocolo).mockImplementation(async (path, _sitio, body) => path === "/programacoes/previa" ? { protocolo:{nome:"Protocolo publicado",versao:2}, itens:[{id:"e1",nome:"Aplicação",previstaPara:"2026-10-18T00:00:00Z",precisaoTemporal:"DIA"}],total:1,pagina:1,porPagina:10,participantes:(body as {animaisIds:string[]}).animaisIds.map(id=>({id,brinco:id,nome:null})),avisos:["Conferência sem gravação"] } : path.startsWith("/versoes") ? {itens:[{id:"protocolo",nome:"Protocolo publicado",versao:2}],total:1,pagina:1,porPagina:10} : {itens:[],total:0,pagina:1,porPagina:10});
  window.history.replaceState(null, "", "/pecuaria/visitas/v");
  setPropriedadeAtiva(99);
  vi.mocked(reqV4).mockImplementation(async (path, body) => path.includes("/protocolos")
    ? [{ id: "protocolo", nome: "Protocolo publicado", versao: 2, publicado: true, ativo: true, etapas: [] }]
    : body ? {} : []);
});
afterEach(() => { cleanup(); setPropriedadeAtiva(null); });

it("abre programação com indicados, permite editar a seleção e grava no sítio explícito", async () => {
  render(<Iatf animais={[animal(0), animal(1)]} animaisIndicadosInicialmente={["a0", "a1"]}
    propriedadeId={7} podeLancar />);
  await screen.findByRole("dialog", { name: "Programar protocolo" });
  expect(screen.getByRole("checkbox", { name: "100" })).toHaveProperty("checked", true);
  expect(screen.getByRole("checkbox", { name: "101" })).toHaveProperty("checked", true);
  expect(vi.mocked(reqV4).mock.calls.every(([, body]) => !body)).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: "101" }));
  mudarCampo(screen.getByRole("textbox", { name: "Nome" }), { target: { value: "Turma após visita" } });
  await esperarOpcoes(() => screen.getByRole("combobox", { name: "Versão publicada" }), o => o.some(i => i.texto === "Protocolo publicado · v2"));
  mudarCampo(screen.getByRole("combobox", { name: "Versão publicada" }), { target: { value: "protocolo" } });
  mudarCampo(screen.getByLabelText("Início previsto"), { target: { value: "2026-10-18" } });
  fireEvent.click(screen.getByRole("button", { name: "Conferir calendário" }));
  await screen.findByRole("button", {name:"Confirmar programação"});
  expect(vi.mocked(reqV4).mock.calls.filter(([,body]) => body)).toHaveLength(0);
  expect(reqProtocolo).toHaveBeenCalledWith("/programacoes/previa",7,expect.objectContaining({animaisIds:["a0"],protocoloId:"protocolo"}));
  fireEvent.click(screen.getByRole("button", {name:"Confirmar programação"}));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/programacoes", expect.objectContaining({
    propriedadeId: 7, nome: "Turma após visita", protocoloId: "protocolo", inicioPrevisto: "2026-10-18",
    animais: [{ animalId: "a0" }],
  }), "POST", 7));
  expect(reqProtocolo).toHaveBeenCalledWith("/programacoes?tipo=REPRODUTIVO&pagina=1&porPagina=10", 7);
  expect(vi.mocked(reqV4).mock.calls.filter(([, body]) => body)).toHaveLength(1);
});

it("limita a primeira programação a 100 e mantém todos os indicados disponíveis", async () => {
  const animais = Array.from({ length: 101 }, (_, i) => animal(i));
  render(<Iatf animais={animais} animaisIndicadosInicialmente={animais.map(a => a.animalId)} propriedadeId={7} podeLancar />);
  await screen.findByRole("dialog", { name: "Programar protocolo" });
  expect(screen.getByText("Participantes: 100/100")).toBeTruthy();
  expect(screen.getAllByRole("checkbox").length).toBeLessThanOrEqual(11);
  mudarCampo(screen.getByLabelText("Buscar animais disponíveis"), { target: { value: "200" } });
  expect(screen.getByRole("checkbox", { name: "200" })).toHaveProperty("checked", false);
  expect(screen.getByText(/os demais indicados continuam disponíveis/)).toBeTruthy();
  expect(vi.mocked(reqV4).mock.calls.every(([, body]) => !body)).toBe(true);
});

it("consome indicação da URL e não reabre os animais ao mudar de sítio", async () => {
 window.history.replaceState(null,"","/pecuaria/reproducao?rotina=programacoes&sitio=7&acao=prepararIatf&animalIndicado=a1&retorno=%2Fpecuaria%2Freproducao");
 const view=render(<Iatf animais={[animal(0),animal(1)]} propriedadeId={7} podeLancar/>);
 await screen.findByRole("dialog",{name:"Programar protocolo"});
 expect(screen.getByRole("checkbox",{name:"101"})).toHaveProperty("checked",true);
 expect(screen.getByRole("checkbox",{name:"100"})).toHaveProperty("checked",false);
 expect(window.location.search).not.toContain("animalIndicado");
 expect(window.location.search).toContain("retorno=");
 view.rerender(<Iatf animais={[animal(0)]} propriedadeId={8} podeLancar/>);
 await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());
});

it("aceita uma segunda preparação pós-DG na mesma montagem sem reaproveitar o pedido anterior",async()=>{
 const url=(pedido:string,id:string)=>`/pecuaria/reproducao?rotina=programacoes&sitio=7&acao=prepararIatf&pedidoPreparacao=${pedido}&animalIndicado=${id}`;
 window.history.replaceState(null,"",url("primeiro","a0"));
 const view=render(<Iatf animais={[animal(0),animal(1)]} propriedadeId={7} podeLancar/>);
 await screen.findByRole("dialog",{name:"Programar protocolo"});
 fireEvent.click(screen.getByRole("button",{name:"Cancelar"}));
 window.history.replaceState(null,"",url("segundo","a1"));
 view.rerender(<Iatf animais={[animal(0),animal(1)]} propriedadeId={7} podeLancar/>);
 await screen.findByRole("dialog",{name:"Programar protocolo"});
 expect(screen.getByRole("checkbox",{name:"101"})).toHaveProperty("checked",true);
 expect(screen.getByRole("checkbox",{name:"100"})).toHaveProperty("checked",false);
 expect(window.location.search).not.toContain("pedidoPreparacao");
});

it("preserva o rascunho se a API devolver calendário sem identificação do modelo",async()=>{
 const respostaNormal=vi.mocked(reqProtocolo).getMockImplementation()!;
 vi.mocked(reqProtocolo).mockImplementation(async (...args)=>args[0]==="/programacoes/previa" ? {itens:[],participantes:[],avisos:[],total:0,pagina:1,porPagina:10} : respostaNormal(...args));
 render(<Iatf animais={[animal(0)]} animaisIndicadosInicialmente={["a0"]} propriedadeId={7} podeLancar/>);
 await screen.findByRole("dialog",{name:"Programar protocolo"});
 mudarCampo(screen.getByRole("textbox",{name:"Nome"}),{target:{value:"Grupo preservado"}});
 await esperarOpcoes(() => screen.getByRole("combobox", { name: "Versão publicada" }), o => o.some(i => i.texto === "Protocolo publicado · v2"));
 mudarCampo(screen.getByRole("combobox",{name:"Versão publicada"}),{target:{value:"protocolo"}});
 mudarCampo(screen.getByLabelText("Início previsto"),{target:{value:"2026-10-18"}});
 fireEvent.click(screen.getByRole("button",{name:"Conferir calendário"}));
 await screen.findAllByText(/A conferência retornou dados incompletos/);
 expect(screen.getByRole("textbox",{name:"Nome"})).toHaveProperty("value","Grupo preservado");
 expect(screen.getByRole("checkbox",{name:"100"})).toHaveProperty("checked",true);
 expect(screen.queryByRole("button",{name:"Confirmar programação"})).toBeNull();
 expect(vi.mocked(reqV4).mock.calls.filter(([,body])=>body)).toHaveLength(0);
 vi.mocked(reqProtocolo).mockImplementation(respostaNormal);
 fireEvent.click(screen.getByRole("button",{name:"Conferir calendário"}));
 await screen.findByRole("button",{name:"Confirmar programação"});
});

it("página dedicada confere o calendário antes da única gravação", async () => {
 const voltar = vi.fn();
 const previaNormal = vi.mocked(reqProtocolo).getMockImplementation()!;
 vi.mocked(reqProtocolo).mockImplementation(async (...args) => {
   const resposta = await previaNormal(...args);
   return args[0] === "/programacoes/previa" ? {
     ...(resposta as object), avisosAptidao: [{ animalId: "a0", mensagem: "DEV-001: Aguarda exame" }],
   } : resposta;
 });
 const normal = vi.mocked(reqV4).getMockImplementation()!;
 vi.mocked(reqV4).mockImplementation(async (...args) => args[0].includes("/visitas/selecoes/opcoes") ? { lotes: [], categorias: [], racas: [], protocolos: [], tiposExame: [] } : args[0] === "/visitas/selecoes/previa" ? { animais: [], total: 0 } : normal(...args));
 render(<Iatf paginaProgramacao solicitarProgramacao onCancelarProgramacao={voltar} animais={[animal(0)]} animaisIndicadosInicialmente={["a0"]} propriedadeId={7} podeLancar/>);
 await screen.findByRole("heading", { name: "Programar protocolo" });
 expect(screen.queryByRole("dialog", { name: "Programar protocolo" })).toBeNull();
 mudarCampo(screen.getByRole("textbox", { name: "Nome" }), { target: { value: "Grupo da página" } });
 fireEvent.click(screen.getByRole("button", { name: "Modelo do protocolo" }));
 fireEvent.click(await screen.findByRole("button", { name: "Protocolo publicado · versão 2" }));
 expect(screen.getByText("Protocolo publicado · v2")).toBeTruthy();
 mudarCampo(screen.getByLabelText("Início previsto"), { target: { value: "2026-10-18" } });
 fireEvent.click(screen.getByRole("button", { name: "Ir para conferência" }));
 await screen.findByRole("dialog", { name: "Avisos de aptidão" });
 expect(screen.getByText("DEV-001: Aguarda exame")).toBeTruthy();
 fireEvent.click(screen.getByRole("button", { name: "Continuar para conferência" }));
 await screen.findByRole("button", { name: "Confirmar programação" });
 expect(vi.mocked(reqV4).mock.calls.filter(([path]) => path === "/reproducao/programacoes")).toHaveLength(0);
 fireEvent.click(screen.getByRole("button", { name: "Voltar à preparação" }));
 expect(screen.getByRole("textbox", { name: "Nome" })).toHaveProperty("value", "Grupo da página");
 expect(screen.getByText("Protocolo publicado · v2")).toBeTruthy();
 expect(voltar).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button", { name: "Ir para conferência" }));
 await screen.findByRole("dialog", { name: "Avisos de aptidão" });
 expect(screen.getByText("DEV-001: Aguarda exame")).toBeTruthy();
 fireEvent.click(screen.getByRole("button", { name: "Continuar para conferência" }));
 await screen.findByRole("button", { name: "Confirmar programação" });
 fireEvent.click(screen.getByRole("button", { name: "Confirmar programação" }));
 await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/programacoes", expect.objectContaining({ propriedadeId: 7, nome: "Grupo da página", cienciaAvisosAptidao: ["a0"], protocoloId: "protocolo", animais: [{animalId: "a0"}] }), "POST", 7));
 expect(voltar).toHaveBeenCalledOnce();
});

it("protege o rascunho ao cancelar ou voltar pela página de programação", async () => {
 const voltar = vi.fn();
 render(<Iatf paginaProgramacao solicitarProgramacao onCancelarProgramacao={voltar} animais={[animal(0)]} propriedadeId={7} podeLancar/>);
 await screen.findByRole("heading", {name:"Programar protocolo"});
 mudarCampo(screen.getByRole("textbox", {name:"Nome"}), {target:{value:"Rascunho"}});
 fireEvent.click(screen.getByRole("button", {name:"Cancelar"}));
 await screen.findByRole("dialog", {name:"Descartar programação?"});
 expect(voltar).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button", {name:"Continuar editando"}));
 await waitFor(() => expect(screen.queryByRole("dialog", {name:"Descartar programação?"})).toBeNull());
 fireEvent.click(screen.getByRole("button", {name:"Voltar"}));
 await screen.findByRole("dialog", {name:"Descartar programação?"});
 fireEvent.click(screen.getByRole("button", {name:"Descartar"}));
 await waitFor(() => expect(voltar).toHaveBeenCalledOnce());
});
