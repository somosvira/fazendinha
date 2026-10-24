import { describe,expect,it } from "vitest";
import { execucaoProtocoloSchema } from "./execucao.schemas.js";
import { manejoProtocoloSchema,retiradaProtocoloSchema,anularManejoProtocoloSchema } from "./execucao.manejos.schemas.js";
const id="e2000000-0000-4000-8000-000000000001";
const base={animalId:id,tarefaId:id,propriedadeId:1,data:"2026-10-01"};
describe("contratos de manejo e retirada",()=>{
 it("manejo sem produto aceita dia sem inventar horário",()=>{const i=manejoProtocoloSchema.parse({...base,tipo:"MANEJO"});expect(i.realizadaEm).toBeUndefined();expect(manejoProtocoloSchema.safeParse({...i,produtoId:id}).success).toBe(false);});
 it("retirada exige inserção e rejeita campo de devolução de estoque",()=>{expect(retiradaProtocoloSchema.safeParse({...base,tipo:"RETIRADA"}).success).toBe(false);expect(retiradaProtocoloSchema.safeParse({...base,tipo:"RETIRADA",insercaoAplicacaoId:id,destinoConsumo:"DEVOLVER_ESTOQUE"}).success).toBe(false);});
 it("preserva centavos exatos e limite comum100",()=>{expect(manejoProtocoloSchema.safeParse({...base,tipo:"MANEJO",valorServicoAtribuido:"1.001"}).success).toBe(false);expect(execucaoProtocoloSchema.safeParse({versao:1,propriedadeId:1,itens:Array(101).fill({...base,tipo:"MANEJO"})}).success).toBe(false);});
 it("anulação declara manutenção da realização",()=>{expect(anularManejoProtocoloSchema.safeParse({chave:id,propriedadeId:1,motivo:"Erro documental"}).success).toBe(false);expect(anularManejoProtocoloSchema.parse({chave:id,propriedadeId:1,motivo:"Erro documental",realizacaoMantida:true}).realizacaoMantida).toBe(true);});
});
