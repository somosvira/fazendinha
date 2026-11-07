import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { exigirBancoIntegracaoPecuaria } from "../../../lib/banco-pecuaria-integration.fixture.js";
import { criarDemandasDoFatoTx, criarPoliticaAcompanhamentoTx } from "./acompanhamento.js";
import { proporAcompanhamentos } from "./acompanhamento.calc.js";
import { parametrosAcompanhamentoSchema, criarPoliticaAcompanhamentoSchema } from "./acompanhamento.schemas.js";

const banco=process.env.PECUARIA_DB_INTEGRATION==="1"?describe:describe.skip;
const dia=(s:string)=>new Date(`${s}T00:00:00Z`);
const json=(v:unknown):Prisma.InputJsonValue=>JSON.parse(JSON.stringify(v));
const regra=(intervalo:number)=>({finalidade:"DIAGNOSTICO",ocorrencia:1,publico:"TE",referencia:"TE",intervalo,unidade:"DIAS",antecedencia:2,tolerancia:1,resolucao:"DIAGNOSTICO_CONCLUSIVO"});
const configuracao=(intervalo:number)=>({versao:2,efeito:"ALERTA",regras:[regra(intervalo)]});

// Toda fixture vive dentro de uma única transação revertida, sem limpar registros externos.
banco("prazos e revisões no PostgreSQL autorizado",()=>{
 it("valida vínculo, snapshot do modelo e revisão explícita em SQL",async()=>{
  exigirBancoIntegracaoPecuaria();
  const marca=`qa-prazos-${randomUUID()}`, cancelar=new Error("reverter fixture");
  await expect(prisma.$transaction(async tx=>{
   const sitio=await tx.propriedade.create({data:{nome:marca}});
   const animal=await tx.animal.create({data:{brinco:marca,sexo:"F",origem:"COMPRADO",dataNascimento:dia("2023-01-01"),dataEntrada:dia("2024-01-01")}});
   const modelo=await tx.protocolo.create({data:{nome:marca,tipo:"REPRODUTIVO",finalidade:"TETF",modalidadeTentativa:"ETAPA",modalidadeDiagnostico:"EXTERNO",configuracaoAcompanhamento:json(configuracao(20))}});
   const etapa=await tx.etapaProtocolo.create({data:{protocoloId:modelo.id,ordem:1,nome:"TE",tipo:"TENTATIVA",diaRelativo:0,configuracao:{tipo:"TENTATIVA",tentativaTipo:"TE"}}});
   const politica=await criarPoliticaAcompanhamentoTx(tx,criarPoliticaAcompanhamentoSchema.parse({chave:randomUUID(),propriedadeId:sitio.id,vigenteDesde:"2025-01-01",parametros:configuracao(30)}),null);
   const snapshot={versao:1,protocoloId:modelo.id,protocoloVersao:modelo.versao,diagnosticoIndividualEm:null,modelo:configuracao(20),sitio:{id:politica.id,versao:politica.versao,parametros:configuracao(30)}};
   const participacao=await tx.participacaoProtocolo.create({data:{protocoloId:modelo.id,animalId:animal.id,propriedadeId:sitio.id,inicio:dia("2026-01-01"),acompanhamentoSnapshot:json(snapshot)}});
   const tarefa=await tx.tarefaProtocolo.create({data:{execucaoId:participacao.id,etapaId:etapa.id,previstaPara:dia("2026-01-01")}});
   const tentativa=await tx.tentativaReprodutiva.create({data:{animalId:animal.id,propriedadeId:sitio.id,tarefaId:tarefa.id,data:dia("2026-01-01"),tipo:"TE",ciclo:1,ordem:1,origemMaterial:"DOCUMENTADA",geneticaSnapshot:{}}});
   await criarDemandasDoFatoTx(tx,{tentativaId:tentativa.id,tipoTentativa:"TE",animalId:animal.id,propriedadeId:sitio.id,data:tentativa.data},null,undefined,participacao.id);
   const demanda=await tx.demandaAcompanhamentoReprodutivo.findFirstOrThrow({where:{tentativaId:tentativa.id}});
   expect(demanda).toMatchObject({origemAdocao:"MODELO",politicaId:null,participacaoAcompanhamentoId:participacao.id,previstaPara:dia("2026-01-21")});
   const proposta=proporAcompanhamentos({...politica,parametros:parametrosAcompanhamentoSchema.parse(politica.parametros)},{tentativaId:tentativa.id,tipoTentativa:"TE",data:"2026-01-01"})[0];
   await tx.revisaoPrazoAcompanhamento.create({data:{demandaId:demanda.id,versaoAnterior:demanda.versao,politicaAnteriorId:null,politicaNovaId:politica.id,previstaAnterior:demanda.previstaPara!,previstaNova:dia(proposta.previstaPara),regraAnterior:json(demanda.regraSnapshot),regraNova:json(proposta.regraSnapshot),motivo:"Conferência da regra"}});
   await tx.demandaAcompanhamentoReprodutivo.update({where:{id:demanda.id},data:{politicaId:politica.id,origemAdocao:"ADOCAO_EXPLICITA",previstaPara:dia(proposta.previstaPara),regraSnapshot:json(proposta.regraSnapshot),versao:{increment:1}}});
   const outroAnimal=await tx.animal.create({data:{brinco:`${marca}-sem-regra`,sexo:"F",origem:"COMPRADO",dataNascimento:dia("2023-01-01"),dataEntrada:dia("2024-01-01")}});
   const outroModelo=await tx.protocolo.create({data:{nome:`${marca}-sem-regra`,tipo:"REPRODUTIVO",finalidade:"TETF",modalidadeTentativa:"ETAPA",modalidadeDiagnostico:"EXTERNO"}});
   const outraEtapa=await tx.etapaProtocolo.create({data:{protocoloId:outroModelo.id,ordem:1,nome:"TE",tipo:"TENTATIVA",diaRelativo:0,configuracao:{tipo:"TENTATIVA",tentativaTipo:"TE"}}});
   const semRegra={versao:1,protocoloId:outroModelo.id,protocoloVersao:outroModelo.versao,diagnosticoIndividualEm:null,modelo:null,sitio:null};
   const outraParticipacao=await tx.participacaoProtocolo.create({data:{protocoloId:outroModelo.id,animalId:outroAnimal.id,propriedadeId:sitio.id,inicio:dia("2026-01-01"),acompanhamentoSnapshot:json(semRegra)}});
   const outraTarefa=await tx.tarefaProtocolo.create({data:{execucaoId:outraParticipacao.id,etapaId:outraEtapa.id,previstaPara:dia("2026-01-01")}});
   const outraTentativa=await tx.tentativaReprodutiva.create({data:{animalId:outroAnimal.id,propriedadeId:sitio.id,tarefaId:outraTarefa.id,data:dia("2026-01-01"),tipo:"TE",ciclo:1,ordem:1,origemMaterial:"DOCUMENTADA",geneticaSnapshot:{}}});
   await criarDemandasDoFatoTx(tx,{tentativaId:outraTentativa.id,tipoTentativa:"TE",animalId:outroAnimal.id,propriedadeId:sitio.id,data:outraTentativa.data},null,undefined,outraParticipacao.id);
   expect(await tx.demandaAcompanhamentoReprodutivo.findFirstOrThrow({where:{tentativaId:outraTentativa.id}})).toMatchObject({origemAdocao:"SEM_REGRA",previstaPara:null,regraSnapshot:{motivo:"REGRA_NAO_CONFIGURADA"}});
   await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
   throw cancelar;
  },{timeout:30000})).rejects.toBe(cancelar);
 });
});
