// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PaginaCadastroProtocolo } from "./PaginaCadastroProtocolo";
import { listarCadastrosProtocolos, obterCadastroProtocolo, obterAcoesCadastro, type CadastroProtocoloMeta } from "./cadastros-api";
import { reqProtocolo } from "./api";
import { reqV4 } from "../reproducao/api";
import { reqSanidade } from "../sanidade/api";
import { navegarPara } from "../../../router";
vi.mock("./cadastros-api", () => ({ listarCadastrosProtocolos: vi.fn(), obterCadastroProtocolo: vi.fn(), obterAcoesCadastro: vi.fn() }));
vi.mock("./api", async original => ({ ...await original<typeof import("./api")>(), reqProtocolo: vi.fn() }));
vi.mock("../reproducao/api", () => ({ reqV4: vi.fn() }));
vi.mock("../sanidade/api", () => ({ reqSanidade: vi.fn() }));
vi.mock("../../../router", () => ({ navegarPara: vi.fn() }));
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
  fireEvent.click(screen.getByRole("radio", { name: /Começar do zero/ }));
  fireEvent.click(screen.getByRole("button", { name: "Definir novo protocolo" }));
}
it("herda o domínio da rota e lista bases em páginas de dez sem rascunho ou área", async () => {
  vi.mocked(listarCadastrosProtocolos).mockImplementation(async (_tipo, atual) => pagina(Array.from({ length: atual === 1 ? 10 : 1 }, (_, i) => ({ ...meta, id: `p-${atual}-${i}`, nome: `Modelo ${atual}-${i}` })), 11, atual));
  render(<PaginaCadastroProtocolo tipo="SANITARIO" podeLancar />);
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
  fireEvent.change(screen.getByLabelText("Nome do protocolo"), { target: { value: "Retiradas" } });
  fireEvent.change(screen.getByLabelText("Dia relativo ao início"), { target: { value: "9" } });
  fireEvent.change(screen.getByLabelText("Tipo de procedimento"), { target: { value: "RETIRADA" } });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar procedimento" }));
  fireEvent.change(screen.getAllByLabelText("Tipo de procedimento")[1], { target: { value: "RETIRADA" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar protocolo" }));
  await waitFor(() => expect(reqSanidade).toHaveBeenCalledTimes(1));
  const [path, init] = vi.mocked(reqSanidade).mock.calls[0];
  expect(path).toBe("/protocolos");
  expect(JSON.parse(String(init?.body))).toMatchObject({ nome: "Retiradas", finalidade: "SANITARIO", versao: 1, publicado: true, etapas: [{ tipo: "RETIRADA", diaRelativo: 9 }, { tipo: "RETIRADA", diaRelativo: 9 }] });
  expect(navegarPara).toHaveBeenCalledWith("/configuracoes/pecuaria/sanidade/protocolos");
});
it.each(["IA", "TE"] as const)("cria %s com material definido somente no atendimento e sem publicação separada", async tentativaTipo => {
  await iniciarZero("REPRODUTIVO");
  fireEvent.change(screen.getByLabelText("Nome do protocolo"), { target: { value: "Modelo genético" } });
  fireEvent.change(screen.getByLabelText("Finalidade da versão"), { target: { value: tentativaTipo === "IA" ? "IATF" : "TETF" } });
  fireEvent.change(screen.getByLabelText("Intervalo desde o início"), { target: { value: "10.5" } });
  fireEvent.change(screen.getByLabelText("Unidade do intervalo"), { target: { value: "HORAS" } });
  fireEvent.change(screen.getByLabelText("Tipo de procedimento"), { target: { value: tentativaTipo } });
  expect(screen.queryByRole("button", { name: /Selecionar Material/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Salvar protocolo" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos", expect.objectContaining({ publicado: true, etapas: [expect.objectContaining({ tipo: "TENTATIVA", tentativaTipo, intervalo: 10.5, unidade: "HORAS" })] }), "POST", undefined));
});
it("usa proximaVersao do servidor e preserva o nome ao derivar, sem alterar a base", async () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/sanidade/protocolos/novo?base=p1&retorno=%2Fconfiguracoes%2Fpecuaria%2Fsanidade%2Fprotocolos%3FcadastroBusca%3DControle%26cadastroPagina%3D2");
  render(<PaginaCadastroProtocolo tipo="SANITARIO" podeLancar />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Salvar protocolo" })).toHaveProperty("disabled", false));
  expect(screen.getByLabelText("Nome do protocolo")).toHaveProperty("readOnly", true);
  expect(screen.getByLabelText("Versão")).toHaveProperty("value", "5");
  fireEvent.change(screen.getByLabelText("Dia relativo ao início"), { target: { value: "3" } });
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
  fireEvent.change(screen.getByLabelText("Nome da etapa"), { target: { value: "Início" } });
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
  fireEvent.change(screen.getByLabelText("Nome do protocolo"), { target: { value: "Controle de campo" } });
  fireEvent.change(screen.getByLabelText("Tipo de procedimento"), { target: { value: "RETIRADA" } });
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
  fireEvent.change(screen.getByLabelText("Nome do protocolo"), { target: { value: "Minha edição" } });
  fireEvent.click(screen.getByRole("button", { name: "Trocar origem" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
  expect(screen.getByLabelText("Nome do protocolo")).toHaveProperty("value", "Minha edição");
});
it("edição de reprodução legada conserva finalidade nula e material planejado no mesmo ID", async () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo?editar=p1");
  vi.mocked(obterCadastroProtocolo).mockResolvedValue({ ...meta, tipo: "REPRODUTIVO", finalidade: null, publicado: false, publicadoEm: null, utilizada: false });
  const planoTentativa = { tipo: "IA", materialId: "material-legado", quantidade: 1 };
  vi.mocked(obterAcoesCadastro).mockResolvedValue(pagina([{ nome: "Inseminação legada", tipo: "TENTATIVA", intervalo: 10, unidade: "DIAS", planoTentativa, ordem: 1 }]));
  render(<PaginaCadastroProtocolo tipo="REPRODUTIVO" podeLancar />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Salvar protocolo" })).toHaveProperty("disabled", false));
  fireEvent.click(screen.getByRole("button", { name: "Salvar protocolo" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/protocolos/p1", expect.objectContaining({ publicado: true, etapas: [expect.objectContaining({ planoTentativa })] }), "PATCH", undefined));
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
  fireEvent.change(screen.getByLabelText("Nome do protocolo"), { target: { value: "Controle de campo" } });
  fireEvent.change(screen.getByLabelText("Tipo de procedimento"), { target: { value: "RETIRADA" } });
  fireEvent.change(screen.getByLabelText("Nome da etapa"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar protocolo" }));
  expect(await screen.findByText("Procedimento 1: informe o nome da etapa.")).toBeTruthy();
  expect(reqSanidade).not.toHaveBeenCalled();
});
