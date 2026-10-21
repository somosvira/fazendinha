import { prepararExecucaoManejoTx,executarExecucaoManejoTx,travarOrigensManejosTx,conferirServicosManejosTx } from "./execucao.manejos.js";
import type { ItemExecucaoManejo } from "./execucao.manejos.schemas.js";
import { prepararExecucaoClinicaTx,executarExecucaoClinicaTx,travarOrigensExecucaoClinicaTx,conferirConsumosExecucaoClinicaTx } from "./execucao.clinica.js";
import type { ItemExecucaoClinica } from "./execucao.clinica.schemas.js";
import { Prisma } from "@prisma/client";
import { travarValorizacaoTx } from "../../estoque/valorizacao.js";
import { prisma } from "../../../db.js";
import { transacaoPecuaria } from "../transacao.js";
import { RebanhoError, travarAnimais } from "../rebanho/regras.js";
import { recuperarRequisicaoTx, guardarRequisicaoTx } from "../requisicoes.js";
import { prepararAplicacaoTx, criarAplicacaoTx, travarOrigensAplicacoesTx } from "../sanidade/aplicacoes.js";
import { conferirConsumosExecucaoTx } from "../sanidade/execucao-etapas.js";
import { prepararExecucaoTarefaTx, executarTarefaTx } from "../reproducao/iatf.js";
import { exigeMotivoExecucao } from "../desvios.calc.js";
import { execucaoProtocoloSchema, confirmarExecucaoProtocoloSchema, paginaExecucaoSchema, type ExecucaoProtocoloInput, type ItemExecucaoProtocolo, type FatoReciboProtocolo } from "./execucao.schemas.js";
import { hashExecucaoProtocolo, paginaExecucao } from "./execucao.calc.js";

const operacao = "EXECUCAO_PROTOCOLO_V1";
type Tx = Prisma.TransactionClient;
function entradaIatf(item: Extract<ItemExecucaoProtocolo,{tipo:"APLICACAO"}>) {
  const { tipo: _tipo, tarefaId, desvio, cienciaRecalendarioLegado, aplicadaEm, ...dados } = item;
  return { chave: tarefaId, propriedadeId: item.propriedadeId, realizadaEm: aplicadaEm ?? item.data,
    dados: { ...dados, aplicadaEm }, motivo: desvio?.motivo, cienciaRecalendarioLegado };
}
function ordenar(input: ExecucaoProtocoloInput): ExecucaoProtocoloInput {
  return { ...input, itens: [...input.itens].sort((a, b) => a.tarefaId.localeCompare(b.tarefaId)) };
}

/** Pode receber várias ações de uma visita; todas as origens precedem a preparação dos grupos. */
export async function travarOrigensExecucaoProtocoloTx(tx:Tx,itens:ItemExecucaoProtocolo[],tarefas?:Array<{execucao:{operacaoServicoId?:string|null}}>) {
  const aplicacoes=itens.filter((i):i is Extract<ItemExecucaoProtocolo,{tipo:"APLICACAO"}>=>i.tipo==="APLICACAO");
  const manejos=itens.filter((i):i is ItemExecucaoManejo=>i.tipo==="MANEJO"||i.tipo==="RETIRADA");
  const clinicos=itens.filter((i):i is ItemExecucaoClinica=>i.tipo==="EXAME"||i.tipo==="TENTATIVA"||i.tipo==="AVALIACAO");
  await travarAnimais(tx,itens.map(i=>i.animalId));
  // A trava de valorização é a primeira trava de produto dos dois executores.
  // Uma visita com aplicação e IA precisa ordenar o conjunto das duas famílias.
  if(aplicacoes.length&&clinicos.some(i=>i.tipo==="TENTATIVA"&&i.materialId)) {
    const materiais=await tx.materialGenetico.findMany({where:{id:{in:clinicos.flatMap(i=>i.tipo==="TENTATIVA"&&i.materialId?[i.materialId]:[])}},select:{produtoId:true}});
    await travarValorizacaoTx(tx,[...new Set([...aplicacoes.flatMap(i=>i.produtoId?[i.produtoId]:[]),...materiais.map(m=>m.produtoId)])].sort());
  }
  await travarOrigensAplicacoesTx(tx,aplicacoes);
  if(clinicos.length)await travarOrigensExecucaoClinicaTx(tx,clinicos,false);
  // Serviços também podem ser compartilhados entre ações/famílias na visita.
  const contextos=tarefas??await tx.tarefaProtocolo.findMany({where:{id:{in:itens.map(i=>i.tarefaId)}},select:{execucao:{select:{operacaoServicoId:true}}}});
  const servicos=[...new Set([...itens.flatMap(i=>"operacaoServicoId" in i&&i.operacaoServicoId?[i.operacaoServicoId]:[]),...contextos.flatMap(t=>t.execucao.operacaoServicoId?[t.execucao.operacaoServicoId]:[])])].sort();
  for(const id of servicos)await tx.$queryRaw`SELECT id FROM public."Operacao" WHERE id=${id} FOR UPDATE`;
  if(manejos.length)await travarOrigensManejosTx(tx,manejos);
}

