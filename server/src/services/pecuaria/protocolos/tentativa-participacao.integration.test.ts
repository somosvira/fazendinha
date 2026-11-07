import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { exigirBancoIntegracaoPecuaria } from "../../../lib/banco-pecuaria-integration.fixture.js";
import { criarDemandasDoFatoTx, reconciliarDemandasAnimalTx } from "../reproducao/acompanhamento.js";
const banco=process.env.PECUARIA_DB_INTEGRATION==="1"?describe:describe.skip;
const dia=(s:string)=>new Date(`${s}T00:00:00Z`);
// Fixtures próprias, todas revertidas na transação. Não há limpeza por nome/prefixo/banco.
banco("vínculo externo e prazo congelado em PostgreSQL",()=>{
 it("aceita prova explícita externa, impede duplicidade/apagamento e reconcilia anulação",async()=>{
  exigirBancoIntegracaoPecuaria();const marca=`qa-vinculo-${randomUUID()}`,rollback=new Error("reverter fixtures próprias");
  await expect(prisma.$transaction(async tx=>{
   const sitio=await tx.propriedade.create({data:{nome:marca}});
   const usuario=await tx.usuario.create({data:{nome:marca,email:`${marca}@example.test`,papel:"DONO",abas:[],flags:[],dono:true}});
   const animal=await tx.animal.create({data:{brinco:marca,sexo:"F",origem:"COMPRADO",dataNascimento:dia("2023-01-01"),dataEntrada:dia("2024-01-01")}});
   const configuracao={versao:2,efeito:"ALERTA",regras:[{finalidade:"DIAGNOSTICO",ocorrencia:1,publico:"IA",referencia:"IA",intervalo:30,unidade:"DIAS",antecedencia:0,tolerancia:0,resolucao:"DIAGNOSTICO_CONCLUSIVO"}]};
   const modelo=await tx.protocolo.create({data:{nome:marca,tipo:"REPRODUTIVO",finalidade:"IATF",modalidadeTentativa:"EXTERNA",modalidadeDiagnostico:"EXTERNO",configuracaoAcompanhamento:configuracao}});
   const p=await tx.participacaoProtocolo.create({data:{protocoloId:modelo.id,animalId:animal.id,propriedadeId:sitio.id,inicio:dia("2026-01-01"),inicioEfetivo:dia("2026-01-01"),acompanhamentoSnapshot:{versao:1,protocoloId:modelo.id,protocoloVersao:modelo.versao,diagnosticoIndividualEm:null,modelo:configuracao,sitio:null}}});
   const t=await tx.tentativaReprodutiva.create({data:{animalId:animal.id,propriedadeId:sitio.id,data:dia("2026-01-12"),tipo:"IA",ciclo:1,ordem:1,origemMaterial:"DOCUMENTADA",geneticaSnapshot:{}}});
   const dados={participacaoId:p.id,tentativaId:t.id,propriedadeId:sitio.id,motivo:"Serviço conferido pelo responsável",snapshot:{tentativaId:t.id,animalId:animal.id,data:"2026-01-12",tipo:"IA"},criadoPorId:usuario.id};
   const v=await tx.vinculoTentativaParticipacao.create({data:dados});
   await criarDemandasDoFatoTx(tx,{tentativaId:t.id,tipoTentativa:t.tipo,animalId:animal.id,propriedadeId:sitio.id,data:t.data},usuario.id,undefined,p.id);
   const d=await tx.demandaAcompanhamentoReprodutivo.findFirstOrThrow({where:{tentativaId:t.id}});
   expect(d).toMatchObject({participacaoAcompanhamentoId:p.id,origemAdocao:"MODELO",previstaPara:dia("2026-02-11")});
   await tx.$executeRaw`SAVEPOINT duplicado`;
   await expect(tx.vinculoTentativaParticipacao.create({data:dados})).rejects.toThrow();
   await tx.$executeRaw`ROLLBACK TO SAVEPOINT duplicado`;
   await tx.tentativaReprodutiva.update({where:{id:t.id},data:{status:"ANULADO",motivoAnulacao:"Correção factual conferida",anuladoEm:new Date()}});
   await reconciliarDemandasAnimalTx(tx,animal.id,usuario.id);
   expect(await tx.demandaAcompanhamentoReprodutivo.findUniqueOrThrow({where:{id:d.id}})).toMatchObject({estado:"ENCERRADA",motivoEncerramento:"ORIGEM_ANULADA"});
   await tx.$executeRaw`SAVEPOINT apagar`;
   await expect(tx.vinculoTentativaParticipacao.delete({where:{id:v.id}})).rejects.toThrow();
   await tx.$executeRaw`ROLLBACK TO SAVEPOINT apagar`;
   await tx.vinculoTentativaParticipacao.update({where:{id:v.id},data:{revogadoEm:new Date(),revogadoPorId:usuario.id,motivoRevogacao:"Vínculo conferido após anulação"}});
   await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
   throw rollback;
  },{timeout:30000})).rejects.toBe(rollback);
 });
});
