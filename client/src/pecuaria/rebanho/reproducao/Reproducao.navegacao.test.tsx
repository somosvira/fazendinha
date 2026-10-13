// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Reproducao } from "./Reproducao";
import { obterReproducao } from "./api";
vi.mock("./api", () => ({obterReproducao:vi.fn(),reqV4:vi.fn().mockResolvedValue([])}));
vi.mock("./Iatf", () => ({Iatf:()=>null}));
vi.mock("./Exposicoes", () => ({Exposicoes:()=>null}));
vi.mock("./RegrasSanitarias", () => ({RegrasSanitarias:()=>null}));
vi.mock("./AcompanhamentoReprodutivo", () => ({AcompanhamentoReprodutivo:()=>null}));
vi.mock("./FormReproducao", () => ({FormReproducao:({animalInicial,acao}:{animalInicial:string;acao:string})=><p>Formulário {acao} {animalInicial}</p>}));
vi.mock("./DetalheFato", () => ({DetalheFato:({fato}:{fato:{id:string}})=><p>Origem {fato.id}</p>}));
afterEach(cleanup);
it("popstate entre consultas da mesma página troca animal, origem e abre parto", async()=>{
  const base={animais:[],tentativas:[],avaliacoes:[],partos:[],restricoes:[]};
  vi.mocked(obterReproducao).mockImplementation(async id=>({...base,avaliacoes:id === "b" ? [{id:"av",animalId:"b",data:"2026-10-13"}] : []}));
  window.history.replaceState(null,"","/pecuaria/reproducao?animalId=a");
  render(<Reproducao podeLancar />);
  await waitFor(()=>expect(obterReproducao).toHaveBeenLastCalledWith("a"));
  window.history.pushState(null,"","/pecuaria/reproducao?animalId=b&fatoId=av");
  fireEvent(window,new PopStateEvent("popstate"));
  await screen.findByText("Origem av");
  expect(obterReproducao).toHaveBeenLastCalledWith("b");
  window.history.pushState(null,"","/pecuaria/reproducao?animalId=c&acao=parto");
  fireEvent(window,new PopStateEvent("popstate"));
  await screen.findByText("Formulário parto c");
  await waitFor(()=>expect(obterReproducao).toHaveBeenLastCalledWith("c"));
});
