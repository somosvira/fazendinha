// @vitest-environment jsdom
import { alterarControle } from "../../../lib/controles.fixture";
import { abrirFiltrosConsulta, aplicarFiltrosConsulta } from "@/lib/controles.fixture";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getHojeISO } from "../../../lib/hoje";
import { ReproducaoIndividual } from "./ReproducaoIndividual";
import { obterReproducao, reqV4, type PainelReprodutivo } from "./api";
vi.mock("./api", () => ({ obterReproducao: vi.fn(), reqV4: vi.fn() }));
const reqProtocolo = vi.hoisted(() => vi.fn());
vi.mock("../protocolos/api", async importOriginal => ({ ...await importOriginal<object>(), reqProtocolo }));
vi.mock("./AcoesReprodutivas", () => ({ AcoesReprodutivas: () => null }));
vi.mock("./ElegibilidadeAnimal", () => ({ ElegibilidadeAnimal: () => <input aria-label="Critérios completos" defaultValue="rascunho"/> }));
vi.mock("../custos/CustosDiretos", () => ({ CustosDiretos: ({ finalidadeInicial }: { finalidadeInicial: string }) => <p>Custos {finalidadeInicial}</p> }));
vi.mock("./DetalheFato", () => ({ DetalheFato: ({ fato, onFechar }: { fato: { id: string }; onFechar: () => void }) => <div><p>Fato {fato.id}</p><button onClick={onFechar}>Fechar fato</button></div> }));
vi.mock("./FormReproducao", () => ({ FormReproducao: ({ onSalvo }: { onSalvo: () => void }) => <div><p>Formulário preservado</p><button onClick={onSalvo}>Salvar formulário</button></div> }));
beforeEach(() => { reqProtocolo.mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 10 }); window.history.replaceState(null,"","/"); vi.stubGlobal("ResizeObserver",class {observe(){} unobserve(){} disconnect(){}}); Element.prototype.scrollIntoView=vi.fn(); vi.mocked(reqV4).mockImplementation(async url => url.startsWith("/reproducao/acompanhamento?") ? paginaDemandas([]) : []); });
afterEach(() => { cleanup(); vi.clearAllMocks(); window.history.replaceState(null, "", "/"); });
function painel(animalId = "a"): PainelReprodutivo {
 const tentativas = Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, animalId, data: `2020-09-${String(i + 1).padStart(2, "0")}`, tipo: i === 0 ? "TE" : "IA", ordem: i + 1, status: "VALIDO" }));
 return { animais: [{ animalId, brinco: animalId, nome: null, situacao: "VAZIA", tentativasCiclo: 999, resumoAcompanhamento: {dataReferencia:getHojeISO(),tentativas:12,referencia:{tipo:"SITUACAO_INICIAL",data:"2020-08-01"}}, partos: 1, gestacao: null, restricoes: [] }], tentativas, avaliacoes: [], partos: [], restricoes: [], situacoesIniciais: [{ id: "inicio", animalId, data: "2020-08-01", situacao: "VAZIA", status:"VALIDO" }], marcos: { estado: "VAZIA", marcos: [], eventos: [{ id: "previsao", data: "2099-10-20", titulo: "Fim do PEV", pendente: true }], intervalos: [{ rotulo: "Liberação até primeiro serviço", dias: null }] } };
}
function contagemTentativas() { return screen.getByText("Tentativas no ciclo").parentElement!.querySelector("dd")!.textContent; }
function secao(nome: string) { return screen.getByRole("heading", { name: nome }).closest("section")!; }

