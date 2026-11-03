import { expect, it } from "vitest";
import { componentesDaFonte, type FonteCusto } from "./custos.calc.js";
import { procedimentosDosComponentes } from "./procedimentos.calc.js";
import { paginaCustos } from "./custos.js";
const fonte=(id:string):FonteCusto=>({id,tipo:"TENTATIVA",animalId:"a",propriedadeId:1,data:"2026-10-01",descricao:id,estadoFato:"VALIDO",participacaoId:null,origemMaterial:"ESTOQUE",movimentoEstoqueId:`m${id}`,operacaoServicoId:`s${id}`,valorMaterial:"80",valorServico:"100",classificacao:null});
it("pagina fatos inteiros, soma composição uma vez e não confunde desconhecido com zero",()=>{
 const componentes=Array.from({length:12},(_,i)=>componentesDaFonte(fonte(String(i).padStart(2,"0")))).flat();
 const grupos=procedimentosDosComponentes(componentes,true);expect(grupos).toHaveLength(12);expect(grupos[0]).toMatchObject({totalConhecido:"180.00",material:{totalConhecido:"80.00"},servico:{totalConhecido:"100.00"}});
 const primeira=paginaCustos(grupos,1,10),segunda=paginaCustos(grupos,2,10);expect(primeira.itens).toHaveLength(10);expect(segunda.itens).toHaveLength(2);expect(new Set([...primeira.itens,...segunda.itens].map(g=>g.chave)).size).toBe(12);
 const parcial=componentesDaFonte({...fonte("a"),valorServico:null});expect(procedimentosDosComponentes(parcial,true)[0]).toMatchObject({cobertura:"PARCIAL",totalConhecido:"80.00",servico:{totalConhecido:null}});
 expect(procedimentosDosComponentes(parcial,false)[0]).toMatchObject({situacao:"OCULTO",totalConhecido:null,material:{totalConhecido:null}});
});
it("conserva a identidade do fechamento nutricional distinto da participação de consumo",()=>{
 const componentes=componentesDaFonte({...fonte("participacao-consumo"),tipo:"NUTRICAO",fechamentoId:"fechamento-2026-10"});
 expect(procedimentosDosComponentes(componentes,true)[0]).toMatchObject({tipoFonte:"NUTRICAO",fonteId:"participacao-consumo",fechamentoId:"fechamento-2026-10"});
});
