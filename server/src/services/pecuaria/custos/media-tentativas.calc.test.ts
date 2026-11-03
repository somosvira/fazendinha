import { describe, expect, it } from "vitest";
import { mediaCustosTentativas } from "./media-tentativas.calc.js";
import type { FonteCusto } from "./custos.calc.js";
const fonte = (id:string, valor:string|null, extra:Partial<FonteCusto>={}):FonteCusto => ({id,tipo:"TENTATIVA",animalId:"a",propriedadeId:1,data:"2026-10-10",descricao:id,estadoFato:"VALIDO",participacaoId:null,origemMaterial:"DOCUMENTADA",movimentoEstoqueId:null,operacaoServicoId:null,valorMaterial:valor,valorServico:null,classificacao:{finalidade:"REPRODUCAO",materialNaoAplicavel:false,servicoNaoAplicavel:true,coberturaServico:"PROCEDIMENTO",valorMaterialDocumentado:null},...extra});
describe("média de custos atribuídos às tentativas",()=>{
  it("usa tentativas válidas do mesmo período e exclui custos gerais e anulações com consumo",()=>{
    const fontes=[fonte("a","80"),fonte("b","120"),fonte("antiga","500",{data:"2025-10-10"}),fonte("anulada","90",{estadoFato:"ANULADO · consumo mantido"}),fonte("exame","700",{tipo:"EXAME",operacaoServicoId:"s",valorMaterial:null,valorServico:"700"})];
    expect(mediaCustosTentativas(fontes,[],{inicio:"2026-10-01",fim:"2026-10-31"},true)).toMatchObject({tentativas:2,totalConhecido:"200.00",mediaConhecida:"100.00",cobertura:"PARCIAL"});
  });
  it("soma somente parcelas explicitamente atribuídas, uma vez por tentativa",()=>{
    const fontes=[fonte("a","80"),fonte("b","120"),fonte("preparo","100",{tipo:"APLICACAO"})];
    const vinculos=[{tentativaId:"a",aplicacaoId:"preparo",exameId:null,participacaoId:null,modo:"PARCELA" as const,valorMaterial:"20",valorServico:null},{tentativaId:"b",aplicacaoId:"preparo",exameId:null,participacaoId:null,modo:"PARCELA" as const,valorMaterial:"30",valorServico:null}];
    expect(mediaCustosTentativas(fontes,vinculos,{},true)).toMatchObject({totalConhecido:"250.00",mediaConhecida:"125.00"});
  });
  it("conserva parcial, desconhecido, zero e ocultação de valores",()=>{
    expect(mediaCustosTentativas([fonte("a","0"),fonte("b",null)],[],{},true)).toMatchObject({tentativas:2,totalConhecido:"0.00",mediaConhecida:"0.00",cobertura:"PARCIAL"});
    expect(mediaCustosTentativas([fonte("a",null)],[],{},true)).toMatchObject({mediaConhecida:null,cobertura:"DESCONHECIDO"});
    expect(mediaCustosTentativas([fonte("a","80")],[],{},false)).toMatchObject({mediaConhecida:null,totalConhecido:null,situacao:"OCULTO"});
    expect(mediaCustosTentativas([],[],{},true)).toMatchObject({tentativas:0,mediaConhecida:null});
  });
  it("aplica finalidade no numerador e na quantidade de tentativas",()=>{
    const outra=fonte("outra","900",{classificacao:{finalidade:"ROTINA",materialNaoAplicavel:false,servicoNaoAplicavel:true,coberturaServico:"PROCEDIMENTO",valorMaterialDocumentado:null}});
    expect(mediaCustosTentativas([fonte("a","80"),outra],[],{finalidade:"REPRODUCAO"},true)).toMatchObject({tentativas:1,mediaConhecida:"80.00"});
    expect(mediaCustosTentativas([fonte("a","80"),fonte("sem","20",{classificacao:null})],[],{finalidade:"SEM_CLASSIFICACAO"},true)).toMatchObject({tentativas:1,mediaConhecida:"20.00"});
  });
});
