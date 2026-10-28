import { describe,it,expect } from "vitest";
import { regraAlertaSchema } from "./regras.js";
const base={nome:"Cuidado configurado",produtoId:"bfa5dbef-cc78-4bba-9fd2-9773e53f9042",gatilho:"IDADE",idadeMeses:6,propriedadeIds:[1],vigencia:"2026-10-28"};
describe("configuração sanitária explícita",()=>{
 it("permite um gatilho e faixa pública própria",()=>expect(regraAlertaSchema.parse({...base,idadeMinimaMeses:3,idadeMaximaMeses:12})).toMatchObject({gatilho:"IDADE",idadeMeses:6,idadeMinimaMeses:3,idadeMaximaMeses:12}));
 it("recusa gatilhos simultâneos e faixa invertida",()=>{expect(regraAlertaSchema.safeParse({...base,dataFixa:"2026-10-28"}).success).toBe(false);expect(regraAlertaSchema.safeParse({...base,idadeMinimaMeses:12,idadeMaximaMeses:3}).success).toBe(false);});
 it("não aceita peso nem cria destino fictício",()=>{expect(regraAlertaSchema.safeParse({...base,pesoMinimo:100}).success).toBe(false);expect(regraAlertaSchema.safeParse({...base,produtoId:null}).success).toBe(false);});
});
