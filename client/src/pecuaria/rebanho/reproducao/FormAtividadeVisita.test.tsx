// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FormAtividade } from "./FormAtividadeVisita";
import { adicionarAtividade, obterSugestoesVisita } from "./visitas-api";
vi.mock("./visitas-api",()=>({adicionarAtividade:vi.fn(),obterSugestoesVisita:vi.fn()}));
afterEach(cleanup);
it("envia critérios estruturados sem valores vazios e mantém apresentação separada",async()=>{
  vi.mocked(obterSugestoesVisita).mockResolvedValue({animais:[{animalId:"a",brinco:"100",nome:null,situacao:"VAZIA",partos:0,tentativasCiclo:0,gestacao:null,restricoes:[]}],tarefasSanitarias:[],tarefasIatf:[],protocolosSanitarios:[],protocolosIatf:[],criterios:{}});
  vi.mocked(adicionarAtividade).mockResolvedValue({id:"at",nome:"Avaliação",tipo:"AVALIACAO_REPRODUTIVA",extra:false,participantes:[]});
  render(<FormAtividade visita={{id:"v",propriedadeId:1,nome:"Visita",data:"2026-10-13",status:"ABERTA",atividades:[],impressoes:[]}} onFechar={vi.fn()} onSalvo={vi.fn()}/>);
  fireEvent.click(await screen.findByRole("checkbox",{name:/100.*VAZIA/}));
  fireEvent.submit(document.getElementById("atividade-visita")!);
  await waitFor(()=>expect(adicionarAtividade).toHaveBeenCalled());
  expect(vi.mocked(adicionarAtividade).mock.calls[0][1].contexto?.criterios).toEqual({});
  expect(vi.mocked(adicionarAtividade).mock.calls[0][1].contexto?.apresentacao).toMatchObject({situacao:"",busca:"",motivos:[]});
});
