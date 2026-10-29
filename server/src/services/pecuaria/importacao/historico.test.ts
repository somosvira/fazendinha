import {expect,it} from "vitest";
import {Prisma} from "@prisma/client";
import {fatoHistoricoSchema,prepararFatoHistoricoTx} from "./historico.js";
const comum={bancoOrigem:"IDEAGRI",chaveOrigem:"ECC:1",animalId:"7be84110-86c2-49b0-bf27-70f666c711ee",data:"2024-02-10",contexto:"INTERNO",propriedadeId:1,evidencia:"Resultado original conferido",snapshotOrigem:{},tipoExameId:"7be84110-86c2-49b0-bf27-70f666c711ee",formatoExameHash:"a".repeat(64)};
it("ECC sem escala comprovada não vira evidência clínica",()=>{
 expect(fatoHistoricoSchema.safeParse({tipo:"ECC",dados:{...comum,resultadoNumero:3}}).success).toBe(false);
 expect(fatoHistoricoSchema.safeParse({tipo:"ECC",dados:{...comum,resultadoNumero:3,escala:"1_A_5",referenciaEscala:"Escala documentada de 1 a 5"}}).success).toBe(true);
});

function contextoTx() {
 return {usuario:{findUnique:async()=>({id:7})},animal:{findUnique:async()=>({id:comum.animalId,dataNascimento:new Date("2020-01-01"),dataEntrada:new Date("2024-01-01")})},baixaAnimal:{findFirst:async()=>null},localizacaoAnimal:{findMany:async()=>[{id:"local",propriedadeId:1}]}};
}
it("vínculo de ECC exige escala, finalidade e sítio compatíveis",async()=>{
 const tipo={id:comum.tipoExameId,ativo:true,tipoResultado:"NUMERO",nome:"ECC",campos:[],versaoFormato:1,unidade:null,opcoes:[]};
 const {hashFormatoExame}=await import("../exames/formato-snapshot.js");
 const dados={...comum,contexto:"INTERNO" as const,formatoExameHash:hashFormatoExame(tipo),resultadoNumero:3,escala:"1_A_9" as const,referenciaEscala:"Escala original 1 a 9"};
 const exame={id:"existente",propriedadeId:1,resultadoNumero:new Prisma.Decimal(3),finalidadePrincipal:"ECC",anotacaoOriginal:JSON.stringify({payload:{escala:"1_A_5"}}),resultados:[]};
 const preparar=async (alteracoes:Record<string,unknown>)=>prepararFatoHistoricoTx({...contextoTx(),tipoExame:{findUnique:async()=>tipo},exameAnimal:{findMany:async()=>[{...exame,...alteracoes}]}}as unknown as Prisma.TransactionClient,{tipo:"ECC",dados},7,{operacao:"VINCULAR",destinoId:"existente",motivo:"Origem conferida explicitamente"});
 await expect(preparar({})).rejects.toMatchObject({code:"CONFLITO"});
 await expect(preparar({anotacaoOriginal:JSON.stringify({payload:{escala:"1_A_9"}}),propriedadeId:2})).rejects.toMatchObject({code:"CONFLITO"});
 await expect(preparar({anotacaoOriginal:JSON.stringify({payload:{escala:"1_A_9"}}),finalidadePrincipal:null})).rejects.toMatchObject({code:"CONFLITO"});
 await expect(preparar({anotacaoOriginal:JSON.stringify({payload:{escala:"1_A_9"}})})).resolves.toMatchObject({existenteId:"existente"});
});

