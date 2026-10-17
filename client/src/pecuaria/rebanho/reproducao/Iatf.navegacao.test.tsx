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

it.each(["Editar rascunho","Nova versão"])("%s envia apenas parâmetros editáveis e preserva exame planejado",async acao=>{
  vi.clearAllMocks();
  const etapas=[{nome:"Avaliação",tipo:"AVALIACAO",intervalo:30,unidade:"DIAS",planoAvaliacao:{tipo:"DIAGNOSTICO",tipoExameId:"exame"},referencias:{tipoExameNome:"Exame congelado"}}];
  vi.mocked(reqV4).mockImplementation(async(_path,body)=>_path.startsWith("/reproducao/biblioteca")?[]:body?{}:[{id:"protocolo",nome:"Modelo",versao:1,publicado:false,ativo:true,etapas}]);
  render(<Iatf modo="cadastros" podeLancar propriedadeId={7}/>);
  fireEvent.click(await screen.findByRole("button",{name:acao}));
  fireEvent.click(screen.getByRole("button",{name:"Salvar"}));
  const {waitFor}=await import("@testing-library/react");
  await waitFor(()=>expect(vi.mocked(reqV4).mock.calls.some(([,body])=>!!body)).toBe(true));
  const [path,body,method]=vi.mocked(reqV4).mock.calls.find(([,body])=>!!body)!;
  expect(path).toBe(acao==="Editar rascunho"?"/reproducao/protocolos/protocolo":"/reproducao/protocolos");
  expect(method).toBe(acao==="Editar rascunho"?"PATCH":"POST");
  expect(body).toMatchObject({versao:acao==="Editar rascunho"?1:2,etapas:[{nome:"Avaliação",tipo:"AVALIACAO",intervalo:30,unidade:"DIAS",planoAvaliacao:{tipo:"DIAGNOSTICO",tipoExameId:"exame"}}]});
  expect(JSON.stringify(body)).not.toContain("referencias");
});