it("separa tentativas e partos do restante histórico, conserva paginação e exclui marcos previstos", async () => {
 vi.mocked(obterReproducao).mockResolvedValue(painel());
 render(<ReproducaoIndividual animalId="a" propriedadeId={1} podeLancar={false}/>);
 await screen.findByRole("heading", { name: "Histórico reprodutivo" });
 expect(contagemTentativas()).toBe("12");
 expect(screen.queryByRole("heading", { name: /Tentativas deste ciclo/ })).toBeNull();
 expect(screen.queryByText("Fim do PEV")).toBeNull();
 expect(within(secao("Tentativas reprodutivas")).getAllByRole("button", { name: "Detalhes" })).toHaveLength(20);
 expect(within(secao("Histórico reprodutivo")).getAllByRole("button", { name: "Detalhes" })).toHaveLength(1);
 expect(within(secao("Histórico de partos")).queryAllByRole("button", { name: "Detalhes" })).toHaveLength(0);
 fireEvent.click(within(secao("Tentativas reprodutivas")).getByRole("button", { name: "Próxima" }));
 expect(within(secao("Tentativas reprodutivas")).getAllByRole("button", { name: "Detalhes" })).toHaveLength(4);
 await abrirFiltrosConsulta(secao("Tentativas reprodutivas"));
 fireEvent.click(screen.getByRole("button",{name:"Tipos de registro"}));fireEvent.click(screen.getByRole("option",{name:"Avaliações"}));fireEvent.keyDown(screen.getByPlaceholderText("Buscar opção…"),{key:"Escape"});
 await aplicarFiltrosConsulta();
 expect(within(secao("Tentativas reprodutivas")).getByText("Nenhum evento registrado neste período e tipo.")).toBeTruthy();
});
it("conserva deep links e detalhes, filtra período e mantém rascunho ao atualizar", async () => {
 window.history.replaceState(null, "", "/?fatoId=t0#reproducao");
 vi.mocked(obterReproducao).mockResolvedValue(painel());
 const { rerender } = render(<ReproducaoIndividual animalId="a" propriedadeId={1} podeLancar={true}/>);
 expect(await screen.findByText("Fato t0")).toBeTruthy();
 fireEvent.click(screen.getByRole("button", { name: "Fechar fato" }));
 expect(new URLSearchParams(window.location.search).has("fatoId")).toBe(false);
 const criterio = screen.getByLabelText("Critérios completos") as HTMLInputElement;
 fireEvent.change(criterio, { target: { value: "alterado" } });
 expect((screen.getByLabelText("Critérios completos") as HTMLInputElement).value).toBe("alterado");
 expect(screen.getByText("Não aferido")).toBeTruthy();
 fireEvent.click(within(secao("Tentativas reprodutivas")).getByRole("button", {name:"Período do histórico reprodutivo"}));
 fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2020-09-10" } });
 fireEvent.click(screen.getByRole("button", {name:"Aplicar período"}));
 expect(screen.getByText("1–3 de 3 registros")).toBeTruthy();
 expect(screen.getByText("Custos REPRODUCAO")).toBeTruthy();
 rerender(<ReproducaoIndividual animalId="a" propriedadeId={1} podeLancar={true} recarregarToken={1}/>);
 await waitFor(() => expect(obterReproducao).toHaveBeenCalledTimes(2));
 expect(screen.queryByText("Fato t0")).toBeNull();
 window.history.replaceState(null, "", "/?fatoId=t1#reproducao");
 fireEvent(window, new PopStateEvent("popstate"));
 expect(await screen.findByText("Fato t1")).toBeTruthy();
 window.history.replaceState(null, "", "/#reproducao");
 fireEvent(window, new PopStateEvent("popstate"));
 expect(screen.queryByText("Fato t1")).toBeNull();
});
it("não deduz início ou IATF de tentativa avulsa e não usa contagem técnica do ciclo", async () => {
 const dados = painel(); dados.situacoesIniciais = []; dados.animais[0].resumoAcompanhamento!.referencia=null;
 vi.mocked(obterReproducao).mockResolvedValue(dados);
 render(<ReproducaoIndividual animalId="a" podeLancar={false}/>);
 expect(await screen.findByText("Início não comprovado")).toBeTruthy();
 expect(contagemTentativas()).toBe("12");
 expect(await screen.findByText(/Nenhum protocolo reprodutivo encontrado/)).toBeTruthy();
 expect(screen.queryByText("999")).toBeNull();
 expect(vi.mocked(reqV4).mock.calls.some(([url]) => url.includes("/reproducao/participacoes"))).toBe(false);
});
it("usa último desfecho factual válido incluindo aborto como referência", async () => {
 const dados = painel(); dados.partos = [{ id:"antigo", animalId:"a", data:"2020-09-01", desfecho:"NASCIMENTO", status:"VALIDO" },{ id:"aborto", animalId:"a", data:"2020-09-10", desfecho:"ABORTO", status:"VALIDO" },{ id:"anulado", animalId:"a", data:"2020-09-12", status:"ANULADO" }];
 dados.animais[0].resumoAcompanhamento={dataReferencia:getHojeISO(),tentativas:2,referencia:{tipo:"ABORTO",data:"2020-09-10"}};
 vi.mocked(obterReproducao).mockResolvedValue(dados);
 render(<ReproducaoIndividual animalId="a" podeLancar={false}/>);
 await screen.findByText("Tentativas no ciclo");expect(contagemTentativas()).toBe("2");
 expect(screen.getByText("Aborto registrado · 10/09/2020")).toBeTruthy();
});
it("ignora painel e protocolos obsoletos ao trocar animal e sítio", async () => {
 let resolverPainel!: (p: PainelReprodutivo) => void;
 vi.mocked(obterReproducao).mockImplementationOnce(() => new Promise(r => { resolverPainel = r; })).mockResolvedValue(painel("b"));
 const { rerender } = render(<ReproducaoIndividual animalId="a" propriedadeId={1} podeLancar={false}/>);
 rerender(<ReproducaoIndividual animalId="b" propriedadeId={2} podeLancar={false}/>);
 await screen.findByRole("heading", { name:"Histórico reprodutivo" });
 resolverPainel({ ...painel(), situacoesIniciais: [{ id:"antiga",animalId:"a",data:"1990-01-01",situacao:"GESTANTE" }] });
 await waitFor(() => expect(screen.queryByText(/1990/)).toBeNull());
 expect(screen.queryByText("Programação obsoleta")).toBeNull();
 expect(obterReproducao).toHaveBeenLastCalledWith("b",2);
});
it("distingue falha de protocolos e vazio, permitindo nova tentativa sem perder histórico", async () => {
 vi.mocked(obterReproducao).mockResolvedValue(painel());
 reqProtocolo.mockImplementation((url: string) => url.includes("ficha-animal") ? Promise.reject(new Error("Falha de protocolos")) : Promise.resolve({ itens: [], total: 0, pagina: 1, porPagina: 10 }));
 render(<ReproducaoIndividual animalId="a" propriedadeId={1} podeLancar={false}/>);
 expect(await screen.findByText("Falha de protocolos")).toBeTruthy();
 expect(screen.queryByText(/Nenhum protocolo reprodutivo encontrado/)).toBeNull();
 expect(screen.getByRole("heading", { name:"Histórico reprodutivo" })).toBeTruthy();
 reqProtocolo.mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 10 });
 fireEvent.click(screen.getByRole("button", { name:"Tentar novamente" }));
 expect(await screen.findByText(/Nenhum protocolo reprodutivo encontrado/)).toBeTruthy();
});

