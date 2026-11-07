// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PartosPrevistos } from "./PartosPrevistos";
import { reqV4, type AnimalReprodutivo, type PainelReprodutivo } from "./api";
vi.mock("./api", () => ({reqV4:vi.fn()}));
afterEach(cleanup);
function animal(id:string, previsao:string|null, encerradaEm:string|null=null): AnimalReprodutivo {
  return {animalId:id,brinco:id,nome:null,situacao:"GESTANTE",partos:0,tentativasCiclo:1,restricoes:[],gestacao:{id:`g-${id}`,status:"VALIDO",previsaoParto:previsao,encerradaEm}};
}
it("distingue previsão registrada, previsão desconhecida e gestação encerrada, apenas por leitura",async()=>{
  const painel: PainelReprodutivo={animais:[animal("Flor","2026-11-08"),animal("Sem previsão",null),animal("Encerrada","2026-10-01","2026-10-02")],tentativas:[],avaliacoes:[],partos:[],restricoes:[]};
  vi.mocked(reqV4).mockResolvedValue(painel);
  render(<PartosPrevistos propriedadeId={7}/>);
  await screen.findAllByText("Flor");
  expect(screen.getAllByText("08/11/2026").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Não informada").length).toBeGreaterThan(0);
  expect(screen.queryByText("Encerrada")).toBeNull();
  expect(screen.queryByRole("columnheader",{name:"Data do parto"})).toBeNull();
  expect(reqV4).toHaveBeenCalledWith("/reproducao",undefined,"GET",7);
  expect(screen.getAllByRole("link",{name:"Ver gestação"})[0].getAttribute("href")).toContain("sitio=7#reproducao");
});
