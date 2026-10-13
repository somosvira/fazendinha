// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AcoesReprodutivas } from "./AcoesReprodutivas";
import { reqV4, type PainelReprodutivo } from "./api";
vi.mock("./api", () => ({reqV4: vi.fn()}));
vi.mock("../../../propriedadeScope", () => ({getPropriedadeAtiva: () => 1}));
afterEach(cleanup);
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
