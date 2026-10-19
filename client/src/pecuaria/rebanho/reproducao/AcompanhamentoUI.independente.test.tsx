// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ req: vi.fn() }));
vi.mock("./api", () => ({ reqV4: mocks.req }));
import type { PainelReprodutivo } from "./api";
import { DemandasAcompanhamento } from "./DemandasAcompanhamento";
import { ConfiguracaoAcompanhamento } from "./ConfiguracaoAcompanhamento";
import { BibliotecaReprodutiva } from "./BibliotecaReprodutiva";
function adiada<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
const politica = (id = "p1", versao = 1) => ({ id, versao, vigenteDesde: "2026-01-01", parametros: { versao: 1, efeito: "ALERTA", diagnostico: { diasAposTentativa: 0 }, reconfirmacoes: [] } });
const demanda = (data: string) => ({ id: `d${data}`, finalidade: "DIAGNOSTICO", ocorrencia: 1, tentativaId: "t", gestacaoId: null, previstaPara: data, estado: "PENDENTE", motivoEncerramento: null, regraSnapshot: { politicaVersao: 1 }, exameResolucaoId: null });
const painel = (animalId: string): PainelReprodutivo => ({ animais: [], tentativas: [{ id: `t-${animalId}`, animalId, data: "2026-01-01", status: "VALIDO" }], avaliacoes: [], partos: [], restricoes: [], gestacoes: [] });
const referencia = { id: "referencia", nome: "Referência técnica", familia: "Família", versaoReferencia: "1", fonte: { titulo: "Publicação técnica", url: "https://example.org/referencia", pagina: 1, data: "2026-01-01", consultadaEm: "2026-10-16" }, objetivo: "Conferir manejo", populacaoIndicada: "Matrizes", camposACompletar: ["Produtos e doses"], observacoes: ["A configuração requer revisão técnica"] };
const previa = () => ({ revisao: "a".repeat(64), propostas: [{ acao: "CRIAR", finalidade: "DIAGNOSTICO", ocorrencia: 1, previstaPara: "2026-01-10" }] });
const padrao = async (url: string, body?: object) => {
 if (url === "/reproducao/biblioteca") return [referencia];
 if (url === "/reproducao/acompanhamento/politicas") return body ? { id: "p-nova" } : [politica()];
 if (url === "/reproducao/tipos-exame") return [{ id: "tipo", nome: "Exame configurável", contexto: "REPRODUTIVO", ativo: true }];
 if (url.includes("/adocao/previa")) return previa();
 if (url.includes("/adocao") || url.includes("/copiar")) return { id: "salvo" };
 return [];
};
const posts = () => mocks.req.mock.calls.filter(([, body]) => body !== undefined);
beforeEach(() => { vi.resetAllMocks(); mocks.req.mockImplementation(padrao); });
afterEach(() => cleanup());
async function conferirAdocao() { await screen.findByRole("option", { name: /Versão 1/ }); fireEvent.click(screen.getByText("Planejar acompanhamentos faltantes")); fireEvent.change(screen.getByLabelText("Regra para os acompanhamentos novos"), { target: { value: "p1" } }); fireEvent.click(screen.getByRole("button", { name: "Ver prévia" })); await screen.findByLabelText("Motivo obrigatório"); }
function preencherPolitica() { fireEvent.change(screen.getByLabelText("Vigente desde"), { target: { value: "2026-02-01" } }); fireEvent.click(screen.getByLabelText("Configurar diagnóstico após tentativa")); fireEvent.change(screen.getByLabelText("Dias após a tentativa"), { target: { value: "0" } }); }
function preencherCopia(nome = "Rascunho da fazenda", versao = "1") { fireEvent.change(screen.getByLabelText("Nome do novo rascunho"), { target: { value: nome } }); fireEvent.change(screen.getByLabelText("Versão do novo rascunho"), { target: { value: versao } }); }
describe("UI acompanhamento — contraprovas independentes", () => {
 it("leitura das demandas independe da demora ou falha das regras administrativas", async () => {
  let rejeitar!: (motivo: Error) => void;
  const lenta = new Promise<never>((_resolve, reject) => { rejeitar = reject; });
  mocks.req.mockImplementation((url, body) => url.endsWith("/politicas") ? lenta : url.includes("animalId=a") ? Promise.resolve([demanda("2026-01-11")]) : padrao(url, body));
  render(<DemandasAcompanhamento animalId="a" propriedadeId={1} painel={painel("a")} podeLancar onAvaliar={vi.fn()} atualizacao={0}/>);
  await screen.findByText("11/01/2026");
  expect(screen.queryByRole("status")).toBeNull();
  await act(async () => rejeitar(new Error("Regras indisponíveis")));
  expect(await screen.findByText(/Não foi possível consultar as regras para adoção/)).toBeTruthy();
  expect(screen.getByText("11/01/2026")).toBeTruthy();
  expect(screen.getByRole("button", {name:"Registrar avaliação"})).toBeTruthy();
 });

 it.each([true, false])("DG de origem inválido fica explícito para podeLancar=%s e impede avaliação vinculada", async (podeLancar) => {
  mocks.req.mockImplementation((url, body) => url.includes("animalId=a") ? Promise.resolve([{ ...demanda("2026-01-11"), finalidade: "RECONFIRMACAO", pendencias: ["EXAME_ORIGEM_INVALIDO"] }]) : padrao(url, body));
  const avaliar = vi.fn();
  render(<DemandasAcompanhamento animalId="a" propriedadeId={1} painel={painel("a")} podeLancar={podeLancar} onAvaliar={avaliar} atualizacao={0}/>);
  await screen.findByText(/O DG de origem foi alterado ou anulado/);
  expect(screen.getByText("11/01/2026")).toBeTruthy();
  expect(screen.getByText("Pendente")).toBeTruthy();
  if (podeLancar) {
   const registrar = screen.getByRole("button", { name: "Registrar avaliação" });
   expect(registrar).toHaveProperty("disabled", true); fireEvent.click(registrar);
  } else expect(screen.queryByRole("button", { name: "Registrar avaliação" })).toBeNull();
  expect(avaliar).not.toHaveBeenCalled(); expect(posts()).toHaveLength(0);
 });
 it("abrir faz somente leitura e adoção exige prévia e explicação", async () => {
  render(<DemandasAcompanhamento animalId="a" propriedadeId={1} painel={painel("a")} podeLancar onAvaliar={vi.fn()} atualizacao={0}/>);
  await screen.findByRole("option", { name: /Versão 1/ }); expect(posts()).toHaveLength(0); expect(screen.queryByRole("button", { name: "Confirmar criação conferida" })).toBeNull();
  await conferirAdocao(); expect(screen.getByRole("button", { name: "Confirmar criação conferida" })).toHaveProperty("disabled", true);
  fireEvent.change(screen.getByLabelText("Motivo obrigatório"), { target: { value: "Adoção explicitamente conferida" } }); fireEvent.click(screen.getByRole("button", { name: "Confirmar criação conferida" }));
  await waitFor(() => expect(posts()).toHaveLength(2)); expect(posts()[1]).toEqual(["/reproducao/acompanhamento/adocao", expect.objectContaining({ propriedadeId: 1, politicaId: "p1", tentativaIds: ["t-a"], motivo: "Adoção explicitamente conferida", revisao: "a".repeat(64), chave: expect.any(String) }), "POST", 1]);
 });
 it("consulta lenta do animalA não substitui demandas do animalB no outro sítio", async () => {
  const antiga = adiada<unknown>(); mocks.req.mockImplementation((url, body) => url.includes("animalId=a") ? antiga.promise : url.includes("animalId=b") ? Promise.resolve([demanda("2026-02-22")]) : padrao(url, body));
  const { rerender } = render(<DemandasAcompanhamento animalId="a" propriedadeId={1} painel={painel("a")} podeLancar onAvaliar={vi.fn()} atualizacao={0}/>);
  rerender(<DemandasAcompanhamento animalId="b" propriedadeId={2} painel={painel("b")} podeLancar onAvaliar={vi.fn()} atualizacao={0}/>); await screen.findByText(/22\/02\/2026/);
  await act(async () => antiga.resolve([demanda("2026-01-11")])); expect(screen.queryByText(/11\/01\/2026/)).toBeNull(); expect(screen.getByText(/22\/02\/2026/)).toBeTruthy();
 });
 it("erro no segundo animal não conserva dados do primeiro", async () => {
  mocks.req.mockImplementation((url, body) => url.includes("animalId=a") ? Promise.resolve([demanda("2026-01-11")]) : url.includes("animalId=b") ? Promise.reject(new Error("Consulta do animalB falhou")) : padrao(url, body));
  const { rerender } = render(<DemandasAcompanhamento animalId="a" propriedadeId={1} painel={painel("a")} podeLancar onAvaliar={vi.fn()} atualizacao={0}/>); await screen.findByText(/11\/01\/2026/);
  rerender(<DemandasAcompanhamento animalId="b" propriedadeId={2} painel={painel("b")} podeLancar onAvaliar={vi.fn()} atualizacao={0}/>); await screen.findByText("Consulta do animalB falhou"); expect(screen.queryByText(/11\/01\/2026/)).toBeNull();
 });
 it("adoção pendente deA não trava nem injeta resultado emB", async () => {
  const escrita = adiada<unknown>(); mocks.req.mockImplementation((url, body) => url.endsWith("/adocao") ? escrita.promise : padrao(url, body));
  const { rerender } = render(<DemandasAcompanhamento animalId="a" propriedadeId={1} painel={painel("a")} podeLancar onAvaliar={vi.fn()} atualizacao={0}/>); await conferirAdocao();
  fireEvent.change(screen.getByLabelText("Motivo obrigatório"), { target: { value: "Adoção conferida para alvoA" } }); fireEvent.click(screen.getByRole("button", { name: "Confirmar criação conferida" }));
  rerender(<DemandasAcompanhamento animalId="b" propriedadeId={2} painel={painel("b")} podeLancar onAvaliar={vi.fn()} atualizacao={0}/>); await screen.findByRole("option", { name: /Versão 1/ });
  fireEvent.change(screen.getByLabelText("Regra para os acompanhamentos novos"), { target: { value: "p1" } }); expect(screen.getByRole("button", { name: "Ver prévia" })).toHaveProperty("disabled", false);
  await act(async () => escrita.resolve({})); expect(screen.queryByLabelText("Motivo obrigatório")).toBeNull();
 });
 it("trocar versão durante prévia invalida resposta da versão anterior", async () => {
  const resposta = adiada<unknown>(); mocks.req.mockImplementation((url, body) => url.endsWith("/politicas") ? Promise.resolve([politica(), politica("p2", 2)]) : url.endsWith("/previa") ? resposta.promise : padrao(url, body));
  render(<DemandasAcompanhamento animalId="a" propriedadeId={1} painel={painel("a")} podeLancar onAvaliar={vi.fn()} atualizacao={0}/>); await screen.findByRole("option", { name: /Versão 1/ }); fireEvent.click(screen.getByText("Planejar acompanhamentos faltantes"));
  fireEvent.change(screen.getByLabelText("Regra para os acompanhamentos novos"), { target: { value: "p1" } }); fireEvent.click(screen.getByRole("button", { name: "Ver prévia" })); fireEvent.change(screen.getByLabelText("Regra para os acompanhamentos novos"), { target: { value: "p2" } });
  await act(async () => resposta.resolve(previa())); expect(screen.queryByRole("button", { name: "Confirmar criação conferida" })).toBeNull(); expect(screen.getByRole("button", { name: "Ver prévia" })).toHaveProperty("disabled", false);
 });
 it("escrita de política pendente não mantém mensagem ou bloqueio no novo sítio", async () => {
  const escrita = adiada<unknown>(); mocks.req.mockImplementation((url, body) => url.endsWith("/politicas") && body ? escrita.promise : padrao(url, body));
  const { rerender } = render(<ConfiguracaoAcompanhamento propriedadeId={1} podeLancar/>); await screen.findByText(/Versão 1/); preencherPolitica(); fireEvent.submit(screen.getByRole("button", { name: "Registrar nova versão" }).closest("form")!); await waitFor(() => expect(posts()).toHaveLength(1));
  rerender(<ConfiguracaoAcompanhamento propriedadeId={2} podeLancar/>); await screen.findByText(/Versão 1/); expect(screen.getByRole("button", { name: "Registrar nova versão" })).toHaveProperty("disabled", false);
  await act(async () => escrita.resolve({ id: "politica-antiga" })); expect(screen.queryByText(/Versão registrada/)).toBeNull(); expect(screen.getByLabelText("Vigente desde")).toHaveProperty("value", "");
 });
 it("consulta de política lenta não substitui versão do novo sítio", async () => {
  const antiga = adiada<unknown>(); mocks.req.mockImplementation((url, body, _method, sitio) => url.endsWith("/politicas") ? sitio === 1 ? antiga.promise : Promise.resolve([politica("p2", 2)]) : padrao(url, body));
  const { rerender } = render(<ConfiguracaoAcompanhamento propriedadeId={1} podeLancar/>); rerender(<ConfiguracaoAcompanhamento propriedadeId={2} podeLancar/>); await screen.findByText(/Versão 2/); await act(async () => antiga.resolve([politica()])); expect(screen.queryByText(/Versão 1/)).toBeNull();
 });
 it("Biblioteca abre sem gravar e permite duas cópias com nome, versão e chave próprios", async () => {
  const copiou = vi.fn(); render(<BibliotecaReprodutiva propriedadeId={1} podeLancar onCopiou={copiou}/>); await screen.findByText("Referência técnica"); expect(posts()).toHaveLength(0);
  preencherCopia("Manejo da fazenda", "1"); fireEvent.click(screen.getByRole("button", { name: "Copiar como rascunho" })); await waitFor(() => expect(copiou).toHaveBeenCalledTimes(1));
  preencherCopia("Outro manejo", "2"); fireEvent.click(screen.getByRole("button", { name: "Copiar como rascunho" })); await waitFor(() => expect(copiou).toHaveBeenCalledTimes(2));
  expect(posts()[0][1]).toMatchObject({ propriedadeId: 1, nome: "Manejo da fazenda", versao: 1 }); expect(posts()[1][1]).toMatchObject({ propriedadeId: 1, nome: "Outro manejo", versao: 2 }); expect(posts()[0][1].chave).not.toBe(posts()[1][1].chave);
 });
 it("cópia exige nome/versão explícitos e sítio escolhido", async () => {
  const { rerender } = render(<BibliotecaReprodutiva propriedadeId={1} podeLancar onCopiou={vi.fn()}/>); await screen.findByText("Referência técnica"); fireEvent.click(screen.getByRole("button", { name: "Copiar como rascunho" })); await screen.findByText(/Informe o nome e o número/); expect(posts()).toHaveLength(0);
  rerender(<BibliotecaReprodutiva propriedadeId={null} podeLancar onCopiou={vi.fn()}/>); preencherCopia(); fireEvent.click(screen.getByRole("button", { name: "Copiar como rascunho" })); await screen.findByText(/Selecione um sítio/); expect(posts()).toHaveLength(0);
 });
 it("cópia antiga não dispara atualização nem mantém botão ocupado no outro sítio", async () => {
  const escrita = adiada<unknown>(); mocks.req.mockImplementation((url, body) => url.endsWith("/copiar") ? escrita.promise : padrao(url, body)); const copiou = vi.fn();
  const { rerender } = render(<BibliotecaReprodutiva propriedadeId={1} podeLancar onCopiou={copiou}/>); await screen.findByText("Referência técnica"); preencherCopia(); fireEvent.click(screen.getByRole("button", { name: "Copiar como rascunho" }));
  rerender(<BibliotecaReprodutiva propriedadeId={2} podeLancar onCopiou={copiou}/>); expect(screen.getByRole("button", { name: "Copiar como rascunho" })).toHaveProperty("disabled", false); await act(async () => escrita.resolve({ id: "copia-antiga" })); expect(copiou).not.toHaveBeenCalled(); expect(screen.queryByText(/Rascunho criado/)).toBeNull();
 });
 it("sem lançar há leitura sem editores nem confirmação", async () => {
  const a = render(<DemandasAcompanhamento animalId="a" propriedadeId={1} painel={painel("a")} podeLancar={false} onAvaliar={vi.fn()} atualizacao={0}/>); await screen.findByText(/Nenhum acompanhamento planejado/); expect(screen.queryByText("Planejar acompanhamentos faltantes")).toBeNull(); a.unmount();
  const b = render(<ConfiguracaoAcompanhamento propriedadeId={1} podeLancar={false}/>); await screen.findByText(/Versão 1/); expect(screen.queryByRole("button", { name: "Registrar nova versão" })).toBeNull(); b.unmount();
  render(<BibliotecaReprodutiva propriedadeId={1} podeLancar={false} onCopiou={vi.fn()}/>); await screen.findByText("Referência técnica"); expect(screen.queryByRole("button", { name: "Copiar como rascunho" })).toBeNull(); expect(posts()).toHaveLength(0);
 });
});
