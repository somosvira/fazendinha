// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProtocolosReprodutivosAnimal, useHistoricoProtocolosReprodutivos } from "./ProtocolosReprodutivosAnimal";
import { reqProtocolo } from "../protocolos/api";
vi.mock("../protocolos/api",()=>({reqProtocolo:vi.fn(),consultaProtocolo:(v:Record<string,string|number|undefined>)=>"?"+new URLSearchParams(Object.entries(v).filter(([,x])=>x!==undefined).map(([k,x])=>[k,String(x)]))}));
const participacao={id:"p1",animalId:"a",propriedadeId:2,protocolo:{id:"proto",nome:"Acompanhamento gestacional",versao:1},programacao:null,inicioReferencia:"2026-10-01",inicioEfetivo:"2026-10-04",encerradoEm:null,motivoEncerramento:null,fase:{total:3,atendidas:1,situacao:"EM_ANDAMENTO",atual:{nome:"Reconfirmação",numero:2,situacao:"SEM_REGISTRO"}}};
beforeEach(()=>{window.history.replaceState(null,"","/pecuaria/rebanho/animais/a#reproducao");vi.stubGlobal("ResizeObserver",class{observe(){}disconnect(){}});vi.mocked(reqProtocolo).mockResolvedValue({itens:[participacao],total:1,pagina:1,porPagina:10});});
afterEach(()=>{cleanup();vi.clearAllMocks();});
it("mostra fase comprovada e navega ao protocolo individual mantendo retorno e sítio",async()=>{
 render(<ProtocolosReprodutivosAnimal animalId="a" propriedadeId={2}/>);
 expect(await screen.findByText("Reconfirmação · etapa 2 de 3")).toBeTruthy();
 const link=screen.getByRole("link",{name:"Ver protocolo"});expect(link.getAttribute("href")).toContain("/participacoes/p1?");expect(link.getAttribute("href")).toContain("sitio=2");
 fireEvent.change(screen.getByRole("searchbox",{name:"Buscar protocolo"}),{target:{value:"Gestacional"}});
 await waitFor(()=>expect(reqProtocolo).toHaveBeenLastCalledWith(expect.stringContaining("busca=Gestacional"),2));
});
function Historico(){const {eventos,erro}=useHistoricoProtocolosReprodutivos("a",2);return <div>{erro}{eventos.map(e=><p key={e.chaveHistorico}>{e.data} · {e.resultado}</p>)}</div>;}
it("histórico não transforma referência prevista ou conclusão sem data em fato ocorrido",async()=>{
 vi.mocked(reqProtocolo).mockResolvedValue({itens:[{...participacao,inicioEfetivo:null,fase:{total:3,atendidas:3,situacao:"CONCLUIDO",atual:null}},participacao,{...participacao,id:"p2",encerradoEm:"2026-10-10"}],total:3,pagina:1,porPagina:10});
 render(<Historico/>);await screen.findByText("2026-10-10 · Participação encerrada");expect(screen.queryByText(/2026-10-01/)).toBeNull();expect(screen.getAllByText("2026-10-04 · Iniciado")).toHaveLength(2);
});
