// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { lactacaoSecagem } from "./PesoSecagem.fixture";
import { AcoesReprodutivas } from "./AcoesReprodutivas";
import { reqV4, type PainelReprodutivo } from "./api";
vi.mock("./api", () => ({reqV4: vi.fn()}));
vi.mock("../../../propriedadeScope", () => ({getPropriedadeAtiva: () => 1}));
afterEach(cleanup);
beforeEach(() => { vi.mocked(reqV4).mockReset(); });
it("permite consultar a explicação e as evidências preservadas sem permissão de lançamento", () => {
  const painel: PainelReprodutivo = { animais: [], tentativas: [], avaliacoes: [], partos: [], restricoes: [],
    gestacoes: [{ id: "g", animalId: "a", animal: { id: "a", brinco: "Matriz transferida 42", nome: null }, status: "VALIDO", tipoEncerramento: "PERDA", encerradaEm: "2026-10-17", motivoEncerramento: "Perda observada durante a visita", causaClinica: { estado: "SUSPEITA", descricao: "Achado ainda em investigação", evidencias: ["Laudo demonstrativo 42"] } }] };
  render(<AcoesReprodutivas painel={painel} podeLancar={false} onMudou={vi.fn()} />);
  fireEvent.click(screen.getByText("Perdas gestacionais registradas"));
  expect(screen.getByText(/Matriz transferida 42/)).toBeTruthy();
  expect(screen.getByText("Perda observada durante a visita")).toBeTruthy();
  expect(screen.getByText(/Causa clínica: Suspeita/)).toBeTruthy();
  expect(screen.getByText("Laudo demonstrativo 42")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Registrar perda" })).toBeNull();
});

it("conserva evidências e explicação da perda no reenvio, sem herdar referências na próxima perda", async () => {
  vi.mocked(reqV4).mockReset().mockRejectedValueOnce(new Error("Resposta perdida")).mockResolvedValue({});
  const painel: PainelReprodutivo = { animais: [{ animalId: "a", brinco: "100", nome: null, situacao: "GESTANTE", partos: 0, tentativasCiclo: 1, gestacao: { id: "g", status: "VALIDO" }, restricoes: [] }], tentativas: [], avaliacoes: [], partos: [], restricoes: [] };
  render(<AcoesReprodutivas painel={painel} podeLancar onMudou={vi.fn().mockResolvedValue(undefined)} />);
  fireEvent.click(screen.getByRole("button", { name: "Registrar perda" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Motivo" }), { target: { value: "Perda observada na avaliação; causa ainda desconhecida" } });
  fireEvent.change(screen.getByRole("textbox", { name: /Evidências e referências/ }), { target: { value: "  Avaliação de campo 17/10\n\nLaudo demonstrativo 42  " } });
  fireEvent.submit(document.getElementById("acao-reproducao")!);
  await screen.findByText("Resposta perdida");
  fireEvent.submit(document.getElementById("acao-reproducao")!);
  await waitFor(() => expect(reqV4).toHaveBeenCalledTimes(2));
  const corpos = vi.mocked(reqV4).mock.calls.map(c => c[1]);
  expect(corpos[0]).toMatchObject({ causaClinica: { estado: "DESCONHECIDA", evidencias: ["Avaliação de campo 17/10", "Laudo demonstrativo 42"] } });
  expect(corpos[1]).toEqual(corpos[0]);
  await waitFor(() => expect(screen.queryByRole("textbox", { name: "Motivo" })).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Registrar perda" }));
  expect((screen.getByRole("textbox", { name: /Evidências e referências/ }) as HTMLTextAreaElement).value).toBe("");
});

it("mantém chave no retry da perda e gera outra para a próxima intenção", async () => {
  vi.mocked(reqV4).mockRejectedValueOnce(new Error("Resposta perdida")).mockResolvedValue({});
  const painel: PainelReprodutivo = {animais: [{animalId:"a", brinco:"100",nome:null,situacao:"GESTANTE",partos:0,tentativasCiclo:1,gestacao:{id:"g",status:"VALIDO"},restricoes:[]}],tentativas:[],avaliacoes:[],partos:[],restricoes:[]};
  render(<AcoesReprodutivas painel={painel} podeLancar onMudou={vi.fn().mockResolvedValue(undefined)} />);
  const registrar = () => fireEvent.click(screen.getByRole("button", {name:"Registrar perda"}));
  const preencher = () => fireEvent.change(screen.getByRole("textbox", {name:"Motivo"}), {target:{value:"Perda confirmada"}});
  registrar(); preencher();
  fireEvent.submit(document.getElementById("acao-reproducao")!);
  await screen.findByText("Resposta perdida");
  fireEvent.submit(document.getElementById("acao-reproducao")!);
  await waitFor(() => expect(screen.queryByRole("textbox", {name:"Motivo"})).toBeNull());
  registrar(); preencher(); fireEvent.submit(document.getElementById("acao-reproducao")!);
  await waitFor(() => expect(reqV4).toHaveBeenCalledTimes(3));
  const corpos = vi.mocked(reqV4).mock.calls.map(c => c[1] as {chave:string});
  expect(corpos[0].chave).toBe(corpos[1].chave);
  expect(corpos[2].chave).not.toBe(corpos[1].chave);
});


it.each(["SEM_LACTACAO", "NAO_INFORMADA"] as const)("apresenta lactação %s como não informada", (situacaoProdutiva) => {
  const painel: PainelReprodutivo = { animais: [{ animalId: "a", brinco: "100", nome: null, situacao: "VAZIA", partos: 0, tentativasCiclo: 0, gestacao: null, restricoes: [], situacaoProdutiva }], tentativas: [], avaliacoes: [], partos: [], restricoes: [] };
  render(<AcoesReprodutivas painel={painel} podeLancar={false} onMudou={vi.fn()} />);
  expect(screen.getByText("Não informada")).toBeTruthy();
  expect(screen.queryByText("Seca")).toBeNull();
});

it("expõe o encerramento com peso opcional e a manutenção apenas para quem pode lançar", async () => {
  const painel: PainelReprodutivo = { animais: [], tentativas: [], avaliacoes: [], partos: [], restricoes: [], lactacoes: [{ ...lactacaoSecagem, encerradaEm: null, vinculosPesagemSecagem: [] }] };
  render(<AcoesReprodutivas painel={painel} podeLancar onMudou={vi.fn()} propriedadeId={7} />);
  fireEvent.click(screen.getByRole("button", { name: "Encerrar lactação" }));
  expect(await screen.findByLabelText("Como deseja informar o peso?")).toBeTruthy();
});
it("leitura da lactação mostra peso e histórico sem permitir manutenção", () => {
  const painel: PainelReprodutivo = { animais: [], tentativas: [], avaliacoes: [], partos: [], restricoes: [], lactacoes: [lactacaoSecagem] };
  render(<AcoesReprodutivas painel={painel} podeLancar={false} onMudou={vi.fn()} propriedadeId={7} />);
  expect(screen.getByText("512 kg")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Manter vínculo de peso" })).toBeNull();
});
