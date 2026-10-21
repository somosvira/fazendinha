// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { reqProtocolo } from "../protocolos/api";
import { ProtocolosCadastro } from "./ProtocolosCadastro";
import { listarTiposAplicacao, reqSanidade } from "./api";
import { listarProdutos } from "../../../estoque/api";
import { listarCadastrosProtocolos, obterCadastroProtocolo, obterAcoesCadastro, type CadastroProtocoloMeta } from "../protocolos/cadastros-api";
vi.mock("./api", () => ({ listarTiposAplicacao: vi.fn(), reqSanidade: vi.fn() }));
vi.mock("../../../estoque/api", () => ({ listarProdutos: vi.fn() }));
vi.mock("../protocolos/cadastros-api", () => ({ listarCadastrosProtocolos: vi.fn(), obterCadastroProtocolo: vi.fn(), obterAcoesCadastro: vi.fn() }));
vi.mock("../protocolos/api", async original=>({...await original<typeof import("../protocolos/api")>(),reqProtocolo:vi.fn()}));
const protocolo: CadastroProtocoloMeta = { id: "p1", nome: "Controle CCS", tipo: "SANITARIO", descricao: null, ativo: true, versao: 1, publicado: false, publicadoEm: null, atualizadoEm: "2026-10-21T12:00:00.000Z", utilizada: false, totalEtapas: 1 };
const etapa = { ordem: 1, diaRelativo: 0, tipo: "EXAME", tipoExameId: "e1", produtoId: null, tipoAplicacaoId: null, tipoAplicacaoNomeSnapshot: null, dose: null, unidade: null };
const pagina = <T,>(itens: T[], total = itens.length, atual = 1) => ({ itens, total, pagina: atual, porPagina: 10 });
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(reqProtocolo).mockImplementation(async path => { const id=new URL(path,"https://local").searchParams.get("selecionadoId"); return pagina(id ? [{id,nome:id === "e1" ? "CCS" : id === "p1" ? "Produto" : "Hormônio",unidade:"ML"}] : []); });
  vi.mocked(listarProdutos).mockResolvedValue([]);
  vi.mocked(listarTiposAplicacao).mockResolvedValue([]);
  vi.mocked(listarCadastrosProtocolos).mockResolvedValue(pagina([protocolo]));
  vi.mocked(obterCadastroProtocolo).mockResolvedValue(protocolo);
  vi.mocked(obterAcoesCadastro).mockResolvedValue(pagina([etapa]));
  vi.mocked(reqSanidade).mockImplementation(async (_path, init) => init ? protocolo as never : [{ id: "e1", nome: "CCS", ativo: true, tipoResultado: "NUMERO", unidade: null, opcoes: null }] as never);
});
afterEach(cleanup);
it("lista metadados e busca ações só quando o detalhe é aberto", async () => {
  render(<ProtocolosCadastro podeLancar={false} />);
  await screen.findByText("Controle CCS");
  expect(obterAcoesCadastro).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Novo protocolo" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Ver etapas/ }));
  expect((await screen.findByText("CCS")).parentElement?.textContent).toContain("Exame · CCS");
  expect(screen.getByText("Etapa legada sem momento")).toBeTruthy();
  expect(obterAcoesCadastro).toHaveBeenCalledWith(protocolo, 1);
});
it("consulta o catálogo apenas ao editar ou abrir referência e mantém a lista disponível se falhar", async () => {
  vi.mocked(reqProtocolo).mockRejectedValue(new Error("Catálogo indisponível"));
  render(<ProtocolosCadastro podeLancar />);
  await screen.findByText("Controle CCS");
  expect(reqProtocolo).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Novo protocolo" })).toHaveProperty("disabled", false);
  fireEvent.click(screen.getByRole("button", { name: /Ver etapas/ }));
  expect(await screen.findByText("Referência indisponível")).toBeTruthy();
  expect(await screen.findByText("Etapa 1 · Dia 0")).toBeTruthy();
});
it("publica e inativa pelos contratos existentes, reconsultando a lista paginada", async () => {
  render(<ProtocolosCadastro podeLancar />);
  fireEvent.click(await screen.findByRole("button", { name: "Publicar Controle CCS v1" }));
  await screen.findByText("Versão publicada.");
  expect(reqSanidade).toHaveBeenCalledWith("/protocolos/p1/publicacao", expect.objectContaining({ method: "POST" }));
  fireEvent.click(screen.getByRole("button", { name: "Inativar Controle CCS v1" }));
  await screen.findByText("Versão inativada.");
  expect(listarCadastrosProtocolos).toHaveBeenCalledTimes(3);
});
it("deriva versão publicada usando POST após carregar suas ações", async () => {
  const publicada = { ...protocolo, publicado: true, publicadoEm: "2026-10-06" };
  vi.mocked(listarCadastrosProtocolos).mockResolvedValue(pagina([publicada]));
  vi.mocked(obterCadastroProtocolo).mockResolvedValue(publicada);
  render(<ProtocolosCadastro podeLancar />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Nova versão de Controle CCS v1" })).toHaveProperty("disabled", false));
  fireEvent.click(screen.getByRole("button", { name: "Nova versão de Controle CCS v1" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Salvar rascunho" })).toHaveProperty("disabled", false));
  fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
  await waitFor(() => expect(reqSanidade).toHaveBeenCalledWith("/protocolos", expect.objectContaining({ method: "POST" })));
});
it("edita duas ações D0 preservando momento explícito e subtipo", async () => {
  const etapas = ["INSERCAO_DISPOSITIVO", "APLICACAO"].map((subtipo, i) => ({ ...etapa, ordem: i + 1, tipo: "APLICACAO", produtoId: "p1", tipoAplicacaoId: "t1", dose: "1", unidade: "ML", momento: { nome: "D0", ordem: 1 }, configuracao: { subtipo } }));
  vi.mocked(obterCadastroProtocolo).mockResolvedValue({ ...protocolo, totalEtapas: 2 });
  vi.mocked(obterAcoesCadastro).mockResolvedValue(pagina(etapas));
  vi.mocked(listarProdutos).mockResolvedValue([{ id: "p1", nome: "Produto", unidade: "ML" }] as never);
  vi.mocked(listarTiposAplicacao).mockResolvedValue([{ id: "t1", nome: "Hormônio", ativo: true }] as never);
  render(<ProtocolosCadastro podeLancar />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Editar rascunho de Controle CCS v1" })).toHaveProperty("disabled", false));
  fireEvent.click(screen.getByRole("button", { name: "Editar rascunho de Controle CCS v1" }));
  await screen.findAllByLabelText("Nome do momento");
  fireEvent.change(screen.getAllByLabelText("Nome do momento")[0], { target: { value: "Início D0" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
  await waitFor(() => expect(reqSanidade).toHaveBeenCalledWith("/protocolos/p1", expect.objectContaining({ method: "PATCH" })));
  const escrita = vi.mocked(reqSanidade).mock.calls.find(([path]) => path === "/protocolos/p1")!;
  expect(JSON.parse(escrita[1]!.body as string).etapas).toMatchObject([
    { momento: { nome: "Início D0", ordem: 1 }, subtipo: "INSERCAO_DISPOSITIVO" },
    { momento: { nome: "Início D0", ordem: 1 }, subtipo: "APLICACAO" },
  ]);
});
it("bloqueia salvar até carregar11 ações, preserva edição da primeira e envia todas em ordem", async () => {
  const etapas = Array.from({ length: 11 }, (_, i) => ({ ...etapa, ordem: i * 2 + 1, diaRelativo: i, momento: { nome: "D0", ordem: 1 } }));
  vi.mocked(obterCadastroProtocolo).mockResolvedValue({ ...protocolo, totalEtapas: 11 });
  vi.mocked(obterAcoesCadastro).mockImplementation(async (_p, atual) => pagina(etapas.slice((atual - 1) * 10, atual * 10), 11, atual));
  render(<ProtocolosCadastro podeLancar />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Editar rascunho de Controle CCS v1" })).toHaveProperty("disabled", false));
  fireEvent.click(screen.getByRole("button", { name: "Editar rascunho de Controle CCS v1" }));
  await screen.findByText(/10 de 11 ações carregadas/);
  expect(screen.getByRole("button", { name: "Salvar rascunho" })).toHaveProperty("disabled", true);
  expect(obterAcoesCadastro).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getAllByLabelText("Dia relativo ao início")[0], { target: { value: "42" } });
  fireEvent.change(screen.getAllByLabelText("Nome do momento")[0], { target: { value: "Início" } });
  expect(screen.getByLabelText("Buscar protocolos")).toHaveProperty("disabled", true);
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Salvar rascunho" })).toHaveProperty("disabled", false));
  expect(screen.getAllByLabelText("Dia relativo ao início")).toHaveLength(1);
  expect(screen.getByLabelText("Nome do momento")).toHaveProperty("value", "Início");
  fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
  await waitFor(() => expect(reqSanidade).toHaveBeenCalledWith("/protocolos/p1", expect.objectContaining({ method: "PATCH" })));
  const escrita = vi.mocked(reqSanidade).mock.calls.find(([path]) => path === "/protocolos/p1")!;
  expect(JSON.parse(escrita[1]!.body as string).etapas.every((e: { momento: { nome: string } }) => e.momento.nome === "Início")).toBe(true);
  expect(JSON.parse(escrita[1]!.body as string).etapas.map((e: { diaRelativo: number }) => e.diaRelativo)).toEqual([42, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});
it("ignora abertura antiga de outra versão sem substituir o rascunho atual", async () => {
  const outra = { ...protocolo, id: "p2", nome: "Outro controle" };
  let resolver!: (valor: CadastroProtocoloMeta) => void;
  const antiga = new Promise<CadastroProtocoloMeta>(resolve => { resolver = resolve; });
  vi.mocked(listarCadastrosProtocolos).mockResolvedValue(pagina([protocolo, outra]));
  vi.mocked(obterCadastroProtocolo).mockImplementation(id => id === "p1" ? antiga : Promise.resolve(outra));
  render(<ProtocolosCadastro podeLancar />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Editar rascunho de Controle CCS v1" })).toHaveProperty("disabled", false));
  fireEvent.click(screen.getByRole("button", { name: "Editar rascunho de Controle CCS v1" }));
  fireEvent.click(screen.getByRole("button", { name: "Editar rascunho de Outro controle v1" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Salvar rascunho" })).toHaveProperty("disabled", false));
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Meu rascunho" } });
  await act(async () => resolver(protocolo));
  expect(screen.getByLabelText("Nome")).toHaveProperty("value", "Meu rascunho");
  fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
  await waitFor(() => expect(reqSanidade).toHaveBeenCalledWith("/protocolos/p2", expect.objectContaining({ method: "PATCH" })));
});
it("consulta filtros no servidor sem buscar ações das versões listadas", async () => {
  render(<ProtocolosCadastro podeLancar={false} />);
  await screen.findByText("Controle CCS");
  fireEvent.change(screen.getByLabelText("Buscar protocolos"), { target: { value: "CCS" } });
  await waitFor(() => expect(listarCadastrosProtocolos).toHaveBeenLastCalledWith("SANITARIO", 1, "CCS", "TODAS"));
  fireEvent.change(screen.getByLabelText("Situação"), { target: { value: "INATIVA" } });
  await waitFor(() => expect(listarCadastrosProtocolos).toHaveBeenLastCalledWith("SANITARIO", 1, "CCS", "INATIVA"));
  expect(obterAcoesCadastro).not.toHaveBeenCalled();
});
