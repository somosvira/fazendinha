import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { registrarEvidenciaAvaliacaoTx } from "./evidencia-reprodutiva.js";
const campos=[{codigo:"CONCLUSAO_GESTACIONAL",tipo:"OPCAO",opcoes:["POSITIVO","NEGATIVO","INCONCLUSIVO"],obrigatorio:false},{codigo:"SEXO_FETAL",tipo:"OPCAO",opcoes:["F","M"]}];
describe("persistência da decisão posterior ao DG",()=>{
 it.each(["INDICAR","NAO_INDICAR",null] as const)("conserva %s no fato e na resposta sem criar participação",async decisaoIatf=>{
  const exame=vi.fn().mockResolvedValue({});
  const tx={
   $executeRaw:vi.fn().mockResolvedValue(1),
   tipoExame:{findUnique:vi.fn().mockResolvedValue({id:"exame",nome:"DG",tipoResultado:"MULTIPLO",contexto:"REPRODUTIVO",ativo:true,versaoFormato:1,campos})},
   exameAnimal:{create:exame},
   avaliacaoReprodutiva:{findUniqueOrThrow:vi.fn().mockResolvedValue({id:"dg",resultado:"NEGATIVO"})},
  } as unknown as Prisma.TransactionClient;
  const r=await registrarEvidenciaAvaliacaoTx(tx,{id:"dg",animalId:"a",data:new Date("2026-11-03"),resultado:"NEGATIVO",decisaoIatf,conduta:decisaoIatf==="INDICAR"?"IATF":null});
  expect(exame).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({interpretacao:{create:expect.objectContaining({decisaoIatf})}})}));
  expect(r.decisaoIatf).toBe(decisaoIatf);
 });
});