it.each([0,1,2,3])("conserva %s tentativas factuais sem completar lacunas", async quantidade => {
 const dados = painel();dados.tentativas=dados.tentativas.slice(0,quantidade);dados.animais[0].resumoAcompanhamento!.tentativas=quantidade;
 vi.mocked(obterReproducao).mockResolvedValue(dados);
 render(<ReproducaoIndividual animalId="a" podeLancar={false}/>);
 await screen.findByText("Tentativas no ciclo");expect(contagemTentativas()).toBe(String(quantidade));
 await abrirFiltrosConsulta(secao("Tentativas reprodutivas"));
 fireEvent.click(screen.getByRole("button",{name:"Tipos de registro"}));fireEvent.click(screen.getByRole("option",{name:"Tentativas"}));fireEvent.keyDown(screen.getByPlaceholderText("Buscar opção…"),{key:"Escape"});
 await aplicarFiltrosConsulta();
 expect(within(secao("Tentativas reprodutivas")).queryAllByRole("button",{name:"Detalhes"})).toHaveLength(quantidade*2);
});
const paginaDemandas = <T extends { estado: string },>(itens: T[]) => ({ itens, total: itens.length, pagina: 1, porPagina: 10, resumo: { total: itens.length, pendentes: itens.filter(d => d.estado === "PENDENTE").length, resolvidas: itens.filter(d => d.estado === "RESOLVIDA").length, encerradas: 0, semData: 0 } });
const demandaPendente = { id:"d", finalidade:"DIAGNOSTICO",ocorrencia:1,tentativaId:"t0",gestacaoId:null,previstaPara:"2020-10-01",estado:"PENDENTE",motivoEncerramento:null,regraSnapshot:{politicaVersao:1},exameResolucaoId:null };
it("bloqueia avaliação quando a evidência de origem foi invalidada", async () => {
 vi.mocked(obterReproducao).mockResolvedValue(painel());
 vi.mocked(reqV4).mockImplementation(url => Promise.resolve(url.startsWith("/reproducao/acompanhamento?") ? paginaDemandas([{...demandaPendente,pendencias:["EXAME_ORIGEM_INVALIDO"]}]) : []));
 render(<ReproducaoIndividual animalId="a" propriedadeId={1} podeLancar={true}/>);
 const atalho = await screen.findByRole("button",{name:"Registrar avaliação"});
 expect((atalho as HTMLButtonElement).disabled).toBe(true);
 expect(screen.getAllByText(/O DG de origem foi alterado ou anulado/).length).toBeGreaterThan(0);
 fireEvent.click(atalho);
 expect(screen.queryByText("Formulário preservado")).toBeNull();
});
it("reconsulta demandas e protocolos depois de salvar e exibe demanda resolvida", async () => {
 vi.mocked(obterReproducao).mockImplementation(async () => ({...painel()}));
 let resolvida = false;
 const onMudou = vi.fn();
 vi.mocked(reqV4).mockImplementation(url => Promise.resolve(url.startsWith("/reproducao/acompanhamento?") ? paginaDemandas([{...demandaPendente,estado:resolvida?"RESOLVIDA":"PENDENTE"}]) : []));
 render(<ReproducaoIndividual animalId="a" propriedadeId={1} podeLancar={true} onMudou={onMudou}/>);
 fireEvent.click(await screen.findByRole("button",{name:"Registrar avaliação"}));
 expect(screen.getByText("Formulário preservado")).toBeTruthy();
 resolvida = true;
 fireEvent.click(screen.getByRole("button",{name:"Salvar formulário"}));
 await screen.findByText("Resolvida");
 expect(screen.queryByRole("button",{name:"Registrar avaliação"})).toBeNull();
 expect(obterReproducao).toHaveBeenCalledTimes(2);
 await waitFor(() => expect(onMudou).toHaveBeenCalledTimes(1));
 expect(reqProtocolo.mock.calls.filter(([url])=>url.includes("/ficha-animal?"))).toHaveLength(4);
});
it("inclui tentativa no dia da situação inicial válida e ignora referências não válidas", async () => {
 const dados = painel();dados.situacoesIniciais![0].data="2020-09-10";
 dados.animais[0].resumoAcompanhamento={dataReferencia:getHojeISO(),tentativas:3,referencia:{tipo:"SITUACAO_INICIAL",data:"2020-09-10"}};
 dados.partos=[{id:"pendente",animalId:"a",data:"2020-09-11",status:"PENDENTE"}];
 dados.tentativas.push({id:"pendente-t",animalId:"a",data:"2020-09-12",tipo:"IA",status:"PENDENTE"});
 vi.mocked(obterReproducao).mockResolvedValue(dados);
 render(<ReproducaoIndividual animalId="a" podeLancar={false}/>);
 await screen.findByText("Tentativas no ciclo");expect(contagemTentativas()).toBe("3");
 expect(screen.getByText("Situação inicial · 10/09/2020")).toBeTruthy();
});
it("adoção explícita reconsulta o pai e torna demanda avulsa e situação descobríveis", async () => {
 vi.mocked(obterReproducao).mockImplementation(async () => ({...painel()}));
 let adotou = false;
 vi.mocked(reqV4).mockImplementation(async url => {
  if (url.endsWith("/adocao/previa")) return {revisao:"r",propostas:[{acao:"CRIAR",finalidade:"DIAGNOSTICO",ocorrencia:1,previstaPara:"2020-10-01"}]};
  if (url.endsWith("/adocao")) {adotou=true;return {};}
  if (url.endsWith("/politicas")) return [{id:"regra",versao:1,vigenteDesde:"2020-01-01",parametros:{versao:1,efeito:"ALERTA",diagnostico:{diasAposTentativa:30},reconfirmacoes:[]}}];
  if (url.startsWith("/reproducao/acompanhamento?")) return paginaDemandas(adotou ? [demandaPendente] : []);
  return [];
 });
 render(<ReproducaoIndividual animalId="a" propriedadeId={1} podeLancar/>);
 fireEvent.click(await screen.findByRole("button",{name:"Planejar avaliações"}));
 await alterarControle(screen.getByLabelText("Regra para os acompanhamentos novos"),{target:{value:"regra"}});
 fireEvent.click(screen.getByRole("button",{name:"Ver prévia"}));
 await screen.findByRole("button",{name:"Confirmar criação conferida"});
 fireEvent.change(screen.getByLabelText("Motivo obrigatório"),{target:{value:"Acompanhamento explicitamente adotado"}});
 fireEvent.click(screen.getByRole("button",{name:"Confirmar criação conferida"}));
 expect(await screen.findByRole("heading",{name:"Avaliações e retornos"})).toBeTruthy();
 expect(screen.getByText("Pendentes")).toBeTruthy();
 expect(await screen.findByRole("button",{name:"Registrar avaliação"})).toBeTruthy();
 expect(obterReproducao).toHaveBeenCalledTimes(2);
});

