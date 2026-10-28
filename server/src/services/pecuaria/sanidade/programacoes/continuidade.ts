import type { Prisma } from "@prisma/client";
import { auditar } from "../../rebanho/regras.js";
import { publicarEstadoProgramacaoTx } from "./atendimento.js";
import { elegivelProgramacao } from "./elegibilidade.calc.js";
import type { AutorAlerta } from "../../../alertas/contratos.js";
import { tentarTravarAnimaisAlertasTx, tentarTravarConfiguracaoAlertaTx } from "../alertas/concorrencia.js";
async function reconciliarNecessidade(tx: Prisma.TransactionClient, n: { id:string; alertaId:string|null; situacao:string; sujeitoTipo:string; sujeitoId:string; propriedadeId:number; programacao:{ativo:boolean; produtoId:string|null; tipoExameId:string|null; publico:Prisma.JsonValue} }, hoje:Date, autor:AutorAlerta, mudanca?:string) {
  if (!n.alertaId || n.sujeitoTipo!=="ANIMAL") return;
  const a = await tx.alerta.findUniqueOrThrow({where:{id:n.alertaId}});
  const encerradaPelaBaixa=n.situacao==="ENCERRADO"&&a.motivo.startsWith("Baixa do animal:");
  const animal = await tx.animal.findUnique({where:{id:n.sujeitoId},include:{localizacoes:{where:{ate:null}},baixas:{where:{estornadaEm:null}}}});
  const local=animal?.localizacoes[0];
  const reabrirBaixa=mudanca==="ESTORNO_BAIXA"&&encerradaPelaBaixa;
  if ((["REALIZADO","DISPENSADO","ENCERRADO","INVALIDADO"].includes(n.situacao) || a.ciclo&&a.ciclo!=="ABERTO")&&!reabrirBaixa) {
    if (local&&local.propriedadeId!==n.propriedadeId) {
      await tx.necessidadeProgramacaoSanitaria.update({where:{id:n.id},data:{propriedadeId:local.propriedadeId,revisao:{increment:1}}});
      await publicarEstadoProgramacaoTx(tx,n.id,autor,a.ciclo==="INVALIDADO"?"INVALIDAR":"ENCERRAR");
      await auditar(tx,{entidade:"NecessidadeProgramacaoSanitaria",entidadeId:n.id,animalId:n.sujeitoId,propriedadeId:local.propriedadeId,acao:"CONTINUIDADE",usuarioId:autor.usuarioId??null,antes:n,depois:{situacao:n.situacao,mudanca,propriedadeId:local.propriedadeId}});
    }
    return;
  }
  const snapshot=(a.resumo as Prisma.JsonObject).programacaoSnapshot;
  const p=snapshot&&typeof snapshot==="object"&&!Array.isArray(snapshot)?snapshot:null;
  const publico=p?.publico??n.programacao.publico;
  const produtoId=p?(typeof p.produtoId==="string"?p.produtoId:null):n.programacao.produtoId;
  const tipoExameId=p?(typeof p.tipoExameId==="string"?p.tipoExameId:null):n.programacao.tipoExameId;
  const produto=produtoId ? await tx.produto.findUnique({where:{id:produtoId},select:{ativo:true,usoSanitario:true}}):null;
  const exame=tipoExameId ? await tx.tipoExame.findUnique({where:{id:tipoExameId},select:{ativo:true}}):null;
  const baixa=!!animal?.baixas.length;
  const fora=!animal||!local||!elegivelProgramacao(publico,animal,hoje);
  const destinoInativo=!!produtoId&&(!produto?.ativo||!produto.usoSanitario)||!!tipoExameId&&!exame?.ativo;
  if (!baixa&&!fora&&!destinoInativo&&!encerradaPelaBaixa&&mudanca!=="CORRECAO"&&local?.propriedadeId===n.propriedadeId) return;
  const situacao=baixa?"ENCERRADO":"NECESSITA_REVISAO";
  if (n.situacao===situacao && (local?.propriedadeId??n.propriedadeId)===n.propriedadeId) return;
  await tx.necessidadeProgramacaoSanitaria.update({where:{id:n.id},data:{situacao,propriedadeId:local?.propriedadeId??n.propriedadeId,revisao:{increment:1}}});
  await publicarEstadoProgramacaoTx(tx,n.id,autor,baixa?"ENCERRAR":encerradaPelaBaixa?"REABRIR":"PUBLICAR",{motivo:baixa?`Baixa do animal: ${animal!.baixas[0].id}; cuidado encerrado sem realização`:encerradaPelaBaixa?"Baixa estornada; conferir continuidade sem reiniciar atendimento":destinoInativo?"Destino sanitário inativo; conferir cuidado":"Cadastro, público ou localização alterados; conferir cuidado"});
  await auditar(tx,{entidade:"NecessidadeProgramacaoSanitaria",entidadeId:n.id,animalId:n.sujeitoId,propriedadeId:local?.propriedadeId??n.propriedadeId,acao:"CONTINUIDADE",usuarioId:autor.usuarioId??null,antes:n,depois:{situacao,mudanca}});
}
export async function reavaliarContinuidadeProgramaAnimalTx(tx:Prisma.TransactionClient,animalId:string,usuarioId:number|null,mudanca:string) {
  const itens=await tx.necessidadeProgramacaoSanitaria.findMany({where:{sujeitoTipo:"ANIMAL",sujeitoId:animalId,regraNecessidadeId:null},include:{programacao:true}});
  const autor=usuarioId&&usuarioId>0?{usuarioId}:{tecnico:"sanidade:continuidade-programa"};
  const hoje=new Date(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())+"T00:00:00Z");
  for(const n of itens)await reconciliarNecessidade(tx,n,hoje,autor,mudanca);
}
export async function reconciliarProgramacaoTx(tx:Prisma.TransactionClient,id:string,hoje:Date,autor:AutorAlerta,cursorNecessidadeId?:string) {
  await tentarTravarConfiguracaoAlertaTx(tx,"programacao",id);
  const candidatas=await tx.necessidadeProgramacaoSanitaria.findMany({where:{programacaoId:id,regraNecessidadeId:null,...(cursorNecessidadeId?{id:{gt:cursorNecessidadeId}}:{})},orderBy:{id:"asc"},take:50,select:{id:true,sujeitoId:true,sujeitoTipo:true}});
  await tentarTravarAnimaisAlertasTx(tx,candidatas.filter(n=>n.sujeitoTipo==="ANIMAL").map(n=>n.sujeitoId));
  // A projeção acima só escolhe o lote; decisões e fatos são relidos depois da trava do animal.
  const itens=candidatas.length?await tx.necessidadeProgramacaoSanitaria.findMany({where:{programacaoId:id,regraNecessidadeId:null,id:{in:candidatas.map(n=>n.id)}},orderBy:{id:"asc"},include:{programacao:true}}):[];
  for(const n of itens)await reconciliarNecessidade(tx,n,hoje,autor);
  return {cursorNecessidadeId:candidatas.at(-1)?.id??null,concluido:candidatas.length<50};
}
