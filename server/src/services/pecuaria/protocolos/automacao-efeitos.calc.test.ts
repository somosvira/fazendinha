import { expect, it } from "vitest";
import { efeitosAplicacao } from "./automacao-efeitos.calc.js";
it("sem movimento não promete entrada; perda não retorna material",()=>{
 expect(efeitosAplicacao({reverter:true,destinoConsumo:"DEVOLVER_ESTOQUE",possuiMovimentoEstoque:false}).efeitoMaterial).toMatch(/não será criada entrada/);
 expect(efeitosAplicacao({reverter:true,destinoConsumo:"MANTER_CONSUMO",administracaoMantida:false,possuiMovimentoEstoque:true}).efeitoMaterial).toMatch(/sem devolução/);
});
it("anulação documental não elimina administração/carência e desconhecido continua distinto",()=>{
 expect(efeitosAplicacao({reverter:true,destinoConsumo:"MANTER_CONSUMO",administracaoMantida:true,possuiMovimentoEstoque:true}).efeitoAdministracao).toMatch(/real mantida/);
 expect(efeitosAplicacao({reverter:true,destinoConsumo:"MANTER_CONSUMO",possuiMovimentoEstoque:true}).efeitoAdministracao).toMatch(/não esclarecida/);
 expect(efeitosAplicacao({reverter:false,possuiMovimentoEstoque:true}).efeitoCarencia).toMatch(/continua/);
});
