// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Iatf } from "./Iatf";
import { reqV4 } from "./api";
vi.mock("./api",()=>({reqV4:vi.fn()}));
vi.mock("../../../estoque/api",()=>({listarProdutos:vi.fn().mockResolvedValue([])}));
vi.mock("../api",()=>({listarMaterialGenetico:vi.fn().mockResolvedValue([])}));
afterEach(cleanup);
it("abre programação de outro retorno por popstate sem remontar",async()=>{
  vi.mocked(reqV4).mockImplementation(async path=>path.endsWith("/um") ? {id:"um",nome:"Primeira programação",participantes:[]} : path.endsWith("/dois") ? {id:"dois",nome:"Segunda programação",participantes:[]} : []);
  window.history.replaceState(null,"","/pecuaria/reproducao?programacaoId=um");
  render(<Iatf animais={[]} painel={{animais:[],tentativas:[],avaliacoes:[],partos:[],restricoes:[]}} podeLancar={false} />);
  await screen.findByText(/Primeira programação/);
  window.history.pushState(null,"","/pecuaria/reproducao?programacaoId=dois");
  fireEvent(window,new PopStateEvent("popstate"));
  expect(await screen.findByText(/Segunda programação/)).toBeTruthy();
});