/** Prepara todo o conjunto sem criar fatos, movimentar estoque ou alterar calendário. */
export async function prepararExecucaoProtocoloTx(tx: Tx, entrada: ExecucaoProtocoloInput) {
  const input = ordenar(execucaoProtocoloSchema.parse(entrada));
  await travarAnimais(tx, input.itens.map(i => i.animalId));
  const tarefas = await tx.tarefaProtocolo.findMany({ where: { id: { in: input.itens.map(i => i.tarefaId) } },
    include: { etapa: true, execucao: { include: { protocolo: true, rodada: true } } } });
  if (tarefas.length !== input.itens.length || tarefas.some(t => {
    const item = input.itens.find(i => i.tarefaId === t.id)!;
    return t.execucao.animalId !== item.animalId || t.execucao.propriedadeId !== input.propriedadeId || (t.etapa.configuracao&&typeof t.etapa.configuracao==="object"&&!Array.isArray(t.etapa.configuracao)&&t.etapa.configuracao.tipo==="AVALIACAO"?"AVALIACAO":t.etapa.tipo) !== item.tipo;
  })) throw new RebanhoError("NAO_ENCONTRADO", "Tarefa não encontrada para o animal, ação e sítio selecionados", "itens");
  if (new Set(tarefas.map(t => `${t.etapaId}:${t.execucao.rodadaId ?? t.execucaoId}`)).size !== 1)
    throw new RebanhoError("VALIDACAO", "Selecione a mesma ação e programação; participação individual não se mistura a outra inscrição", "itens");
  if (tarefas.some(t => t.execucao.canceladaEm || t.execucao.rodada && t.execucao.rodada.status !== "ABERTA"))
    throw new RebanhoError("CONFLITO", "A participação ou programação está encerrada", "itens");
  const aplicacoes=input.itens.filter((i):i is Extract<ItemExecucaoProtocolo,{tipo:"APLICACAO"}>=>i.tipo==="APLICACAO");
  const manejos=input.itens.filter((i):i is ItemExecucaoManejo=>i.tipo==="MANEJO"||i.tipo==="RETIRADA");
  const clinicos=input.itens.filter((i):i is ItemExecucaoClinica=>i.tipo==="EXAME"||i.tipo==="TENTATIVA"||i.tipo==="AVALIACAO");
  await travarOrigensExecucaoProtocoloTx(tx,input.itens,tarefas);
  const itens = [];
  const basesFingerprint = [];
  const preparadosClinicos:Awaited<ReturnType<typeof prepararExecucaoClinicaTx>>[]=[];
  const quantidadesDiretas = new Map<string, Prisma.Decimal>();
  for (const item of input.itens) {
    const tarefa = tarefas.find(t => t.id === item.tarefaId)!;
    try {
      if(item.tipo!=="APLICACAO"){
        const p=item.tipo==="MANEJO"||item.tipo==="RETIRADA"?await prepararExecucaoManejoTx(tx,item,null):await prepararExecucaoClinicaTx(tx,item,null);
        if("consumo" in p)preparadosClinicos.push(p);
        basesFingerprint.push({tarefaId:tarefa.id,planejado:tarefa.parametros,momento:tarefa.momentoSnapshot,prevista:tarefa.previstaPara,preparada:p.dadosFingerprint});
        itens.push({tarefaId:item.tarefaId,animalId:item.animalId,tipo:item.tipo,...p.desvio,inicioLegado:p.inicioLegado,carencia:null});
        continue;
      }
      let desvio;
      let preparada;
      let inicioLegado = { exigeCiencia: false, total: 0 };
      if (tarefa.execucao.protocolo.tipo === "REPRODUTIVO") {
        const reprodutiva = await prepararExecucaoTarefaTx(tx, tarefa.id, entradaIatf(item), null);
        // O executor IATF mantém seu plano e seus efeitos clínicos. A preparação
        // sanitária é reutilizada somente para validar a origem/custo/carência.
        const { tarefaId: _tarefaId, cienciaSanitaria: _ciencia, cienciaRecalendarioLegado: _legado, ...avulsa } = item;
        preparada = await prepararAplicacaoTx(tx, avulsa, null, true);
        desvio = { ...reprodutiva.desvio, referencia: reprodutiva.plano ? "SNAPSHOT_PLANEJADO" : "LEGADO_SEM_SNAPSHOT",
          motivo: item.desvio?.motivo ?? null, motivoObrigatorio: exigeMotivoExecucao(reprodutiva.desvio),
          planejado: reprodutiva.plano?.etapa ?? {}, realizado: reprodutiva.preparado };
        inicioLegado = { exigeCiencia: reprodutiva.impactosInicio.itens.length > 0, total: reprodutiva.impactosInicio.itens.length };
        basesFingerprint.push({ tarefaId: tarefa.id, plano: reprodutiva.plano, impactos: reprodutiva.impactosInicio });
      } else {
        preparada = await prepararAplicacaoTx(tx, item, null, true);
        desvio = preparada.desvioProtocoloSnapshot!;
      }
      if (preparada.dadosCriacao.quantidadeCompraDireta != null)
        quantidadesDiretas.set(item.tarefaId, new Prisma.Decimal(preparada.dadosCriacao.quantidadeCompraDireta.toString()));
      basesFingerprint.push({ tarefaId: tarefa.id, planejado: tarefa.parametros, momento: tarefa.momentoSnapshot,
        prevista: tarefa.previstaPara, precisao: tarefa.precisaoTemporal, inicio: tarefa.execucao.inicioEfetivo,
        versao: tarefa.execucao.protocolo.versao, preparada: preparada.dadosCriacao });
      itens.push({ tarefaId: item.tarefaId, animalId: item.animalId, tipo: item.tipo, ...desvio, inicioLegado,
        carencia: { estadoLeite: preparada.dadosCriacao.estadoCarenciaLeite, estadoCarne: preparada.dadosCriacao.estadoCarenciaCarne,
          leiteHoras: item.carenciaLeiteHoras ?? null, carneHoras: item.carenciaCarneHoras ?? null } });
    } catch (e) {
      if (e instanceof RebanhoError) throw new RebanhoError(e.code, `Animal ${item.animalId}: ${e.message}`, `itens.${entrada.itens.findIndex(i => i.tarefaId === item.tarefaId)}.${e.campo ?? "tarefaId"}`);
      throw e;
    }
  }
  const consumos = aplicacoes.length?await conferirConsumosExecucaoTx(tx, {propriedadeId:input.propriedadeId,itens:aplicacoes}, quantidadesDiretas):[];
  if(clinicos.length)consumos.push(...await conferirConsumosExecucaoClinicaTx(tx,clinicos,preparadosClinicos));
  if(manejos.length)await conferirServicosManejosTx(tx,manejos);
  return { input, tarefas, itens, consumos, temDesvios: itens.some(i => i.motivoObrigatorio),
    fingerprint: hashExecucaoProtocolo({ input, basesFingerprint, itens, consumos }) };
}

