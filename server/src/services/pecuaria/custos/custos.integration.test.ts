import { transacaoValidada } from "../../../lib/transacao-validada.js";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { exigirBancoIntegracaoPecuaria } from "../../../lib/banco-pecuaria-integration.fixture.js";
import { classificarCusto, consultarCustos, encerrarVinculoPreparo, vincularPreparo } from "./custos.js";
import { consultaCustosSchema } from "./custos.schemas.js";

// Esta suíte prova constraints reais e concorrência. Não é autorizada a executar localmente.
const comBanco=process.env.PECUARIA_DB_INTEGRATION==="1"&&process.env.CI==="true"&&process.env.GITHUB_ACTIONS==="true"?describe:describe.skip;
const operacoes:string[]=[];
const sitios:number[]=[], animais:string[]=[], aplicacoes:string[]=[], tentativas:string[]=[];
async function fixture(valor:string|null="30.00"){
 exigirBancoIntegracaoPecuaria();
 const sitio=await prisma.propriedade.create({data:{nome:`Custos independentes ${randomUUID()}`}});sitios.push(sitio.id);
 const animal=await prisma.animal.create({data:{brinco:`C${randomUUID()}`,sexo:"F",origem:"COMPRADO",dataNascimento:new Date("2024-01-01"),dataEntrada:new Date("2025-01-01")}});animais.push(animal.id);
 const aplicacao=await prisma.aplicacaoProduto.create({data:{animalId:animal.id,propriedadeId:sitio.id,data:new Date("2026-01-05"),precisaoTemporal:"DIA",
  nomeProdutoAplicado:"Preparatório com valor documental",origemInsumo:"SEM_ORIGEM_JUSTIFICADA",justificativaSemOrigem:"Material externo desta fixture, sem consumo de estoque"}});aplicacoes.push(aplicacao.id);
 const alvos=[];
 for(let ordem=1;ordem<=3;ordem++){
  const tentativa=await prisma.tentativaReprodutiva.create({data:{animalId:animal.id,propriedadeId:sitio.id,data:new Date(`2026-01-${9+ordem}`),tipo:"IA",ciclo:1,ordem,origemMaterial:"DOCUMENTADA",geneticaSnapshot:{origem:"FIXTURE"}}});
  tentativas.push(tentativa.id);alvos.push(tentativa);
 }
 const f={animalId:animal.id,propriedadeId:sitio.id,aplicacaoId:aplicacao.id,alvos};
 if(valor!==null)await classificarCusto(classificacao(f,valor),null);
 return f;
}
type Fixture=Awaited<ReturnType<typeof fixture>>;
function classificacao(f:Pick<Fixture,"propriedadeId"|"aplicacaoId">,valor:string|null,versao=0){return{chave:randomUUID(),propriedadeId:f.propriedadeId,tipo:"APLICACAO" as const,fonteId:f.aplicacaoId,versao,
 motivo:"Valor e finalidade conferidos nesta fixture",finalidade:"REPRODUCAO" as const,materialNaoAplicavel:false,servicoNaoAplicavel:true,coberturaServico:"PROCEDIMENTO" as const,
 materialDocumentado:valor===null?null:{valor,referencia:"FIXTURE_DOCUMENTO",evidencia:"Valor fictício comprovado explicitamente pelo caso de teste"}};}
function vinculo(f:Fixture,indice:number,valor:string|null){return{chave:randomUUID(),propriedadeId:f.propriedadeId,tentativaId:f.alvos[indice].id,tipo:"APLICACAO" as const,fonteId:f.aplicacaoId,
 modo:valor===null?"INTEGRAL" as const:"PARCELA" as const,valorMaterial:valor,valorServico:null,motivo:"Preparatório atribuído explicitamente ao alvo"};}
