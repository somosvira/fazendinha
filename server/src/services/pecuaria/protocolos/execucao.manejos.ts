import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError, auditar, travarAnimais } from "../rebanho/regras.js";
import { conferirAnimalNoFato } from "../fatos.js";
import { dinheiro, exigirPeriodoAberto } from "../../financeiro/regras.js";
import { totalAtribuidoServicoTx } from "../reproducao/atribuicoes-servico.js";
import { prepararExecucaoTarefaTx, iniciarParticipanteTx, contextoTarefaTx } from "../reproducao/iatf.js";
import { lerDataIatf, anteriorIatf } from "../reproducao/horarios.calc.js";
import { compararParametros, exigeMotivoExecucao } from "../desvios.calc.js";
import { vincularFatoTarefaTx } from "./vinculos.js";
import { itemExecucaoManejoSchema, type ItemExecucaoManejo } from "./execucao.manejos.schemas.js";
import { paginaExecucaoSchema } from "./execucao.schemas.js";
import { consultaInsercoesRetiradaSchema, filtroInsercoesRetirada } from "./insercoes-retirada.js";

type Tx=Prisma.TransactionClient;
const json=(v:unknown):Prisma.InputJsonValue=>JSON.parse(JSON.stringify(v));
const origem=(i:ItemExecucaoManejo)=>({chave:i.tarefaId,propriedadeId:i.propriedadeId,realizadaEm:i.realizadaEm??i.data,
  dados:{observacao:i.observacao,responsavel:i.responsavel,cienciaSanitaria:i.cienciaSanitaria},motivo:i.desvio?.motivo,cienciaRecalendarioLegado:i.cienciaRecalendarioLegado});
export async function travarOrigensManejosTx(tx:Tx,itens:ItemExecucaoManejo[]) {
  const tarefas=await tx.tarefaProtocolo.findMany({where:{id:{in:itens.map(i=>i.tarefaId)}},select:{execucao:{select:{operacaoServicoId:true}}}});
  for(const id of [...new Set([...itens.flatMap(i=>i.operacaoServicoId?[i.operacaoServicoId]:[]),...tarefas.flatMap(t=>t.execucao.operacaoServicoId?[t.execucao.operacaoServicoId]:[])])].sort())
    await tx.$queryRaw`SELECT id FROM public."Operacao" WHERE id=${id} FOR UPDATE`;
}
export async function conferirServicosManejosTx(tx:Tx,itens:ItemExecucaoManejo[]) {
  const somas=new Map<string,Prisma.Decimal>();
  for(const i of itens){const tarefa=await tx.tarefaProtocolo.findUniqueOrThrow({where:{id:i.tarefaId},select:{execucao:{select:{operacaoServicoId:true}}}});const id=i.operacaoServicoId??tarefa.execucao.operacaoServicoId;if(id&&i.valorServicoAtribuido!=null)somas.set(id,(somas.get(id)??new Prisma.Decimal(0)).plus(dinheiro(i.valorServicoAtribuido)));}
  for(const [id,valor]of somas){const s=await tx.operacao.findUniqueOrThrow({where:{id}});if(valor.plus(await totalAtribuidoServicoTx(tx,id,itens[0].propriedadeId)).gt(s.valorTotal))throw new RebanhoError("VALIDACAO","Os manejos selecionados ultrapassam o Serviço confirmado","valorServicoAtribuido");}
}

