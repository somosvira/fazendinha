// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
it("integra tentativas ao histórico com paginação e exclui marcos previstos", async () => {
 vi.mocked(obterReproducao).mockResolvedValue(painel());
 render(<ReproducaoIndividual animalId="a" propriedadeId={1} podeLancar={false}/>);
 await screen.findByRole("heading", { name: "Histórico reprodutivo" });
 expect(screen.getByText("12 desde o início registrado")).toBeTruthy();
 expect(screen.queryByRole("heading", { name: /Tentativas deste ciclo/ })).toBeNull();
 expect(screen.queryByText("Fim do PEV")).toBeNull();
 expect(screen.getAllByRole("button", { name: "Ver detalhes" })).toHaveLength(20);
 fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
 expect(screen.getAllByRole("button", { name: "Ver detalhes" })).toHaveLength(6);
 fireEvent.click(screen.getByRole("button",{name:"Tipos de registro"}));fireEvent.click(screen.getByRole("option",{name:"Avaliações"}));fireEvent.keyDown(screen.getByPlaceholderText("Buscar opção…"),{key:"Escape"});
 expect(screen.getByText("Nenhum evento registrado neste período e tipo.")).toBeTruthy();
});
it("conserva deep links e detalhes, filtra período e mantém rascunho ao recolher", async () => {
 window.history.replaceState(null, "", "/?fatoId=t0#reproducao");
 vi.mocked(obterReproducao).mockResolvedValue(painel());
 const { rerender } = render(<ReproducaoIndividual animalId="a" propriedadeId={1} podeLancar={true}/>);
 expect(await screen.findByText("Fato t0")).toBeTruthy();
 fireEvent.click(screen.getByRole("button", { name: "Fechar fato" }));
 expect(new URLSearchParams(window.location.search).has("fatoId")).toBe(false);
 fireEvent.click(screen.getByRole("button", { name: /Aptidão hoje/ }));
 const criterio = screen.getByLabelText("Critérios completos") as HTMLInputElement;
 fireEvent.change(criterio, { target: { value: "alterado" } });
 fireEvent.click(screen.getByRole("button", { name: /Aptidão hoje/ }));
 fireEvent.click(screen.getByRole("button", { name: /Aptidão hoje/ }));
 expect((screen.getByLabelText("Critérios completos") as HTMLInputElement).value).toBe("alterado");
 expect(screen.getByText("Não aferido")).toBeTruthy();
 fireEvent.click(screen.getByRole("button", {name:"Personalizar período"}));
 fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2020-09-10" } });
 fireEvent.click(screen.getByRole("button", {name:"Aplicar período"}));
 expect(screen.getByText("1–3 de 3 registros")).toBeTruthy();
 fireEvent.click(screen.getByRole("button", { name: /Custos diretos/ }));
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
 expect(screen.getByText("12 no histórico disponível")).toBeTruthy();
 expect(await screen.findByText(/Nenhuma participação coletiva/)).toBeTruthy();
 expect(screen.queryByText("999")).toBeNull();
 expect(vi.mocked(reqV4).mock.calls.some(([url]) => url.includes("/reproducao/participacoes"))).toBe(false);
});
it("usa último desfecho factual válido incluindo aborto como referência", async () => {
 const dados = painel(); dados.partos = [{ id:"antigo", animalId:"a", data:"2020-09-01", desfecho:"NASCIMENTO", status:"VALIDO" },{ id:"aborto", animalId:"a", data:"2020-09-10", desfecho:"ABORTO", status:"VALIDO" },{ id:"anulado", animalId:"a", data:"2020-09-12", status:"ANULADO" }];
 dados.animais[0].resumoAcompanhamento={dataReferencia:getHojeISO(),tentativas:2,referencia:{tipo:"ABORTO",data:"2020-09-10"}};
 vi.mocked(obterReproducao).mockResolvedValue(dados);
 render(<ReproducaoIndividual animalId="a" podeLancar={false}/>);
 expect(await screen.findByText("2 desde o último parto registrado")).toBeTruthy();
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
 reqProtocolo.mockImplementation((url: string) => url.includes("vinculos-coletivos") ? Promise.reject(new Error("Falha de protocolos")) : Promise.resolve({ itens: [], total: 0, pagina: 1, porPagina: 10 }));
 render(<ReproducaoIndividual animalId="a" propriedadeId={1} podeLancar={false}/>);
 expect(await screen.findByText("Falha de protocolos")).toBeTruthy();
 expect(screen.queryByText(/Nenhuma participação coletiva/)).toBeNull();
 expect(screen.getByRole("heading", { name:"Histórico reprodutivo" })).toBeTruthy();
 reqProtocolo.mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 10 });
 fireEvent.click(screen.getByRole("button", { name:"Atualizar protocolos coletivos" }));
 expect(await screen.findByText(/Nenhuma participação coletiva/)).toBeTruthy();
});

