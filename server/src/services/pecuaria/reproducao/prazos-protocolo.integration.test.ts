import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { exigirBancoIntegracaoPecuaria } from "../../../lib/banco-pecuaria-integration.fixture.js";
import { criarDemandasDoFatoTx, criarPoliticaAcompanhamentoTx, previaRevisaoPrazosTx, revisarPrazosTx, reconciliarDemandasAnimalTx, referenciaGuiadaValidaTx } from "./acompanhamento.js";
import { reconciliarAlertasReprodutivosAnimalTx } from "./alertas/produtor.js";
import { criarPoliticaAcompanhamentoSchema } from "./acompanhamento.schemas.js";
import { registrarEventoTarefaTx } from "../protocolos/eventos.js";

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
   const animal=await tx.animal.create({data:{brinco:marca,sexo:"F",origem:"COMPRADO",dataNascimento:dia("2023-01-01"),dataEntrada:dia("2024-01-01"),localizacoes:{create:{propriedadeId:sitio.id,desde:dia("2024-01-01")}}}});
   const modelo=await tx.protocolo.create({data:{nome:marca,tipo:"REPRODUTIVO",finalidade:"TETF",modalidadeTentativa:"ETAPA",modalidadeDiagnostico:"PROTOCOLO",configuracaoAcompanhamento:json(configuracao(20))}});
   const etapa=await tx.etapaProtocolo.create({data:{protocoloId:modelo.id,ordem:1,nome:"TE",tipo:"TENTATIVA",diaRelativo:0,configuracao:{tipo:"TENTATIVA",tentativaTipo:"TE"}}});
   const etapaDg=await tx.etapaProtocolo.create({data:{protocoloId:modelo.id,ordem:2,nome:"DG",tipo:"EXAME",diaRelativo:20,configuracao:{tipo:"AVALIACAO",referenciaPrazoDiagnostico:true,planoAvaliacao:{tipo:"DIAGNOSTICO"}}}});
   const etapaConvencional=await tx.etapaProtocolo.create({data:{protocoloId:modelo.id,ordem:3,nome:"DG de apoio",tipo:"EXAME",diaRelativo:0,configuracao:{tipo:"AVALIACAO",planoAvaliacao:{tipo:"DIAGNOSTICO"}}}});
   const politica=await criarPoliticaAcompanhamentoTx(tx,criarPoliticaAcompanhamentoSchema.parse({chave:randomUUID(),propriedadeId:sitio.id,vigenteDesde:"2025-01-01",parametros:configuracao(30)}),null);
   const snapshot={versao:1,protocoloId:modelo.id,protocoloVersao:modelo.versao,diagnosticoIndividualEm:null,modelo:configuracao(20),sitio:{id:politica.id,versao:politica.versao,parametros:configuracao(30)}};
   const participacao=await tx.participacaoProtocolo.create({data:{protocoloId:modelo.id,animalId:animal.id,propriedadeId:sitio.id,inicio:dia("2026-01-01"),acompanhamentoSnapshot:json(snapshot)}});
   const tarefa=await tx.tarefaProtocolo.create({data:{execucaoId:participacao.id,etapaId:etapa.id,previstaPara:dia("2026-01-01")}});
   const tarefaDg=await tx.tarefaProtocolo.create({data:{execucaoId:participacao.id,etapaId:etapaDg.id,previstaPara:dia("2026-01-01"),previsaoOriginal:dia("2026-01-01"),precisaoTemporal:"DIA",previsaoPendente:true,parametros:{previsaoOriginal:"2026-01-01",previsaoPendente:true}}});
   const tarefaConvencional=await tx.tarefaProtocolo.create({data:{id:`00000000-0000-4000-8000-${randomUUID().slice(-12)}`,execucaoId:participacao.id,etapaId:etapaConvencional.id,previstaPara:dia("2026-01-01"),precisaoTemporal:"DIA"}});
   await expect(registrarEventoTarefaTx(tx,tarefaDg.id,{chave:randomUUID(),propriedadeId:sitio.id,tipo:"ADIAMENTO",ocorridaEm:"2026-01-01T12:00:00Z",motivo:"Tentativa ainda pendente",previstaPara:"2026-02-01"},null)).rejects.toThrow("A avaliação aguarda o fato de referência");
   expect(await tx.eventoTarefaProtocolo.count({where:{tarefaId:tarefaDg.id}})).toBe(0);
   const tentativa=await tx.tentativaReprodutiva.create({data:{animalId:animal.id,propriedadeId:sitio.id,tarefaId:tarefa.id,data:dia("2026-01-01"),tipo:"TE",ciclo:1,ordem:1,origemMaterial:"DOCUMENTADA",geneticaSnapshot:{}}});
   await criarDemandasDoFatoTx(tx,{tentativaId:tentativa.id,tipoTentativa:"TE",animalId:animal.id,propriedadeId:sitio.id,data:tentativa.data},null,undefined,participacao.id);
   const demanda=await tx.demandaAcompanhamentoReprodutivo.findFirstOrThrow({where:{tentativaId:tentativa.id}});
   expect(demanda).toMatchObject({origemAdocao:"MODELO",politicaId:null,participacaoAcompanhamentoId:participacao.id,previstaPara:dia("2026-01-21")});
   await reconciliarDemandasAnimalTx(tx,animal.id,null);
   await reconciliarDemandasAnimalTx(tx,animal.id,null);
   expect(await tx.tarefaProtocolo.findUniqueOrThrow({where:{id:tarefaDg.id}})).toMatchObject({previstaPara:dia("2026-01-21"),previsaoOriginal:dia("2026-01-21"),previsaoPendente:false,precisaoTemporal:"DIA"});
   expect(await tx.demandaAcompanhamentoReprodutivo.findUniqueOrThrow({where:{id:demanda.id}})).toMatchObject({tarefaId:tarefaDg.id});
   expect(await tx.demandaAcompanhamentoReprodutivo.findUnique({where:{tarefaId:tarefaConvencional.id}})).toBeNull();
   expect(await tx.demandaAcompanhamentoReprodutivo.count({where:{tentativaId:tentativa.id}})).toBe(1);
   await reconciliarAlertasReprodutivosAnimalTx(tx,animal.id,null);
   const necessidadeAnterior=await tx.necessidadeReprodutiva.findFirstOrThrow({where:{demandaId:demanda.id}});
   expect(necessidadeAnterior.previstaPara).toEqual(dia("2026-01-21"));
   expect(necessidadeAnterior.alertaId).not.toBeNull();
   const selecao={propriedadeId:sitio.id,politicaId:politica.id,demandaIds:[demanda.id]};
   const previa=await previaRevisaoPrazosTx(tx,selecao);
   expect(previa.propostas[0]).toMatchObject({impedimento:null,tarefaHerdada:{id:tarefaDg.id}});
   await revisarPrazosTx(tx,{...selecao,chave:randomUUID(),motivo:"Conferência da regra",revisao:previa.revisao},null);
   const necessidadeAtual=await tx.necessidadeReprodutiva.findUniqueOrThrow({where:{id:necessidadeAnterior.id}});
   const alertaAtual=await tx.alerta.findUniqueOrThrow({where:{id:necessidadeAtual.alertaId!}});
   expect(necessidadeAtual).toMatchObject({previstaPara:dia("2026-01-31"),demandaId:demanda.id,tarefaId:tarefaDg.id});
   expect(alertaAtual.dataReferencia).toEqual(dia("2026-01-31"));
   expect((await tx.tarefaProtocolo.findUniqueOrThrow({where:{id:tarefaDg.id}})).previstaPara).toEqual(dia("2026-01-31"));
   expect(await tx.revisaoPrazoAcompanhamento.count({where:{demandaId:demanda.id}})).toBe(1);
   await tx.$executeRaw`SET CONSTRAINTS pecuaria."RevisaoPrazo_aplicada" IMMEDIATE`;
   await tx.tentativaReprodutiva.update({where:{id:tentativa.id},data:{status:"ANULADO",anuladoEm:new Date(),motivoAnulacao:"Fato corrigido, revisar previsão"}});
   await reconciliarDemandasAnimalTx(tx,animal.id,null);
   expect(await tx.tarefaProtocolo.findUniqueOrThrow({where:{id:tarefaDg.id}})).toMatchObject({previstaPara:dia("2026-01-31"),previsaoPendente:false});
   expect(await tx.demandaAcompanhamentoReprodutivo.findUniqueOrThrow({where:{id:demanda.id}})).toMatchObject({tarefaId:null,estado:"ENCERRADA",previstaPara:dia("2026-01-31")});
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

