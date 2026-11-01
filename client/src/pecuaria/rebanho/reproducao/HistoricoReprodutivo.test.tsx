// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HistoricoReprodutivo } from "./HistoricoReprodutivo";
vi.mock("../protocolos/OrigensFatoProtocolo",()=>({OrigensFatoProtocolo:()=> <span>Origem comprovada</span>}));
beforeEach(()=>{window.history.replaceState(null,"","/pecuaria/rebanho/animais/a#reproducao");vi.stubGlobal("ResizeObserver",class{observe(){}disconnect(){}});});afterEach(cleanup);
it("alterna histórico e mantém evento comprovado de protocolo na tabela",()=>{
 render(<HistoricoReprodutivo animalId="a" onAbrir={vi.fn()} fatos={[{id:"p1",animalId:"a",data:"2026-10-04",grupo:"Protocolo",registro:"Ovsynch",resultado:"Iniciado",urlDetalhe:"/pecuaria/reproducao/participacoes/p1"}]}/>);
 expect(screen.getByRole("list",{name:"Histórico reprodutivo por data"})).toBeTruthy();expect(screen.getByText("Ovsynch")).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"Tabela"}));expect(screen.getAllByRole("table").length).toBeGreaterThan(0);expect(screen.getAllByText("Ovsynch").length).toBeGreaterThan(0);
});
it("partos abrem ficha da cria real e exibem responsável sem inferir identificação",()=>{
 render(<HistoricoReprodutivo chaveUrl="partos" animalId="a" propriedadeId={2} onAbrir={vi.fn()} fatos={[{id:"parto",animalId:"a",data:"2026-10-04",grupo:"Parto",desfecho:"NASCIMENTO",responsavel:"Ana",crias:[{id:"cria",animalId:"b",viva:true,sexo:"FEMEA",brinco:"2335"}]}]}/>);
 expect(screen.getAllByRole("link",{name:"2335 · Fêmea"})[0].getAttribute("href")).toBe("/pecuaria/rebanho/animais/b?sitio=2");expect(screen.getAllByText("Ana").length).toBeGreaterThan(0);expect(screen.getAllByRole("button",{name:"Ver parto"}).length).toBeGreaterThan(0);
});