it("mantém os registros frequentes no cabeçalho de cada seção", async () => {
 vi.mocked(obterReproducao).mockResolvedValue(painel());
 render(<ReproducaoIndividual animalId="a" propriedadeId={1} podeLancar/>);
 fireEvent.click(await screen.findByRole("button", {name:"Registrar tentativa"}));
 expect(screen.getByText("Formulário preservado")).toBeTruthy();
 expect(screen.getByRole("button", {name:"Registrar situação inicial"})).toBeTruthy();
 expect(screen.getByRole("button", {name:"Registrar restrição"})).toBeTruthy();
});
it("não consulta aptidão de hoje nem acompanhamentos de animal fora do efetivo atual", async () => {
 const dados = painel(); dados.animais=[]; dados.tentativas=[]; dados.situacoesIniciais=[];
 vi.mocked(obterReproducao).mockResolvedValue(dados);
 render(<ReproducaoIndividual animalId="a" propriedadeId={1} podeLancar/>);
 expect(await screen.findByText(/Consulta histórica neste sítio/)).toBeTruthy();
 expect(screen.queryByLabelText("Critérios completos")).toBeNull();
 expect(vi.mocked(reqV4).mock.calls.some(([url])=>url.startsWith("/reproducao/acompanhamento?"))).toBe(false);
 expect(within(secao("Tentativas reprodutivas")).getByText("Nenhum evento registrado neste período e tipo.")).toBeTruthy();
});