banco("reconfirmação factual no PostgreSQL autorizado",()=>{
 it("aguarda DG separado positivo, vincula uma vez e revoga previsão quando a prova é invalidada",async()=>{
  exigirBancoIntegracaoPecuaria();
  const marca=`qa-reconfirmacao-${randomUUID()}`, cancelar=new Error("reverter fixture");
  await expect(prisma.$transaction(async tx=>{
   const sitio=await tx.propriedade.create({data:{nome:marca}});
   const animal=await tx.animal.create({data:{brinco:marca,sexo:"F",origem:"COMPRADO",dataNascimento:dia("2023-01-01"),dataEntrada:dia("2024-01-01"),localizacoes:{create:{propriedadeId:sitio.id,desde:dia("2024-01-01")}}}});
   const regraRec={finalidade:"RECONFIRMACAO",ocorrencia:1,publico:"GESTACAO",referencia:"PRIMEIRO_DG_POSITIVO",intervalo:20,unidade:"DIAS",antecedencia:0,tolerancia:0,resolucao:"RECONFIRMACAO_CONCLUSIVA"};
   const config={versao:2,efeito:"ALERTA",regras:[regraRec]};
   const modelo=await tx.protocolo.create({data:{nome:marca,tipo:"REPRODUTIVO",finalidade:"IATF",modalidadeTentativa:"ETAPA",modalidadeDiagnostico:"EXTERNO",configuracaoAcompanhamento:json(config)}});
   const tentativaEtapa=await tx.etapaProtocolo.create({data:{protocoloId:modelo.id,ordem:1,nome:"IA",tipo:"TENTATIVA",diaRelativo:0,configuracao:{tipo:"TENTATIVA",tentativaTipo:"IA"}}});
   const recEtapa=await tx.etapaProtocolo.create({data:{protocoloId:modelo.id,ordem:2,nome:"Reconfirmação",tipo:"EXAME",diaRelativo:0,configuracao:{tipo:"AVALIACAO",referenciaPrazoReconfirmacao:true,planoAvaliacao:{tipo:"RECONFIRMACAO"}}}});
   const snapshot={versao:1,protocoloId:modelo.id,protocoloVersao:modelo.versao,diagnosticoIndividualEm:null,modelo:config,sitio:null};
   const participacao=await tx.participacaoProtocolo.create({data:{protocoloId:modelo.id,animalId:animal.id,propriedadeId:sitio.id,inicio:dia("2026-01-01"),acompanhamentoSnapshot:json(snapshot)}});
   const tentativaTarefa=await tx.tarefaProtocolo.create({data:{execucaoId:participacao.id,etapaId:tentativaEtapa.id,previstaPara:dia("2026-01-01")}});
   const rec=await tx.tarefaProtocolo.create({data:{execucaoId:participacao.id,etapaId:recEtapa.id,previstaPara:dia("2026-01-01"),previsaoPendente:true,parametros:{previsaoPendente:true}}});
   const tentativa=await tx.tentativaReprodutiva.create({data:{animalId:animal.id,propriedadeId:sitio.id,tarefaId:tentativaTarefa.id,data:dia("2026-01-10"),tipo:"IA",ciclo:1,ordem:1,origemMaterial:"DOCUMENTADA",geneticaSnapshot:{}}});
   await reconciliarDemandasAnimalTx(tx,animal.id,null);
   expect(await tx.tarefaProtocolo.findUniqueOrThrow({where:{id:rec.id}})).toMatchObject({previsaoPendente:true});
   const gestacao=await tx.gestacaoAnimal.create({data:{animalId:animal.id,propriedadeId:sitio.id,tentativaId:tentativa.id,confirmadaEm:dia("2026-02-01")}});
   const tipo=await tx.tipoExame.create({data:{nome:marca,tipoResultado:"MULTIPLO",contexto:"REPRODUTIVO",campos:[{codigo:"CONCLUSAO_GESTACIONAL",tipo:"OPCAO",opcoes:["POSITIVO","NEGATIVO","INCONCLUSIVO"]}]}});
   const criarPositivo = (prefixo: string, finalidade: "DIAGNOSTICO" | "RECONFIRMACAO", criadoEm: string) => tx.exameAnimal.create({data:{
    id: prefixo + randomUUID().slice(8), animalId:animal.id, propriedadeId:sitio.id, tipoExameId:tipo.id, data:dia("2026-02-01"), criadoEm:new Date(criadoEm),
    finalidades:[finalidade], finalidadePrincipal:finalidade, formatoSnapshot:{nome:marca,tipoResultado:"MULTIPLO",versao:1},
    interpretacao:{create:{tentativaId:tentativa.id,gestacaoId:gestacao.id}}, resultados:{create:{campo:"CONCLUSAO_GESTACIONAL",valor:"POSITIVO"}},
   }});
   const exame = await criarPositivo("f0000000", "DIAGNOSTICO", "2026-02-01T11:00:00Z");
   const origem={gestacaoId:gestacao.id,animalId:animal.id,propriedadeId:sitio.id,data:exame.data,exameOrigemId:exame.id};
   await criarDemandasDoFatoTx(tx,origem,null); await criarDemandasDoFatoTx(tx,origem,null);
   await reconciliarDemandasAnimalTx(tx,animal.id,null); await reconciliarDemandasAnimalTx(tx,animal.id,null);
   expect(await tx.demandaAcompanhamentoReprodutivo.count({where:{gestacaoId:gestacao.id,finalidade:"RECONFIRMACAO"}})).toBe(1);
   expect(await tx.tarefaProtocolo.findUniqueOrThrow({where:{id:rec.id}})).toMatchObject({previsaoPendente:false,previstaPara:dia("2026-02-21")});
   expect(await tx.demandaAcompanhamentoReprodutivo.findFirstOrThrow({where:{gestacaoId:gestacao.id}})).toMatchObject({tarefaId:rec.id,exameOrigemId:exame.id});
   await criarPositivo("10000000", "DIAGNOSTICO", "2026-02-01T12:00:00Z");
   await criarPositivo("20000000", "RECONFIRMACAO", "2026-02-01T10:00:00Z");
   const verificarReferencia = () => referenciaGuiadaValidaTx(tx, rec.id, animal.id, participacao.id, sitio.id, true);
   await expect(verificarReferencia()).resolves.toMatchObject({ id: tentativa.id });
   await tx.exameAnimal.update({where:{id:exame.id},data:{status:"ANULADO",anuladoEm:new Date(),motivoAnulacao:"Correção de evidência de teste"}});
   await reconciliarDemandasAnimalTx(tx,animal.id,null);
   expect(await tx.tarefaProtocolo.findUniqueOrThrow({where:{id:rec.id}})).toMatchObject({previsaoPendente:true});
   await expect(verificarReferencia()).resolves.toBe(false);
   throw cancelar;
  },{timeout:30000})).rejects.toBe(cancelar);
 });
});