it("vínculo de mastite exige mesmo encerramento e não perde achados e tratamentos",async()=>{
 const {tipoExameId,formatoExameHash,...base}=comum;
 const dados={...base,contexto:"INTERNO" as const,doencaId:comum.tipoExameId,achadosPorTeto:[],tratamentos:[],fim:"2024-02-12",desfecho:null};
 const preparar=async (alteracoes:Record<string,unknown>)=>prepararFatoHistoricoTx({...contextoTx(),doenca:{findUnique:async()=>({id:dados.doencaId,ativo:true})},ocorrenciaSanitaria:{findMany:async()=>[{id:"existente",propriedadeId:1,fim:null,desfecho:null,observacao:JSON.stringify({payload:dados}),...alteracoes}]}}as unknown as Prisma.TransactionClient,{tipo:"MASTITE",dados},7,{operacao:"VINCULAR",destinoId:"existente",motivo:"Origem conferida explicitamente"});
 await expect(preparar({})).rejects.toMatchObject({code:"CONFLITO"});
 await expect(preparar({fim:new Date(dados.fim),propriedadeId:2})).rejects.toMatchObject({code:"CONFLITO"});
 await expect(preparar({fim:new Date(dados.fim),observacao:JSON.stringify({payload:{...dados,tratamentos:[{descricao:"Outro tratamento"}]}})})).rejects.toMatchObject({code:"CONFLITO"});
 await expect(preparar({fim:new Date(dados.fim)})).resolves.toMatchObject({existenteId:"existente"});
});
it("coletivo não aceita animal e ausência de laudo não impede dado estruturado",()=>{
 const {animalId,...resto}=comum;
 expect(fatoHistoricoSchema.safeParse({tipo:"QUALIDADE",dados:{...resto,sujeito:{tipo:"COLETIVO",origem:"Tanque original"},resultados:[],referenciaUnidades:"Unidades preservadas do formato"}}).success).toBe(true);
 expect(fatoHistoricoSchema.safeParse({tipo:"QUALIDADE",dados:{...resto,sujeito:{tipo:"COLETIVO",origem:"Tanque original",animalId},resultados:[],referenciaUnidades:"Unidades preservadas do formato"}}).success).toBe(false);
});
it("correção não autorizada não reescreve registro clínico pelo importador",async()=>{
 const tx={usuario:{findUnique:async()=>({id:7})}}as unknown as Prisma.TransactionClient;
 await expect(prepararFatoHistoricoTx(tx,{tipo:"ECC",dados:{...comum,contexto:"INTERNO",resultadoNumero:3,escala:"1_A_5",referenciaEscala:"Escala documentada"}},7,{operacao:"CORRIGIR",destinoId:"existente",versaoEsperada:1,motivo:"Correção da origem"})).rejects.toMatchObject({code:"CONFLITO"});
});

it("vínculo de peso não transforma estimativa ou contexto divergente em medida operacional",async()=>{
 const {Prisma}=await import("@prisma/client");
 const dados={...comum,chaveOrigem:"PESO:1",tipo:"ROTINA" as const,origem:"MANUAL" as const,precisao:"ESTIMADO" as const,pesoKg:200,contexto:"INTERNO" as const};
 const {tipoExameId,formatoExameHash,snapshotOrigem,...peso}=dados;
 const tx={usuario:{findUnique:async()=>({id:7})},pesagem:{findUnique:async()=>({id:"existente",animalId:comum.animalId,data:new Date(comum.data),pesoKg:new Prisma.Decimal(200),tipo:"ROTINA",origem:"MANUAL",precisao:"MEDIDO",contextoHistorico:"INTERNO",propriedadeId:1})},animal:{findUnique:async()=>({id:comum.animalId,dataNascimento:new Date("2020-01-01"),dataEntrada:new Date("2024-01-01")})},baixaAnimal:{findFirst:async()=>null},localizacaoAnimal:{findMany:async()=>[{id:"local",propriedadeId:1}]}}as unknown as Prisma.TransactionClient;
 await expect(prepararFatoHistoricoTx(tx,{tipo:"PESAGEM",dados:{...peso,observacao:null}},7,{operacao:"VINCULAR",destinoId:"existente",motivo:"Conferência explícita da origem"})).rejects.toMatchObject({code:"CONFLITO"});
});

it("o contrato comum aceita associação pendente sem transformar pesagem em encerramento", async () => {
 const pesoId="00000000-0000-7000-8000-000000000001";
 const fato=fatoHistoricoSchema.parse({tipo:"ASSOCIACAO_PESO_SECAGEM",dados:{bancoOrigem:"IDEAGRI",chaveOrigem:"ASSOCIACAO_SECAGEM:1",pesagem:{id:pesoId}}});
 const tx={usuario:{findUnique:async()=>({id:7})},pesagem:{findUnique:async()=>({id:pesoId,animalId:comum.animalId,data:new Date("2024-02-10"),pesoKg:new Prisma.Decimal(500),tipo:"SECAGEM",origem:"MANUAL",precisao:"ESTIMADO",contextoHistorico:"INTERNO",propriedadeId:1})}} as unknown as Prisma.TransactionClient;
 const r=await prepararFatoHistoricoTx(tx,fato,7);
 expect(r).toHaveProperty("pendente");expect(r.existenteId).toBeNull();expect(r.contexto).toHaveProperty("associacaoSecagem.estado","PENDENTE");
});