it("transferência conserva resumo clínico transversal sem acrescentar fatos ao histórico do sítio", async () => {
 const dados=painel();dados.tentativas=[];dados.partos=[];dados.situacoesIniciais=[];
 dados.animais[0].resumoAcompanhamento={dataReferencia:getHojeISO(),tentativas:2,referencia:{tipo:"ABORTO",data:"2020-09-10"}};
 vi.mocked(obterReproducao).mockResolvedValue(dados);
 render(<ReproducaoIndividual animalId="a" propriedadeId={2} podeLancar={false}/>);
 await screen.findByText("Tentativas no ciclo");expect(contagemTentativas()).toBe("2");
 expect(screen.getByText("Aborto registrado · 10/09/2020")).toBeTruthy();
 expect(within(secao("Tentativas reprodutivas")).getByText("Nenhum evento registrado neste período e tipo.")).toBeTruthy();
 expect(screen.queryByRole("button", {name:"Detalhes"})).toBeNull();
 expect(screen.queryByText("999")).toBeNull();
 expect(vi.mocked(reqV4).mock.calls.some(([url]) => url.includes("/reproducao/participacoes"))).toBe(false);
});
it("resumo clínico ausente permanece desconhecido, sem inferir zero pelas listas filtradas", async () => {
 const dados=painel();delete dados.animais[0].resumoAcompanhamento;
 vi.mocked(obterReproducao).mockResolvedValue(dados);
 render(<ReproducaoIndividual animalId="a" propriedadeId={2} podeLancar={false}/>);
 expect(await screen.findByText("Contagem não informada")).toBeTruthy();
 expect(screen.getByText("Referência não informada")).toBeTruthy();
});

