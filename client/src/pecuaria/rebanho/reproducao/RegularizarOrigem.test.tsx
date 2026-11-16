// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RegularizarOrigem, consumoMantidoUltimaAnulacao } from "./RegularizarOrigem";
import { reqV4 } from "./api";
import { esperarOpcoes, mudarCampo, opcoesDoCampo } from "@/lib/controles.fixture";
vi.mock("./api",()=>({reqV4:vi.fn()}));
afterEach(cleanup);
it("seleciona procedimento legível e envia só vínculo, preservando motivo/chave no retry",async()=>{
  const path="/reproducao/tarefas-iatf/t/regularizacao";
  const mudou=vi.fn().mockResolvedValue(undefined);
  let tentativas=0;
  vi.mocked(reqV4).mockImplementation(async (url,body)=>{
    if(!body) return {itens:[{id:"f",descricao:"13/10/2026 · IA · Matriz 100"}],total:1,pagina:1,porPagina:10};
    if(++tentativas===1) throw new Error("Resposta perdida");
    return {};
  });
  render(<RegularizarOrigem path={path} propriedadeId={1} consumoMantido={false} onMudou={mudou}/>);
  fireEvent.click(screen.getByRole("button",{name:"Regularizar origem do fato anulado"}));
  mudarCampo(screen.getByLabelText("Ação"),{target:{value:"VINCULAR_SUBSTITUTO"}});
  await esperarOpcoes(() => screen.getByLabelText("Fato substituto comprovado"), o => o.some(i => i.texto === "13/10/2026 · IA · Matriz 100"));
  expect(screen.queryByRole("textbox",{name:/ID/})).toBeNull();
  mudarCampo(screen.getByLabelText("Fato substituto comprovado"),{target:{value:"f"}});
  mudarCampo(screen.getByRole("textbox",{name:"Motivo"}),{target:{value:"Correção comprovada"}});
  fireEvent.click(screen.getByRole("button",{name:"Confirmar regularização"}));
  await screen.findByText("Resposta perdida");
  fireEvent.click(screen.getByRole("button",{name:"Confirmar regularização"}));
  await waitFor(()=>expect(mudou).toHaveBeenCalled());
  const chamadas=vi.mocked(reqV4).mock.calls;
  expect(chamadas[0][0]).toContain("/reproducao/tarefas-iatf/t/substitutos?propriedadeId=1&paginado=true&pagina=1&porPagina=10");
  expect(chamadas).toHaveLength(3);
  expect(chamadas[0].slice(1)).toEqual([undefined, "GET", 1]);
  expect(chamadas[1].slice(2)).toEqual(["POST", 1]);
  expect(chamadas[1][0]).toBe(path);
  expect(chamadas[1][1]).toEqual(chamadas[2][1]);
  expect(chamadas[1][1]).toMatchObject({propriedadeId:1,acao:"VINCULAR_SUBSTITUTO",fatoId:"f",motivo:"Correção comprovada"});
});
it("somente a última anulação determina se o consumo impede reabrir",()=>{
  expect(consumoMantidoUltimaAnulacao([{acao:"FATO_ANULADO",destinoConsumo:"MANTER_CONSUMO"},{acao:"ENCERRAR_SEM_SUBSTITUICAO"},{acao:"FATO_ANULADO",destinoConsumo:"DEVOLVER_ESTOQUE"}])).toBe(false);
});

it("onze candidatos paginam dez e conservam a escolha ao mudar de página",async()=>{
  vi.mocked(reqV4).mockClear();
  const mudou=vi.fn().mockResolvedValue(undefined);
  vi.mocked(reqV4).mockImplementation(async(url,body)=>{
    if(body)return{};
    const pagina=new URL("http://local"+url).searchParams.get("pagina")==="2"?2:1;
    return{itens:Array.from({length:pagina===1?10:1},(_,n)=>({id:`f${(pagina-1)*10+n}`,descricao:`Procedimento ${(pagina-1)*10+n}`})),total:11,pagina,porPagina:10};
  });
  render(<RegularizarOrigem path="/reproducao/tarefas-iatf/t/regularizacao" propriedadeId={1} consumoMantido={false} onMudou={mudou}/>);
  fireEvent.click(screen.getByRole("button",{name:"Regularizar origem do fato anulado"}));
  mudarCampo(screen.getByLabelText("Ação"),{target:{value:"VINCULAR_SUBSTITUTO"}});
  await esperarOpcoes(() => screen.getByLabelText("Fato substituto comprovado"), o => o.some(i => i.texto === "Procedimento 0"));
  expect(opcoesDoCampo(screen.getByLabelText("Fato substituto comprovado"))).toHaveLength(11);
  mudarCampo(screen.getByLabelText("Fato substituto comprovado"),{target:{value:"f0"}});
  mudarCampo(screen.getByLabelText("Motivo"),{target:{value:"Vincular fato conferido"}});
  fireEvent.click(screen.getByRole("button",{name:"Próxima"}));
  await esperarOpcoes(() => screen.getByLabelText("Fato substituto comprovado"), o => o.some(i => i.texto === "Procedimento 10"));
  expect(opcoesDoCampo(screen.getByLabelText("Fato substituto comprovado"))).toHaveLength(2);
  expect(screen.getByText("Fato selecionado:")).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Confirmar regularização"}));
  await waitFor(()=>expect(mudou).toHaveBeenCalledOnce());
  expect(vi.mocked(reqV4).mock.calls.find(([,body])=>body)?.[1]).toMatchObject({fatoId:"f0"});
});
