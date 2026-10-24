import { Prisma } from "@prisma/client";
import { RebanhoError } from "../rebanho/regras.js";
import { obterSaldo } from "../consumo.js";
import { travarValorizacaoTx } from "../../estoque/valorizacao.js";
import { travarUsosProduto } from "../../estoque/usos.js";
import { resolverLotePrincipalTx } from "../../estoque/partidas.js";
import { prepararExameTx, registrarExameTx, travarTiposExame } from "../sanidade/exames.js";
import { prepararTentativaTx, prepararAvaliacaoTx, criarAvaliacaoTx } from "../reproducao/registros.js";
import { prepararExecucaoTarefaTx, executarTarefaTx } from "../reproducao/iatf.js";
import { tentativaSchema, avaliacaoSchema } from "../reproducao/schemas.js";
import { anteriorIatf, lerDataIatf } from "../reproducao/horarios.calc.js";
import { exigeMotivoExecucao } from "../desvios.calc.js";
import { itemExecucaoClinicaSchema, type ItemExecucaoClinica } from "./execucao.clinica.schemas.js";
import { TIPO_EXAME_REPRODUTIVO } from "../exames/evidencia-reprodutiva.js";
import { totalAtribuidoServicoTx } from "../reproducao/atribuicoes-servico.js";
import { dinheiro } from "../../financeiro/regras.js";

type Tx = Prisma.TransactionClient;
type Consumo = { produtoId: string; partidaId: string | null; itemCompraDiretaId: null; unidade: string; quantidade: string; produtoNome: string; partidaNome: string | null; partidaValidade: string | null };
export function entradaClinicaIatf(item: ItemExecucaoClinica) {
  const { tipo, tarefaId, realizadaEm, desvio, cienciaRecalendarioLegado, ...campos } = item;
  const dados: Record<string, unknown> = { ...campos };
  delete dados.reavaliacao;
  if (tipo === "TENTATIVA") {
    dados.tipo = item.tipoTentativa;
    delete dados.tipoTentativa;
  }
  return { chave: tarefaId, propriedadeId: item.propriedadeId, realizadaEm: realizadaEm ?? item.data,
    dados, motivo: desvio?.motivo, cienciaRecalendarioLegado };
}

async function prepararReavaliacaoTx(tx: Tx, item: Extract<ItemExecucaoClinica, {tipo:"AVALIACAO"}>, usuarioId: number|null) {
  if(!item.demandaAcompanhamentoId)throw new RebanhoError("VALIDACAO","Identifique a demanda da reavaliação","demandaAcompanhamentoId");
  const demanda=await tx.demandaAcompanhamentoReprodutivo.findUnique({where:{id:item.demandaAcompanhamentoId}});
  if(!demanda||demanda.tarefaId!==item.tarefaId||demanda.animalId!==item.animalId||demanda.estado!=="PENDENTE")
    throw new RebanhoError("CONFLITO","A demanda não está pendente para esta tarefa e animal","demandaAcompanhamentoId");
  const regra=demanda.regraSnapshot as Record<string,unknown>;
  const esperados={finalidade:demanda.finalidade,tentativaId:demanda.tentativaId,gestacaoId:demanda.gestacaoId,tipoExameId:regra.tipoExameId};
  const entrada=entradaClinicaIatf(item);
  for(const [campo,valor] of Object.entries(esperados)) {
    if(entrada.dados[campo]!=null&&entrada.dados[campo]!==valor)throw new RebanhoError("VALIDACAO","A reavaliação deve conservar a origem e o formato da demanda",campo);
    if(valor!=null)entrada.dados[campo]=valor;
  }
  const input=avaliacaoSchema.parse({...entrada.dados,chave:item.tarefaId});
  if(new Date(`${input.data}T00:00:00Z`)<demanda.dataReferencia)throw new RebanhoError("VALIDACAO","Reavaliação anterior ao exame de origem","data");
  const preparada=await prepararAvaliacaoTx(tx,input,usuarioId);
  if(regra.tipoExameVersao&&preparada.evidencia.tipo.versaoFormato!==regra.tipoExameVersao)throw new RebanhoError("CONFLITO","O formato difere da versão congelada na demanda","tipoExameId");
  return {input,demanda,preparada};
}

