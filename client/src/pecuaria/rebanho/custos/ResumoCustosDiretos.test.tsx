// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ResumoCustosDiretos } from "./ResumoCustosDiretos";
import type { CustosDTO } from "./api";
import { navegarPara } from "../../../router";
vi.mock("../../../router",()=>({navegarPara:vi.fn()}));
vi.mock("./CustosDiretos",()=>({CustosDiretos:({tentativaId}:{tentativaId?:string})=><p>Composição da tentativa {tentativaId}</p>}));
const dados:CustosDTO={rotulo:"Custo direto registrado",cobertura:"PARCIAL",situacao:"PARCIAL",totalConhecido:"180.00",componentesPendentes:1,componentes:[],limitacoes:[],escopo:"ANIMAL_PERIODO",propriedadeId:1,periodo:{inicio:"2026-01-01",fim:"2026-10-31",referencia:"DATA_DO_FATO"},totalIntegral:null,totalComponentes:3,pagina:1,limite:10,fontes:[],atribuicoesPreparos:[],totaisNatureza:{material:"80.00",servico:"100.00"},mediaPorTentativa:{tentativas:2,cobertura:"PARCIAL",situacao:"PARCIAL",totalConhecido:"180.00",mediaConhecida:"90.00"},procedimentos:{total:1,pagina:1,porPagina:10,itens:[{chave:"TENTATIVA:t",tipoFonte:"TENTATIVA",fonteId:"t",animalId:"a",data:"2026-10-01",descricao:"Tentativa IA",totalConhecido:"180.00",cobertura:"PARCIAL",situacao:"PARCIAL",material:{totalConhecido:"80.00",cobertura:"COMPLETO",situacao:"COMPLETO"},servico:{totalConhecido:"100.00",cobertura:"COMPLETO",situacao:"COMPLETO"}}]}};
afterEach(cleanup);
it("mostra média do servidor e uma linha por fato; detalhes abrem composição exata em modal",()=>{
 render(<ResumoCustosDiretos mostrarMediaPorTentativa dados={dados} propriedadeId={1} porAnimal comRecorte pagina={1} aoMudarPagina={vi.fn()}/>);
 expect(screen.getByText(/90,00/)).toBeTruthy();expect(screen.getByText(/2 tentativas na base da média/)).toBeTruthy();
 const tabela=screen.getByRole("table",{name:"Custos diretos por fato"});expect(within(tabela).getAllByRole("row")).toHaveLength(2);
 fireEvent.click(within(tabela).getByRole("button",{name:"Detalhes"}));expect(screen.getByRole("dialog")).toBeTruthy();expect(screen.getByText("Composição da tentativa t")).toBeTruthy();
});
it("não apresenta média ou totais ocultos como zero",()=>{
 render(<ResumoCustosDiretos mostrarMediaPorTentativa dados={{...dados,situacao:"OCULTO",totalConhecido:null,mediaPorTentativa:{...dados.mediaPorTentativa!,situacao:"OCULTO",mediaConhecida:null,totalConhecido:null}}} propriedadeId={1} porAnimal comRecorte pagina={1} aoMudarPagina={vi.fn()}/>);
 expect(screen.getAllByText("Valores ocultos").length).toBeGreaterThan(0);expect(screen.queryByText(/90,00/)).toBeNull();expect(screen.queryByText(/180,00/)).toBeNull();
});
it("detalhe nutricional abre o fechamento exato em vez dos custos gerais do animal",()=>{
 const nutricional={...dados,procedimentos:{...dados.procedimentos!,itens:[{...dados.procedimentos!.itens[0],tipoFonte:"NUTRICAO" as const,fonteId:"participacao-consumo",fechamentoId:"fechamento-2026-10",descricao:"Nutrição · período"}]}};
 render(<ResumoCustosDiretos mostrarMediaPorTentativa dados={nutricional} propriedadeId={1} porAnimal comRecorte pagina={1} aoMudarPagina={vi.fn()}/>);
 fireEvent.click(screen.getByRole("button",{name:"Detalhes"}));expect(navegarPara).toHaveBeenCalledWith(expect.stringContaining("fechamentoId=fechamento-2026-10"));expect(screen.queryByRole("dialog")).toBeNull();expect(screen.queryByText(/Composição da tentativa/)).toBeNull();
});
