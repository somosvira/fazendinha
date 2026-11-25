// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PaginaCadastroProtocolo } from "./PaginaCadastroProtocolo";
import { listarCadastrosProtocolos, obterCadastroProtocolo, obterAcoesCadastro, type CadastroProtocoloMeta } from "./cadastros-api";
import { reqProtocolo } from "./api";
import { RebanhoApiError } from "../api";
import { reqV4 } from "../reproducao/api";
import { reqSanidade } from "../sanidade/api";
import { navegarPara } from "../../../router";
import { mudarCampo } from "@/lib/controles.fixture";
vi.mock("./cadastros-api", () => ({ listarCadastrosProtocolos: vi.fn(), obterCadastroProtocolo: vi.fn(), obterAcoesCadastro: vi.fn() }));
vi.mock("./api", async original => ({ ...await original<typeof import("./api")>(), reqProtocolo: vi.fn() }));
vi.mock("../reproducao/api", () => ({ reqV4: vi.fn() }));
vi.mock("../sanidade/api", () => ({ reqSanidade: vi.fn() }));
vi.mock("../../../router", () => ({ navegarPara: vi.fn() }));
vi.mock("../../../estoque/SeletorProdutoCatalogo", () => ({
  SeletorProdutoCatalogo: ({ onChange, value, permitirCadastro, limpavel }: { onChange: (v: unknown) => void; value?: { nomeCompleto?: string; nome?: string } | null; permitirCadastro?: boolean; limpavel?: boolean }) =>
    <><span data-testid="cadastro-permitido">{String(permitirCadastro)}</span><span data-testid="seletor-limpavel">{String(limpavel)}</span><span>Seleção atual: {value?.nomeCompleto ?? value?.nome ?? "nenhuma"}</span><button onClick={() => onChange({ tipo: "catalogo", produtoCatalogoId: "c1", nomeCompleto: "Insumo de catálogo", unidadeSugerida: "ML", categoriaSugeridaId: "cat1" })}>Escolher item de catálogo</button></>,
}));
vi.mock("../../../estoque/api", () => ({ listarCategorias: async () => [{ id: "cat1", nome: "Medicamentos", ativo: true }] }));
const meta: CadastroProtocoloMeta = { id: "p1", nome: "Controle", tipo: "SANITARIO", finalidade: "SANITARIO", versao: 2, proximaVersao: 5, publicado: true, publicadoEm: "2026-10-01", ativo: true, utilizada: true, atualizadoEm: "2026-10-23T12:00:00Z", descricao: "Descrição da base", totalEtapas: 1 };
const pagina = <T,>(itens: T[], total = itens.length, atual = 1) => ({ itens, total, pagina: atual, porPagina: 10 });
const exame = { ordem: 1, diaRelativo: 0, tipo: "EXAME", produtoId: null, tipoExameId: "e1", tipoAplicacaoId: null, tipoAplicacaoNomeSnapshot: null, dose: null, unidade: null, momento: { nome: "D0", ordem: 1, modoAtendimento: "MANUAL" } };
beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState(null, "", "/configuracoes/pecuaria/sanidade/protocolos/novo");
  vi.mocked(listarCadastrosProtocolos).mockResolvedValue(pagina([meta]));
  vi.mocked(obterCadastroProtocolo).mockResolvedValue(meta);
  vi.mocked(obterAcoesCadastro).mockResolvedValue(pagina([exame]));
  vi.mocked(reqProtocolo).mockImplementation(async path => { const id = new URL(path, "https://local").searchParams.get("selecionadoId"); return pagina(id ? [{ id, nome: "Referência", unidade: "ML" }] : []); });
  vi.mocked(reqSanidade).mockResolvedValue({});
  vi.mocked(reqV4).mockResolvedValue({});
});
afterEach(cleanup);
async function iniciarZero(tipo: "SANITARIO" | "REPRODUTIVO" = "SANITARIO") {
  render(<PaginaCadastroProtocolo tipo={tipo} podeLancar />);
  fireEvent.click(screen.getByRole("button", { name: /Começar do zero/ }));
}
async function iniciarReproComAplicacao() {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo");
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  mudarCampo(screen.getByLabelText("Nome do protocolo"), {target:{value:"Modelo"}});
  mudarCampo(screen.getByLabelText("Finalidade"), {target:{value:"PRE_SINCRONIZACAO"}});
  fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"}));
  fireEvent.click(await screen.findByRole("button", {name:"Adicionar etapa"}));
  fireEvent.click(screen.getByRole("button", {name:"Ir para procedimentos"}));
  fireEvent.click(screen.getByRole("button", {name:"Concluir etapa"}));
  fireEvent.click(screen.getByRole("button", {name:/Editar Aplicação de produto/}));
}
it("herda o domínio da rota e lista bases em páginas de dez sem rascunho ou área", async () => {
  vi.mocked(listarCadastrosProtocolos).mockImplementation(async (_tipo, atual) => pagina(Array.from({ length: atual === 1 ? 10 : 1 }, (_, i) => ({ ...meta, id: `p-${atual}-${i}`, nome: `Modelo ${atual}-${i}` })), 11, atual));
  render(<PaginaCadastroProtocolo tipo="SANITARIO" podeLancar />);
  fireEvent.click(screen.getByRole("button", { name: /Usar protocolo como base/ }));
  await screen.findByText("Modelo 1-0");
  const bases = screen.getByRole("region", { name: "Escolha de protocolo-base, com rolagem horizontal" });
  expect(bases.tabIndex).toBe(0);
  expect(within(bases).getAllByRole("button", { name: /^Usar Modelo/ })).toHaveLength(10);
  expect(screen.queryByLabelText("Área do protocolo")).toBeNull();
  expect(screen.queryByText("Salvar rascunho")).toBeNull();
  expect(screen.queryByText("Publicar versão")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  await screen.findByText("Modelo 2-0");
  expect(screen.getAllByRole("button", { name: /^Usar Modelo/ })).toHaveLength(1);
  expect(listarCadastrosProtocolos).toHaveBeenLastCalledWith("SANITARIO", 2, "");
});
it("cria protocolo sanitário pronto em uma chamada e herda calendário ao adicionar procedimento", async () => {
  await iniciarZero();
  mudarCampo(screen.getByLabelText("Nome do protocolo"), { target: { value: "Retiradas" } });
  mudarCampo(screen.getByLabelText("Dia relativo ao início"), { target: { value: "9" } });
  mudarCampo(screen.getByLabelText("Tipo de procedimento"), { target: { value: "RETIRADA" } });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar procedimento" }));
  mudarCampo(screen.getAllByLabelText("Tipo de procedimento")[1], { target: { value: "RETIRADA" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar protocolo" }));
  await waitFor(() => expect(reqSanidade).toHaveBeenCalledTimes(1));
  const [path, init] = vi.mocked(reqSanidade).mock.calls[0];
  expect(path).toBe("/protocolos");
  expect(JSON.parse(String(init?.body))).toMatchObject({ nome: "Retiradas", finalidade: "SANITARIO", versao: 1, publicado: true, etapas: [{ tipo: "RETIRADA", diaRelativo: 9 }, { tipo: "RETIRADA", diaRelativo: 9 }] });
  expect(navegarPara).toHaveBeenCalledWith("/configuracoes/pecuaria/sanidade/protocolos");
});
it.each(["IA", "TE"] as const)("cria %s com material definido somente no atendimento e sem publicação separada", async tentativaTipo => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo");
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  mudarCampo(screen.getByLabelText("Nome do protocolo"), { target: { value: "Modelo genético" } });
  mudarCampo(screen.getByLabelText("Finalidade"), { target: { value: tentativaTipo === "IA" ? "IATF" : "TETF" } });
  mudarCampo(screen.getByLabelText("Tentativa"), {target:{value:"ETAPA"}});
  mudarCampo(screen.getByLabelText("Diagnóstico de gestação"), {target:{value:"EXTERNO"}});
  fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"}));
  fireEvent.click(await screen.findByRole("button", {name: tentativaTipo === "IA" ? /Editar Inseminação/ : /Editar Transferência de embrião/}));
  expect(screen.queryByRole("button", { name: /Selecionar Material/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", {name:"Voltar aos dados"}));
  mudarCampo(screen.getByLabelText("Dia da etapa"), {target:{value:"10.5"}});
  mudarCampo(screen.getByLabelText("Unidade do intervalo"), {target:{value:"HORAS"}});
  fireEvent.click(screen.getByRole("button", {name:"Ir para procedimentos"}));
  fireEvent.click(screen.getByRole("button", {name:"Concluir etapa"}));
  fireEvent.click(screen.getByRole("button", {name:"Ir para conferência"}));
  fireEvent.click(screen.getByRole("button", {name:"Salvar protocolo"}));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos", expect.objectContaining({ publicado: true, etapas: [expect.objectContaining({ tipo: "TENTATIVA", tentativaTipo, intervalo: 10.5, unidade: "HORAS" })] }), "POST", undefined));
});

it("usa proximaVersao do servidor e preserva o nome ao derivar, sem alterar a base", async () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/sanidade/protocolos/novo?base=p1&retorno=%2Fconfiguracoes%2Fpecuaria%2Fsanidade%2Fprotocolos%3FcadastroBusca%3DControle%26cadastroPagina%3D2");
  render(<PaginaCadastroProtocolo tipo="SANITARIO" podeLancar />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Salvar protocolo" })).toHaveProperty("disabled", false));
  expect(screen.getByLabelText("Nome do protocolo")).toHaveProperty("readOnly", true);
  expect(screen.getByLabelText("Versão")).toHaveProperty("value", "5");
  mudarCampo(screen.getByLabelText("Dia relativo ao início"), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar protocolo" }));
  await waitFor(() => expect(reqSanidade).toHaveBeenCalledTimes(1));
  expect(vi.mocked(reqSanidade).mock.calls[0][0]).toBe("/protocolos");
  expect(JSON.parse(String(vi.mocked(reqSanidade).mock.calls[0][1]?.body))).toMatchObject({ origemVersaoId: "p1", versao: 5, nome: "Controle", descricao: "Descrição da base", etapas: [{ diaRelativo: 3 }] });
  expect(meta.versao).toBe(2);
  expect(exame.diaRelativo).toBe(0);
  expect(navegarPara).toHaveBeenCalledWith("/configuracoes/pecuaria/sanidade/protocolos?cadastroBusca=Controle&cadastroPagina=2");
});
it("bloqueia gravação parcial e valida procedimentos fora da página visível", async () => {
  const origem = { ...meta, totalEtapas: 11 };
  vi.mocked(obterCadastroProtocolo).mockResolvedValue(origem);
  const itens = Array.from({ length: 11 }, (_, i) => ({ ...exame, ordem: i + 1, tipoExameId: i === 10 ? null : "e1" }));
  vi.mocked(obterAcoesCadastro).mockImplementation(async (_p, atual) => pagina(itens.slice((atual - 1) * 10, atual * 10), 11, atual));
  window.history.replaceState(null, "", "/configuracoes/pecuaria/sanidade/protocolos/novo?base=p1");
  render(<PaginaCadastroProtocolo tipo="SANITARIO" podeLancar />);
  await screen.findByText(/10 de 11 procedimentos carregados/);
  expect(screen.getByRole("button", { name: "Salvar protocolo" })).toHaveProperty("disabled", true);
  mudarCampo(screen.getByLabelText("Nome da etapa"), { target: { value: "Início" } });
  fireEvent.click(screen.getByRole("button", { name: "Carregar próximos 10 procedimentos" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Salvar protocolo" })).toHaveProperty("disabled", false));
  expect(screen.getAllByLabelText("Tipo de procedimento")).toHaveLength(10);
  fireEvent.click(screen.getByRole("button", { name: "Salvar protocolo" }));
  await screen.findByText(/Procedimento 11: confira/);
  expect(reqSanidade).not.toHaveBeenCalled();
  expect(screen.getAllByLabelText("Tipo de procedimento")).toHaveLength(1);
  expect(screen.getByLabelText("Nome da etapa")).toHaveProperty("value", "Início");
});
it("rejeita base de outro domínio e não expõe formulário ou escrita", async () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo?base=p1");
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  await screen.findByText(/Este protocolo pertence a outro cadastro/);
  expect(screen.queryByLabelText("Nome do protocolo")).toBeNull();
  expect(reqV4).not.toHaveBeenCalled();
});
it("preserva conteúdo após erro e bloqueia envio duplo", async () => {
  let rejeitar!: (erro: Error) => void;
  vi.mocked(reqSanidade).mockImplementation(() => new Promise((_resolve, reject) => { rejeitar = reject; }));
  await iniciarZero();
  mudarCampo(screen.getByLabelText("Nome do protocolo"), { target: { value: "Controle de campo" } });
  mudarCampo(screen.getByLabelText("Tipo de procedimento"), { target: { value: "RETIRADA" } });
  fireEvent.submit(document.getElementById("cadastro-protocolo")!);
  fireEvent.submit(document.getElementById("cadastro-protocolo")!);
  expect(reqSanidade).toHaveBeenCalledTimes(1);
  await act(async () => rejeitar(new Error("Falha de conexão")));
  await screen.findByText("Falha de conexão");
  expect(screen.getByLabelText("Nome do protocolo")).toHaveProperty("value", "Controle de campo");
  expect(navegarPara).not.toHaveBeenCalled();
});
it("sem permissão não consulta catálogo nem mostra formulário de escrita", () => {
  render(<PaginaCadastroProtocolo tipo="SANITARIO" podeLancar={false} />);
  expect(screen.getByRole("alert").textContent).toContain("permissão");
  expect(listarCadastrosProtocolos).not.toHaveBeenCalled();
});
it("trocar a origem exige confirmação e conserva o domínio", async () => {
  await iniciarZero();
  mudarCampo(screen.getByLabelText("Nome do protocolo"), { target: { value: "Minha edição" } });
  fireEvent.click(screen.getByRole("button", { name: "Trocar origem" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
  expect(screen.getByLabelText("Nome do protocolo")).toHaveProperty("value", "Minha edição");
});
it("edição legada conserva finalidade, material planejado e avaliação com exame padrão", async () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo?editar=p1");
  vi.mocked(obterCadastroProtocolo).mockResolvedValue({ ...meta, tipo: "REPRODUTIVO", finalidade: null, publicado: false, publicadoEm: null, utilizada: false, totalEtapas: 2 });
  const planoTentativa = { tipo: "IA", materialId: "material-legado", quantidade: 1 };
  const planoAvaliacao = { tipo: "DIAGNOSTICO" };
  vi.mocked(obterAcoesCadastro).mockResolvedValue(pagina([
    { nome: "Inseminação legada", tipo: "TENTATIVA", intervalo: 10, unidade: "DIAS", planoTentativa, ordem: 1 },
    { nome: "Avaliação legada", tipo: "AVALIACAO", intervalo: 40, unidade: "DIAS", planoAvaliacao, ordem: 2 },
  ]));
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  await screen.findByDisplayValue("Controle");
  await waitFor(() => { fireEvent.click(screen.getByRole("button", { name: "Ir para etapas" })); expect(screen.getByRole("button", { name: "Ir para conferência" })).toBeTruthy(); });
  fireEvent.click(screen.getByRole("button", { name: "Ir para conferência" }));
  fireEvent.click(screen.getByRole("button", { name: "Salvar protocolo" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos/p1", expect.objectContaining({ publicado: true, etapas: [expect.objectContaining({ planoTentativa }), expect.objectContaining({ planoAvaliacao })] }), "PATCH", undefined));
  expect(vi.mocked(reqV4).mock.calls[0][1]).not.toHaveProperty("finalidade");
});
it("edição sanitária legada mantém finalidade nula sem converter a mesma versão", async () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/sanidade/protocolos/novo?editar=p1");
  vi.mocked(obterCadastroProtocolo).mockResolvedValue({ ...meta, finalidade: null, publicado: false, publicadoEm: null, utilizada: false });
  render(<PaginaCadastroProtocolo tipo="SANITARIO" podeLancar />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Salvar protocolo" })).toHaveProperty("disabled", false));
  fireEvent.click(screen.getByRole("button", { name: "Salvar protocolo" }));
  await waitFor(() => expect(reqSanidade).toHaveBeenCalledTimes(1));
  const [path, init] = vi.mocked(reqSanidade).mock.calls[0];
  expect(path).toBe("/protocolos/p1");
  expect(JSON.parse(String(init?.body))).not.toHaveProperty("finalidade");
});

it("não envia uma etapa sem nome mesmo com a validação nativa desativada", async () => {
  await iniciarZero();
  mudarCampo(screen.getByLabelText("Nome do protocolo"), { target: { value: "Controle de campo" } });
  mudarCampo(screen.getByLabelText("Tipo de procedimento"), { target: { value: "RETIRADA" } });
  mudarCampo(screen.getByLabelText("Nome da etapa"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar protocolo" }));
  expect(await screen.findByText("Procedimento 1: informe o nome da etapa.")).toBeTruthy();
  expect(reqSanidade).not.toHaveBeenCalled();
});

it.each((["IATF", "TETF"] as const).flatMap(finalidade => (["ETAPA", "EXTERNA"] as const).flatMap(modalidadeTentativa => (["PROTOCOLO", "EXTERNO"] as const).map(modalidadeDiagnostico => ({finalidade,modalidadeTentativa,modalidadeDiagnostico})))))("preserva $finalidade com tentativa $modalidadeTentativa e DG $modalidadeDiagnostico independentes", async ({finalidade,modalidadeTentativa,modalidadeDiagnostico}) => {
  const acoes = [
    {nome:"Retirada",tipo:"RETIRADA",intervalo:7,unidade:"DIAS",ordem:1,momento:{nome:"Fim do preparo",ordem:1,modoAtendimento:"MANUAL"}},
    ...(modalidadeTentativa === "ETAPA" ? [{nome:"Tentativa",tipo:"TENTATIVA",tentativaTipo:finalidade === "IATF" ? "IA" : "TE",intervalo:9,unidade:"DIAS",ordem:2,momento:{nome:"Tentativa",ordem:2,modoAtendimento:"MANUAL"}}] : []),
    ...(modalidadeDiagnostico === "PROTOCOLO" ? [{nome:"Diagnóstico",tipo:"AVALIACAO",planoAvaliacao:{tipo:"DIAGNOSTICO",tipoExameId:"e1"},intervalo:40,unidade:"DIAS",ordem:3,momento:{nome:"Diagnóstico",ordem:3,modoAtendimento:"MANUAL"}}] : []),
  ];
  window.history.replaceState(null,"","/configuracoes/pecuaria/reproducao/protocolos/novo?base=p1");
  vi.mocked(obterCadastroProtocolo).mockResolvedValue({...meta,tipo:"REPRODUTIVO",finalidade,modalidadeTentativa,modalidadeDiagnostico,totalEtapas:acoes.length});
  vi.mocked(obterAcoesCadastro).mockResolvedValue(pagina(acoes));
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar/>);
  await screen.findByDisplayValue("Controle");
  if (modalidadeDiagnostico === "PROTOCOLO") mudarCampo(screen.getByLabelText("Dias após a tentativa"), {target:{value:"31"}});
  await waitFor(() => { fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"})); expect(screen.getByRole("button", {name:"Ir para conferência"})).toBeTruthy(); });
  fireEvent.click(screen.getByRole("button",{name:"Ir para conferência"}));
  fireEvent.click(screen.getByRole("button",{name:"Salvar protocolo"}));
  await waitFor(()=>expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos",expect.objectContaining({finalidade,modalidadeTentativa,modalidadeDiagnostico}),"POST",undefined));
});

it("cria IATF externo com preparo sem tentativa ou DG fictícios", async () => {
  await iniciarReproComAplicacao();
  mudarCampo(screen.getByLabelText("Tipo de procedimento"), {target:{value:"RETIRADA"}});
  fireEvent.click(screen.getByRole("button", {name:"Concluir etapa"}));
  fireEvent.click(screen.getByRole("button", {name:"Voltar"}));
  mudarCampo(screen.getByLabelText("Finalidade"), {target:{value:"IATF"}});
  mudarCampo(screen.getByLabelText("Tentativa"), {target:{value:"EXTERNA"}});
  mudarCampo(screen.getByLabelText("Diagnóstico de gestação"), {target:{value:"EXTERNO"}});
  fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"}));
  fireEvent.click(screen.getByRole("button", {name:"Ir para conferência"}));
  fireEvent.click(screen.getByRole("button", {name:"Salvar protocolo"}));
  await waitFor(()=>expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos",expect.objectContaining({finalidade:"IATF",modalidadeTentativa:"EXTERNA",modalidadeDiagnostico:"EXTERNO",etapas:[expect.objectContaining({tipo:"RETIRADA"})]}),"POST",undefined));
});


it("derivar uma base e mudar finalidade não duplica etapas nem recarrega ações", async () => {
  window.history.replaceState(null,"","/configuracoes/pecuaria/reproducao/protocolos/novo?base=p1");
  vi.mocked(obterCadastroProtocolo).mockResolvedValue({...meta,tipo:"REPRODUTIVO",finalidade:null,totalEtapas:3});
  vi.mocked(obterAcoesCadastro).mockResolvedValue(pagina([1,2,3].map(ordem=>({ordem,nome:`Procedimento ${ordem}`,tipo:"RETIRADA",intervalo:ordem,unidade:"DIAS"}))));
  render(<StrictMode><PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar/></StrictMode>);
  await screen.findByDisplayValue("Controle");
  mudarCampo(screen.getByLabelText("Finalidade"),{target:{value:"IATF"}});
  mudarCampo(screen.getByLabelText("Tentativa"),{target:{value:"EXTERNA"}});
  mudarCampo(screen.getByLabelText("Diagnóstico de gestação"),{target:{value:"EXTERNO"}});
  await waitFor(() => { fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"})); expect(screen.getAllByRole("button",{name:/Editar Procedimento .*ação legada/})).toHaveLength(3); });
  const cargas=vi.mocked(obterAcoesCadastro).mock.calls.length;
  fireEvent.click(screen.getByRole("button", {name:"Voltar"}));
  fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"}));
  expect(screen.getAllByRole("button",{name:/Editar Procedimento .*ação legada/})).toHaveLength(3);
  expect(obterAcoesCadastro).toHaveBeenCalledTimes(cargas);
});

it("herda e edita regras do modelo, valida prazo vazio e envia configuração sem alterar a base", async () => {
  const configuracao:NonNullable<CadastroProtocoloMeta["configuracaoAcompanhamento"]>={versao:2,efeito:"ALERTA",regras:[{finalidade:"DIAGNOSTICO",ocorrencia:1,publico:"IA",referencia:"IA",intervalo:20,unidade:"DIAS",antecedencia:1,tolerancia:2,resolucao:"DIAGNOSTICO_CONCLUSIVO"}]};
  window.history.replaceState(null,"","/configuracoes/pecuaria/reproducao/protocolos/novo?base=p1");
  vi.mocked(obterCadastroProtocolo).mockResolvedValue({...meta,tipo:"REPRODUTIVO",finalidade:"IATF",modalidadeTentativa:"EXTERNA",modalidadeDiagnostico:"EXTERNO",configuracaoAcompanhamento:configuracao});
  vi.mocked(obterAcoesCadastro).mockResolvedValue(pagina([{nome:"Retirada",tipo:"RETIRADA",intervalo:7,unidade:"DIAS",ordem:1,momento:{nome:"Fim do preparo",ordem:1,modoAtendimento:"MANUAL"}}]));
  vi.mocked(reqV4).mockImplementation(async(path)=>path.startsWith("/reproducao/tipos-exame")?[]:{});
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar/>);
  await screen.findByDisplayValue("Controle");
  const intervalo=await screen.findByLabelText("Intervalo (dias)");
  expect(intervalo).toHaveProperty("value","20");
  fireEvent.change(intervalo,{target:{value:""}});
  await waitFor(() => { fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"})); expect(screen.getByRole("button", {name:"Ir para conferência"})).toBeTruthy(); });
  fireEvent.click(screen.getByRole("button", {name:"Ir para conferência"}));
  fireEvent.click(screen.getByRole("button", {name:"Salvar protocolo"}));
  expect(await screen.findByText(/Informe intervalo, antecedência e tolerância/)).toBeTruthy();
  expect(vi.mocked(reqV4).mock.calls.some(([path])=>path==="/reproducao/protocolos")).toBe(false);
  fireEvent.click(screen.getByRole("button", {name:"Voltar"}));
  fireEvent.click(screen.getByRole("button", {name:"Voltar"}));
  fireEvent.change(screen.getByLabelText("Intervalo (dias)"),{target:{value:"23"}});
  fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"}));
  fireEvent.click(screen.getByRole("button", {name:"Ir para conferência"}));
  fireEvent.click(screen.getByRole("button", {name:"Salvar protocolo"}));
  await waitFor(()=>expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos",expect.objectContaining({configuracaoAcompanhamento:{...configuracao,regras:[{...configuracao.regras[0],intervalo:23}]}}),"POST",undefined));
  expect(configuracao.regras[0].intervalo).toBe(20);
});

it("abre o procedimento escolhido e cancelar restaura o rascunho da etapa", async () => {
  await iniciarReproComAplicacao();
  const dialogo = screen.getByRole("dialog", { name: /Editar etapa/ });
  expect(within(dialogo).getByRole("radio", { name: "Aplicação de produto" })).toHaveProperty("checked", true);
  mudarCampo(within(dialogo).getByLabelText("Tipo de procedimento"), { target: { value: "RETIRADA" } });
  fireEvent.click(within(dialogo).getByRole("button", {name:"Voltar aos dados"}));
  fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
  expect(screen.getByRole("button", { name: /Editar Aplicação de produto/ })).toBeTruthy();
});

it("preserva o item de catálogo ao digitar a dose no editor de manutenção", async () => {
  await iniciarReproComAplicacao();
  fireEvent.click(screen.getByRole("button", { name: "Ver catálogo" }));
  fireEvent.click(screen.getByRole("button", { name: "Escolher item de catálogo" }));
  fireEvent.change(screen.getByLabelText("Quantidade por animal"), { target: { value: "7" } });
  expect(screen.getByRole("combobox", { name: "Produto planejado" }).textContent).toContain("Insumo de catálogo");
  expect(screen.getByText(/Produto do catálogo · será adotado ao salvar/)).toBeTruthy();
  expect(screen.getByLabelText("Quantidade por animal")).toHaveProperty("value", "7");
  expect(screen.getByLabelText("Categoria do produto")).toHaveProperty("value", "cat1");
  fireEvent.click(screen.getByRole("button", { name: "Concluir etapa" }));
  expect(screen.getByText("7 mL")).toBeTruthy();
});

it("apresenta e foca o erro do servidor no campo da dose sem descartar o rascunho", async () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo?base=p1");
  vi.mocked(obterCadastroProtocolo).mockResolvedValue({ ...meta, tipo: "REPRODUTIVO", finalidade: "PRE_SINCRONIZACAO" });
  vi.mocked(obterAcoesCadastro).mockResolvedValue(pagina([{ ordem: 1, nome: "Aplicação", tipo: "APLICACAO", intervalo: 0, unidade: "DIAS", planoAplicacao: { produtoId: "p1", dose: "2", unidadeDose: "ML" }, momento: { nome: "Preparo", ordem: 1, modoAtendimento: "MANUAL" } }]));
  vi.mocked(reqV4).mockRejectedValue(new RebanhoApiError("Selecione a unidade efetiva do produto", 422, "VALIDACAO", "etapas.0.planoAplicacao.unidadeDose"));
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  await screen.findByDisplayValue("Controle");
  await waitFor(() => { fireEvent.click(screen.getByRole("button", { name: "Ir para etapas" })); expect(screen.getByRole("button", { name: "Ir para conferência" })).toBeTruthy(); });
  fireEvent.click(screen.getByRole("button", { name: "Ir para conferência" }));
  fireEvent.click(screen.getByRole("button", { name: "Salvar protocolo" }));
  const modal = await screen.findByRole("dialog", { name: "Editar etapa · Preparo" });
  expect(within(modal).getByRole("alert").textContent).toBe("Selecione a unidade efetiva do produto");
  const dose = within(modal).getByLabelText("Quantidade por animal");
  expect(dose).toHaveProperty("value", "2");
  expect(dose.getAttribute("aria-invalid")).toBe("true");
  await waitFor(() => expect(document.activeElement).toBe(dose));
});

it("começar novamente após trocar a origem invalida o snapshot da identificação antiga", async () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo?base=p1");
  vi.mocked(obterCadastroProtocolo).mockResolvedValue({ ...meta, nome: "Modelo antigo", tipo: "REPRODUTIVO", finalidade: "PRE_SINCRONIZACAO" });
  vi.mocked(obterAcoesCadastro).mockResolvedValue(pagina([{ nome: "Retirada", tipo: "RETIRADA", intervalo: 7, unidade: "DIAS", ordem: 1 }]));
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  await screen.findByDisplayValue("Modelo antigo");
  fireEvent.click(screen.getByRole("radio", {name:"Começar do zero"}));
  fireEvent.click(screen.getByRole("button", {name:"Trocar origem"}));
  expect(screen.getByLabelText("Nome do protocolo")).toHaveProperty("value", "");
  expect(screen.queryByText(/Modelo antigo/)).toBeNull();
});

it("sinaliza calendários distintos e apresenta o intervalo do procedimento ativo sem alterá-los", async () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo?base=p1");
  vi.mocked(obterCadastroProtocolo).mockResolvedValue({ ...meta, tipo: "REPRODUTIVO", finalidade: "PRE_SINCRONIZACAO", totalEtapas: 2 });
  const momento = { nome: "Preparo", ordem: 1, modoAtendimento: "MANUAL" };
  vi.mocked(obterAcoesCadastro).mockResolvedValue(pagina([
    { ordem: 1, nome: "Primeiro", tipo: "RETIRADA", intervalo: 3.75, unidade: "DIAS", momento },
    { ordem: 2, nome: "Segundo", tipo: "RETIRADA", intervalo: 12.5, unidade: "HORAS", momento },
  ]));
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  await screen.findByDisplayValue("Controle");
  await waitFor(() => { fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"})); expect(screen.getByText("Intervalos distintos")).toBeTruthy(); });
  fireEvent.click(screen.getByRole("button", { name: "Editar Segundo · Preparo" }));
  const modal = screen.getByRole("dialog", { name: "Editar etapa · Preparo" });
  fireEvent.click(within(modal).getByRole("button", {name:"Voltar aos dados"}));
  expect(within(modal).getByText(/intervalos individuais diferentes/)).toBeTruthy();
  fireEvent.click(within(modal).getByRole("button", {name:"Ir para procedimentos"}));
  fireEvent.click(within(modal).getByRole("button", { name: "Concluir etapa" }));
  fireEvent.click(screen.getByRole("button", {name:"Ir para conferência"}));
  fireEvent.click(screen.getByRole("button", { name: "Salvar protocolo" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos", expect.objectContaining({ etapas: [expect.objectContaining({ intervalo: 3.75, unidade: "DIAS" }), expect.objectContaining({ intervalo: 12.5, unidade: "HORAS" })] }), "POST", undefined));
});

it("mantém o produto de catálogo no controle, restaura ao cancelar e permite limpar com foco", async () => {
  await iniciarReproComAplicacao();
  let etapa = screen.getByRole("dialog", { name: /Editar etapa/ });
  const catalogo = within(etapa).getByRole("button", { name: "Ver catálogo" });
  catalogo.focus();
  fireEvent.click(catalogo);
  expect(screen.getByTestId("cadastro-permitido").textContent).toBe("false");
  expect(screen.getByTestId("seletor-limpavel").textContent).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: "Escolher item de catálogo" }));
  await waitFor(() => expect(document.activeElement).toBe(catalogo));
  expect(within(etapa).getByRole("combobox", { name: "Produto planejado" }).textContent).toContain("Insumo de catálogo");
  fireEvent.change(within(etapa).getByLabelText("Quantidade por animal"), { target: { value: "2.5" } });
  await waitFor(() => expect(within(etapa).getByLabelText("Categoria do produto")).toHaveProperty("value", "cat1"));
  fireEvent.click(within(etapa).getByRole("button", { name: "Concluir etapa" }));
  fireEvent.click(screen.getByRole("button", { name: /Editar Aplicação de produto/ }));
  etapa = screen.getByRole("dialog", { name: /Editar etapa/ });
  expect(within(etapa).getByRole("combobox", { name: "Produto planejado" }).textContent).toContain("Insumo de catálogo");
  expect(within(etapa).getByLabelText("Quantidade por animal")).toHaveProperty("value", "2.5");
  fireEvent.click(within(etapa).getByRole("button", { name: "Limpar Produto planejado" }));
  expect(document.activeElement).toBe(within(etapa).getByRole("combobox", { name: "Produto planejado" }));
  fireEvent.click(within(etapa).getByRole("button", {name:"Voltar aos dados"}));
  fireEvent.click(within(etapa).getByRole("button", { name: "Cancelar" }));
  fireEvent.click(screen.getByRole("button", { name: /Editar Aplicação de produto/ }));
  etapa = screen.getByRole("dialog", { name: /Editar etapa/ });
  expect(within(etapa).getByRole("combobox", { name: "Produto planejado" }).textContent).toContain("Insumo de catálogo");
  expect(within(etapa).getByLabelText("Quantidade por animal")).toHaveProperty("value", "2.5");
  expect(within(etapa).getByLabelText("Categoria do produto")).toHaveProperty("value", "cat1");
  within(etapa).getByRole("button", { name: "Ver catálogo" }).focus();
  fireEvent.click(within(etapa).getByRole("button", { name: "Ver catálogo" }));
  expect(screen.getByText("Seleção atual: Insumo de catálogo")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Escolher item de catálogo" }));
  await waitFor(() => expect(document.activeElement).toBe(within(etapa).getByRole("button", { name: "Ver catálogo" })));
  expect(within(etapa).getByLabelText("Quantidade por animal")).toHaveProperty("value", "2.5");
  expect(within(etapa).getByLabelText("Categoria do produto")).toHaveProperty("value", "cat1");
  vi.mocked(reqProtocolo).mockImplementation(async path => path.startsWith("/cadastros/opcoes?") ? pagina([{ id: "p2", nome: "Produto da fazenda", unidade: "L" }]) : {});
  fireEvent.click(within(etapa).getByRole("combobox", { name: "Produto planejado" }));
  fireEvent.click(await screen.findByRole("option", { name: "Produto da fazenda" }));
  expect(within(etapa).getByRole("combobox", { name: "Produto planejado" }).textContent).toContain("Produto da fazenda");
  expect(within(etapa).getByLabelText("Quantidade por animal")).toHaveProperty("value", "");
  expect(within(etapa).queryByLabelText("Categoria do produto")).toBeNull();
  fireEvent.click(within(etapa).getByRole("button", { name: "Ver catálogo" }));
  expect(within(screen.getByRole("dialog", { name: "Catálogo de produtos" })).getByText("Seleção atual: Produto da fazenda")).toBeTruthy();
});

it("resolve pelo ID o nome do produto da fazenda herdado da versão-base ao abrir o catálogo", async () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo?base=p1");
  vi.mocked(obterCadastroProtocolo).mockResolvedValue({ ...meta, tipo: "REPRODUTIVO", finalidade: "PRE_SINCRONIZACAO" });
  vi.mocked(obterAcoesCadastro).mockResolvedValue(pagina([{
    ordem: 1, nome: "Aplicação", tipo: "APLICACAO", intervalo: 0, unidade: "DIAS",
    planoAplicacao: { produtoId: "fazenda", dose: "3", unidadeDose: "ML" },
  }]));
  vi.mocked(reqProtocolo).mockImplementation(async path =>
    new URL(path, "https://local").searchParams.get("selecionadoId") === "fazenda"
      ? pagina([{ id: "fazenda", nome: "Produto da versão-base", unidade: "ML" }])
      : {});
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  await screen.findByDisplayValue("Controle");
  await waitFor(() => { fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"})); expect(screen.getByRole("button", { name: "Editar Aplicação · ação legada" })).toBeTruthy(); });
  fireEvent.click(screen.getByRole("button", { name: "Editar Aplicação · ação legada" }));
  const etapa = screen.getByRole("dialog", { name: "Editar etapa · Ação legada" });
  fireEvent.click(within(etapa).getByRole("button", { name: "Ver catálogo" }));
  const catalogo = screen.getByRole("dialog", { name: "Catálogo de produtos" });
  expect(await within(catalogo).findByText("Seleção atual: Produto da versão-base")).toBeTruthy();
  fireEvent.click(within(catalogo).getByRole("button", { name: "Concluir" }));
  expect(within(etapa).getByLabelText("Quantidade por animal")).toHaveProperty("value", "3");
});

it.each([["IATF", "Inseminação"], ["TETF", "Transferência de embrião"]] as const)("insere e protege a tentativa de %s sem duplicá-la ao voltar", async (finalidade, nomeAcao) => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo");
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  mudarCampo(screen.getByLabelText("Nome do protocolo"), { target: { value: "Modelo" } });
  mudarCampo(screen.getByLabelText("Finalidade"), { target: { value: finalidade } });
  mudarCampo(screen.getByLabelText("Tentativa"), { target: { value: "ETAPA" } });
  mudarCampo(screen.getByLabelText("Diagnóstico de gestação"), { target: { value: "EXTERNO" } });
  await waitFor(() => fireEvent.click(screen.getByRole("button", { name: "Ir para etapas" })));
  const editar = await screen.findByRole("button", { name: new RegExp(`Editar ${nomeAcao}`) });
  expect(screen.getAllByRole("button", { name: new RegExp(`Editar ${nomeAcao}`) })).toHaveLength(1);
  fireEvent.click(editar);
  expect(screen.getByRole("button", { name: `Remover ${nomeAcao}` })).toHaveProperty("disabled", true);
  fireEvent.click(screen.getByRole("button", { name: "Voltar aos dados" }));
  mudarCampo(screen.getByLabelText("Dia da etapa"), { target: { value: "10.5" } });
  mudarCampo(screen.getByLabelText("Unidade do intervalo"), { target: { value: "HORAS" } });
  fireEvent.click(screen.getByRole("button", { name: "Ir para procedimentos" }));
  fireEvent.click(screen.getByRole("button", { name: "Concluir etapa" }));
  fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
  fireEvent.click(screen.getByRole("button", { name: "Ir para etapas" }));
  expect(screen.getAllByRole("button", { name: new RegExp(`Editar ${nomeAcao}`) })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Ir para conferência" }));
  fireEvent.click(screen.getByRole("button", { name: "Salvar protocolo" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos", expect.objectContaining({ etapas: [expect.objectContaining({ tipo: "TENTATIVA", intervalo: 10.5, unidade: "HORAS" })] }), "POST", undefined));
});
it("exige prazo de DG e preserva ação dependente ao voltar à identificação", async () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo");
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  mudarCampo(screen.getByLabelText("Nome do protocolo"), {target:{value:"Modelo DG"}});
  mudarCampo(screen.getByLabelText("Finalidade"), {target:{value:"IATF"}});
  mudarCampo(screen.getByLabelText("Tentativa"), {target:{value:"EXTERNA"}});
  mudarCampo(screen.getByLabelText("Diagnóstico de gestação"), {target:{value:"PROTOCOLO"}});
  fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"}));
  expect(await screen.findByText(/Informe o prazo do diagnóstico/)).toBeTruthy();
  mudarCampo(screen.getByLabelText("Dias após a tentativa"), {target:{value:"31"}});
  fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"}));
  expect(await screen.findByRole("button", {name:/Editar Diagnóstico de gestação.*31 dias após a tentativa/})).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name:/Editar Diagnóstico de gestação/}));
  expect(screen.getByRole("button", {name:/Remover Diagnóstico de gestação/})).toHaveProperty("disabled", true);
  fireEvent.click(screen.getByRole("button", {name:"Voltar aos dados"}));
  fireEvent.click(screen.getByRole("button", {name:"Cancelar"}));
  fireEvent.click(screen.getByRole("button", {name:"Voltar"}));
  expect(screen.getByLabelText("Dias após a tentativa")).toHaveProperty("value", "31");
  fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"}));
  expect(screen.getAllByRole("button", {name:/Editar Diagnóstico de gestação/})).toHaveLength(1);
});
it("seleciona o modelo de exame da última ação DG obrigatória", async () => {
  const exameId = "00000000-0000-4000-8000-000000000001";
  vi.mocked(reqProtocolo).mockImplementation(async () => pagina([{id:exameId,nome:"Avaliação reprodutiva"}]));
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo");
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  mudarCampo(screen.getByLabelText("Nome do protocolo"), {target:{value:"Modelo DG"}});
  mudarCampo(screen.getByLabelText("Finalidade"), {target:{value:"IATF"}});
  mudarCampo(screen.getByLabelText("Tentativa"), {target:{value:"EXTERNA"}});
  mudarCampo(screen.getByLabelText("Diagnóstico de gestação"), {target:{value:"PROTOCOLO"}});
  mudarCampo(screen.getByLabelText("Dias após a tentativa"), {target:{value:"31"}});
  fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"}));
  fireEvent.click(await screen.findByRole("button", {name:/Editar Diagnóstico de gestação/}));
  expect(screen.getByLabelText("Avaliação planejada")).toHaveProperty("disabled", true);
  fireEvent.click(screen.getByRole("combobox", {name:"Tipo de exame reprodutivo"}));
  fireEvent.click(await screen.findByRole("option", {name:"Avaliação reprodutiva"}));
  await waitFor(() => expect(screen.getByRole("combobox", {name:"Tipo de exame reprodutivo"}).textContent).toContain("Avaliação reprodutiva"));
  fireEvent.click(screen.getByRole("button", {name:"Concluir etapa"}));
  fireEvent.click(screen.getByRole("button", {name:"Ir para conferência"}));
  expect(reqV4).not.toHaveBeenCalledWith("/reproducao/protocolos", expect.anything(), "POST", undefined);
  expect(screen.getByRole("button", {name:"Salvar protocolo"})).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name:"Salvar protocolo"}));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos", expect.objectContaining({etapas:[expect.objectContaining({referenciaPrazoDiagnostico:true,planoAvaliacao:{tipo:"DIAGNOSTICO",tipoExameId:exameId}})]}), "POST", undefined));
});
it("confirma mudança de modalidade antes de remover tentativa e conserva os demais procedimentos", async () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo?base=p1");
  vi.mocked(obterCadastroProtocolo).mockResolvedValue({...meta,tipo:"REPRODUTIVO",finalidade:"IATF",modalidadeTentativa:"ETAPA",modalidadeDiagnostico:"EXTERNO",totalEtapas:2});
  vi.mocked(obterAcoesCadastro).mockResolvedValue(pagina([{nome:"Retirada",tipo:"RETIRADA",intervalo:7,unidade:"DIAS",ordem:1,momento:{nome:"Preparo",ordem:1,modoAtendimento:"MANUAL"}},{nome:"IA",tipo:"TENTATIVA",tentativaTipo:"IA",intervalo:9,unidade:"DIAS",ordem:2,momento:{nome:"IA",ordem:2,modoAtendimento:"MANUAL"}}]));
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  await screen.findByDisplayValue("Controle");
  await waitFor(() => { fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"})); expect(screen.getByRole("button", {name:"Ir para conferência"})).toBeTruthy(); });
  fireEvent.click(screen.getByRole("button", {name:"Voltar"}));
  mudarCampo(screen.getByLabelText("Tentativa"), {target:{value:"EXTERNA"}});
  fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"}));
  let dialogo = screen.getByRole("dialog", {name:"Alterar procedimentos planejados?"});
  expect(within(dialogo).getByText(/IA/)).toBeTruthy();
  fireEvent.click(within(dialogo).getByRole("button", {name:"Cancelar"}));
  expect(screen.getByLabelText("Tentativa")).toHaveProperty("value", "ETAPA");
  mudarCampo(screen.getByLabelText("Tentativa"), {target:{value:"EXTERNA"}});
  fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"}));
  dialogo = screen.getByRole("dialog", {name:"Alterar procedimentos planejados?"});
  fireEvent.click(within(dialogo).getByRole("button", {name:"Remover e continuar"}));
  expect(screen.queryByRole("button", {name:/Editar IA/})).toBeNull();
  expect(screen.getByRole("button", {name:/Editar Retirada/})).toBeTruthy();
});

it("deriva o prazo da finalidade correta e protege o DG factual quando há DG opcional", async () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo?base=p1");
  const regra = (tipo: "IA" | "TE", intervalo: number) => ({
    finalidade: "DIAGNOSTICO", ocorrencia: 1, publico: tipo, referencia: tipo, intervalo, unidade: "DIAS",
    antecedencia: 0, tolerancia: 0, resolucao: "DIAGNOSTICO_CONCLUSIVO",
  }) as const;
  const regras = [regra("TE", 60), regra("IA", 30)];
  vi.mocked(obterCadastroProtocolo).mockResolvedValue({ ...meta, tipo: "REPRODUTIVO", finalidade: "IATF", modalidadeTentativa: "EXTERNA", modalidadeDiagnostico: "PROTOCOLO", totalEtapas: 2, configuracaoAcompanhamento: { versao: 2, efeito: "ALERTA", regras } });
  const dg = { tipo: "AVALIACAO", planoAvaliacao: { tipo: "DIAGNOSTICO", tipoExameId: "e1" }, intervalo: 30, unidade: "DIAS" };
  vi.mocked(obterAcoesCadastro).mockResolvedValue(pagina([
    { ...dg, id: "factual", nome: "DG factual", ordem: 1, referenciaPrazoDiagnostico: true, momento: { nome: "Principal", ordem: 1, modoAtendimento: "MANUAL" } },
    { ...dg, id: "opcional", nome: "DG opcional", ordem: 2, momento: { nome: "Apoio", ordem: 2, modoAtendimento: "MANUAL" } },
  ]));
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  expect(await screen.findByLabelText("Dias após a tentativa")).toHaveProperty("value", "30");
  await waitFor(() => { fireEvent.click(screen.getByRole("button", { name: "Ir para etapas" })); expect(screen.getByRole("button", { name: "Ir para conferência" })).toBeTruthy(); });
  fireEvent.click(screen.getByRole("button", { name: /Editar DG factual/ }));
  expect(screen.getByRole("button", { name: /Remover DG factual/ })).toHaveProperty("disabled", true);
  expect(screen.getByLabelText("Tipo de procedimento")).toHaveProperty("disabled", true);
  fireEvent.click(screen.getByRole("button", { name: "Voltar aos dados" }));
  expect(screen.getByRole("button", { name: "Remover etapa" })).toHaveProperty("disabled", true);
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  fireEvent.click(screen.getByRole("button", { name: /Editar DG opcional/ }));
  expect(screen.getByRole("button", { name: "Remover DG opcional" })).toHaveProperty("disabled", false);
  expect(screen.getByLabelText("Tipo de procedimento")).toHaveProperty("disabled", false);
  fireEvent.click(screen.getByRole("button", { name: "Concluir etapa" }));
  fireEvent.click(screen.getByRole("button", { name: "Ir para conferência" }));
  fireEvent.click(screen.getByRole("button", { name: "Salvar protocolo" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos", expect.objectContaining({
    configuracaoAcompanhamento: { versao: 2, efeito: "ALERTA", regras },
    etapas: [expect.objectContaining({ nome: "DG factual", referenciaPrazoDiagnostico: true }), expect.objectContaining({ nome: "DG opcional" })],
  }), "POST", undefined));
});

it("explicita a remoção das duas modalidades ao mudar um rascunho para preparo", async () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo?editar=p1");
  vi.mocked(obterCadastroProtocolo).mockResolvedValue({ ...meta, tipo: "REPRODUTIVO", finalidade: "IATF", modalidadeTentativa: "ETAPA", modalidadeDiagnostico: "EXTERNO", publicado: false, publicadoEm: null, utilizada: false, totalEtapas: 2 });
  vi.mocked(obterAcoesCadastro).mockResolvedValue(pagina([
    { nome: "Retirada", tipo: "RETIRADA", intervalo: 7, unidade: "DIAS", ordem: 1 },
    { nome: "IA", tipo: "TENTATIVA", tentativaTipo: "IA", intervalo: 9, unidade: "DIAS", ordem: 2 },
  ]));
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  await screen.findByDisplayValue("Controle");
  mudarCampo(screen.getByLabelText("Finalidade"), { target: { value: "PRE_SINCRONIZACAO" } });
  await waitFor(() => { fireEvent.click(screen.getByRole("button", { name: "Ir para etapas" })); expect(screen.getByRole("dialog", { name: "Alterar procedimentos planejados?" })).toBeTruthy(); });
  fireEvent.click(screen.getByRole("button", { name: "Remover e continuar" }));
  expect(screen.queryByRole("button", { name: /Editar IA/ })).toBeNull();
  expect(screen.getByRole("button", { name: /Editar Retirada/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Ir para conferência" }));
  expect(reqV4).not.toHaveBeenCalled();
  expect(screen.getByRole("heading", { name: "Conferência" })).toBeTruthy();
  expect(screen.getByText("Controle · v2")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Adicionar etapa" })).toBeNull();
  expect(screen.queryByRole("button", { name: /Editar Retirada/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Editar etapas" }));
  expect(screen.getAllByRole("button", { name: /Editar Retirada/ })).toHaveLength(1);
  expect(obterAcoesCadastro).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Ir para conferência" }));
  fireEvent.click(screen.getByRole("button", { name: "Salvar protocolo" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos/p1", expect.objectContaining({
    finalidade: "PRE_SINCRONIZACAO", modalidadeTentativa: null, modalidadeDiagnostico: null,
    etapas: [expect.objectContaining({ nome: "Retirada" })],
  }), "PATCH", undefined));
});

it("permite mudar nome e contexto do exame no modal e desfaz os dois ao cancelar", async () => {
  await iniciarReproComAplicacao();
  mudarCampo(screen.getByLabelText("Tipo de procedimento"), { target: { value: "EXAME" } });
  mudarCampo(screen.getByLabelText("Contexto do modelo de exame"), { target: { value: "SANITARIO" } });
  expect(screen.getByRole("combobox", { name: "Exame sanitário planejado" })).toBeTruthy();
  fireEvent.click(screen.getByText("Opções do procedimento"));
  mudarCampo(screen.getByLabelText("Nome do procedimento"), { target: { value: "Análise sanitária" } });
  fireEvent.click(screen.getByRole("button", { name: "Editar referência de serviço" }));
  const referencia = screen.getByRole("dialog", { name: "Referência de serviço" });
  fireEvent.click(within(referencia).getByLabelText("Informar referência explícita"));
  mudarCampo(within(referencia).getByLabelText("Valor unitário (R$)"), { target: { value: "18" } });
  fireEvent.click(within(referencia).getByRole("button", { name: "Concluir" }));
  fireEvent.click(screen.getByRole("button", { name: "Voltar aos dados" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.queryByText("Análise sanitária")).toBeNull();
  expect(screen.getByRole("button", { name: /Editar Aplicação de produto/ })).toBeTruthy();
});

it("grava a troca do exame do DG factual na regra compatível e conserva as outras", async () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo?base=p1");
  const exameAntigo = "00000000-0000-4000-8000-000000000001";
  const exameNovo = "00000000-0000-4000-8000-000000000002";
  const diagnostico = {
    finalidade: "DIAGNOSTICO", publico: "IA", referencia: "IA", ocorrencia: 1, unidade: "DIAS", intervalo: 30, antecedencia: 4, tolerancia: 3,
    resolucao: "DIAGNOSTICO_CONCLUSIVO", tipoExameId: exameAntigo,
  } as const;
  const outra = { ...diagnostico, publico: "TE", referencia: "TE", intervalo: 26, tipoExameVersao: 7 } as const;
  vi.mocked(obterCadastroProtocolo).mockResolvedValue({ ...meta, tipo: "REPRODUTIVO", finalidade: "IATF", modalidadeTentativa: "EXTERNA", modalidadeDiagnostico: "PROTOCOLO",
    configuracaoAcompanhamento: { versao: 2, efeito: "ALERTA", regras: [{ ...diagnostico, tipoExameVersao: 7 }, outra] } });
  vi.mocked(obterAcoesCadastro).mockResolvedValue(pagina([{ nome: "DG", tipo: "AVALIACAO", intervalo: 0, unidade: "DIAS", referenciaPrazoDiagnostico: true, planoAvaliacao: { tipo: "DIAGNOSTICO", tipoExameId: exameAntigo } }]));
  vi.mocked(reqProtocolo).mockResolvedValue(pagina([{ id: exameAntigo, nome: "Exame original" }, { id: exameNovo, nome: "Exame atualizado" }]));
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  await screen.findByDisplayValue("Controle");
  await waitFor(() => { fireEvent.click(screen.getByRole("button", { name: "Ir para etapas" })); expect(screen.getByRole("button", { name: "Ir para conferência" })).toBeTruthy(); });
  async function trocarExame() {
    fireEvent.click(screen.getByRole("button", { name: /Editar DG/ }));
    fireEvent.click(screen.getByRole("combobox", { name: "Tipo de exame reprodutivo" }));
    fireEvent.click(await screen.findByRole("option", { name: "Exame atualizado" }));
  }
  await trocarExame();
  fireEvent.click(screen.getByRole("button", { name: "Voltar aos dados" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(await within(screen.getByRole("table")).findByText("Exame original")).toBeTruthy();
  await trocarExame();
  fireEvent.click(screen.getByRole("button", { name: "Concluir etapa" }));
  fireEvent.click(screen.getByRole("button", { name: "Ir para conferência" }));
  fireEvent.click(screen.getByRole("button", { name: "Salvar protocolo" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos", expect.objectContaining({
    configuracaoAcompanhamento: { versao: 2, efeito: "ALERTA", regras: [{ ...diagnostico, tipoExameId: exameNovo }, outra] },
    etapas: [expect.objectContaining({ referenciaPrazoDiagnostico: true, planoAvaliacao: { tipo: "DIAGNOSTICO", tipoExameId: exameNovo } })],
  }), "POST", undefined));
});