it.each([0,1,2,3])("conserva %s tentativas factuais sem completar lacunas", async quantidade => {
 const dados = painel();dados.tentativas=dados.tentativas.slice(0,quantidade);dados.animais[0].resumoAcompanhamento!.tentativas=quantidade;
 vi.mocked(obterReproducao).mockResolvedValue(dados);
 render(<ReproducaoIndividual animalId="a" podeLancar={false}/>);
 expect(await screen.findByText(`${quantidade} desde o início registrado`)).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"Tipos de registro"}));fireEvent.click(screen.getByRole("option",{name:"Tentativas"}));fireEvent.keyDown(screen.getByPlaceholderText("Buscar opção…"),{key:"Escape"});
 expect(screen.queryAllByRole("button",{name:"Ver detalhes"})).toHaveLength(quantidade*2);
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
 vi.mocked(reqV4).mockImplementation(url => Promise.resolve(url.startsWith("/reproducao/acompanhamento?") ? paginaDemandas([{...demandaPendente,estado:resolvida?"RESOLVIDA":"PENDENTE"}]) : []));
 render(<ReproducaoIndividual animalId="a" propriedadeId={1} podeLancar={true}/>);
 fireEvent.click(await screen.findByRole("button",{name:"Registrar avaliação"}));
 expect(screen.getByText("Formulário preservado")).toBeTruthy();
 resolvida = true;
 fireEvent.click(screen.getByRole("button",{name:"Salvar formulário"}));
 await screen.findByText("Resolvida");
 expect(screen.queryByRole("button",{name:"Registrar avaliação"})).toBeNull();
 expect(obterReproducao).toHaveBeenCalledTimes(2);
 expect(reqProtocolo.mock.calls.filter(([url])=>url.includes("/vinculos-coletivos?"))).toHaveLength(2);
});
it("inclui tentativa no dia da situação inicial válida e ignora referências não válidas", async () => {
 const dados = painel();dados.situacoesIniciais![0].data="2020-09-10";
 dados.animais[0].resumoAcompanhamento={dataReferencia:getHojeISO(),tentativas:3,referencia:{tipo:"SITUACAO_INICIAL",data:"2020-09-10"}};
 dados.partos=[{id:"pendente",animalId:"a",data:"2020-09-11",status:"PENDENTE"}];
 dados.tentativas.push({id:"pendente-t",animalId:"a",data:"2020-09-12",tipo:"IA",status:"PENDENTE"});
 vi.mocked(obterReproducao).mockResolvedValue(dados);
 render(<ReproducaoIndividual animalId="a" podeLancar={false}/>);
 expect(await screen.findByText("3 desde o início registrado")).toBeTruthy();
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
 fireEvent.click(await screen.findByText("Planejar acompanhamentos faltantes"));
 fireEvent.change(screen.getByLabelText("Regra para os acompanhamentos novos"),{target:{value:"regra"}});
 fireEvent.click(screen.getByRole("button",{name:"Ver prévia"}));
 await screen.findByRole("button",{name:"Confirmar criação conferida"});
 fireEvent.change(screen.getByLabelText("Motivo obrigatório"),{target:{value:"Acompanhamento explicitamente adotado"}});
 fireEvent.click(screen.getByRole("button",{name:"Confirmar criação conferida"}));
 expect(await screen.findByRole("heading",{name:"Acompanhamentos"})).toBeTruthy();
 expect(screen.getByText(/1 acompanhamento pendente/)).toBeTruthy();
 expect(await screen.findByRole("button",{name:"Registrar avaliação"})).toBeTruthy();
 expect(obterReproducao).toHaveBeenCalledTimes(2);
});

it("agrupa registros no menu e a ação abre o mesmo formulário sem depender de expandir a seção", async () => {
 vi.mocked(obterReproducao).mockResolvedValue(painel());
 render(<ReproducaoIndividual animalId="a" propriedadeId={1} podeLancar/>);
 const menu = await screen.findByRole("button", {name:"Ações de reprodução"});
 expect(screen.getByRole("button", {name:"Registros e ações"}).getAttribute("aria-expanded")).toBe("false");
 fireEvent.keyDown(menu, {key:"Enter"});
 expect(await screen.findAllByRole("menuitem")).toHaveLength(5);
 fireEvent.click(screen.getByRole("menuitem", {name:"Registrar tentativa"}));
 expect(screen.getByText("Formulário preservado")).toBeTruthy();
});

it("transferência conserva resumo clínico transversal sem acrescentar fatos ao histórico do sítio", async () => {
 const dados=painel();dados.tentativas=[];dados.partos=[];dados.situacoesIniciais=[];
 dados.animais[0].resumoAcompanhamento={dataReferencia:getHojeISO(),tentativas:2,referencia:{tipo:"ABORTO",data:"2020-09-10"}};
 vi.mocked(obterReproducao).mockResolvedValue(dados);
 render(<ReproducaoIndividual animalId="a" propriedadeId={2} podeLancar={false}/>);
 expect(await screen.findByText("2 desde o último parto registrado")).toBeTruthy();
 expect(screen.getByText("Aborto registrado · 10/09/2020")).toBeTruthy();
 expect(screen.getByText("Nenhum evento registrado neste período e tipo.")).toBeTruthy();
 expect(screen.queryByRole("button", {name:"Ver detalhes"})).toBeNull();
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
