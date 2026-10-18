// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Reproducao, ReproducaoAnimal } from "./Reproducao";
import { obterReproducao } from "./api";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
import { ElegibilidadeAnimal } from "./ElegibilidadeAnimal";
vi.mock("./IndicadoresReprodutivos", () => ({ IndicadoresReprodutivos: ({ propriedadeId }: { propriedadeId: number }) => <p>Indicadores do sítio {propriedadeId}</p> }));
vi.mock("./ConfiguracaoReprodutiva", () => ({ ConfiguracaoReprodutiva: ({ propriedadeId }: { propriedadeId: number }) => <p>Política do sítio {propriedadeId}</p> }));
vi.mock("./PartosPosParto", () => ({ PartosPosParto: ({ propriedadeId, podeLancar }: { propriedadeId: number; podeLancar: boolean }) => <p>Partos do sítio {propriedadeId}</p> }));
vi.mock("./ResumoPoliticaReprodutiva", () => ({ ResumoPoliticaReprodutiva: () => null }));
vi.mock("../../../api/propriedades", () => ({ listarPropriedades: vi.fn().mockResolvedValue([{ id: 7, nome: "Escola" }, { id: 8, nome: "Destino" }]) }));
vi.mock("./ElegibilidadeAnimal", () => ({ ElegibilidadeAnimal: vi.fn(({ propriedadeId }: { propriedadeId: number }) => <p>Elegibilidade no sítio {propriedadeId}</p>) }));
vi.mock("./api", () => ({obterReproducao:vi.fn(),reqV4:vi.fn().mockResolvedValue([])}));
vi.mock("./Iatf", () => ({Iatf:()=>null}));
vi.mock("./Exposicoes", () => ({Exposicoes:()=>null}));
vi.mock("./RegrasSanitarias", () => ({RegrasSanitarias:()=>null}));
vi.mock("./AcompanhamentoReprodutivo", () => ({AcompanhamentoReprodutivo:()=>null}));
vi.mock("./FormReproducao", () => ({FormReproducao:({animalInicial,acao}:{animalInicial:string;acao:string})=><p>Formulário {acao} {animalInicial}</p>}));
vi.mock("./DetalheFato", () => ({DetalheFato:({fato}:{fato:{id:string}})=><p>Origem {fato.id}</p>}));
afterEach(() => { cleanup(); vi.clearAllMocks(); setPropriedadeAtiva(null); });
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


it("troca rotina pela URL preservando filtros e deep links e responde ao histórico", async () => {
  setPropriedadeAtiva(7);
  window.history.replaceState(null, "", "/pecuaria/reproducao?q=Matriz&situacao=GESTANTE&animalId=a&fatoId=f#origem");
  vi.mocked(obterReproducao).mockResolvedValue({ animais: [], tentativas: [], avaliacoes: [], partos: [], restricoes: [] });
  render(<Reproducao podeLancar={false} />);
  fireEvent.click(screen.getByRole("tab", { name: "Partos e pós-parto" }));
  await screen.findByText("Partos do sítio 7");
  const url = new URL(window.location.href);
  expect(url.searchParams.get("rotina")).toBe("partos");
  expect(url.searchParams.get("q")).toBe("Matriz");
  expect(url.searchParams.get("animalId")).toBe("a");
  expect(url.searchParams.get("fatoId")).toBe("f");
  expect(url.hash).toBe("#origem");
  fireEvent.click(screen.getByRole("tab", { name: "Indicadores" }));
  await screen.findByText("Indicadores do sítio 7");
  expect(screen.queryByRole("tab", { name: "Política reprodutiva" })).toBeNull();
  expect(screen.getByRole("link", { name: "Política reprodutiva" }).getAttribute("href")).toBe("/configuracoes/pecuaria/reproducao/politica?sitio=7");
});
it.each(["partos", "indicadores"])("consolidado oferece seletor dentro da página para %s", async rotina => {
  setPropriedadeAtiva(null);
  window.history.replaceState(null, "", `/pecuaria/reproducao?rotina=${rotina}`);
  render(<Reproducao podeLancar />);
  const seletor = await screen.findByLabelText("Sítio da consulta");
  await screen.findByRole("option", { name: "Escola" });
  fireEvent.change(seletor, { target: { value: "7" } });
  await screen.findByText(rotina === "partos" ? "Partos do sítio 7" : "Indicadores do sítio 7");
  expect(obterReproducao).not.toHaveBeenCalled();
});
it("elegibilidade individual recebe localização comprovada mesmo com outro sítio ativo", async () => {
  setPropriedadeAtiva(99);
  window.history.replaceState(null, "", "/pecuaria/rebanho/animais/a#reproducao");
  vi.mocked(obterReproducao).mockResolvedValue({ animais: [], tentativas: [], avaliacoes: [], partos: [], restricoes: [] });
  render(<ReproducaoAnimal animalId="a" propriedadeId={7} podeLancar />);
  await screen.findByText("Elegibilidade no sítio 7");
  expect(obterReproducao).toHaveBeenCalledWith("a", 7);
  expect(vi.mocked(ElegibilidadeAnimal).mock.calls.at(-1)?.[0]).toMatchObject({ animalId: "a", propriedadeId: 7, podeLancar: true });
});
