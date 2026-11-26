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
it("ordena as etapas pelo dia ao adicionar, editar e conferir o protocolo", async () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo");
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  mudarCampo(screen.getByLabelText("Nome do protocolo"), { target: { value: "Preparo" } });
  mudarCampo(screen.getByLabelText("Finalidade"), { target: { value: "PRE_SINCRONIZACAO" } });
  fireEvent.click(screen.getByRole("button", { name: "Ir para etapas" }));

  for (const dia of ["2", "0"]) {
    fireEvent.click(await screen.findByRole("button", { name: "Adicionar etapa" }));
    mudarCampo(screen.getByLabelText("Dia da etapa"), { target: { value: dia } });
    fireEvent.click(screen.getByRole("button", { name: "Ir para procedimentos" }));
    mudarCampo(screen.getByLabelText("Tipo de procedimento"), { target: { value: "RETIRADA" } });
    fireEvent.click(screen.getByRole("button", { name: "Concluir etapa" }));
  }

  const etapas = () => within(screen.getByRole("region", { name: "Quadro de procedimentos" }))
    .getAllByRole("rowheader").map(celula => celula.textContent);
  expect(etapas()).toEqual(["D0Etapa 2", "D2Etapa 1"]);

  fireEvent.click(screen.getByRole("button", { name: "Editar dados da etapa Etapa 2" }));
  mudarCampo(screen.getByLabelText("Dia da etapa"), { target: { value: "10" } });
  fireEvent.click(screen.getByRole("button", { name: "Ir para procedimentos" }));
  fireEvent.click(screen.getByRole("button", { name: "Concluir etapa" }));
  expect(etapas()).toEqual(["D2Etapa 1", "D10Etapa 2"]);

  fireEvent.click(screen.getByRole("button", { name: "Ir para conferência" }));
  expect(screen.getByRole("button", { name: "Salvar protocolo" })).toBeTruthy();
  expect(etapas()).toEqual(["D2Etapa 1", "D10Etapa 2"]);
});

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
  const { container } = render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  mudarCampo(screen.getByLabelText("Nome do protocolo"), { target: { value: "Modelo genético" } });
  mudarCampo(screen.getByLabelText("Finalidade"), { target: { value: tentativaTipo === "IA" ? "IATF" : "TETF" } });
  mudarCampo(screen.getByLabelText("Tentativa"), {target:{value:"ETAPA"}});
  fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"}));
  const avancar = await screen.findByRole("button", { name: "Ir para conferência" });
  fireEvent.click(avancar);
  const nomeEtapa = tentativaTipo === "IA" ? "Inseminação" : "Transferência de embrião";
  const dia = await screen.findByLabelText("Dia da etapa");
  await waitFor(() => expect(document.activeElement).toBe(dia));
  expect(container.querySelector("footer [role=alert]")?.textContent).toBe(`Defina o dia da etapa “${nomeEtapa}”.`);
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  fireEvent.click(avancar);
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Dia da etapa")));
  expect(screen.queryByRole("button", { name: /Selecionar Material/ })).toBeNull();
  expect(screen.queryByLabelText("Unidade do intervalo")).toBeNull();
  expect(screen.queryByText("Orientação temporal desta etapa")).toBeNull();
  expect(screen.getByLabelText("Instruções gerais")).toHaveProperty("required", false);
  mudarCampo(screen.getByLabelText("Dia da etapa"), {target:{value:"9"}});
  expect(container.querySelector("footer [role=alert]")).toBeNull();
  fireEvent.click(screen.getByRole("button", {name:"Ir para procedimentos"}));
  fireEvent.click(screen.getByRole("button", {name:"Concluir etapa"}));
  fireEvent.click(screen.getByRole("button", {name:"Ir para conferência"}));
  fireEvent.click(screen.getByRole("button", {name:"Salvar protocolo"}));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos", expect.objectContaining({ publicado: true, etapas: [expect.objectContaining({ tipo: "TENTATIVA", tentativaTipo, intervalo: 9, unidade: "DIAS" })] }), "POST", undefined));
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
  fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"}));
  fireEvent.click(screen.getByRole("button", {name:"Ir para conferência"}));
  fireEvent.click(screen.getByRole("button", {name:"Salvar protocolo"}));
  await waitFor(()=>expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos",expect.objectContaining({finalidade:"IATF",modalidadeTentativa:"EXTERNA",modalidadeDiagnostico:"EXTERNO",etapas:[expect.objectContaining({nome:"Retirada de dispositivo",tipo:"RETIRADA"})]}),"POST",undefined));
});