/** O coordenador trava todos os animais antes de adquirir estas origens ordenadas. */
export async function travarOrigensExecucaoClinicaTx(tx: Tx, itens: ItemExecucaoClinica[], incluirServicos = true) {
  const materiais = await tx.materialGenetico.findMany({ where: { id: { in: itens.flatMap(i => i.tipo === "TENTATIVA" && i.materialId ? [i.materialId] : []) } }, select: { produtoId: true } });
  const produtos = [...new Set(materiais.map(m => m.produtoId))].sort();
  await travarValorizacaoTx(tx, produtos);
  await travarUsosProduto(tx, produtos);
  for (const produtoId of produtos) {
    const sitio = itens[0]?.propriedadeId;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-produto:${sitio}:${produtoId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-produto:${produtoId}`}))`;
  }
  await travarTiposExame(tx, [...new Set(itens.flatMap(i => i.tipo === "EXAME" ? [i.tipoExameId] : i.tipo === "AVALIACAO" ? [i.tipoExameId ?? TIPO_EXAME_REPRODUTIVO] : []))].sort());
  if(incluirServicos)for (const id of [...new Set(itens.flatMap(i => "operacaoServicoId" in i && i.operacaoServicoId ? [i.operacaoServicoId] : []))].sort())
    await tx.$queryRaw`SELECT id FROM public."Operacao" WHERE id=${id} FOR UPDATE`;
}

export async function prepararExecucaoClinicaTx(tx: Tx, entrada: ItemExecucaoClinica, usuarioId: number | null) {
  const item = itemExecucaoClinicaSchema.parse(entrada);
  const temporal = lerDataIatf(item.realizadaEm ?? item.data);
  if (temporal.data !== item.data) throw new RebanhoError("VALIDACAO", "A data e o horário do procedimento divergem", "realizadaEm");
  if (anteriorIatf(new Date(), "HORA", temporal.instante, temporal.precisao)) throw new RebanhoError("VALIDACAO", "Informe um procedimento já ocorrido", "realizadaEm");
  const tarefa = await tx.tarefaProtocolo.findUniqueOrThrow({ where: { id: item.tarefaId }, include: { execucao: { include: { protocolo: true } } } });
  if (tarefa.execucao.animalId !== item.animalId || tarefa.execucao.propriedadeId !== item.propriedadeId)
    throw new RebanhoError("NAO_ENCONTRADO", "Tarefa não encontrada para o animal e sítio");
  if(item.tipo==="AVALIACAO"&&item.reavaliacao){
    const preparada=await prepararReavaliacaoTx(tx,item,usuarioId);
    return {desvio:{aferido:true,diferencas:[],referencia:"DEMANDA_ACOMPANHAMENTO",motivo:item.desvio?.motivo??null,motivoObrigatorio:false,planejado:preparada.demanda.regraSnapshot,realizado:preparada.input},
      dadosFingerprint:preparada,inicioLegado:{exigeCiencia:false,total:0},consumo:null};
  }
  if (item.tipo === "EXAME" && tarefa.execucao.protocolo.tipo !== "REPRODUTIVO") {
    const preparada = await prepararExameTx(tx, item, usuarioId, true);
    return { desvio: preparada.desvioProtocoloSnapshot!, dadosFingerprint: preparada.dadosCriacao, inicioLegado: { exigeCiencia: false, total: 0 }, consumo: null };
  }
  const reprodutiva = await prepararExecucaoTarefaTx(tx, item.tarefaId, entradaClinicaIatf(item), usuarioId);
  let dadosFingerprint: unknown = reprodutiva.preparado;
  let consumo: Consumo | null = null;
  if (item.tipo === "TENTATIVA") {
    const preparada = await prepararTentativaTx(tx, tentativaSchema.parse(reprodutiva.preparado), usuarioId);
    dadosFingerprint = preparada.dadosCriacao;
    if (item.origem === "ESTOQUE" && preparada.material && preparada.quantidade) {
      const partida = item.partidaId ? await resolverLotePrincipalTx(tx, item.partidaId, preparada.material.produtoId) : null;
      consumo = { produtoId: preparada.material.produtoId, partidaId: partida?.id ?? null, itemCompraDiretaId: null,
        unidade: preparada.material.produto.unidade, quantidade: preparada.quantidade.toString(), produtoNome: preparada.material.produto.nome,
        partidaNome: partida?.nome ?? partida?.codigo ?? null, partidaValidade: partida?.validade?.toISOString().slice(0, 10) ?? null };
    }
  } else if (item.tipo === "AVALIACAO") {
    const preparada = await prepararAvaliacaoTx(tx, avaliacaoSchema.parse(reprodutiva.preparado), usuarioId);
    dadosFingerprint = { ...preparada, plano: reprodutiva.plano };
  } else dadosFingerprint = (await prepararExameTx(tx, { ...item, data: reprodutiva.data, tarefaId: undefined }, usuarioId, true)).dadosCriacao;
  return { desvio: { ...reprodutiva.desvio, referencia: reprodutiva.plano ? "SNAPSHOT_PLANEJADO" : "LEGADO_SEM_SNAPSHOT",
    motivo: item.desvio?.motivo ?? null, motivoObrigatorio: exigeMotivoExecucao(reprodutiva.desvio),
    planejado: reprodutiva.plano?.etapa ?? {}, realizado: reprodutiva.preparado },
    dadosFingerprint: { dados: dadosFingerprint, plano: reprodutiva.plano, impactos: reprodutiva.impactosInicio },
    inicioLegado: { exigeCiencia: reprodutiva.impactosInicio.itens.length > 0, total: reprodutiva.impactosInicio.itens.length }, consumo };
}

export async function conferirConsumosExecucaoClinicaTx(tx: Tx, itens: ItemExecucaoClinica[], preparados: Array<{ consumo?: Consumo | null }>) {
  const grupos = new Map<string, Consumo>();
  const totais = new Map<string, Prisma.Decimal>();
  for (const { consumo } of preparados) {
    if (!consumo) continue;
    const chave = `${consumo.produtoId}:${consumo.partidaId ?? ""}`;
    grupos.set(chave, { ...consumo, quantidade: new Prisma.Decimal(grupos.get(chave)?.quantidade ?? 0).plus(consumo.quantidade).toString() });
    totais.set(consumo.produtoId, (totais.get(consumo.produtoId) ?? new Prisma.Decimal(0)).plus(consumo.quantidade));
  }
  const sitio = itens[0]?.propriedadeId;
  if (sitio == null) return [];
  for (const grupo of grupos.values())
    if (grupo.partidaId && (await obterSaldo(tx, grupo.produtoId, sitio, grupo.partidaId)).lt(grupo.quantidade))
      throw new RebanhoError("VALIDACAO", "Saldo do lote insuficiente para as tentativas selecionadas", "partidaId");
  for (const [produtoId, quantidade] of totais)
    if ((await obterSaldo(tx, produtoId, sitio)).lt(quantidade))
      throw new RebanhoError("VALIDACAO", "Saldo insuficiente para as tentativas selecionadas", "quantidade");
  const servicos = new Map<string, Prisma.Decimal>();
  for (const item of itens)
    if (item.tipo === "TENTATIVA" && item.operacaoServicoId && item.valorServicoAtribuido != null)
      servicos.set(item.operacaoServicoId, (servicos.get(item.operacaoServicoId) ?? new Prisma.Decimal(0)).plus(dinheiro(item.valorServicoAtribuido)));
  for (const [id, valor] of servicos) {
    const servico = await tx.operacao.findUniqueOrThrow({ where: { id } });
    if (valor.plus(await totalAtribuidoServicoTx(tx, id, sitio)).gt(servico.valorTotal))
      throw new RebanhoError("VALIDACAO", "Atribuições das tentativas superam o valor confirmado do Serviço", "valorServicoAtribuido");
  }
  return [...grupos.values()];
}

export async function executarExecucaoClinicaTx(tx: Tx, entrada: ItemExecucaoClinica, usuarioId: number | null) {
  const item = itemExecucaoClinicaSchema.parse(entrada);
  await prepararExecucaoClinicaTx(tx, item, usuarioId);
  if(item.tipo==="AVALIACAO"&&item.reavaliacao){
    const preparada=await prepararReavaliacaoTx(tx,item,usuarioId);
    const exame=await criarAvaliacaoTx(tx,preparada.input,usuarioId);
    return {id:exame.id,tipo:item.tipo};
  }
  const tarefa = await tx.tarefaProtocolo.findUniqueOrThrow({ where: { id: item.tarefaId }, include: { execucao: { include: { protocolo: true } } } });
  if (item.tipo === "EXAME" && tarefa.execucao.protocolo.tipo !== "REPRODUTIVO") {
    const feita = await registrarExameTx(tx, item, usuarioId);
    const temporal = lerDataIatf(item.realizadaEm ?? item.data);
    await tx.tarefaProtocolo.update({ where: { id: item.tarefaId }, data: { realizadaEm: temporal.instante, precisaoRealizacao: temporal.precisao } });
    return { id: feita.id, tipo: item.tipo };
  }
  const feita = await executarTarefaTx(tx, item.tarefaId, entradaClinicaIatf(item), usuarioId);
  const id = item.tipo === "TENTATIVA" ? feita.tentativaId : item.tipo === "AVALIACAO" ? feita.avaliacaoId : feita.exameId;
  if (!id) throw new RebanhoError("CONFLITO", "A execução não produziu o fato clínico esperado");
  return { id, tipo: item.tipo };
}