export async function preverExecucaoProtocolo(entrada: ExecucaoProtocoloInput, consulta: unknown = {}) {
  const f = paginaExecucaoSchema.parse(consulta);
  return transacaoPecuaria(async tx => {
    const previa = await prepararExecucaoProtocoloTx(tx, entrada);
    return { versao: 1 as const, fingerprint: previa.fingerprint, temDesvios: previa.temDesvios,
      tarefas: paginaExecucao(previa.itens, f.pagina, f.porPagina), consumos: paginaExecucao(previa.consumos, f.pagina, f.porPagina) };
  });
}

/** Uma transação serializável: chave, revalidação, todos os fatos e recibo. */
export async function confirmarExecucaoProtocoloTx(tx: Tx, entrada: unknown, usuarioId: number | null) {
  const { execucao, chave, fingerprint } = confirmarExecucaoProtocoloSchema.parse(entrada);
  const input = ordenar(execucao);
  await travarAnimais(tx, input.itens.map(i => i.animalId));
  const identidade = { chave, propriedadeId: input.propriedadeId, usuarioId, operacao, hashPayload: hashExecucaoProtocolo({ input, fingerprint }) };
  const anterior = await recuperarRequisicaoTx(tx, identidade);
  if (anterior) return recibo(chave, anterior.resultadoIds);
  const previa = await prepararExecucaoProtocoloTx(tx, input);
  if (previa.fingerprint !== fingerprint) throw new RebanhoError("CONFLITO", "O planejamento, a origem ou os dados mudaram. Confira uma nova prévia", "fingerprint");
  if (previa.itens.some(i => i.motivoObrigatorio && !i.motivo)) throw new RebanhoError("VALIDACAO", "Explique os desvios antes de confirmar", "desvio.motivo");
  const fatos=await executarItensPreparadosProtocoloTx(tx,previa,usuarioId);
  const resultado = { versao: 1, fatos };
  await guardarRequisicaoTx(tx, identidade, resultado);
  return recibo(chave, resultado);
}
/** Escreve na transação do chamador; não cria outro envelope ou transação por grupo. */
export async function executarItensPreparadosProtocoloTx(tx:Tx,previa:Awaited<ReturnType<typeof prepararExecucaoProtocoloTx>>,usuarioId:number|null) {
  if(previa.itens.some(i=>i.motivoObrigatorio&&!i.motivo))throw new RebanhoError("VALIDACAO","Explique os desvios antes de confirmar","desvio.motivo");
  const fatos: FatoReciboProtocolo[] = [];
  for (const item of previa.input.itens) {
    const tarefa = previa.tarefas.find(t => t.id === item.tarefaId)!;
    let id: string;
    if(item.tipo==="MANEJO"||item.tipo==="RETIRADA")id=(await executarExecucaoManejoTx(tx,item,usuarioId)).id;
    else if(item.tipo!=="APLICACAO")id=(await executarExecucaoClinicaTx(tx,item,usuarioId)).id;
    else if (tarefa.execucao.protocolo.tipo === "REPRODUTIVO") {
      const feita = await executarTarefaTx(tx, tarefa.id, entradaIatf(item), usuarioId);
      if (!feita.aplicacaoId) throw new RebanhoError("CONFLITO", "A execução não produziu a aplicação esperada");
      id = feita.aplicacaoId;
    } else id = (await criarAplicacaoTx(tx, item, usuarioId)).id;
    fatos.push({ tarefaId: item.tarefaId, animalId: item.animalId, tipo: item.tipo, id });
  }
  return fatos;
}
export const confirmarExecucaoProtocolo = (entrada: unknown, usuarioId: number | null) => transacaoPecuaria(tx => confirmarExecucaoProtocoloTx(tx, entrada, usuarioId));

function recibo(chave: string, resultado: unknown, pagina = 1, porPagina = 10) {
  const envelope = resultado as { versao?: number; fatos?: FatoReciboProtocolo[] };
  if (envelope?.versao !== 1 || !Array.isArray(envelope.fatos)) throw new RebanhoError("CONFLITO", "Recibo incompatível com esta operação");
  return { versao: 1 as const, chave, ...paginaExecucao(envelope.fatos, pagina, porPagina) };
}
export async function obterReciboExecucaoProtocolo(chave: string, propriedadeId: number, usuarioId: number | null, consulta: unknown) {
  const f = paginaExecucaoSchema.parse(consulta);
  const requisicao = await prisma.requisicaoPecuaria.findFirst({ where: { chave, propriedadeId, usuarioId, operacao } });
  if (!requisicao) throw new RebanhoError("NAO_ENCONTRADO", "Confirmação não encontrada neste sítio e autoria");
  return recibo(chave, requisicao.resultadoIds, f.pagina, f.porPagina);
}
