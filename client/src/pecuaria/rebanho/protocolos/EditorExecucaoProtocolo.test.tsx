// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { AplicacaoInput } from "../sanidade/api";
import type { TarefaOperacional } from "./api";
import { EditorExecucaoProtocolo, planoAplicacaoTarefa } from "./EditorExecucaoProtocolo";
const m=vi.hoisted(()=>({req:vi.fn(),erro:vi.fn(),itens:[] as AplicacaoInput[]}));
vi.mock("./api",async original=>({...await original<typeof import("./api")>(),reqProtocolo:m.req}));
vi.mock("../sanidade/FormAplicacaoServico",()=>({FormAplicacaoServico:({onConferirConjunto,conteudoExtra,rotuloSubmeter}:{onConferirConjunto:(itens:AplicacaoInput[])=>Promise<void>;conteudoExtra:ReactNode;rotuloSubmeter:string})=><section>{conteudoExtra}<button onClick={()=>{void onConferirConjunto(m.itens).catch(m.erro);}}>{rotuloSubmeter}</button></section>}));
vi.mock("../sanidade/PreviaExecucao",()=>({ConferenciaExecucao:({previa}:{previa:{itens:Array<{animalId:string}>}})=><ul aria-label="Conferência">{previa.itens.map(i=><li key={i.animalId}>{i.animalId}</li>)}</ul>}));
vi.mock("../../../financeiro/PainelCadastro",()=>({PainelCadastro:({titulo,children,rodape}:{titulo:string;children:ReactNode;rodape:ReactNode})=><section><h2>{titulo}</h2>{children}{rodape}</section>,classeInput:"input"}));
function tarefa(n:number):TarefaOperacional {
  const animal={id:`animal-${n}`,brinco:`Brinco ${n}`,nome:null};
  const execucao={animalId:animal.id,propriedadeId:7,animal,protocolo:{nome:"Vacinação",versao:1}};
  return{id:`tarefa-${n}`,tarefaId:`tarefa-${n}`,participacaoId:`participacao-${n}`,etapaId:"etapa",animal,propriedadeId:7,situacao:"SEM_REGISTRO",previstaPara:"2026-10-01",previsaoOriginal:null,previsaoIndividual:false,precisaoTemporal:"DIA",realizadaEm:null,precisaoRealizacao:null,previsaoPendente:false,ultimoEvento:null,vinculoAtual:null,acoes:{atender:true,justificar:true,adiar:true,retificar:false,regularizar:false},tarefaOrigem:{id:`tarefa-${n}`,etapaId:"etapa",execucaoId:`participacao-${n}`,tipo:"APLICACAO",previstaEm:"2026-10-01",previstaPara:"2026-10-01",status:"PENDENTE",situacao:"PENDENTE",parametros:{tipo:"APLICACAO",produtoId:"produto",tipoAplicacaoId:"tipo",dose:"2",unidade:"ML"},execucao}};
}
const tarefas=Array.from({length:14},(_,n)=>tarefa(n+1));
function previa(pagina=1) {
  return{fingerprint:"a".repeat(64),temDesvios:false,tarefas:{itens:tarefas.slice((pagina-1)*10,pagina*10).map(t=>({tarefaId:t.id,animalId:t.animal.id,tipo:"APLICACAO",motivoObrigatorio:false,motivo:null,inicioLegado:{exigeCiencia:false,total:0}})),total:14,pagina,porPagina:10},consumos:{itens:[],total:0,pagina:1,porPagina:10}};
}
beforeEach(()=>{vi.clearAllMocks();m.itens=tarefas.map(t=>({animalId:t.animal.id,propriedadeId:7,tarefaId:t.id,data:"2026-10-01",tipoAplicacaoId:"tipo",origemInsumo:"BAIXA_ESTOQUE",nomeProdutoAplicado:"Produto",dose:"2",unidadeDose:"ML",estadoCarenciaLeite:"NAO_INFORMADO",estadoCarenciaCarne:"NAO_INFORMADO",carenciaLeiteHoras:null,carenciaCarneHoras:null}));});
afterEach(cleanup);
describe("editor comum de execução",()=>{
  it("uma prévia de14 mantém no máximo10linhas e pagina no servidor sem perder o conjunto",async()=>{
    m.req.mockImplementation((path:string)=>Promise.resolve(previa(path.includes("pagina=2")?2:1)));
    render(<EditorExecucaoProtocolo tarefas={tarefas} reprodutivo={false} onFechar={vi.fn()} onSalvo={vi.fn()}/>);
    fireEvent.click(screen.getByRole("button",{name:"Conferir execução"}));
    await screen.findByRole("button",{name:"Confirmar conjunto"});
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    fireEvent.click(screen.getByRole("button",{name:"Próxima"}));
    await waitFor(()=>expect(screen.getAllByRole("listitem")).toHaveLength(4));
    expect(m.req.mock.calls[1][2].itens).toHaveLength(14);
    expect(m.req.mock.calls[1][0]).toBe("/execucoes/previa?pagina=2&porPagina=10");
  });
  it("timeout conserva chave de retry e o recibo só lista10fatos",async()=>{
    let tentativa=0;
    m.req.mockImplementation((path:string)=>{
      if(path==="/execucoes/previa")return Promise.resolve(previa());
      tentativa++;if(tentativa===1)return Promise.reject(new TypeError("Falha de rede"));
      return Promise.resolve({versao:1,chave:"chave",itens:tarefas.slice(0,10).map(t=>({tarefaId:t.id,animalId:t.animal.id,tipo:"APLICACAO",id:`fato-${t.id}`})),total:14,pagina:1,porPagina:10});
    });
    const salvo=vi.fn();render(<EditorExecucaoProtocolo tarefas={tarefas} reprodutivo={false} onFechar={vi.fn()} onSalvo={salvo}/>);
    fireEvent.click(screen.getByRole("button",{name:"Conferir execução"}));
    await screen.findByRole("button",{name:"Confirmar conjunto"});
    fireEvent.click(screen.getByRole("button",{name:"Confirmar conjunto"}));
    await waitFor(()=>expect(m.erro).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button",{name:"Confirmar conjunto"}));
    await screen.findByRole("heading",{name:"Aplicações registradas"});
    const chamadas=m.req.mock.calls.filter(c=>c[0]==="/execucoes/confirmar");
    expect(chamadas).toHaveLength(2);expect(chamadas[1][2].chave).toBe(chamadas[0][2].chave);
    expect(screen.getAllByRole("link",{name:"Abrir aplicação"})).toHaveLength(10);
    expect(salvo).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"Concluir"}));expect(salvo).toHaveBeenCalledTimes(1);
  });
});

 it("aplicação reprodutiva usa a classificação congelada da ação, sem consultar padrão atual do produto",()=>{
   const t=tarefa(1);
   t.tarefaOrigem.planejadoSnapshot={etapa:{nome:"Aplicação",tipo:"APLICACAO",intervalo:0,unidade:"DIAS",planoAplicacao:{produtoId:"produto",dose:"2",unidadeDose:"ML",tipoAplicacaoId:"tipo-congelado"}},previstaEm:"2026-10-01",previsaoOriginal:"2026-10-01",inicioReferencia:"2026-10-01"};
   expect(planoAplicacaoTarefa(t).tipoAplicacaoId).toBe("tipo-congelado");
 });