it("derivar uma base e mudar finalidade não duplica etapas nem recarrega ações", async () => {
  window.history.replaceState(null,"","/configuracoes/pecuaria/reproducao/protocolos/novo?base=p1");
  vi.mocked(obterCadastroProtocolo).mockResolvedValue({...meta,tipo:"REPRODUTIVO",finalidade:null,totalEtapas:3});
  vi.mocked(obterAcoesCadastro).mockResolvedValue(pagina([1,2,3].map(ordem=>({ordem,nome:`Procedimento ${ordem}`,tipo:"RETIRADA",intervalo:ordem,unidade:"DIAS"}))));
  render(<StrictMode><PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar/></StrictMode>);
  await screen.findByDisplayValue("Controle");
  mudarCampo(screen.getByLabelText("Finalidade"),{target:{value:"IATF"}});
  mudarCampo(screen.getByLabelText("Tentativa"),{target:{value:"EXTERNA"}});
  await waitFor(() => { fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"})); expect(screen.getAllByRole("button",{name:/Editar Procedimento .*ação legada/})).toHaveLength(3); });
  const cargas=vi.mocked(obterAcoesCadastro).mock.calls.length;
  fireEvent.click(screen.getByRole("button", {name:"Voltar"}));
  fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"}));
  expect(screen.getAllByRole("button",{name:/Editar Procedimento .*ação legada/})).toHaveLength(3);
  expect(obterAcoesCadastro).toHaveBeenCalledTimes(cargas);
});

it("preserva regras avançadas da base sem expor edição no formulário simples", async () => {
  const configuracao:NonNullable<CadastroProtocoloMeta["configuracaoAcompanhamento"]>={versao:2,efeito:"ALERTA",regras:[{finalidade:"DIAGNOSTICO",ocorrencia:1,publico:"IA",referencia:"IA",intervalo:20,unidade:"DIAS",antecedencia:1,tolerancia:2,resolucao:"DIAGNOSTICO_CONCLUSIVO"}]};
  window.history.replaceState(null,"","/configuracoes/pecuaria/reproducao/protocolos/novo?base=p1");
  vi.mocked(obterCadastroProtocolo).mockResolvedValue({...meta,tipo:"REPRODUTIVO",finalidade:"IATF",modalidadeTentativa:"EXTERNA",modalidadeDiagnostico:"EXTERNO",configuracaoAcompanhamento:configuracao});
  vi.mocked(obterAcoesCadastro).mockResolvedValue(pagina([{nome:"Retirada",tipo:"RETIRADA",intervalo:7,unidade:"DIAS",ordem:1,momento:{nome:"Fim do preparo",ordem:1,modoAtendimento:"MANUAL"}}]));
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar/>);
  await screen.findByDisplayValue("Controle");
  expect(screen.queryByLabelText("Intervalo (dias)")).toBeNull();
  await waitFor(() => { fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"})); expect(screen.getByRole("button", {name:"Ir para conferência"})).toBeTruthy(); });
  fireEvent.click(screen.getByRole("button", {name:"Ir para conferência"}));
  fireEvent.click(screen.getByRole("button", {name:"Salvar protocolo"}));
  await waitFor(()=>expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos",expect.objectContaining({configuracaoAcompanhamento:configuracao}),"POST",undefined));
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
  const orientacaoTemporal = { versao: 1, referencia: "INICIO_EFETIVO", intervaloHoras: 12.5, toleranciaAntesMinutos: 15, toleranciaDepoisMinutos: 15, efeito: "ALERTA" };
  vi.mocked(obterAcoesCadastro).mockResolvedValue(pagina([
    { ordem: 1, nome: "Primeiro", tipo: "RETIRADA", intervalo: 3.75, unidade: "DIAS", momento },
    { ordem: 2, nome: "Segundo", tipo: "RETIRADA", intervalo: 12.5, unidade: "HORAS", momento, orientacaoTemporal },
  ]));
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  await screen.findByDisplayValue("Controle");
  await waitFor(() => { fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"})); expect(screen.getByText("Intervalos distintos")).toBeTruthy(); });
  fireEvent.click(screen.getByRole("button", { name: "Editar Segundo · Preparo" }));
  const modal = screen.getByRole("dialog", { name: "Editar etapa · Preparo" });
  fireEvent.click(within(modal).getByRole("button", {name:"Voltar aos dados"}));
  expect(within(modal).getByText(/intervalos individuais diferentes/)).toBeTruthy();
  expect(within(modal).getByLabelText("Dia da etapa")).toHaveProperty("value", "3.75");
  expect(within(modal).getByLabelText("Intervalo em horas")).toHaveProperty("value", "12.5");
  fireEvent.click(within(modal).getByRole("button", {name:"Ir para procedimentos"}));
  fireEvent.click(within(modal).getByRole("button", { name: "Concluir etapa" }));
  fireEvent.click(screen.getByRole("button", {name:"Ir para conferência"}));
  fireEvent.click(screen.getByRole("button", { name: "Salvar protocolo" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos", expect.objectContaining({ etapas: [expect.objectContaining({ intervalo: 3.75, unidade: "DIAS" }), expect.objectContaining({ intervalo: 12.5, unidade: "HORAS", orientacaoTemporal })] }), "POST", undefined));
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
  await waitFor(() => fireEvent.click(screen.getByRole("button", { name: "Ir para etapas" })));
  const editar = await screen.findByRole("button", { name: new RegExp(`Editar ${nomeAcao}`) });
  expect(screen.getAllByRole("button", { name: new RegExp(`Editar ${nomeAcao}`) })).toHaveLength(1);
  fireEvent.click(editar);
  expect(screen.getByLabelText("Nome do procedimento")).toBeTruthy();
  expect(screen.queryByLabelText("Dia da etapa")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Concluir etapa" }));
  fireEvent.click(screen.getByRole("button", { name: `Editar dados da etapa ${nomeAcao}` }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Dia da etapa")));
  mudarCampo(screen.getByLabelText("Dia da etapa"), { target: { value: "10.5" } });
  fireEvent.click(screen.getByRole("button", { name: "Ir para procedimentos" }));
  expect(screen.getByRole("button", { name: `Remover ${nomeAcao}` })).toHaveProperty("disabled", true);
  fireEvent.click(screen.getByRole("button", { name: "Concluir etapa" }));
  fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
  fireEvent.click(screen.getByRole("button", { name: "Ir para etapas" }));
  expect(screen.getAllByRole("button", { name: new RegExp(`Editar ${nomeAcao}`) })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Ir para conferência" }));
  fireEvent.click(screen.getByRole("button", { name: "Salvar protocolo" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos", expect.objectContaining({ etapas: [expect.objectContaining({ tipo: "TENTATIVA", intervalo: 10.5, unidade: "DIAS" })] }), "POST", undefined));
});
it("exige prazo de DG e preserva ação dependente ao voltar à identificação", async () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo");
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  mudarCampo(screen.getByLabelText("Nome do protocolo"), {target:{value:"Modelo DG"}});
  mudarCampo(screen.getByLabelText("Finalidade"), {target:{value:"IATF"}});
  mudarCampo(screen.getByLabelText("Tentativa"), {target:{value:"EXTERNA"}});
  fireEvent.click(screen.getByRole("switch", { name: "DG" }));
  fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"}));
  expect(await screen.findByText("Preencha este campo.")).toBeTruthy();
  mudarCampo(screen.getByLabelText("Dias após a tentativa"), {target:{value:"31"}});
  fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"}));
  const ajuda = await screen.findByRole("button", {name:"Como alterar Diagnóstico de gestação"});
  const quadro = screen.getByRole("table");
  expect(within(quadro).getByText("31 dias após a tentativa")).toBeTruthy();
  expect(within(ajuda.closest("tr")!).getByText("—")).toBeTruthy();
  expect(within(quadro).queryByRole("button", {name:/Editar Diagnóstico de gestação/})).toBeNull();
  fireEvent.click(ajuda);
  expect(await screen.findByText("Para alterar este acompanhamento, volte à Identificação.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name:"Voltar"}));
  expect(screen.getByLabelText("Dias após a tentativa")).toHaveProperty("value", "31");
  fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"}));
  expect(screen.getAllByRole("button", {name:"Como alterar Diagnóstico de gestação"})).toHaveLength(1);
});
it.each([[true, false], [false, true], [true, true]] as const)("salva acompanhamentos independentes DG=%s reconfirmação=%s com avaliação padrão", async (dg, reconfirmacao) => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo");
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  mudarCampo(screen.getByLabelText("Nome do protocolo"), {target:{value:"Modelo acompanhamento"}});
  mudarCampo(screen.getByLabelText("Finalidade"), {target:{value:"IATF"}});
  expect(screen.getByRole("switch", { name: "DG" })).toHaveProperty("checked", false);
  expect(screen.getByRole("switch", { name: "Incluir reconfirmação" })).toHaveProperty("checked", false);
  if (dg) { fireEvent.click(screen.getByRole("switch", { name: "DG" })); mudarCampo(screen.getByLabelText("Dias após a tentativa"), {target:{value:"31"}}); }
  if (reconfirmacao) { fireEvent.click(screen.getByRole("switch", { name: "Incluir reconfirmação" })); mudarCampo(screen.getByLabelText("Dias após o primeiro DG positivo"), {target:{value:"20"}}); }
  const acompanhamento = within(screen.getByRole("group", { name: "Encerramento e acompanhamento" }));
  expect(acompanhamento.queryByText(/Exame padrão|Avaliação reprodutiva/)).toBeNull();
  expect(!!acompanhamento.queryByLabelText("Dias após a tentativa")).toBe(dg);
  expect(!!acompanhamento.queryByLabelText("Dias após o primeiro DG positivo")).toBe(reconfirmacao);
  expect(!!screen.queryByText("31 dias corridos após a tentativa registrada")).toBe(dg);
  expect(!!screen.queryByText("20 dias corridos após o primeiro DG positivo")).toBe(reconfirmacao);
  fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"}));
  if (reconfirmacao) {
    const ajuda = screen.getByRole("button", { name: "Como alterar Reconfirmação" });
    expect(within(ajuda.closest("tr")!).getByText("—")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Editar Reconfirmação/ })).toBeNull();
  }
  fireEvent.click(screen.getByRole("button", {name:"Ir para conferência"}));
  fireEvent.click(screen.getByRole("button", {name:"Salvar protocolo"}));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos", expect.anything(), "POST", undefined));
  const payload = vi.mocked(reqV4).mock.calls.find(c => c[0] === "/reproducao/protocolos")![1] as { configuracaoAcompanhamento: { regras: Array<{finalidade:string;publico:string;intervalo:number}> }; etapas: Array<{referenciaPrazoDiagnostico?:boolean;referenciaPrazoReconfirmacao?:boolean}> };
  expect(payload.configuracaoAcompanhamento.regras.filter(r => r.finalidade === "DIAGNOSTICO").map(r => r.publico)).toEqual(dg ? ["IA", "TE", "COBERTURA"] : []);
  expect(payload.configuracaoAcompanhamento.regras.filter(r => r.finalidade === "RECONFIRMACAO")).toHaveLength(reconfirmacao ? 1 : 0);
  expect(payload.etapas.some(e => e.referenciaPrazoDiagnostico)).toBe(dg);
  expect(payload.etapas.some(e => e.referenciaPrazoReconfirmacao)).toBe(reconfirmacao);
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
  expect(screen.getByRole("button", { name: "Como alterar DG factual" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Editar DG factual/ })).toBeNull();
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
  const campoNome = screen.getByLabelText("Nome do procedimento");
  expect(campoNome).toHaveProperty("required", false);
  expect(campoNome).toHaveProperty("value", "");
  mudarCampo(campoNome, { target: { value: "Análise sanitária" } });
  mudarCampo(screen.getByLabelText("Tipo de procedimento"), { target: { value: "EXAME" } });
  mudarCampo(screen.getByLabelText("Contexto do modelo de exame"), { target: { value: "SANITARIO" } });
  expect(screen.getByRole("combobox", { name: "Exame sanitário planejado" })).toBeTruthy();
  expect(screen.getByLabelText("Nome do procedimento")).toHaveProperty("value", "Análise sanitária");
  expect(screen.queryByText("Opções do procedimento")).toBeNull();
  expect(screen.queryByRole("button", { name: "Editar referência de serviço" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Voltar aos dados" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.queryByText("Análise sanitária")).toBeNull();
  expect(screen.getByRole("button", { name: /Editar Aplicação de produto/ })).toBeTruthy();
});

it("preserva exame e regras de DG herdado sem oferecer troca no builder simples", async () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo?base=p1");
  const exame = "00000000-0000-4000-8000-000000000001";
  const regra = { finalidade:"DIAGNOSTICO", publico:"IA", referencia:"IA", ocorrencia:1, unidade:"DIAS", intervalo:30, antecedencia:4, tolerancia:3, resolucao:"DIAGNOSTICO_CONCLUSIVO", tipoExameId:exame } as const;
  const configuracao: NonNullable<CadastroProtocoloMeta["configuracaoAcompanhamento"]> = { versao:2, efeito:"ALERTA", regras:[regra] };
  vi.mocked(obterCadastroProtocolo).mockResolvedValue({...meta,tipo:"REPRODUTIVO",finalidade:"IATF",modalidadeTentativa:"EXTERNA",modalidadeDiagnostico:"PROTOCOLO",configuracaoAcompanhamento:configuracao});
  vi.mocked(obterAcoesCadastro).mockResolvedValue(pagina([{nome:"DG",tipo:"AVALIACAO",intervalo:0,unidade:"DIAS",referenciaPrazoDiagnostico:true,planoAvaliacao:{tipo:"DIAGNOSTICO",tipoExameId:exame}}]));
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  await screen.findByDisplayValue("Controle");
  await waitFor(() => { fireEvent.click(screen.getByRole("button",{name:"Ir para etapas"})); expect(screen.getByRole("button",{name:"Ir para conferência"})).toBeTruthy(); });
  expect(screen.getByRole("button",{name:"Como alterar DG"})).toBeTruthy();
  expect(screen.queryByRole("button",{name:/Editar DG/})).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Ir para conferência"}));
  fireEvent.click(screen.getByRole("button",{name:"Salvar protocolo"}));
  await waitFor(()=>expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos",expect.objectContaining({configuracaoAcompanhamento:configuracao,etapas:[expect.objectContaining({planoAvaliacao:{tipo:"DIAGNOSTICO",tipoExameId:exame}})]}),"POST",undefined));
});
it("permite cobertura interna com ambos acompanhamentos desligados e preserva a ordem de encerramento", async () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo");
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  mudarCampo(screen.getByLabelText("Nome do protocolo"), {target:{value:"Cobertura"}});
  mudarCampo(screen.getByLabelText("Finalidade"), {target:{value:"IATF"}});
  mudarCampo(screen.getByLabelText("Tentativa"), {target:{value:"ETAPA"}});
  mudarCampo(screen.getByLabelText("Tipo de tentativa"), {target:{value:"COBERTURA"}});
  fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"}));
  fireEvent.click(await screen.findByRole("button", {name:"Editar dados da etapa Cobertura observada"}));
  mudarCampo(screen.getByLabelText("Dia da etapa"), {target:{value:"10"}});
  fireEvent.click(screen.getByRole("button", {name:"Ir para procedimentos"}));
  fireEvent.click(screen.getByRole("button", {name:"Concluir etapa"}));
  fireEvent.click(screen.getByRole("button", {name:"Adicionar etapa"}));
  fireEvent.click(screen.getByRole("button", {name:"Ir para procedimentos"}));
  mudarCampo(screen.getByLabelText("Tipo de procedimento"), {target:{value:"RETIRADA"}});
  fireEvent.click(screen.getByRole("button", {name:"Concluir etapa"}));
  fireEvent.click(screen.getByRole("button", {name:"Ir para conferência"}));
  fireEvent.click(screen.getByRole("button", {name:"Salvar protocolo"}));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos", expect.objectContaining({ encerramentoGuiado:true, configuracaoAcompanhamento:null, etapas:[expect.objectContaining({tipo:"RETIRADA"}), expect.objectContaining({tipo:"TENTATIVA", tentativaTipo:"COBERTURA"})] }), "POST", undefined));
});
it("deriva DG de data fixa sem convertê-lo nem reordenar etapas legadas inalteradas", async () => {
  window.history.replaceState(null,"","/configuracoes/pecuaria/reproducao/protocolos/novo?base=p1");
  vi.mocked(obterCadastroProtocolo).mockResolvedValue({...meta,tipo:"REPRODUTIVO",finalidade:"IATF",modalidadeTentativa:"EXTERNA",modalidadeDiagnostico:"PROTOCOLO",configuracaoAcompanhamento:null,totalEtapas:2});
  vi.mocked(obterAcoesCadastro).mockResolvedValue(pagina([
    {nome:"DG fixo",tipo:"AVALIACAO",intervalo:30,unidade:"DIAS",ordem:1,planoAvaliacao:{tipo:"DIAGNOSTICO",tipoExameId:"exame-legado"},momento:{nome:"DG",ordem:1,modoAtendimento:"MANUAL"}},
    {nome:"Retirada",tipo:"RETIRADA",intervalo:7,unidade:"DIAS",ordem:2,momento:{nome:"Preparo",ordem:2,modoAtendimento:"MANUAL"}},
  ]));
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  await screen.findByDisplayValue("Controle");
  await waitFor(() => { fireEvent.click(screen.getByRole("button", {name:"Ir para etapas"})); expect(screen.getByRole("button", {name:"Ir para conferência"})).toBeTruthy(); });
  fireEvent.click(screen.getByRole("button", {name:"Ir para conferência"}));
  fireEvent.click(screen.getByRole("button", {name:"Salvar protocolo"}));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos",expect.objectContaining({configuracaoAcompanhamento:null,etapas:[expect.objectContaining({nome:"DG fixo",intervalo:30,momento:expect.objectContaining({ordem:1})}),expect.objectContaining({nome:"Retirada",momento:expect.objectContaining({ordem:2})})]}),"POST",undefined));
  const carga = vi.mocked(reqV4).mock.calls.find(c => c[0] === "/reproducao/protocolos")![1] as {encerramentoGuiado?:boolean;etapas:Array<{referenciaPrazoDiagnostico?:boolean}>};
  expect(carga.encerramentoGuiado).toBe(true);
  expect(carga.etapas[0].referenciaPrazoDiagnostico).toBeUndefined();
});
it("ao mudar para preparo remove reconfirmação guiada e sua regra após confirmação", async () => {
  window.history.replaceState(null,"","/configuracoes/pecuaria/reproducao/protocolos/novo?base=p1");
  const regra = {finalidade:"RECONFIRMACAO",publico:"GESTACAO",referencia:"PRIMEIRO_DG_POSITIVO",ocorrencia:1,unidade:"DIAS",intervalo:20,antecedencia:0,tolerancia:0,resolucao:"RECONFIRMACAO_CONCLUSIVA"} as const;
  vi.mocked(obterCadastroProtocolo).mockResolvedValue({...meta,tipo:"REPRODUTIVO",finalidade:"IATF",modalidadeTentativa:"EXTERNA",modalidadeDiagnostico:"EXTERNO",configuracaoAcompanhamento:{versao:2,efeito:"ALERTA",regras:[regra]},totalEtapas:2});
  vi.mocked(obterAcoesCadastro).mockResolvedValue(pagina([
    {nome:"Retirada",tipo:"RETIRADA",intervalo:7,unidade:"DIAS",ordem:1,momento:{nome:"Preparo",ordem:1,modoAtendimento:"MANUAL"}},
    {nome:"Reconfirmação",tipo:"AVALIACAO",intervalo:0,unidade:"DIAS",ordem:2,referenciaPrazoReconfirmacao:true,planoAvaliacao:{tipo:"RECONFIRMACAO"},momento:{nome:"Reconfirmação",ordem:2,modoAtendimento:"MANUAL"}},
  ]));
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  await screen.findByDisplayValue("Controle");
  await waitFor(() => expect(screen.getByRole("switch", { name: "Incluir reconfirmação" })).toHaveProperty("checked", true));
  mudarCampo(screen.getByLabelText("Finalidade"),{target:{value:"PRE_SINCRONIZACAO"}});
  fireEvent.click(screen.getByRole("button",{name:"Ir para etapas"}));
  fireEvent.click(screen.getByRole("button",{name:"Remover e continuar"}));
  fireEvent.click(screen.getByRole("button",{name:"Ir para conferência"}));
  fireEvent.click(screen.getByRole("button",{name:"Salvar protocolo"}));
  await waitFor(()=>expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos",expect.objectContaining({finalidade:"PRE_SINCRONIZACAO",configuracaoAcompanhamento:null,etapas:[expect.objectContaining({tipo:"RETIRADA"})]}),"POST",undefined));
});
it("não cria regras ocultas ao escolher preparo antes de concluir a identificação", async () => {
  window.history.replaceState(null,"","/configuracoes/pecuaria/reproducao/protocolos/novo");
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  mudarCampo(screen.getByLabelText("Nome do protocolo"),{target:{value:"Preparo"}});
  mudarCampo(screen.getByLabelText("Finalidade"),{target:{value:"IATF"}});
  fireEvent.click(screen.getByRole("switch", { name: "DG" }));
  fireEvent.click(screen.getByRole("switch", { name: "Incluir reconfirmação" }));
  mudarCampo(screen.getByLabelText("Finalidade"),{target:{value:"PRE_SINCRONIZACAO"}});
  fireEvent.click(screen.getByRole("button",{name:"Ir para etapas"}));
  fireEvent.click(screen.getByRole("button",{name:"Adicionar etapa"}));
  fireEvent.click(screen.getByRole("button",{name:"Ir para procedimentos"}));
  mudarCampo(screen.getByLabelText("Tipo de procedimento"),{target:{value:"RETIRADA"}});
  fireEvent.click(screen.getByRole("button",{name:"Concluir etapa"}));
  fireEvent.click(screen.getByRole("button",{name:"Ir para conferência"}));
  fireEvent.click(screen.getByRole("button",{name:"Salvar protocolo"}));
  await waitFor(()=>expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos",expect.objectContaining({finalidade:"PRE_SINCRONIZACAO",configuracaoAcompanhamento:null,etapas:[expect.objectContaining({tipo:"RETIRADA"})]}),"POST",undefined));
});

it("focaliza o primeiro campo inválido em cada tentativa e preserva erro até corrigi-lo", async () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo");
  const rolar = vi.fn();
  const anterior = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = rolar;
  try {
    render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
    const avancar = screen.getByRole("button", { name: "Ir para etapas" });
    fireEvent.click(screen.getByRole("radio", { name: "Usar protocolo como base" }));
    fireEvent.click(avancar);
    const base = screen.getByLabelText("Protocolo-base");
    expect(document.activeElement).toBe(base);
    expect(base.getAttribute("aria-describedby")).toBe("erro-cadastro-base");
    fireEvent.click(screen.getByRole("radio", { name: "Começar do zero" }));
    fireEvent.click(avancar);
    const nome = screen.getByLabelText("Nome do protocolo");
    expect(document.activeElement).toBe(nome);
    expect(nome.getAttribute("aria-invalid")).toBe("true");
    mudarCampo(screen.getByLabelText("Descrição"), { target: { value: "Detalhe" } });
    expect(nome.getAttribute("aria-invalid")).toBe("true");
    avancar.focus();
    fireEvent.click(avancar);
    expect(document.activeElement).toBe(nome);
    expect(rolar).toHaveBeenCalledTimes(3);
    mudarCampo(nome, { target: { value: "Modelo" } });
    expect(nome.hasAttribute("aria-invalid")).toBe(false);
    fireEvent.click(avancar);
    const finalidade = screen.getByLabelText("Finalidade");
    expect(document.activeElement).toBe(finalidade);
    expect(finalidade.getAttribute("aria-describedby")).toBe("erro-cadastro-finalidade");
    mudarCampo(finalidade, { target: { value: "IATF" } });
    expect(finalidade.hasAttribute("aria-invalid")).toBe(false);
  } finally { HTMLElement.prototype.scrollIntoView = anterior; }
});

it("limpa erros dos prazos ao corrigir ou desligar cada opção", () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo");
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  mudarCampo(screen.getByLabelText("Nome do protocolo"), { target: { value: "Modelo" } });
  mudarCampo(screen.getByLabelText("Finalidade"), { target: { value: "IATF" } });
  fireEvent.click(screen.getByRole("switch", { name: "DG" }));
  fireEvent.click(screen.getByRole("switch", { name: "Incluir reconfirmação" }));
  fireEvent.click(screen.getByRole("button", { name: "Ir para etapas" }));
  const dg = screen.getByLabelText("Dias após a tentativa");
  expect(document.activeElement).toBe(dg);
  mudarCampo(dg, { target: { value: "30" } });
  expect(dg.hasAttribute("aria-invalid")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Ir para etapas" }));
  const reconfirmacao = screen.getByLabelText("Dias após o primeiro DG positivo");
  expect(document.activeElement).toBe(reconfirmacao);
  mudarCampo(reconfirmacao, { target: { value: "1001" } });
  expect(reconfirmacao.getAttribute("aria-invalid")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Ir para etapas" }));
  expect(document.activeElement).toBe(reconfirmacao);
  expect(reconfirmacao.getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByText("Use dias inteiros de 1 a 1.000.")).toBeTruthy();
  fireEvent.click(screen.getByRole("switch", { name: "Incluir reconfirmação" }));
  expect(screen.queryByText("Use dias inteiros de 1 a 1.000.")).toBeNull();
  fireEvent.click(screen.getByRole("switch", { name: "Incluir reconfirmação" }));
  expect(screen.getByLabelText("Dias após o primeiro DG positivo").hasAttribute("aria-invalid")).toBe(false);
});

it("ao trocar IA por cobertura exige prazo próprio e preserva a regra herdada de IA", async () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo?base=p1");
  const regraIa = { finalidade: "DIAGNOSTICO", ocorrencia: 1, publico: "IA", referencia: "IA", intervalo: 30, unidade: "DIAS", antecedencia: 4, tolerancia: 2, resolucao: "DIAGNOSTICO_CONCLUSIVO" } as const;
  vi.mocked(obterCadastroProtocolo).mockResolvedValue({ ...meta, tipo: "REPRODUTIVO", finalidade: "IATF", modalidadeTentativa: "ETAPA", modalidadeDiagnostico: "PROTOCOLO", configuracaoAcompanhamento: { versao: 2, efeito: "ALERTA", regras: [regraIa] }, totalEtapas: 2 });
  vi.mocked(obterAcoesCadastro).mockResolvedValue(pagina([
    { nome: "IA", tipo: "TENTATIVA", tentativaTipo: "IA", intervalo: 9, unidade: "DIAS", ordem: 1, momento: { nome: "IA", ordem: 1, modoAtendimento: "MANUAL" } },
    { nome: "DG", tipo: "AVALIACAO", planoAvaliacao: { tipo: "DIAGNOSTICO" }, referenciaPrazoDiagnostico: true, intervalo: 30, unidade: "DIAS", ordem: 2, momento: { nome: "DG", ordem: 2, modoAtendimento: "MANUAL" } },
  ]));
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  await screen.findByDisplayValue("Controle");
  await waitFor(() => expect(obterAcoesCadastro).toHaveBeenCalled());
  mudarCampo(screen.getByLabelText("Tipo de tentativa"), { target: { value: "COBERTURA" } });
  expect(screen.getByLabelText("Dias após a tentativa")).toHaveProperty("value", "");
  fireEvent.click(screen.getByRole("button", { name: "Ir para etapas" }));
  expect(screen.getByText("Preencha este campo.")).toBeTruthy();
  mudarCampo(screen.getByLabelText("Dias após a tentativa"), { target: { value: "35" } });
  fireEvent.click(screen.getByRole("button", { name: "Ir para etapas" }));
  fireEvent.click(screen.getByRole("button", { name: "Remover e continuar" }));
  fireEvent.click(screen.getByRole("button", { name: "Ir para conferência" }));
  mudarCampo(await screen.findByLabelText("Dia da etapa"), { target: { value: "9" } });
  fireEvent.click(screen.getByRole("button", { name: "Ir para procedimentos" }));
  fireEvent.click(screen.getByRole("button", { name: "Concluir etapa" }));
  fireEvent.click(screen.getByRole("button", { name: "Ir para conferência" }));
  fireEvent.click(screen.getByRole("button", { name: "Salvar protocolo" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos", expect.objectContaining({ encerramentoGuiado: true, configuracaoAcompanhamento: expect.objectContaining({ regras: expect.arrayContaining([regraIa, expect.objectContaining({ publico: "COBERTURA", intervalo: 35 })]) }) }), "POST", undefined));
});

it("bloqueia tentativa anterior à retirada e orienta revisão do calendário", async () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo?base=p1");
  vi.mocked(obterCadastroProtocolo).mockResolvedValue({ ...meta, tipo: "REPRODUTIVO", finalidade: "IATF", modalidadeTentativa: "ETAPA", modalidadeDiagnostico: "EXTERNO", totalEtapas: 2 });
  vi.mocked(obterAcoesCadastro).mockResolvedValue(pagina([
    { nome: "Retirada", tipo: "RETIRADA", intervalo: 12, unidade: "DIAS", ordem: 1, momento: { nome: "Retirada", ordem: 1, modoAtendimento: "MANUAL" } },
    { nome: "IA", tipo: "TENTATIVA", tentativaTipo: "IA", intervalo: 9, unidade: "DIAS", ordem: 2, momento: { nome: "IA", ordem: 2, modoAtendimento: "MANUAL" } },
  ]));
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  await screen.findByDisplayValue("Controle");
  await waitFor(() => { fireEvent.click(screen.getByRole("button", { name: "Ir para etapas" })); expect(screen.getByRole("button", { name: "Ir para conferência" })).toBeTruthy(); });
  fireEvent.click(screen.getByRole("button", { name: "Ir para conferência" }));
  expect(screen.getByText(/tentativa deve encerrar o calendário/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Salvar protocolo" })).toBeNull();
  const dia = await screen.findByLabelText("Dia da etapa");
  await waitFor(() => expect(document.activeElement).toBe(dia));
  mudarCampo(dia, { target: { value: "9" } });
  fireEvent.click(screen.getByRole("button", { name: "Ir para procedimentos" }));
  fireEvent.click(screen.getByRole("button", { name: "Concluir etapa" }));
  fireEvent.click(screen.getByRole("button", { name: "Ir para conferência" }));
  fireEvent.click(screen.getByRole("button", { name: "Salvar protocolo" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos", expect.objectContaining({ encerramentoGuiado: true, etapas: [expect.objectContaining({ tipo: "RETIRADA", intervalo: 9 }), expect.objectContaining({ tipo: "TENTATIVA", intervalo: 9 })] }), "POST", undefined));
});

it("ordena tentativa antes de DG e reconfirmação relativos na derivação", async () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo?base=p1");
  const dg = { finalidade: "DIAGNOSTICO", ocorrencia: 1, publico: "IA", referencia: "IA", intervalo: 30, unidade: "DIAS", antecedencia: 0, tolerancia: 0, resolucao: "DIAGNOSTICO_CONCLUSIVO" } as const;
  const reconf = { finalidade: "RECONFIRMACAO", ocorrencia: 1, publico: "GESTACAO", referencia: "PRIMEIRO_DG_POSITIVO", intervalo: 20, unidade: "DIAS", antecedencia: 0, tolerancia: 0, resolucao: "RECONFIRMACAO_CONCLUSIVA" } as const;
  vi.mocked(obterCadastroProtocolo).mockResolvedValue({ ...meta, tipo: "REPRODUTIVO", finalidade: "IATF", modalidadeTentativa: "ETAPA", modalidadeDiagnostico: "PROTOCOLO", configuracaoAcompanhamento: { versao: 2, efeito: "ALERTA", regras: [dg, reconf] }, totalEtapas: 3 });
  vi.mocked(obterAcoesCadastro).mockResolvedValue(pagina([
    { nome: "IA", tipo: "TENTATIVA", tentativaTipo: "IA", intervalo: 9, unidade: "DIAS", ordem: 1, momento: { nome: "IA", ordem: 1, modoAtendimento: "MANUAL" } },
    { nome: "DG", tipo: "AVALIACAO", planoAvaliacao: { tipo: "DIAGNOSTICO" }, referenciaPrazoDiagnostico: true, intervalo: 0, unidade: "DIAS", ordem: 2, momento: { nome: "DG", ordem: 2, modoAtendimento: "MANUAL" } },
    { nome: "Reconfirmação", tipo: "AVALIACAO", planoAvaliacao: { tipo: "RECONFIRMACAO" }, referenciaPrazoReconfirmacao: true, intervalo: 0, unidade: "DIAS", ordem: 3, momento: { nome: "Reconfirmação", ordem: 3, modoAtendimento: "MANUAL" } },
  ]));
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  await screen.findByDisplayValue("Controle");
  await waitFor(() => { fireEvent.click(screen.getByRole("button", { name: "Ir para etapas" })); expect(screen.getByRole("button", { name: "Ir para conferência" })).toBeTruthy(); });
  fireEvent.click(screen.getByRole("button", { name: "Ir para conferência" }));
  fireEvent.click(screen.getByRole("button", { name: "Salvar protocolo" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos", expect.objectContaining({ encerramentoGuiado: true, etapas: [expect.objectContaining({ tipo: "TENTATIVA" }), expect.objectContaining({ referenciaPrazoDiagnostico: true }), expect.objectContaining({ referenciaPrazoReconfirmacao: true })] }), "POST", undefined));
});
