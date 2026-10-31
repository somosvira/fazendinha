import { configuracaoNecessidadeTx } from "./produtor.js";
import { dataCivil,diaCivil,situacaoTemporal } from "./datas.calc.js";
import { consultarDetalheProgramacaoAlerta } from "../programacoes/detalhe.js";
import type { UsuarioContexto } from "../../../auth/sessao.js";
import { temArea, temPermissao } from "../../../auth/papeis.js";
import { prisma } from "../../../../db.js";
import { RebanhoError } from "../../rebanho/regras.js";
export async function consultarDetalheAlerta(id:string,propriedadeId:number|null,usuario:UsuarioContexto) {
 const alerta=await prisma.alerta.findFirst({where:{id,proprietario:"fazendinha",produtor:"sanidade",...(propriedadeId==null?{}:{propriedadeId})}});
 if(!alerta)throw new RebanhoError("NAO_ENCONTRADO","Alerta não encontrado");
 // Resumo e snapshot só são liberados depois de revalidar contexto atual do sujeito.
 if(alerta.sujeitoTipo==="ANIMAL"&&propriedadeId!=null&&!await prisma.localizacaoAnimal.findFirst({where:{animalId:alerta.sujeitoId,propriedadeId,ate:null}}))throw new RebanhoError("NAO_ENCONTRADO","Alerta não encontrado neste sítio");
 const necessidade=await prisma.necessidadeSanitaria.findUnique({where:{alertaId:id},include:{regra:true}});
 if(!necessidade && alerta.tipo === "PROGRAMACAO") { const detalhe = await consultarDetalheProgramacaoAlerta(alerta,usuario); if (detalhe) return detalhe; }
 if(!necessidade)return{alertaId:id,titulo:alerta.titulo,motivo:alerta.motivo,situacao:alerta.situacao,evidenciaDisparo:alerta.snapshotInicial,origem:{estado:"INDISPONIVEL" as const},acoes:[]};
 necessidade.regra=await configuracaoNecessidadeTx(prisma,necessidade);
 const [animal,produto,eventos]=await Promise.all([prisma.animal.findUnique({where:{id:necessidade.animalId},select:{id:true,brinco:true,nome:true,dataNascimento:true,nascimentoEstimado:true}}),necessidade.regra.produtoId?prisma.produto.findUnique({where:{id:necessidade.regra.produtoId},select:{id:true,nome:true,ativo:true}}):null,prisma.eventoAlerta.findMany({where:{alertaId:id},select:{id:true,revisao:true,comando:true,criadoEm:true,autorUsuarioId:true,autorTecnico:true,payload:true},orderBy:{revisao:"asc"}})]);
 const hoje=dataCivil(diaCivil(new Date()));
 const situacaoAtual=situacaoTemporal({situacao:necessidade.situacao,dataReferencia:alerta.dataReferencia,dataAtencao:necessidade.dataAtencao,prazo:alerta.prazo},hoje);
 const escrever=temArea(usuario,"pecuaria")&&temPermissao(usuario,"lancar")&&alerta.ciclo==="ABERTO";
 const semVinculo=!necessidade.aplicacaoId&&!necessidade.participacaoId;
 const operacional=escrever&&semVinculo&&["PROXIMO","PENDENTE","ADIADO"].includes(necessidade.situacao);
 const conferir=escrever&&semVinculo&&necessidade.situacao==="CONFERENCIA_INICIAL";
 const acoes=escrever?[...(operacional?(necessidade.regra.produtoId&&produto?.ativo?["REGISTRAR_APLICACAO","VINCULAR_APLICACAO"]:necessidade.regra.protocoloId?["PROGRAMAR_PROTOCOLO"]:[]):[]),...(conferir?["CONFIRMAR_NECESSIDADE",...(produto?.ativo?["VINCULAR_APLICACAO"]:[])]:[]),...(operacional?["ADIAR"]:[]),...(semVinculo?["DISPENSAR"]:[])]:[];
 return{alertaId:id,necessidadeId:necessidade.id,revisao:necessidade.revisao,titulo:alerta.titulo,motivo:alerta.motivo,situacao:situacaoAtual,evidenciaDisparo:alerta.snapshotInicial,origem:{estado:animal?"DISPONIVEL" as const:"REMOVIDA" as const,animal,produto,regra:{protocoloId:necessidade.regra.protocoloId,id:necessidade.regraId,nome:necessidade.regra.nome,revisao:necessidade.regra.revisao,ativo:necessidade.regra.ativo,gatilho:necessidade.regra.gatilho,orientacao:necessidade.regra.orientacao},dataReferencia:necessidade.dataTeorica?.toISOString().slice(0,10)??null,dataAtencao:necessidade.dataAtencao?.toISOString().slice(0,10)??null,aplicacaoId:necessidade.aplicacaoId,participacaoId:necessidade.participacaoId},eventos,acoes};
}