comBanco("custos — garantias SQL, casos felizes e concorrência no CI externo",()=>{
 beforeAll(()=>{exigirBancoIntegracaoPecuaria();});
 afterEach(async()=>{
  if(!animais.length&&!sitios.length)return;
  // Exclusão administrativa somente dos IDs criados pela suíte. Não remove fatos de outra execução.
  await transacaoValidada(async tx=>{
   await tx.vinculoPreparoTentativa.deleteMany({where:{tentativaId:{in:tentativas}}});
   await tx.classificacaoCustoPecuaria.deleteMany({where:{OR:[{aplicacaoId:{in:aplicacoes}},{tentativaId:{in:tentativas}}]}});
   await tx.aplicacaoProduto.deleteMany({where:{id:{in:aplicacoes}}});
   await tx.tentativaReprodutiva.deleteMany({where:{id:{in:tentativas}}});
   await tx.auditoriaPecuaria.deleteMany({where:{OR:[{animalId:{in:animais}},{propriedadeId:{in:sitios}}]}});
   await tx.requisicaoPecuaria.deleteMany({where:{propriedadeId:{in:sitios}}});
   await tx.operacao.deleteMany({where:{id:{in:operacoes}}});
   await tx.animal.deleteMany({where:{id:{in:animais}}});
   await tx.propriedade.deleteMany({where:{id:{in:sitios}}});
  });
  operacoes.length=0;sitios.length=0;animais.length=0;aplicacoes.length=0;tentativas.length=0;
 });

 it("classificação de finalidade sem documento grava SQL NULL e respeita o caso feliz",async()=>{
  const f=await fixture(null);const salva=await classificarCusto(classificacao(f,null),null);
  const prova=await prisma.$queryRaw<Array<{semDocumento:boolean}>>`SELECT "documentoMaterial" IS NULL AS "semDocumento" FROM pecuaria."ClassificacaoCustoPecuaria" WHERE id=${salva.id}`;
  expect(prova[0].semDocumento).toBe(true);expect(salva.versao).toBe(1);
 });
 it("zero documental comprovado é completo e não confundido com ausência",async()=>{
  const f=await fixture("0.00");
  expect(await consultarCustos(f.propriedadeId,consultaCustosSchema.parse({aplicacaoId:f.aplicacaoId}),true)).toMatchObject({totalConhecido:"0.00",cobertura:"COMPLETO"});
 });
 it.each([{valor:null,documento:{referencia:"Documento",evidencia:"Preço sem valor explícito"}},{valor:"0.00",documento:Prisma.DbNull}])("CHECK recusa valor/documento incompatíveis %#",async({valor,documento})=>{
  const f=await fixture(null);
  await expect(transacaoValidada(tx=>tx.classificacaoCustoPecuaria.create({data:{aplicacaoId:f.aplicacaoId,valorMaterialDocumentado:valor,documentoMaterial:documento,atualizadoEm:new Date()}}))).rejects.toThrow();
  expect(await prisma.classificacaoCustoPecuaria.count({where:{aplicacaoId:f.aplicacaoId}})).toBe(0);
 });
 it("CHECK recusa encerramento sem motivo mesmo quando o vínculo já nasce encerrado",async()=>{
  const f=await fixture();
  await expect(transacaoValidada(tx=>tx.vinculoPreparoTentativa.create({data:{tentativaId:f.alvos[0].id,aplicacaoId:f.aplicacaoId,modo:"INTEGRAL",motivo:"Atribuição conferida",encerradoEm:new Date(),motivoEncerramento:null}}))).rejects.toThrow();
 });
 it("parcelas20+10 esgotam origem30 e uma nova parcela0,01 é recusada",async()=>{
  const f=await fixture();await vincularPreparo(vinculo(f,0,"20.00"),null);await vincularPreparo(vinculo(f,1,"10.00"),null);
  await expect(vincularPreparo(vinculo(f,2,"0.01"),null)).rejects.toMatchObject({code:"CONFLITO"});
  const soma=await prisma.vinculoPreparoTentativa.aggregate({where:{aplicacaoId:f.aplicacaoId,encerradoEm:null},_sum:{valorMaterial:true}});
  expect(soma._sum.valorMaterial?.toFixed(2)).toBe("30.00");
 });
 it("integral não pode ser replicado nem combinado com outra parcela",async()=>{
  const f=await fixture();await vincularPreparo(vinculo(f,0,null),null);
  await expect(vincularPreparo(vinculo(f,1,"0.00"),null)).rejects.toMatchObject({code:"CONFLITO"});
  expect(await prisma.vinculoPreparoTentativa.count({where:{aplicacaoId:f.aplicacaoId,encerradoEm:null}})).toBe(1);
 });
 it("correção documental abaixo do já atribuído falha no serviço e também no SQL diferido",async()=>{
  const f=await fixture();await vincularPreparo(vinculo(f,0,"20.00"),null);
  await expect(classificarCusto(classificacao(f,"19.99",1),null)).rejects.toMatchObject({code:"CONFLITO"});
  await expect(transacaoValidada(tx=>tx.classificacaoCustoPecuaria.update({where:{aplicacaoId:f.aplicacaoId},data:{valorMaterialDocumentado:"19.99",versao:{increment:1}}}))).rejects.toThrow();
  expect((await prisma.classificacaoCustoPecuaria.findUniqueOrThrow({where:{aplicacaoId:f.aplicacaoId}})).valorMaterialDocumentado?.toFixed(2)).toBe("30.00");
 });
 it("duas confirmações concorrentes20+20 não ultrapassam a capacidade30",async()=>{
  const f=await fixture();const resultados=await Promise.allSettled([vincularPreparo(vinculo(f,0,"20.00"),null),vincularPreparo(vinculo(f,1,"20.00"),null)]);
  expect(resultados.filter(r=>r.status==="fulfilled")).toHaveLength(1);
  expect((await prisma.vinculoPreparoTentativa.aggregate({where:{aplicacaoId:f.aplicacaoId,encerradoEm:null},_sum:{valorMaterial:true}}))._sum.valorMaterial?.toFixed(2)).toBe("20.00");
 });
 it("reenvio da mesma chave conserva vínculo único e resposta original",async()=>{
  const f=await fixture(),input=vinculo(f,0,"15.00");const primeiro=await vincularPreparo(input,null);
  expect(await vincularPreparo(input,null)).toEqual(primeiro);
  expect(await prisma.vinculoPreparoTentativa.count({where:{aplicacaoId:f.aplicacaoId}})).toBe(1);
 });
 it("vínculo confirmado não permite editar valor; encerrar preserva história e libera capacidade",async()=>{
  const f=await fixture();const primeiro=await vincularPreparo(vinculo(f,0,"20.00"),null);
  await expect(transacaoValidada(tx=>tx.vinculoPreparoTentativa.update({where:{id:primeiro.id},data:{valorMaterial:19}}))).rejects.toThrow();
  await encerrarVinculoPreparo(primeiro.id,{chave:randomUUID(),propriedadeId:f.propriedadeId,motivo:"Atribuição corrigida com rastreabilidade"},null);
  await vincularPreparo(vinculo(f,1,"30.00"),null);
  expect(await prisma.vinculoPreparoTentativa.count({where:{aplicacaoId:f.aplicacaoId}})).toBe(2);
  expect((await prisma.vinculoPreparoTentativa.findUniqueOrThrow({where:{id:primeiro.id}})).valorMaterial?.toFixed(2)).toBe("20.00");
 });
 it("classificação de tentativa protege Serviço não aplicável e pacote de ambos contra alterações posteriores",async()=>{
  const f=await fixture(null);const t=f.alvos[0];
  const op=await prisma.operacao.create({data:{tipo:"SERVICO",status:"CONFIRMADA",data:new Date("2026-01-01"),propriedadeId:f.propriedadeId,valorTotal:70,descricao:"Pacote comprovado da fixture"}});operacoes.push(op.id);
  const entrada={...classificacao(f,null),tipo:"TENTATIVA" as const,fonteId:t.id};
  await classificarCusto(entrada,null);
  await expect(transacaoValidada(tx=>tx.tentativaReprodutiva.update({where:{id:t.id},data:{operacaoServicoId:op.id,valorServicoAtribuido:70}}))).rejects.toThrow();
  await classificarCusto({...entrada,chave:randomUUID(),versao:1,servicoNaoAplicavel:false},null);
  await transacaoValidada(tx=>tx.tentativaReprodutiva.update({where:{id:t.id},data:{operacaoServicoId:op.id,valorServicoAtribuido:70}}));
  await classificarCusto({...entrada,chave:randomUUID(),versao:2,servicoNaoAplicavel:false,coberturaServico:"AMBOS"},null);
  await expect(transacaoValidada(tx=>tx.tentativaReprodutiva.update({where:{id:t.id},data:{operacaoServicoId:null,valorServicoAtribuido:null}}))).rejects.toThrow();
  expect((await prisma.tentativaReprodutiva.findUniqueOrThrow({where:{id:t.id}})).operacaoServicoId).toBe(op.id);
 });
 it("consulta de custos não cria classificação, vínculo, consumo nem obrigação",async()=>{
  const f=await fixture(null);const antes=await prisma.classificacaoCustoPecuaria.count({where:{aplicacaoId:f.aplicacaoId}});
  const resultado=await consultarCustos(f.propriedadeId,consultaCustosSchema.parse({animalId:f.animalId}),false);
  expect(resultado.situacao).toBe("OCULTO");
  expect(await prisma.classificacaoCustoPecuaria.count({where:{aplicacaoId:f.aplicacaoId}})).toBe(antes);
  expect(await prisma.vinculoPreparoTentativa.count({where:{tentativaId:{in:f.alvos.map(t=>t.id)}}})).toBe(0);
  expect(await prisma.movimentoEstoque.count({where:{propriedadeId:f.propriedadeId}})).toBe(0);
  expect(await prisma.operacao.count({where:{propriedadeId:f.propriedadeId}})).toBe(0);
 });
});
