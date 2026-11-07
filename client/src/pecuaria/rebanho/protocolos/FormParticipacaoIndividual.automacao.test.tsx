// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FormParticipacaoIndividual } from "./FormParticipacaoIndividual";
import { esperarOpcoes, mudarCampo } from "@/lib/controles.fixture";
import { reqProtocolo } from "./api";
vi.mock("./api", async original=>({...await original<typeof import("./api")>(),reqProtocolo:vi.fn()}));
vi.mock("./useAcoesInicioProtocolo",()=>({useAcoesInicioProtocolo:()=>({etapas:[{id:"e1",momento:{politicaExecucao:"AUTOMATICA_EXCECAO"}}],erro:null,recarregar:vi.fn()})}));
vi.mock("./PreparacaoAutomacao",()=>({PreparacaoAutomacao:({onChange}:{onChange:(entradas:unknown[],pronta:boolean,revisoes:unknown[])=>void})=><button type="button" onClick={()=>onChange([{animalId:"a1",etapaId:"e1",dados:{produtoId:"produto"}}],true,[{animalId:"a1",etapaId:"e0",decisao:"DISPENSAR",motivo:"Etapa anterior não realizada"}])}>Concluir preparo de teste</button>}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it("exige preparação, manda dados somente na confirmação e invalida ao mudar o início",async()=>{
 vi.mocked(reqProtocolo).mockImplementation(async caminho=>caminho.startsWith("/versoes")?{itens:[{id:"p1",nome:"Automático",versao:1}],total:1,pagina:1,porPagina:10}:caminho==="/participacoes/previa"?{itens:[],total:0,pagina:1,porPagina:10,avisos:[]}:{id:"p-individual"});
 render(<FormParticipacaoIndividual animalId="a1" propriedadeId={7} onFechar={vi.fn()} onSalvo={vi.fn()}/>);
 await esperarOpcoes(() => screen.getByLabelText("Protocolo publicado"), o => o.some(i => i.texto === "Automático · v1"));
 mudarCampo(screen.getByLabelText("Protocolo publicado"),{target:{value:"p1"}});
 mudarCampo(screen.getByLabelText("Início previsto"),{target:{value:"2026-11-15"}});
 fireEvent.click(screen.getByRole("checkbox",{name:"Conferi o contexto sanitário e reprodutivo deste animal."}));
 expect(screen.getByRole("button",{name:"Conferir calendário"})).toHaveProperty("disabled",true);
 fireEvent.click(screen.getByRole("button",{name:"Concluir preparo de teste"}));
 fireEvent.click(screen.getByRole("button",{name:"Conferir calendário"}));
 await screen.findByText("Calendário previsto");
 const previa=vi.mocked(reqProtocolo).mock.calls.find(([p])=>p==="/participacoes/previa");expect(previa?.[2]).not.toHaveProperty("automacoes");
 fireEvent.click(screen.getByRole("button",{name:"Confirmar participação"}));
 await waitFor(()=>expect(reqProtocolo).toHaveBeenCalledWith("/participacoes",7,expect.objectContaining({automacoes:[{animalId:"a1",etapaId:"e1",dados:{produtoId:"produto"}}],revisaoRetroativa:[expect.objectContaining({decisao:"DISPENSAR"})]})));
 mudarCampo(screen.getByLabelText("Início previsto"),{target:{value:"2026-11-16"}});
 expect(screen.getByRole("button",{name:"Conferir calendário"})).toHaveProperty("disabled",true);
});
