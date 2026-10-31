import { tentarTravarAnimaisAlertasTx, tentarTravarConfiguracaoAlertaTx } from "./concorrencia.js";
import { reconciliarParticipacaoAlertaTx } from "./protocolos.js";
import { idadeEmMeses, idadeNaFaixa } from "../../rebanho/categoria.calc.js";
import { RebanhoError } from "../../rebanho/regras.js";
import { z } from "zod";
import type { Prisma, RegraAlertaSanitario } from "@prisma/client";
import { publicarAlertaTx } from "../../../alertas/publicacao.js";
import type { AutorAlerta } from "../../../alertas/contratos.js";
import { alcanceIdade, avaliarPrazo, somarDias } from "./datas.calc.js";
export async function publicarNecessidadeTx(tx:Prisma.TransactionClient, necessidadeId:string, autor:AutorAlerta, comando:"PUBLICAR"|"ENCERRAR"|"INVALIDAR"|"REABRIR"="PUBLICAR") {
  const n=await tx.necessidadeSanitaria.findUniqueOrThrow({where:{id:necessidadeId},include:{regra:true}});
  const regra=await configuracaoNecessidadeTx(tx,n);
  const [animal,produto]=await Promise.all([tx.animal.findUniqueOrThrow({where:{id:n.animalId},select:{brinco:true,nome:true,nascimentoEstimado:true,dataNascimento:true}}),regra.produtoId?tx.produto.findUnique({where:{id:regra.produtoId},select:{nome:true}}):null]);
  const entrada={proprietario:"fazendinha",produtor:"sanidade",tipo:regra.gatilho,versaoContrato:1 as const,chaveOcorrencia:`regra:${n.regraId}:animal:${n.animalId}`,revisaoOrigem:n.revisao,eventoId:`necessidade:${n.id}:${n.revisao}`,comando,origemId:n.id,sujeitoTipo:"ANIMAL",sujeitoId:n.animalId,propriedadeId:n.propriedadeId,chaveAgrupamento:`sanidade:${n.propriedadeId}:${n.regraId}:${regra.produtoId??regra.protocoloId}`,titulo:`${regra.produtoId?"Aplicar":"Programar"} ${produto?.nome??regra.nome}`,motivo:n.motivo??regra.nome,situacao:n.situacao,resumo:{regraId:n.regraId,revisaoRegra:n.revisaoRegra,produtoId:regra.produtoId,produtoNome:produto?.nome??null,protocoloId:regra.protocoloId,animalId:n.animalId,brinco:animal.brinco,nome:animal.nome,nascimentoEstimado:animal.nascimentoEstimado,dataNascimento:animal.dataNascimento.toISOString().slice(0,10),cuidado:regra.cuidado??null,tipoAplicacaoId:regra.tipoAplicacaoId??null},dataReferencia:n.dataTeorica,visivelDesde:n.dataTeorica?somarDias(n.dataTeorica,-regra.antecedenciaDias):null,prazo:n.situacao==="CONFERENCIA_INICIAL"?null:n.dataAtencao?somarDias(n.dataAtencao,regra.prazoDias):null};
  const resultado=await publicarAlertaTx(tx,entrada,autor);
  if (!n.alertaId) await tx.necessidadeSanitaria.update({where:{id:n.id},data:{alertaId:resultado.alertaId}});
  return resultado;
}
export async function avaliarRegraAnimalTx(tx:Prisma.TransactionClient,regraId:string,animalId:string,hoje:Date,autor:AutorAlerta) {
  await tentarTravarAnimaisAlertasTx(tx, [animalId]);
  await tentarTravarConfiguracaoAlertaTx(tx, "regra", regraId);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`necessidade:${regraId}:${animalId}`},0))`;
  const [regra,animal,existente]=await Promise.all([tx.regraAlertaSanitario.findUniqueOrThrow({where:{id:regraId}}),tx.animal.findUniqueOrThrow({where:{id:animalId},include:{localizacoes:{where:{ate:null}},baixas:{where:{estornadaEm:null}}}}),tx.necessidadeSanitaria.findUnique({where:{regraId_animalId:{regraId,animalId}}})]);
  const configuracao=existente?await configuracaoNecessidadeTx(tx,{...existente,regra}):regra;
  const destino=configuracao.produtoId?await tx.produto.findUnique({where:{id:configuracao.produtoId},select:{ativo:true}}):configuracao.protocoloId?await tx.protocolo.findUnique({where:{id:configuracao.protocoloId},select:{ativo:true,publicado:true}}):null;
  if(!destino?.ativo || ("publicado" in destino && !destino.publicado)){
    if(existente&&!['REALIZADO','DISPENSADO','ENCERRADO','NECESSITA_REVISAO'].includes(existente.situacao)){
      const revisada=await tx.necessidadeSanitaria.update({where:{id:existente.id},data:{situacao:"NECESSITA_REVISAO",motivo:"Produto ou protocolo inativo: conferir continuidade do cuidado",revisao:{increment:1}}});
      await publicarNecessidadeTx(tx,revisada.id,autor);
      return revisada;
    }
    return existente;
  }
  if(existente?.participacaoId&&!['REALIZADO','DISPENSADO','ENCERRADO'].includes(existente.situacao)){
    await reconciliarParticipacaoAlertaTx(tx,existente.participacaoId,autor.usuarioId??null);
    return tx.necessidadeSanitaria.findUnique({where:{id:existente.id}});
  }
  const naFaixa=idadeNaFaixa(idadeEmMeses(animal.dataNascimento,hoje),configuracao.idadeMinimaMeses,configuracao.idadeMaximaMeses);
  if(!naFaixa){
    if(existente&&!['REALIZADO','DISPENSADO','ENCERRADO','NECESSITA_REVISAO'].includes(existente.situacao)){
      const revisada=await tx.necessidadeSanitaria.update({where:{id:existente.id},data:{situacao:"NECESSITA_REVISAO",motivo:"Animal fora da faixa de idade configurada: conferir continuidade",revisao:{increment:1}}});
      await publicarNecessidadeTx(tx,revisada.id,autor);return revisada;
    }
    return existente;
  }
  const local=animal.localizacoes[0];
  if (!regra.ativo || regra.vigencia>hoje || !local || animal.baixas.length || !regra.propriedadeIds.includes(local.propriedadeId) || (regra.sexo&&regra.sexo!==animal.sexo)) return null;
  if (existente && existente.revisaoRegra !== regra.revisao) return existente;
  if (existente && !["PROXIMO","PENDENTE","DADOS_INSUFICIENTES"].includes(existente.situacao)) return existente;
  const data=regra.gatilho==="IDADE"?alcanceIdade(animal.dataNascimento,regra.idadeMeses!):regra.dataFixa;
  const adocao=existente?.adocao??new Date(Math.max((regra.adocao??hoje).getTime(),regra.vigencia.getTime(),local.desde.getTime(),animal.dataEntrada.getTime(),configuracao.idadeMinimaMeses?alcanceIdade(animal.dataNascimento,configuracao.idadeMinimaMeses)?.getTime()??0:0));
  const avaliacao=avaliarPrazo({data,hoje,adocao,antecedenciaDias:regra.antecedenciaDias,prazoDias:regra.prazoDias});
  if (!avaliacao.visivel) return null;
  // Próximo→pendente/atrasado é projeção temporal da consulta, sem revisão artificial diária.
  if (existente && existente.dataTeorica?.getTime()===data?.getTime() && existente.propriedadeId===local.propriedadeId && existente.revisaoRegra===regra.revisao) return existente;
  const n=existente?await tx.necessidadeSanitaria.update({where:{id:existente.id},data:{revisao:{increment:1},revisaoRegra:regra.revisao,propriedadeId:local.propriedadeId,dataTeorica:data,dataAtencao:data,situacao:avaliacao.situacao}}):await tx.necessidadeSanitaria.create({data:{regraId,animalId,revisaoRegra:regra.revisao,propriedadeId:local.propriedadeId,situacao:avaliacao.situacao,dataTeorica:data,dataAtencao:data,adocao}});
  await publicarNecessidadeTx(tx,n.id,autor);
  return n;
}

export async function configuracaoNecessidadeTx(tx:Prisma.TransactionClient,n:{regraId:string;revisaoRegra:number;regra:RegraAlertaSanitario}):Promise<RegraAlertaSanitario> {
  const historica=n.revisaoRegra===n.regra.revisao?null:await tx.revisaoRegraAlertaSanitario.findUnique({where:{regraId_revisao:{regraId:n.regraId,revisao:n.revisaoRegra}}});
  if(n.revisaoRegra!==n.regra.revisao&&!historica)throw new RebanhoError("CONFLITO","A revisão original da regra está indisponível para conferência");
  const campos=z.object({nome:z.string(),produtoId:z.string().nullable(),protocoloId:z.string().nullable(),gatilho:z.string(),idadeMeses:z.number().nullable(),dataFixa:z.string().nullable(),propriedadeIds:z.array(z.number().int().positive()),sexo:z.string().nullable(),vigencia:z.string(),orientacao:z.string().nullable(),antecedenciaDias:z.number(),prazoDias:z.number(),idadeMinimaMeses:z.number().nullable().optional(),idadeMaximaMeses:z.number().nullable().optional(),cuidado:z.string().nullable().optional(),tipoAplicacaoId:z.string().nullable().optional()});
  if(!historica)return n.regra;
  const original=campos.parse(historica.dados);
  return {...n.regra,...original,revisao:n.revisaoRegra,vigencia:new Date(original.vigencia),dataFixa:original.dataFixa?new Date(original.dataFixa):null,idadeMinimaMeses:original.idadeMinimaMeses??null,idadeMaximaMeses:original.idadeMaximaMeses??null,cuidado:original.cuidado??null,tipoAplicacaoId:original.tipoAplicacaoId??null};
 }