it("preserva filtros e páginas independentes de tentativas, partos e histórico na URL", async () => {
 window.history.replaceState(null, "", "/?historicoTipos=Situa%C3%A7%C3%A3o+inicial&partosInicio=2019-01-01#reproducao");
 vi.mocked(obterReproducao).mockResolvedValue(painel());
 render(<ReproducaoIndividual animalId="a" propriedadeId={1} podeLancar={false}/>);
 await screen.findByRole("heading", { name: "Tentativas reprodutivas" });
 fireEvent.click(within(secao("Tentativas reprodutivas")).getByRole("button", { name: "Próxima" }));
 let url = new URL(window.location.href);
 expect(url.searchParams.get("tentativasPagina")).toBe("2");
 expect(url.searchParams.get("historicoTipos")).toBe("Situação inicial");
 expect(url.searchParams.get("partosInicio")).toBe("2019-01-01");
 expect(within(secao("Histórico reprodutivo")).getByText("1–1 de 1 registros")).toBeTruthy();
 window.history.replaceState(null, "", "/?tentativasInicio=2020-09-10&partosInicio=2019-01-01&historicoTipos=Situa%C3%A7%C3%A3o+inicial#reproducao");
 fireEvent.popState(window);
 await waitFor(() => expect(within(secao("Tentativas reprodutivas")).getByText("1–3 de 3 registros")).toBeTruthy());
 url = new URL(window.location.href);
 expect(url.searchParams.get("historicoTipos")).toBe("Situação inicial");
 expect(url.searchParams.get("partosInicio")).toBe("2019-01-01");
});

it.each([["Tentativa", "Tentativas reprodutivas"], ["Parto", "Histórico de partos"]])("restaura link legado filtrado por %s no cartão correspondente", async (tipo, titulo) => {
 window.history.replaceState(null, "", `/?historicoTipos=${tipo}&historicoInicio=2020-09-10#reproducao`);
 const dados = painel();
 dados.partos = [{ id: "parto", animalId: "a", data: "2020-09-11", desfecho: "NASCIMENTO", status: "VALIDO" }];
 vi.mocked(obterReproducao).mockResolvedValue(dados);
 render(<ReproducaoIndividual animalId="a" propriedadeId={1} podeLancar={false}/>);
 await screen.findByRole("heading", { name: titulo });
 expect(within(secao(titulo)).getByText(tipo === "Tentativa" ? "1–3 de 3 registros" : "1–1 de 1 registros")).toBeTruthy();
});

it("restaura período legado sem tipo nas tentativas e partos", async () => {
 window.history.replaceState(null, "", "/?historicoInicio=2020-09-10&historicoFim=2020-09-30#reproducao");
 const dados = painel();
 dados.partos = [{ id: "parto", animalId: "a", data: "2020-09-11", desfecho: "NASCIMENTO", status: "VALIDO" }];
 vi.mocked(obterReproducao).mockResolvedValue(dados);
 render(<ReproducaoIndividual animalId="a" propriedadeId={1} podeLancar={false}/>);
 await screen.findByRole("heading", { name: "Histórico de partos" });
 const parametros = new URLSearchParams(window.location.search);
 for (const prefixo of ["tentativas", "partos"]) {
   expect(parametros.get(`${prefixo}Inicio`)).toBe("2020-09-10");
   expect(parametros.get(`${prefixo}Fim`)).toBe("2020-09-30");
 }
});
