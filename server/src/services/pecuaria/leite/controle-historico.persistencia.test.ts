import { expect,it } from "vitest";
import type { Prisma } from "@prisma/client";
import { reordenarChavesJson } from "../../../test/jsonb.js";
import { prepararControleHistoricoLeiteTx, registrarControleHistoricoLeiteTx } from "./controle-historico.js";
const registro={tipo:"CONTROLE_PERIODICO" as const,inicio:"2024-02-10",fim:"2024-02-10",animalId:"7be84110-86c2-49b0-bf27-70f666c711ee",propriedadeId:1,contexto:"INTERNO" as const,lactacaoId:null,total:20,unidade:"L" as const,referenciaUnidade:"Documento original em litros",parcelas:[],evidencia:"Controle da fazenda registrado",snapshotOrigem:{arquivo:"original"}};
const fonte={bancoOrigem:"TESTE",chaveOrigem:"LEITE:1",registro};
function banco(){
 const estado:{registro:Record<string,unknown>|null;auditorias:Record<string,unknown>[]}={registro:null,auditorias:[]};
 const tx={
  $executeRaw:async()=>1,
  usuario:{findUnique:async()=>({id:7})},
  propriedade:{findUnique:async()=>({id:1})},
  animal:{findUnique:async()=>({id:registro.animalId,sexo:"F",dataNascimento:new Date("2020-01-01"),dataEntrada:new Date("2024-01-01")})},
  baixaAnimal:{findFirst:async()=>null},localizacaoAnimal:{findMany:async()=>[{id:"local",propriedadeId:1}]},
  controleHistoricoLeite:{findUnique:async()=>estado.registro,findUniqueOrThrow:async()=>estado.registro,findMany:async()=>[],
   create:async({data}:{data:Record<string,unknown>})=>(estado.registro={id:"controle",...data,provenienciaSnapshot:reordenarChavesJson(data.provenienciaSnapshot),versao:1}),
   updateMany:async({data}:{data:Record<string,unknown>})=>{estado.registro={...estado.registro,...data,provenienciaSnapshot:reordenarChavesJson(data.provenienciaSnapshot),versao:2};return {count:1};}},
  auditoriaPecuaria:{create:async({data}:{data:Record<string,unknown>})=>{estado.auditorias.push(data);return data;}},
 }as unknown as Prisma.TransactionClient;
 return {estado,tx};
}
it("prévia apenas lê e identifica cobertura sem lactação comprovada",async()=>{
 const {estado,tx}=banco();
 const p=await prepararControleHistoricoLeiteTx(tx,fonte,7);
 expect(p.existenteId).toBeNull();expect(p.contexto.semLactacaoComprovada).toBe(true);
 expect(estado).toEqual({registro:null,auditorias:[]});
});
it("incorpora um documento sem folhas diárias, estoque ou financeiro e reenvia com o mesmo ID",async()=>{
 const {estado,tx}=banco();
 expect(await registrarControleHistoricoLeiteTx(tx,fonte,7)).toEqual({id:"controle"});
 expect(await registrarControleHistoricoLeiteTx(tx,fonte,7)).toEqual({id:"controle"});
 expect(estado.registro).toMatchObject({tipo:"CONTROLE_PERIODICO",parcelas:[],lactacaoId:null,unidade:"L"});
 expect(estado.auditorias).toHaveLength(1);
 await expect(registrarControleHistoricoLeiteTx(tx,{...fonte,registro:{...registro,total:30}},7)).rejects.toMatchObject({code:"CONFLITO"});
});
it("correção explícita mantém documento/sujeito/período e audita antes/depois",async()=>{
 const {estado,tx}=banco();await registrarControleHistoricoLeiteTx(tx,fonte,7);
 const alterado={...fonte,registro:{...registro,total:25}};
 await registrarControleHistoricoLeiteTx(tx,alterado,7,{operacao:"CORRIGIR",destinoId:"controle",versaoEsperada:1,motivo:"Documento original retificado"});
 expect(estado.registro).toMatchObject({id:"controle",versao:2});
 expect(estado.auditorias).toHaveLength(2);expect(estado.auditorias[1]).toMatchObject({acao:"CORRECAO_HISTORICA",antes:expect.objectContaining({versao:1}),depois:expect.objectContaining({versao:2})});
 await expect(registrarControleHistoricoLeiteTx(tx,alterado,7,{operacao:"CORRIGIR",destinoId:"controle",versaoEsperada:1,motivo:"Documento original retificado"})).rejects.toMatchObject({code:"CONFLITO"});
});

it("reenvio conserva evidência JSONB aninhada sem ignorar valor, autoria, null ou ordem das parcelas",async()=>{
 const {estado,tx}=banco();
 const documento={...fonte,registro:{...registro,parcelas:[{rotulo:"Manhã",hora:"06:00",quantidade:8},{rotulo:"Tarde",hora:"17:00",quantidade:12}],snapshotOrigem:{arquivo:{nome:"controle-original",valores:{declarado:20,ausente:null}},linhas:[{ordem:1,valor:8},{ordem:2,valor:12}]}}};
 await registrarControleHistoricoLeiteTx(tx,documento,7);
 expect(await registrarControleHistoricoLeiteTx(tx,documento,7)).toEqual({id:"controle"});
 for(const divergente of [
  {...documento,registro:{...documento.registro,total:21}},
  {...documento,registro:{...documento.registro,parcelas:[...documento.registro.parcelas].reverse()}},
  {...documento,registro:{...documento.registro,snapshotOrigem:{...documento.registro.snapshotOrigem,linhas:[...documento.registro.snapshotOrigem.linhas].reverse()}}},
  {...documento,registro:{...documento.registro,snapshotOrigem:{...documento.registro.snapshotOrigem,arquivo:{...documento.registro.snapshotOrigem.arquivo,valores:{declarado:20}}}}},
 ]) await expect(registrarControleHistoricoLeiteTx(tx,divergente,7)).rejects.toMatchObject({code:"CONFLITO"});
 await expect(registrarControleHistoricoLeiteTx(tx,documento,8)).rejects.toMatchObject({code:"CONFLITO"});
 expect(estado.registro).toMatchObject({id:"controle",total:expect.anything(),versao:1});expect(estado.auditorias).toHaveLength(1);
});
