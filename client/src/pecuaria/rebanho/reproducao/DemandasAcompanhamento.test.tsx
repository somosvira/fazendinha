// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { alterarControle } from "../../../lib/controles.fixture";
import { reqV4 } from "./api";
import { DemandasAcompanhamento } from "./DemandasAcompanhamento";
vi.mock("./api", () => ({ reqV4: vi.fn().mockResolvedValue({ itens: [{ id: "d", tarefaId: "t", finalidade: "SEXAGEM", ocorrencia: 1, tentativaId: null, gestacaoId: null, previstaPara: null, estado: "PENDENTE", motivoEncerramento: null, regraSnapshot: {}, exameResolucaoId: null }], total: 1, pagina: 1, porPagina: 10, resumo: { total: 1, pendentes: 1, resolvidas: 0, encerradas: 0, semData: 1 } }) }));
afterEach(cleanup);
it("mostra acompanhamento sem prazo configurado sem inventar data ou regra", async () => {
  render(<DemandasAcompanhamento animalId="a" propriedadeId={7} painel={{ animais: [], tentativas: [], avaliacoes: [], partos: [], restricoes: [] }} podeLancar={false} onAvaliar={vi.fn()} atualizacao={1} />);
  expect(await screen.findByText("Sem data definida")).toBeTruthy();
  expect(screen.getByRole("cell", { name: "Sexagem" })).toBeTruthy();
  expect(screen.getByText("Acompanhamento do exame")).toBeTruthy();
  expect(screen.queryByText(/Regra versão/)).toBeNull();
});

it("oferece planejamento diretamente e exige prévia e motivo para criar sem alterar acompanhamentos existentes", async () => {
  vi.mocked(reqV4).mockImplementation(async (path) => {
    if (path.endsWith("/politicas")) return [{id:"regra1",versao:2,vigenteDesde:"2026-10-01"}] as never;
    if (path.endsWith("/previa")) return {revisao:"revisao1",propostas:[{acao:"CRIAR",finalidade:"DIAGNOSTICO",ocorrencia:1,previstaPara:"2026-10-20",tentativaId:"tentativa1"}]} as never;
    return {itens:[],total:0,pagina:1,porPagina:10,resumo:{total:0,pendentes:0,resolvidas:0,encerradas:0,semData:0}} as never;
  });
  render(<DemandasAcompanhamento animalId="a" propriedadeId={7} painel={{ animais: [], tentativas: [{id:"tentativa1",animalId:"a",status:"VALIDO",data:"2026-10-01"}], avaliacoes: [], partos: [], restricoes: [] }} podeLancar onAvaliar={vi.fn()} atualizacao={1}/>);
  const regra = await screen.findByRole("combobox", {name:"Regra para os acompanhamentos novos"});
  expect(regra.closest("details")).toBeNull();
  await alterarControle(regra,{target:{value:"regra1"}});
  fireEvent.click(screen.getByRole("button",{name:"Ver prévia"}));
  const confirmar=await screen.findByRole("button",{name:"Confirmar criação conferida"});
  expect(confirmar).toHaveProperty("disabled",true);
  fireEvent.change(screen.getByLabelText("Motivo obrigatório"),{target:{value:"Planejamento conferido no histórico"}});
  expect(confirmar).toHaveProperty("disabled",false);
  fireEvent.click(confirmar);
  await waitFor(()=>expect(reqV4).toHaveBeenCalledWith("/reproducao/acompanhamento/adocao",expect.objectContaining({politicaId:"regra1",revisao:"revisao1",tentativaIds:["tentativa1"],motivo:"Planejamento conferido no histórico"}),"POST",7));
});
