import { expect, it } from "vitest";
import { FILTROS_AVANCADOS_VAZIOS, contarFiltrosAvancados, consultaFiltrosAvancados, validarFiltrosAvancados } from "./busca-animais-filtros";
it("traduz categoria especial sem enviar filtros incompatíveis",()=>{
 expect(consultaFiltrosAvancados({...FILTROS_AVANCADOS_VAZIOS,categoriaId:"__sem_categoria__"},"TODOS")).toMatchObject({semCategoria:true,categoriaId:undefined,categoriaOrigem:undefined});
 expect(consultaFiltrosAvancados({...FILTROS_AVANCADOS_VAZIOS,categoriaId:"__manual__"},"TODOS")).toMatchObject({categoriaOrigem:"MANUAL",semCategoria:undefined,categoriaId:undefined});
});
it("preserva idade zero, conta campos preenchidos e não envia a baixa com ativos",()=>{
 const f={...FILTROS_AVANCADOS_VAZIOS,idadeMin:"0",tipoBaixa:"VENDA" as const,baixaDe:"2026-01-01"};
 expect(consultaFiltrosAvancados(f,"ATIVO")).toMatchObject({idadeMinMeses:0,tipoBaixa:undefined,baixaDe:undefined});
 expect(contarFiltrosAvancados(f,"TODOS")).toBe(3);expect(contarFiltrosAvancados(f,"ATIVO")).toBe(1);
});
it("valida idades inteiras entre 0 e 600, os limites e datas reais ordenadas",()=>{
 for(const idadeMin of ["-1","1.5","601","abc"]){expect(validarFiltrosAvancados({...FILTROS_AVANCADOS_VAZIOS,idadeMin},"TODOS")).not.toBeNull()}
 expect(validarFiltrosAvancados({...FILTROS_AVANCADOS_VAZIOS,idadeMin:"20",idadeMax:"10"},"TODOS")).toContain("máxima");
 expect(validarFiltrosAvancados({...FILTROS_AVANCADOS_VAZIOS,baixaDe:"2026-02-30"},"TODOS")).not.toBeNull();
 expect(validarFiltrosAvancados({...FILTROS_AVANCADOS_VAZIOS,baixaDe:"2026-11-03",baixaAte:"2026-11-01"},"TODOS")).toContain("final");
 expect(validarFiltrosAvancados({...FILTROS_AVANCADOS_VAZIOS,idadeMin:"0",idadeMax:"600"},"TODOS")).toBeNull();
});
