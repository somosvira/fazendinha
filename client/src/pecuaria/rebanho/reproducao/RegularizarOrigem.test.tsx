// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RegularizarOrigem, consumoMantidoUltimaAnulacao } from "./RegularizarOrigem";
import { reqV4 } from "./api";
vi.mock("./api",()=>({reqV4:vi.fn()}));
afterEach(cleanup);
it("seleciona procedimento legível e envia só vínculo, preservando motivo/chave no retry",async()=>{
  const path="/reproducao/tarefas-iatf/t/regularizacao";
  const mudou=vi.fn().mockResolvedValue(undefined);
  let tentativas=0;
  vi.mocked(reqV4).mockImplementation(async (url,body)=>{
    if(!body) return [{id:"f",descricao:"13/10/2026 · IA · Matriz 100"}];
    if(++tentativas===1) throw new Error("Resposta perdida");
    return {};
  });
  render(<RegularizarOrigem path={path} propriedadeId={1} consumoMantido={false} onMudou={mudou}/>);
  fireEvent.click(screen.getByRole("button",{name:"Regularizar origem do fato anulado"}));
  fireEvent.change(screen.getByLabelText("Ação"),{target:{value:"VINCULAR_SUBSTITUTO"}});
  expect(await screen.findByRole("option",{name:"13/10/2026 · IA · Matriz 100"})).toBeTruthy();
  expect(screen.queryByRole("textbox",{name:/ID/})).toBeNull();
  fireEvent.change(screen.getByLabelText("Fato substituto comprovado"),{target:{value:"f"}});
  fireEvent.change(screen.getByRole("textbox",{name:"Motivo"}),{target:{value:"Correção comprovada"}});
  fireEvent.click(screen.getByRole("button",{name:"Confirmar regularização"}));
  await screen.findByText("Resposta perdida");
  fireEvent.click(screen.getByRole("button",{name:"Confirmar regularização"}));
  await waitFor(()=>expect(mudou).toHaveBeenCalled());
  const chamadas=vi.mocked(reqV4).mock.calls;
  expect(chamadas[0][0]).toBe("/reproducao/tarefas-iatf/t/substitutos");
  expect(chamadas).toHaveLength(3);
  expect(chamadas[1][0]).toBe(path);
  expect(chamadas[1][1]).toEqual(chamadas[2][1]);
  expect(chamadas[1][1]).toMatchObject({propriedadeId:1,acao:"VINCULAR_SUBSTITUTO",fatoId:"f",motivo:"Correção comprovada"});
});
it("somente a última anulação determina se o consumo impede reabrir",()=>{
  expect(consumoMantidoUltimaAnulacao([{acao:"FATO_ANULADO",destinoConsumo:"MANTER_CONSUMO"},{acao:"ENCERRAR_SEM_SUBSTITUICAO"},{acao:"FATO_ANULADO",destinoConsumo:"DEVOLVER_ESTOQUE"}])).toBe(false);
});
