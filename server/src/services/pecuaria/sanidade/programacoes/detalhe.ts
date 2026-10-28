import { prisma } from "../../../../db.js";
import type { Alerta,Prisma } from "@prisma/client";
import type { UsuarioContexto } from "../../../auth/sessao.js";
import { programacaoSnapshotSchema } from "../../../alertas/registro.js";
import { dataCivil,diaCivil,situacaoTemporal } from "../alertas/datas.calc.js";
export async function consultarDetalheProgramacaoAlerta(alerta: Alerta, usuario: UsuarioContexto,agora=new Date()) {
  const necessidade = await prisma.necessidadeProgramacaoSanitaria.findUnique({ where: { alertaId: alerta.id }, include: { programacao: true } });
  if (!necessidade) return null;
  const vigente=necessidade.programacao;
  const resumo=alerta.resumo as Prisma.JsonObject;
  const snapshot=programacaoSnapshotSchema.safeParse(resumo.programacaoSnapshot);
  if(!snapshot.success)return{alertaId:alerta.id,necessidadeId:necessidade.id,revisao:necessidade.revisao,titulo:alerta.titulo,motivo:alerta.motivo,situacao:necessidade.situacao,evidenciaDisparo:alerta.snapshotInicial,origem:{estado:"INDISPONIVEL" as const},acoes:[]};
  // O cuidado continua usando a revisão preservada; a configuração vigente é apresentada separadamente.
  const p=snapshot.data;
  const [animal, produto, exame, eventos] = await Promise.all([
    necessidade.sujeitoTipo === "ANIMAL" ? prisma.animal.findUnique({ where: { id: necessidade.sujeitoId }, select: { id: true, brinco: true, nome: true, dataNascimento: true, nascimentoEstimado: true } }) : null,
    p.produtoId ? prisma.produto.findUnique({ where: { id: p.produtoId }, select: { id: true, nome: true, ativo: true } }) : null,
    p.tipoExameId?prisma.tipoExame.findUnique({where:{id:p.tipoExameId},select:{id:true,ativo:true}}):null,
    prisma.eventoAlerta.findMany({ where: { alertaId: alerta.id }, select: { id: true, revisao: true, comando: true, criadoEm: true, autorUsuarioId: true, autorTecnico: true, payload: true }, orderBy: { revisao: "asc" } }),
  ]);
  const hoje=dataCivil(diaCivil(agora));
  const situacao=situacaoTemporal({situacao:necessidade.situacao,dataReferencia:alerta.dataReferencia??(typeof resumo.inicioJanela==="string"?dataCivil(resumo.inicioJanela):null),prazo:alerta.prazo},hoje);
  const escrever=alerta.ciclo==="ABERTO"&&!necessidade.aplicacaoId&&!necessidade.exameId&&!!animal&&(usuario.dono||usuario.flags.includes("lancar"));
  const operacional=escrever&&["PROXIMO","PENDENTE","ADIADO"].includes(necessidade.situacao);
  const destinoAtivo=p.executor==="APLICACAO"?!!produto?.ativo:!!exame?.ativo;
  const acoes=escrever?necessidade.situacao==="CONFERENCIA_INICIAL"?[...(destinoAtivo?["CONFIRMAR_NECESSIDADE",...(p.executor==="APLICACAO"?["VINCULAR_APLICACAO"]:[])]:[]),"DISPENSAR"]:[...(operacional&&destinoAtivo?[...(p.executor==="APLICACAO"?["REGISTRAR_APLICACAO","VINCULAR_APLICACAO"]:["REGISTRAR_EXAME"]),"ADIAR"]:[]),...(!["REALIZADO","DISPENSADO","ENCERRADO","INVALIDADO"].includes(necessidade.situacao)?["DISPENSAR"]:[])]:[];
  return { alertaId: alerta.id, necessidadeId: necessidade.id, revisao: necessidade.revisao, titulo: alerta.titulo, motivo: alerta.motivo, situacao,
    evidenciaDisparo: alerta.snapshotInicial, origem: { estado: animal ? "DISPONIVEL" as const : "REMOVIDA" as const, animal, produto,
      programacao: { id: p.id, nome: p.nome, revisao: p.revisao, ativo: p.ativo, meses: p.meses, ano: p.ano, precisao: p.precisao, dia: p.dia, recorrencia: p.recorrencia, periodo: necessidade.periodo, procedimento: p.procedimento, publico: p.publico,executor:p.executor,tipoExameId:p.tipoExameId,produtoId:p.produtoId },
      programacaoVigente:{id:vigente.id,nome:vigente.nome,revisao:vigente.revisao,ativo:vigente.ativo},
      dataReferencia:alerta.dataReferencia?.toISOString().slice(0,10)??null,dataAtencao:necessidade.situacao==="ADIADO"?alerta.prazo?.toISOString().slice(0,10)??null:alerta.dataReferencia?.toISOString().slice(0,10)??null,
      aplicacaoId: necessidade.aplicacaoId, exameId: necessidade.exameId }, eventos,acoes };
}