/** Sem fatos, auditoria, início de participação ou estoque. */
export async function prepararExecucaoManejoTx(tx:Tx,entrada:ItemExecucaoManejo,usuarioId:number|null) {
  const item=itemExecucaoManejoSchema.parse(entrada);
  await travarAnimais(tx,[item.animalId]);
  const t=await tx.tarefaProtocolo.findFirst({where:{id:item.tarefaId,execucao:{animalId:item.animalId,propriedadeId:item.propriedadeId}},include:{etapa:true,execucao:{include:{protocolo:true,rodada:true}},manejos:true,vinculos:{include:{manejo:true}}}});
  if(!t)throw new RebanhoError("NAO_ENCONTRADO","Tarefa não encontrada para este animal e sítio");
  if(t.etapa.tipo!==item.tipo||t.execucao.canceladaEm||t.dispensadaEm||t.realizadaEm||t.regularizacaoPendente||t.execucao.rodada&&t.execucao.rodada.status!=="ABERTA"||t.manejos.some(m=>m.status==="VALIDO"||m.realizacaoMantida)||t.vinculos.some(v=>v.estado==="ENCERRADO"||v.manejo?.realizacaoMantida))throw new RebanhoError("CONFLITO","A tarefa já foi realizada ou exige regularização","tarefaId");
  const temporal=lerDataIatf(item.realizadaEm??item.data);
  if(temporal.data!==item.data||anteriorIatf(new Date(),"HORA",temporal.instante,temporal.precisao))throw new RebanhoError("VALIDACAO","Confira a data realizada e, quando conhecido, o horário até agora","realizadaEm");
  await conferirAnimalNoFato(tx,item.animalId,item.propriedadeId,new Date(item.data));
  let comparacao;
  let inicioLegado={exigeCiencia:false,total:0};
  let impactos:unknown=null;
  if(t.execucao.protocolo.tipo==="REPRODUTIVO"){
    const p=await prepararExecucaoTarefaTx(tx,t.id,origem(item),usuarioId);
    comparacao=p.desvio;impactos=p.impactosInicio;
    inicioLegado={exigeCiencia:p.impactosInicio.itens.length>0,total:p.impactosInicio.itens.length};
  }else comparacao=compararParametros({tipo:t.etapa.tipo,data:t.previstaPara.toISOString().slice(0,10)},{tipo:item.tipo,data:item.data},t.parametros!==null);
  let insercao=null;
  if(item.tipo==="RETIRADA"){
    insercao=await tx.aplicacaoProduto.findFirst({where:{id:item.insercaoAplicacaoId,animalId:item.animalId,status:"VALIDO"},include:{tarefa:{include:{etapa:true}},retiradasDispositivo:{where:{OR:[{status:"VALIDO"},{realizacaoMantida:true}]}}}});
    const config=insercao?.tarefa?.etapa.configuracao;
    if(!insercao||(!config||typeof config!=="object"||Array.isArray(config)||config.subtipo!=="INSERCAO_DISPOSITIVO")&&!insercao.insercaoDispositivoSnapshot)throw new RebanhoError("VALIDACAO","Selecione inserção válida configurada para este animal. Origem legada exige regularização explícita, sem nova baixa","insercaoAplicacaoId");
    if(insercao.retiradasDispositivo.length)throw new RebanhoError("CONFLITO","Este dispositivo já tem retirada válida ou realização mantida","insercaoAplicacaoId");
    if(anteriorIatf(temporal.instante,temporal.precisao,insercao.aplicadaEm??insercao.data,insercao.precisaoTemporal==="HORA"?"HORA":"DIA"))throw new RebanhoError("VALIDACAO","A retirada não pode anteceder a inserção","realizadaEm");
  }
  const servicoId=item.operacaoServicoId??t.execucao.operacaoServicoId;
  let servico=null;
  if(servicoId){
    await tx.$queryRaw`SELECT id FROM public."Operacao" WHERE id=${servicoId} FOR UPDATE`;
    servico=await tx.operacao.findFirst({where:{id:servicoId,propriedadeId:item.propriedadeId,tipo:"SERVICO",status:"CONFIRMADA",data:{lte:new Date(item.data)}}});
    if(!servico||t.execucao.operacaoServicoId&&t.execucao.operacaoServicoId!==servicoId)throw new RebanhoError("VALIDACAO","Serviço incompatível com sítio, participação ou data","operacaoServicoId");
    await exigirPeriodoAberto(tx,item.propriedadeId,servico.data);await exigirPeriodoAberto(tx,item.propriedadeId,new Date(item.data));
    if(item.valorServicoAtribuido!=null&&(t.execucao.valorServicoAtribuido!=null||dinheiro(item.valorServicoAtribuido).plus(await totalAtribuidoServicoTx(tx,servicoId,item.propriedadeId)).gt(servico.valorTotal)))throw new RebanhoError("VALIDACAO","Valor já atribuído ao protocolo ou superior ao Serviço disponível","valorServicoAtribuido");
  }else if(item.valorServicoAtribuido!=null)throw new RebanhoError("VALIDACAO","Valor exige vínculo a Serviço","valorServicoAtribuido");
  const dadosCriacao:Prisma.ManejoAnimalUncheckedCreateInput={tarefaId:item.tarefaId,animalId:item.animalId,propriedadeId:item.propriedadeId,tipo:item.tipo==="RETIRADA"?"RETIRADA_DISPOSITIVO":"PROTOCOLAR",data:new Date(item.data),realizadaEm:temporal.precisao==="HORA"?temporal.instante:null,precisaoTemporal:temporal.precisao,criadoPorId:usuarioId,responsavel:item.responsavel?.trim()||null,observacao:item.observacao?.trim()||null,insercaoAplicacaoId:item.tipo==="RETIRADA"?item.insercaoAplicacaoId:null,operacaoServicoId:servicoId??null,valorServicoAtribuido:item.valorServicoAtribuido==null?null:dinheiro(item.valorServicoAtribuido),origem:"PROTOCOLO"};
  const desvio={...comparacao,referencia:t.parametros?"SNAPSHOT_PLANEJADO":"LEGADO_SEM_SNAPSHOT",planejado:{tipo:t.etapa.tipo,data:t.previstaPara.toISOString().slice(0,10)},realizado:{tipo:item.tipo,data:item.data},motivo:item.desvio?.motivo??null,motivoObrigatorio:exigeMotivoExecucao(comparacao)};
  return{tarefa:t,temporal,dadosCriacao,desvio,inicioLegado,dadosFingerprint:{...dadosCriacao,criadoPorId:null,insercao:insercao?{id:insercao.id,data:insercao.data,aplicadaEm:insercao.aplicadaEm,tarefaId:insercao.tarefaId}:null,servico:servico?{id:servico.id,valor:servico.valorTotal,status:servico.status}:null,impactos}};
}
export async function executarExecucaoManejoTx(tx:Tx,item:ItemExecucaoManejo,usuarioId:number|null) {
  let preparada=await prepararExecucaoManejoTx(tx,item,usuarioId);
  if(preparada.desvio.motivoObrigatorio&&!item.desvio?.motivo)throw new RebanhoError("VALIDACAO","Explique o desvio do manejo planejado","desvio.motivo");
  if(preparada.inicioLegado.exigeCiencia&&!item.cienciaRecalendarioLegado)throw new RebanhoError("VALIDACAO","Confira e autorize o calendário legado","cienciaRecalendarioLegado");
  if(preparada.tarefa.execucao.protocolo.tipo==="REPRODUTIVO"&&!preparada.tarefa.execucao.inicioEfetivo){await iniciarParticipanteTx(tx,preparada.tarefa.execucaoId,item.propriedadeId,item.realizadaEm??item.data,usuarioId,item.cienciaSanitaria,item.tipo);preparada=await prepararExecucaoManejoTx(tx,item,usuarioId);}
  const fato=await tx.manejoAnimal.create({data:preparada.dadosCriacao});
  await tx.classificacaoCustoPecuaria.create({data:{manejoId:fato.id,materialNaoAplicavel:true}});
  await vincularFatoTarefaTx(tx,item.tarefaId,{manejoId:fato.id},usuarioId);
  await tx.tarefaProtocolo.update({where:{id:item.tarefaId},data:{realizadaEm:preparada.temporal.instante,precisaoRealizacao:preparada.temporal.precisao,realizadoSnapshot:json({versao:1,tipo:item.tipo,fato:{id:fato.id},dados:preparada.dadosCriacao,usuarioId}),desviosSnapshot:json(preparada.desvio)}});
  await auditar(tx,{entidade:"ManejoAnimal",entidadeId:fato.id,animalId:item.animalId,propriedadeId:item.propriedadeId,acao:"REGISTRO_PROTOCOLO",usuarioId,depois:fato});
  return{id:fato.id,tipo:item.tipo};
}
/** Compatibilidade do endpoint/visita IATF: passa a produzir o mesmo fato completo. */
export async function executarManejoDaTarefaIatfTx(tx:Tx,id:string,input:Parameters<typeof prepararExecucaoTarefaTx>[2],usuarioId:number|null) {
  const contexto=await contextoTarefaTx(tx,id,input.propriedadeId);
  const item=itemExecucaoManejoSchema.parse({...input.dados,tipo:contexto.tarefa.tipo,tarefaId:contexto.tarefa.id,animalId:contexto.participante.animalId,propriedadeId:input.propriedadeId,data:lerDataIatf(input.realizadaEm).data,realizadaEm:input.realizadaEm,desvio:input.motivo?{motivo:input.motivo}:undefined,cienciaRecalendarioLegado:input.cienciaRecalendarioLegado});
  await executarExecucaoManejoTx(tx,item,usuarioId);
  return tx.tarefaIatf.findUniqueOrThrow({where:{id:contexto.tarefa.id}});
}
export async function listarInsercoesTarefa(tarefaId:string,propriedadeId:number,consulta:unknown) {
  const f = consultaInsercoesRetiradaSchema.parse(consulta);
  return prisma.$transaction(async tx => {
    const t = await tx.tarefaProtocolo.findFirst({ where: { id: tarefaId, etapa: { tipo: "RETIRADA" }, execucao: { propriedadeId } }, select: { execucao: { select: { animalId: true } } } });
    if (!t) throw new RebanhoError("NAO_ENCONTRADO", "Tarefa de retirada não encontrada neste sítio");
    const where = filtroInsercoesRetirada(t.execucao.animalId, f.realizadaEm);
    const total = await tx.aplicacaoProduto.count({ where });
    const pagina = Math.min(f.pagina, Math.max(1, Math.ceil(total / f.porPagina)));
    const itens = await tx.aplicacaoProduto.findMany({ where, select: { id: true, data: true, aplicadaEm: true, precisaoTemporal: true, nomeProdutoAplicado: true, dose: true, unidadeDose: true }, orderBy: [{ data: "desc" }, { id: "asc" }], skip: (pagina - 1) * f.porPagina, take: f.porPagina });
    // Só uma origem no conjunto inteiro autoriza proposta. Ordenação e página não decidem origem.
    const sugestaoInsercaoId = f.realizadaEm && total === 1 ? itens[0]?.id ?? null : null;
    return { itens, total, pagina, porPagina: f.porPagina, sugestaoInsercaoId,
      situacaoOrigem: !f.realizadaEm ? "DATA_NECESSARIA" : total === 0 ? "SEM_ORIGEM" : total === 1 ? "UNIVOCA" : "AMBIGUA" };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function listarServicosManejo(tarefaId:string,propriedadeId:number,consulta:unknown){
 const f=paginaExecucaoSchema.parse(consulta);
 if(!await prisma.tarefaProtocolo.count({where:{id:tarefaId,etapa:{tipo:{in:["MANEJO","RETIRADA"]}},execucao:{propriedadeId}}}))throw new RebanhoError("NAO_ENCONTRADO","Tarefa não encontrada neste sítio");
 const where:Prisma.OperacaoWhereInput={propriedadeId,tipo:"SERVICO",status:"CONFIRMADA"};const total=await prisma.operacao.count({where});const pagina=Math.min(f.pagina,Math.max(1,Math.ceil(total/f.porPagina)));
 const itens=await prisma.operacao.findMany({where,select:{id:true,numero:true,descricao:true,data:true},orderBy:[{data:"desc"},{id:"asc"}],skip:(pagina-1)*f.porPagina,take:f.porPagina});return{itens,total,pagina,porPagina:f.porPagina};
}
