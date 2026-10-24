import { sqlDemandaPendenteTarefa } from "../reproducao/acompanhamento.js";
import { nomeEtapaOperacao } from "./operacao.rotulos.js";
import { participacaoNoEscopoOperacao, programacaoNoEscopoOperacao, tarefaNoEscopoOperacao, sqlTarefaNoEscopoOperacao } from "./operacao.escopo.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { temPermissao } from "../../auth/papeis.js";
import { RebanhoError } from "../rebanho/regras.js";
import { estimarProtocoloTx } from "../custos/estimativa-protocolo.js";
import { consolidarCustos } from "../custos/custos.calc.js";
import { consultarCustosTx } from "../custos/custos.js";
import { podeConsultarCustosPecuaria, podeVerValoresFinanceiros } from "../custos/permissoes.js";
import { consultaOperacaoSchema, type ConsultaOperacao, type ContextoOperacao } from "./operacao.schemas.js";
import type { CabecalhoOperacao, ContagensOperacao, SituacaoOperacional, VinculoAtualOperacao } from "./operacao.dto.js";
import { sqlSituacaoOperacional, sqlAtrasoOperacional, ultimoEventoOperacional, contextoRegularizacaoOperacao, vinculoRegularizacaoSelect, tarefaOperacionalAtrasada } from "./situacao.js";

type Tx = Prisma.TransactionClient;
export type UsuarioOperacao = { dono: boolean; areas: string[]; flags: string[] } | null;
const protocoloSelect = { id:true, nome:true, versao:true, tipo:true } as const;
const animalSelect = { id:true, brinco:true, nome:true } as const;
const pendentes = ["NAO_ATENDIDO", "SEM_REGISTRO", "ADIADO", "REGULARIZACAO_PENDENTE"];
export function paginaOperacao(total:number,pagina:number,porPagina:number) { return Math.min(pagina,Math.max(1,Math.ceil(total/porPagina))); }
async function contextoTx(tx:Tx, c:ContextoOperacao, propriedadeId:number|null) {
  if (c.programacaoId) {
    const r = await tx.programacaoProtocolo.findFirst({where:{OR:[{id:c.programacaoId},{legadoIatfId:c.programacaoId}],AND:[programacaoNoEscopoOperacao(propriedadeId)]},include:{protocolo:{select:protocoloSelect}}});
    if(!r) throw new RebanhoError("NAO_ENCONTRADO","Programação não encontrada neste sítio");
    return {id:r.id,modo:"COLETIVO" as const,nome:r.nome,protocolo:r.protocolo,propriedadeId:r.propriedadeId,propriedadeContextoId:propriedadeId??r.propriedadeId,escopoLeituraId:propriedadeId,inicioReferencia:r.inicioReferencia,precisaoTemporal:r.precisaoTemporal,status:r.status,animal:null,where:{rodadaId:r.id,AND:[participacaoNoEscopoOperacao(propriedadeId)]} satisfies Prisma.ParticipacaoProtocoloWhereInput};
  }
  const p=await tx.participacaoProtocolo.findFirst({where:{OR:[{id:c.participacaoId},{legadoIatfId:c.participacaoId}],AND:[participacaoNoEscopoOperacao(propriedadeId)]},include:{protocolo:{select:protocoloSelect},animal:{select:animalSelect},rodada:{select:{status:true}}}});
  if(!p) throw new RebanhoError("NAO_ENCONTRADO","Participação individual não encontrada neste sítio");
  return {id:p.id,modo:"INDIVIDUAL" as const,nome:p.animal.nome??p.animal.brinco,protocolo:p.protocolo,propriedadeId:p.propriedadeId,propriedadeContextoId:propriedadeId??p.propriedadeId,escopoLeituraId:propriedadeId,inicioReferencia:p.inicio,precisaoTemporal:p.precisaoTemporal,status:p.canceladaEm?"ENCERRADA":p.rodada?.status??"ABERTA",animal:p.animal,where:{id:p.id} satisfies Prisma.ParticipacaoProtocoloWhereInput};
}
type Contexto = Awaited<ReturnType<typeof contextoTx>>;
function baseSql(c:Contexto,f:ConsultaOperacao,agora:Date,aplicarEtapa=true) {
  const escopo=c.modo==="COLETIVO"?Prisma.sql`p."programacaoId"=${c.id}`:Prisma.sql`p.id=${c.id}`;
  const busca=f.busca?Prisma.sql`AND (strpos(lower(a.brinco),lower(${f.busca}))>0 OR strpos(lower(coalesce(a.nome,'')),lower(${f.busca}))>0)`:Prisma.empty;
  const etapa=aplicarEtapa&&f.etapaId?Prisma.sql`AND t."etapaId"=${f.etapaId}`:Prisma.empty;
  return Prisma.sql`WITH tarefas AS (SELECT t.id,p."animalId",t."etapaId",t."previstaEm",t."precisaoTemporal",t."previsaoPendente",${sqlDemandaPendenteTarefa()} AS "acompanhamentoPendente",${sqlSituacaoOperacional(agora)} AS situacao FROM pecuaria."TarefaProtocolo" t JOIN pecuaria."ParticipacaoProtocolo" p ON p.id=t."participacaoId" JOIN pecuaria."Animal" a ON a.id=p."animalId" WHERE ${escopo} AND ${sqlTarefaNoEscopoOperacao(c.escopoLeituraId)} ${busca} ${etapa})`;
}
function filtroSituacao(f:ConsultaOperacao,agora:Date) {
  if(f.situacao==="PENDENTES") return Prisma.sql`(situacao IN (${Prisma.join(pendentes)}) OR "acompanhamentoPendente")`;
  if(f.situacao==="ACOMPANHAMENTO_PENDENTE") return Prisma.sql`"acompanhamentoPendente"`;
  if(f.situacao==="ATRASADAS") return sqlAtrasoOperacional(agora);
  return f.situacao?Prisma.sql`situacao=${f.situacao}`:Prisma.sql`true`;
}
export function contagensOperacao(linhas:Array<{situacao:string;total:bigint|number;atrasadas:bigint|number}>):ContagensOperacao {
  const n=(s:string)=>Number(linhas.find(l=>l.situacao===s)?.total??0);
  return {total:linhas.reduce((s,l)=>s+Number(l.total),0),atendidos:n("ATENDIDO"),pendentes:pendentes.reduce((s,p)=>s+n(p),0),atrasadas:linhas.reduce((s,l)=>s+Number(l.atrasadas),0),naoAtendidos:n("NAO_ATENDIDO"),adiados:n("ADIADO"),semRegistro:n("SEM_REGISTRO"),previstos:n("PREVISTO"),regularizacoes:n("REGULARIZACAO_PENDENTE"),encerradas:n("ENCERRADO")+n("DISPENSADO")+n("RETIRADO")};
}
async function contarTx(tx:Tx,c:Contexto,f:ConsultaOperacao,agora:Date) {
  const linhas=await tx.$queryRaw<Array<{situacao:string;total:bigint;atrasadas:bigint}>>(Prisma.sql`${baseSql(c,f,agora)} SELECT situacao,count(*) AS total,count(*) FILTER(WHERE ${sqlAtrasoOperacional(agora)}) AS atrasadas FROM tarefas GROUP BY situacao`);
  const operacionais=contagensOperacao(linhas);
  const [clinico]=await tx.$queryRaw<Array<{animaisPendentes:bigint;acompanhamentosPendentes:bigint}>>(Prisma.sql`${baseSql(c,f,agora)} SELECT count(DISTINCT "animalId") FILTER(WHERE situacao IN (${Prisma.join(pendentes)}) OR "acompanhamentoPendente") AS "animaisPendentes",count(*) FILTER(WHERE "acompanhamentoPendente") AS "acompanhamentosPendentes" FROM tarefas`);
  const animaisPendentes=Number(clinico?.animaisPendentes??0);
  return {...operacionais,pendentes:animaisPendentes,pendenciasOperacionais:operacionais.pendentes,animaisPendentes,acompanhamentosPendentes:Number(clinico?.acompanhamentosPendentes??0)};
}
const leitura=<T>(fn:(tx:Tx)=>Promise<T>)=>prisma.$transaction(fn,{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
export async function obterCabecalhoOperacao(contexto:ContextoOperacao,propriedadeId:number|null,_usuario?:UsuarioOperacao):Promise<CabecalhoOperacao> {
  return leitura(async tx=>{const c=await contextoTx(tx,contexto,propriedadeId);const {where,escopoLeituraId,...campos}=c;return {...campos,podeEditarValores:podeVerValoresFinanceiros(_usuario??null),participantesTotal:c.modo==="INDIVIDUAL"?1:await tx.participacaoProtocolo.count({where:c.where}),tipo:c.protocolo.tipo,inicioReferencia:c.inicioReferencia.toISOString(),contagens:await contarTx(tx,c,consultaOperacaoSchema.parse({}),new Date())};});
}
export async function listarEtapasOperacao(contexto:ContextoOperacao,propriedadeId:number|null,consulta:ConsultaOperacao) {
  const f=consultaOperacaoSchema.parse(consulta);
  return leitura(async tx=>{const c=await contextoTx(tx,contexto,propriedadeId);const where={protocoloId:c.protocolo.id,...(f.momentoId?{momentoId:f.momentoId==="SEM_MOMENTO"?null:f.momentoId}:{})};const total=await tx.etapaProtocolo.count({where});const pagina=paginaOperacao(total,f.pagina,f.porPagina);const agora=new Date();
    const etapas=await tx.etapaProtocolo.findMany({where,include:{momento:true,produto:{select:{nome:true}},tipoExame:{select:{nome:true}}},orderBy:[{ordem:"asc"},{id:"asc"}],skip:(pagina-1)*f.porPagina,take:f.porPagina});
    const itens=await Promise.all(etapas.map(async e=>{const previsao=await tx.tarefaProtocolo.findFirst({where:{etapaId:e.id,execucao:c.where,AND:[tarefaNoEscopoOperacao(c.escopoLeituraId)]},select:{previstaPara:true,precisaoTemporal:true,parametros:true},orderBy:[{previstaPara:"asc"},{id:"asc"}]});return {id:e.id,momento:e.momento,configuracao:e.configuracao,nome:nomeEtapaOperacao(e,previsao?.parametros),ordem:e.ordem,tipo:e.tipo,diaRelativo:e.diaRelativo,unidadeIntervalo:e.unidadeIntervalo,previstaPara:previsao?.previstaPara.toISOString()??null,precisaoTemporal:previsao?.precisaoTemporal??null,contagens:await contarTx(tx,c,{...f,etapaId:e.id},agora)};}));
    return {itens,total,pagina,porPagina:f.porPagina};});
}
const includeTarefa={demandaAcompanhamento:{select:{id:true,estado:true,finalidade:true,previstaPara:true,versao:true,exameResolucaoId:true}},execucao:{include:{animal:{select:animalSelect},protocolo:{select:protocoloSelect}}},etapa:true,aplicacoes:{where:{status:"VALIDO"},take:1,orderBy:{id:"asc"},select:{id:true,status:true,data:true,aplicadaEm:true,dose:true,unidadeDose:true,nomeProdutoAplicado:true,propriedadeId:true}},exames:{where:{status:"VALIDO"},take:1,orderBy:{id:"asc"},select:{id:true,status:true,data:true,propriedadeId:true,formatoSnapshot:true,realizacao:true,resultados:{where:{vigente:true,campo:{in:["CONCLUSAO_GESTACIONAL","SEXO_FETAL"]}},select:{campo:true,valor:true}},interpretacao:{select:{id:true}}}},tentativas:{where:{status:"VALIDO"},take:1,orderBy:{id:"asc"},select:{id:true,status:true,data:true,propriedadeId:true}},manejos:{where:{status:"VALIDO"},take:1,orderBy:{id:"asc"},select:{id:true,status:true,data:true,realizadaEm:true,propriedadeId:true,tipo:true}},vinculos:{where:{estado:"ATUAL"},take:1,include:{aplicacao:{select:{id:true,status:true,data:true,aplicadaEm:true,dose:true,unidadeDose:true,nomeProdutoAplicado:true,propriedadeId:true}},exame:{select:{id:true,status:true,data:true,propriedadeId:true,formatoSnapshot:true,realizacao:true,resultados:{where:{vigente:true,campo:{in:["CONCLUSAO_GESTACIONAL","SEXO_FETAL"]}},select:{campo:true,valor:true}},interpretacao:{select:{id:true}}}},tentativa:{select:{id:true,status:true,data:true,propriedadeId:true}},manejo:{select:{id:true,status:true,data:true,realizadaEm:true,propriedadeId:true,tipo:true}}}},eventos:{where:{tipo:{not:"RETIFICACAO_JUSTIFICATIVA"}},orderBy:[{registradoEm:"desc"},{id:"desc"}],take:1,include:{retificacoes:{orderBy:[{registradoEm:"desc"},{id:"desc"}],take:1}}}} satisfies Prisma.TarefaProtocoloInclude;
export async function listarTarefasOperacao(contexto:ContextoOperacao,propriedadeId:number|null,consulta:ConsultaOperacao,usuario:UsuarioOperacao) {
  const f=consultaOperacaoSchema.parse(consulta);
  return leitura(async tx=>{const c=await contextoTx(tx,contexto,propriedadeId);if(f.etapaId&&!await tx.etapaProtocolo.findFirst({where:{id:f.etapaId,protocoloId:c.protocolo.id},select:{id:true}}))throw new RebanhoError("NAO_ENCONTRADO","Etapa não pertence à versão deste protocolo");
    const agora=new Date();const base=baseSql(c,f,agora);const predicado=filtroSituacao(f,agora);const [contagem]=await tx.$queryRaw<Array<{total:bigint}>>(Prisma.sql`${base} SELECT count(*) AS total FROM tarefas WHERE ${predicado}`);const total=Number(contagem?.total??0);const pagina=paginaOperacao(total,f.pagina,f.porPagina);
    const ids=await tx.$queryRaw<Array<{id:string;situacao:SituacaoOperacional;acompanhamentoPendente:boolean}>>(Prisma.sql`${base} SELECT id,situacao,"acompanhamentoPendente" FROM tarefas WHERE ${predicado} ORDER BY "previstaEm",id OFFSET ${(pagina-1)*f.porPagina} LIMIT ${f.porPagina}`);
    const tarefas=await tx.tarefaProtocolo.findMany({where:{id:{in:ids.map(i=>i.id)}},include:includeTarefa});
    const origensRegularizacao=await tx.tarefaProtocolo.findMany({where:{id:{in:ids.map(i=>i.id)}},select:{id:true,vinculos:vinculoRegularizacaoSelect,execucao:{select:{propriedadeId:true}}}});
    const escrever=!!usuario&&temPermissao(usuario,"lancar");
    const itens=ids.map(i=>{const t=tarefas.find(t=>t.id===i.id)!;const regularizacao=contextoRegularizacaoOperacao(origensRegularizacao.find(o=>o.id===t.id)??{execucao:{propriedadeId:t.execucao.propriedadeId}},propriedadeId);const bruto=t.vinculos[0]??(t.manejos[0]?{manejo:t.manejos[0],manejoId:t.manejos[0].id,aplicacao:null,aplicacaoId:null,exame:null,exameId:null,tentativa:null,tentativaId:null,origem:"EXECUCAO"}:t.aplicacoes[0]?{aplicacao:t.aplicacoes[0],aplicacaoId:t.aplicacoes[0].id,exame:null,exameId:null,tentativa:null,tentativaId:null,origem:"EXECUCAO"}:t.exames[0]?{aplicacao:null,aplicacaoId:null,exame:t.exames[0],exameId:t.exames[0].id,tentativa:null,tentativaId:null,origem:"EXECUCAO"}:t.tentativas[0]?{aplicacao:null,aplicacaoId:null,exame:null,exameId:null,tentativa:t.tentativas[0],tentativaId:t.tentativas[0].id,origem:"EXECUCAO"}:undefined);const v=bruto&&[bruto.aplicacao,bruto.exame,bruto.tentativa,"manejo" in bruto?bruto.manejo:null].some(f=>f&&(propriedadeId==null||f.propriedadeId===propriedadeId))?bruto:undefined;const manejo=v&&"manejo" in v?v.manejo:null;const vinculoAtual:VinculoAtualOperacao|null=manejo?{tipo:"MANEJO",id:manejo.id,origem:v!.origem}:v?.aplicacao?{tipo:"APLICACAO",id:v.aplicacao.id,origem:v.origem}:v?.exame?{tipo:"EXAME",id:v.exame.id,origem:v.origem}:v?.tentativa?{tipo:"TENTATIVA",id:v.tentativa.id,origem:v.origem}:null;const realizadaEm=t.realizadaEm??manejo?.realizadaEm??manejo?.data??v?.aplicacao?.aplicadaEm??v?.aplicacao?.data??v?.exame?.data??v?.tentativa?.data??null;const evento=ultimoEventoOperacional(t.eventos.flatMap(e=>[e,...e.retificacoes]));const config=t.etapa.configuracao&&typeof t.etapa.configuracao==="object"&&!Array.isArray(t.etapa.configuracao)?t.etapa.configuracao:{};const aberto=(propriedadeId==null||propriedadeId===t.execucao.propriedadeId)&&["NAO_ATENDIDO","SEM_REGISTRO","ADIADO","PREVISTO"].includes(i.situacao)&&c.status==="ABERTA";
      const tarefaOrigem={id:t.id,...regularizacao,etapaId:t.etapaId,execucaoId:t.execucaoId,parametros:t.parametros,previstaPara:t.previstaPara,previstaEm:t.previstaPara,previsaoOriginal:t.previsaoOriginal,precisaoTemporal:t.precisaoTemporal,precisaoRealizacao:t.precisaoRealizacao,previsaoPendente:t.previsaoPendente,realizadaEm,dispensadaEm:t.dispensadaEm,regularizacaoPendente:t.regularizacaoPendente,historicoRegularizacao:Array.isArray(t.historicoRegularizacao)?t.historicoRegularizacao.slice(-1).map(e=>e&&typeof e==="object"&&!Array.isArray(e)?{acao:e.acao,destinoConsumo:e.destinoConsumo}:{}):[],acompanhamento:t.demandaAcompanhamento,nome:t.nomeSnapshot??t.etapa.nome,tipo:typeof config.tipo==="string"?config.tipo:t.etapa.tipo,status:i.situacao==="ATENDIDO"?"REALIZADA":i.situacao==="DISPENSADO"?"DISPENSADA":i.situacao==="ENCERRADO"?"ENCERRADA_SEM_SUBSTITUICAO":i.situacao==="REGULARIZACAO_PENDENTE"?i.situacao:"PENDENTE",planejadoSnapshot:t.parametros,realizadoSnapshot:t.realizadoSnapshot,aplicacaoId:v?.aplicacaoId??null,avaliacaoId:v?.exame?.interpretacao?.id??null,tentativaId:v?.tentativaId??null,fatoId:vinculoAtual?.id??null,manejoId:manejo?.id??null,manejos:manejo?[manejo]:[],aplicacoes:v?.aplicacao?[v.aplicacao]:[],exames:v?.exame?[v.exame]:[],execucao:{id:t.execucao.id,animalId:t.execucao.animalId,propriedadeId:t.execucao.propriedadeId,canceladaEm:t.execucao.canceladaEm,origemCalendario:t.execucao.origemCalendario,inicioEfetivo:t.execucao.inicioEfetivo,animal:t.execucao.animal,protocolo:t.execucao.protocolo}};
      return {id:t.id,...regularizacao,atrasada:tarefaOperacionalAtrasada({...t,vinculos:t.vinculos},agora),tarefaId:t.id,participacaoId:t.execucaoId,etapaId:t.etapaId,animal:t.execucao.animal,propriedadeId:t.execucao.propriedadeId,situacao:i.situacao,previstaPara:t.previstaPara,previsaoOriginal:t.previsaoOriginal,previsaoIndividual:!!t.previsaoOriginal&&t.previsaoOriginal.getTime()!==t.previstaPara.getTime(),precisaoTemporal:t.precisaoTemporal,realizadaEm,precisaoRealizacao:t.precisaoRealizacao,previsaoPendente:t.previsaoPendente,resultadoProcedimento:v?.exame?{realizacao:v.exame.realizacao,resultados:v.exame.resultados}:null,acompanhamento:t.demandaAcompanhamento,acompanhamentoPendente:i.acompanhamentoPendente,ultimoEvento:evento?{id:evento.id,tipo:evento.tipo,motivo:evento.motivo,ocorridaEm:evento.ocorridaEm}:null,vinculoAtual,acoes:{reavaliar:escrever&&c.status==="ABERTA"&&!t.execucao.canceladaEm&&(propriedadeId==null||propriedadeId===t.execucao.propriedadeId)&&config.tipo==="AVALIACAO"&&t.demandaAcompanhamento?.estado==="PENDENTE"&&i.situacao==="ATENDIDO",atender:escrever&&aberto,justificar:escrever&&aberto,adiar:escrever&&aberto,retificar:escrever&&(propriedadeId==null||propriedadeId===t.execucao.propriedadeId)&&!!evento,regularizar:escrever&&regularizacao.propriedadeRegularizacaoId!=null&&i.situacao==="REGULARIZACAO_PENDENTE"},tarefaOrigem};});
    return {itens,total,pagina,porPagina:f.porPagina,resumo:await contarTx(tx,c,f,agora)};});
}
export async function listarEventosTarefaOperacao(tarefaId:string,propriedadeId:number|null,consulta:ConsultaOperacao) {
  const f=consultaOperacaoSchema.parse(consulta);
  return leitura(async tx=>{const tarefa=await tx.tarefaProtocolo.findFirst({where:{id:tarefaId,AND:[tarefaNoEscopoOperacao(propriedadeId)]},select:{id:true}});if(!tarefa)throw new RebanhoError("NAO_ENCONTRADO","Tarefa não encontrada neste sítio");
    const where={tarefaId};const total=await tx.eventoTarefaProtocolo.count({where});const pagina=paginaOperacao(total,f.pagina,f.porPagina);const itens=await tx.eventoTarefaProtocolo.findMany({where,orderBy:[{registradoEm:"desc"},{id:"desc"}],skip:(pagina-1)*f.porPagina,take:f.porPagina});return {itens,total,pagina,porPagina:f.porPagina};});
}
export async function listarProcedimentosOperacao(contexto:ContextoOperacao,propriedadeId:number|null,consulta:ConsultaOperacao,usuario:UsuarioOperacao) {
  const f=consultaOperacaoSchema.parse(consulta);
  return leitura(async tx=>{const c=await contextoTx(tx,contexto,propriedadeId);if(!podeConsultarCustosPecuaria(usuario))throw new RebanhoError("NAO_ENCONTRADO","Custos não disponíveis neste sítio");
    if(f.situacao||f.etapaId)throw new RebanhoError("VALIDACAO","Filtro de tarefa não se aplica aos procedimentos");
    // O serviço existente já calcula o conjunto integral. Este limite é interno;
    // ordenamos e recortamos antes de construir o único DTO público, limitado a dez.
    const filtro={...(c.modo==="COLETIVO"?{programacaoId:c.id}:{participacaoId:c.id}),pagina:1,limite:Number.MAX_SAFE_INTEGER};
    const sitios=propriedadeId!=null?[propriedadeId]:(await tx.$queryRaw<Array<{id:number}>>(Prisma.sql`${baseSql(c,consultaOperacaoSchema.parse({}),new Date())}
      SELECT DISTINCT id FROM (
        SELECT p."propriedadeId" AS id FROM pecuaria."ParticipacaoProtocolo" p JOIN pecuaria."TarefaProtocolo" t ON t."participacaoId"=p.id JOIN tarefas s ON s.id=t.id
        UNION SELECT f."propriedadeId" FROM pecuaria."AplicacaoProduto" f JOIN tarefas s ON s.id=f."tarefaId"
        UNION SELECT f."propriedadeId" FROM pecuaria."ExameAnimal" f JOIN tarefas s ON s.id=f."tarefaId"
        UNION SELECT f."propriedadeId" FROM pecuaria."TentativaReprodutiva" f JOIN tarefas s ON s.id=f."tarefaId"
        UNION SELECT f."propriedadeId" FROM pecuaria."ManejoAnimal" f JOIN tarefas s ON s.id=f."tarefaId"
        UNION SELECT f."propriedadeId" FROM pecuaria."AplicacaoProduto" f JOIN pecuaria."VinculoTarefaProtocolo" v ON v."aplicacaoId"=f.id JOIN tarefas s ON s.id=v."tarefaId"
        UNION SELECT f."propriedadeId" FROM pecuaria."ExameAnimal" f JOIN pecuaria."VinculoTarefaProtocolo" v ON v."exameId"=f.id JOIN tarefas s ON s.id=v."tarefaId"
        UNION SELECT f."propriedadeId" FROM pecuaria."TentativaReprodutiva" f JOIN pecuaria."VinculoTarefaProtocolo" v ON v."tentativaId"=f.id JOIN tarefas s ON s.id=v."tarefaId"
      ) sitios WHERE id IS NOT NULL ORDER BY id`)).map(s=>s.id);
    if(!sitios.length&&c.propriedadeId!=null)sitios.push(c.propriedadeId);
    const porSitio=await Promise.all(sitios.map(sitio=>consultarCustosTx(tx,sitio,filtro,true,podeVerValoresFinanceiros(usuario))));
    const custos=consolidarCustos(porSitio.flatMap(r=>r.componentes.map(componente=>({...componente,valor:componente.valor==null?null:new Prisma.Decimal(componente.valor)}))),true);
    const grupos=new Map<string,typeof custos.componentes>();
    for(const componente of custos.componentes){const chave=`${componente.tipoFonte}:${componente.fonteId}`;const itens=grupos.get(chave)??[];itens.push(componente);grupos.set(chave,itens);}
    const procedimentos=[...grupos.entries()].map(([chave,componentes])=>{
      const resumo=consolidarCustos(componentes.map(c=>({...c,valor:c.valor==null?null:new Prisma.Decimal(c.valor)})),true);
      const {origemId:_origem,natureza:_natureza,...base}=componentes[0];
      return {...base,chave,valor:resumo.totalConhecido,situacao:resumo.situacao,componentesPendentes:resumo.componentesPendentes,componentes:componentes.map(({origemId,...c})=>({...c,origemId:podeVerValoresFinanceiros(usuario)?origemId:null}))};
    }).filter(c=>!f.busca||c.descricao.toLocaleLowerCase("pt-BR").includes(f.busca.toLocaleLowerCase("pt-BR"))).sort((a,b)=>b.data.localeCompare(a.data)||a.chave.localeCompare(b.chave));
    const total=procedimentos.length;const pagina=paginaOperacao(total,f.pagina,f.porPagina);
    return {itens:procedimentos.slice((pagina-1)*f.porPagina,pagina*f.porPagina),total,pagina,porPagina:f.porPagina,resumo:{rotulo:custos.rotulo,cobertura:custos.cobertura,situacao:custos.situacao,totalConhecido:custos.totalConhecido,componentesPendentes:custos.componentesPendentes,limitacoes:custos.limitacoes},estimativa:c.propriedadeContextoId!=null?await estimarProtocoloTx(tx,c.propriedadeContextoId,c.where,tarefaNoEscopoOperacao(c.escopoLeituraId),f.referenciasPagina??1):{situacao:"NAO_APURADO",total:null,totalConhecido:null,componentesConhecidos:0,componentesPendentes:0,referencia:"Sítio de referência não informado",limitacoes:[]}};});
}

export async function preverParticipacaoIndividual(entrada:unknown) {
  const {previaParticipacaoIndividualSchema}=await import("./operacao.schemas.js");
  const {deslocarCalendario}=await import("./calendario.calc.js");
  const input=previaParticipacaoIndividualSchema.parse(entrada);
  return leitura(async tx=>{
    const protocolo=await tx.protocolo.findFirst({where:{id:input.protocoloId,tipo:input.tipo,ativo:true,publicadoEm:{not:null}},select:protocoloSelect});
    if(!protocolo)throw new RebanhoError("NAO_ENCONTRADO","Versão publicada não encontrada");
    const animal=await tx.animal.findFirst({where:{id:input.animalId,localizacoes:{some:{propriedadeId:input.propriedadeId,ate:null}},baixas:{none:{estornadaEm:null}}},select:animalSelect});
    if(!animal)throw new RebanhoError("NAO_ENCONTRADO","Animal não encontrado neste sítio");
    const total=await tx.etapaProtocolo.count({where:{protocoloId:protocolo.id}});const pagina=paginaOperacao(total,input.pagina,input.porPagina);const etapas=await tx.etapaProtocolo.findMany({where:{protocoloId:protocolo.id},orderBy:[{ordem:"asc"},{id:"asc"}],skip:(pagina-1)*input.porPagina,take:input.porPagina});
    const inicio=new Date(input.inicioReferencia);const precisao=input.inicioReferencia.length===10?"DIA" as const:"HORA" as const;
    return {tipo:input.tipo,modo:"INDIVIDUAL" as const,protocolo,animal,propriedadeId:input.propriedadeId,inicioReferencia:input.inicioReferencia,precisaoTemporal:precisao,itens:etapas.map(e=>{const previsaoPendente=precisao==="DIA"&&(e.unidadeIntervalo==="HORAS"||!Number.isInteger(e.diaRelativo));return{id:e.id,nome:e.nome,tipo:e.tipo,ordem:e.ordem,previstaPara:previsaoPendente?null:deslocarCalendario(inicio,e.diaRelativo,e.unidadeIntervalo==="HORAS"?"HORAS":"DIAS",precisao).toISOString(),precisaoTemporal:precisao,previsaoPendente};}),total,pagina,porPagina:input.porPagina,avisos:["A prévia não inscreve o animal. Elegibilidade e disponibilidade serão conferidas ao confirmar."]};
  });
}

export async function listarParticipacoesOperacao(propriedadeId:number|null,consulta:import("./operacao.schemas.js").ListaOperacao) {
  const {listaOperacaoSchema}=await import("./operacao.schemas.js");const f=listaOperacaoSchema.parse(consulta);
  return leitura(async tx=>{const where:Prisma.ParticipacaoProtocoloWhereInput={rodadaId:f.programacaoId??null,AND:[participacaoNoEscopoOperacao(propriedadeId)],...(f.tipo?{protocolo:{tipo:f.tipo}}:{}),...(f.animalId?{animalId:f.animalId}:{}),...(f.busca?{animal:{OR:[{brinco:{contains:f.busca,mode:"insensitive"}},{nome:{contains:f.busca,mode:"insensitive"}}]}}:{})};
    const total=await tx.participacaoProtocolo.count({where});const pagina=paginaOperacao(total,f.pagina,f.porPagina);const participacoes=await tx.participacaoProtocolo.findMany({where,select:{id:true},orderBy:[{inicio:"desc"},{id:"asc"}],skip:(pagina-1)*f.porPagina,take:f.porPagina});
    const itens=await Promise.all(participacoes.map(async p=>{const c=await contextoTx(tx,{participacaoId:p.id},propriedadeId);const {where,escopoLeituraId,...campos}=c;return {...campos,participantesTotal:c.modo==="INDIVIDUAL"?1:await tx.participacaoProtocolo.count({where:c.where}),tipo:c.protocolo.tipo,inicioReferencia:c.inicioReferencia.toISOString(),contagens:await contarTx(tx,c,consultaOperacaoSchema.parse({}),new Date())};}));
    return{itens,total,pagina,porPagina:f.porPagina};});
}
export async function listarProgramacoesOperacao(propriedadeId:number|null,consulta:import("./operacao.schemas.js").ListaOperacao) {
  const {listaOperacaoSchema}=await import("./operacao.schemas.js");const f=listaOperacaoSchema.parse(consulta);
  return leitura(async tx=>{const where:Prisma.ProgramacaoProtocoloWhereInput={AND:[programacaoNoEscopoOperacao(propriedadeId)],...(f.tipo?{protocolo:{tipo:f.tipo}}:{}),...(f.animalId?{execucoes:{some:{animalId:f.animalId,AND:[participacaoNoEscopoOperacao(propriedadeId)]}}}:{}),...(f.busca?{nome:{contains:f.busca,mode:"insensitive"}}:{})};
    const total=await tx.programacaoProtocolo.count({where});const pagina=paginaOperacao(total,f.pagina,f.porPagina);const programacoes=await tx.programacaoProtocolo.findMany({where,select:{id:true},orderBy:[{inicioReferencia:"desc"},{id:"asc"}],skip:(pagina-1)*f.porPagina,take:f.porPagina});
    const itens=await Promise.all(programacoes.map(async p=>{const c=await contextoTx(tx,{programacaoId:p.id},propriedadeId);const {where,escopoLeituraId,...campos}=c;return {...campos,participantesTotal:c.modo==="INDIVIDUAL"?1:await tx.participacaoProtocolo.count({where:c.where}),tipo:c.protocolo.tipo,inicioReferencia:c.inicioReferencia.toISOString(),contagens:await contarTx(tx,c,consultaOperacaoSchema.parse({}),new Date())};}));
    return{itens,total,pagina,porPagina:f.porPagina};});
}

/** Seletor operacional: somente versões publicadas e ativas, sem carregar etapas. */
export async function listarVersoesOperacao(consulta:import("./operacao.schemas.js").ConsultaVersoesOperacao) {
  const {consultaVersoesOperacaoSchema}=await import("./operacao.schemas.js");
  const f=consultaVersoesOperacaoSchema.parse(consulta);
  return leitura(async tx=>{
    const where:Prisma.ProtocoloWhereInput={tipo:f.tipo,ativo:true,publicadoEm:{not:null},...(f.busca?{nome:{contains:f.busca,mode:"insensitive"}}:{})};
    const total=await tx.protocolo.count({where});const pagina=paginaOperacao(total,f.pagina,f.porPagina);
    const itens=await tx.protocolo.findMany({where,select:protocoloSelect,orderBy:[{nome:"asc"},{versao:"desc"},{id:"asc"}],skip:(pagina-1)*f.porPagina,take:f.porPagina});
    return {itens,total,pagina,porPagina:f.porPagina};
  });
}

/** Participantes do coletivo, sem anexar o conjunto de tarefas de cada animal. */
export async function listarParticipantesOperacao(contexto:ContextoOperacao,propriedadeId:number|null,consulta:ConsultaOperacao):Promise<import("./operacao.dto.js").PaginaOperacao<import("./operacao.dto.js").ParticipanteOperacao>> {
  const f=consultaOperacaoSchema.parse(consulta);
  if(f.situacao||f.etapaId)throw new RebanhoError("VALIDACAO","Filtro de tarefa não se aplica aos participantes");
  return leitura(async tx=>{
    const c=await contextoTx(tx,contexto,propriedadeId);
    if(c.modo!=="COLETIVO")throw new RebanhoError("VALIDACAO","Selecione uma programação coletiva");
    const where:Prisma.ParticipacaoProtocoloWhereInput={...c.where,...(f.busca?{animal:{OR:[{brinco:{contains:f.busca,mode:"insensitive"}},{nome:{contains:f.busca,mode:"insensitive"}}]}}:{})};
    const total=await tx.participacaoProtocolo.count({where});const pagina=paginaOperacao(total,f.pagina,f.porPagina);
    const participacoes=await tx.participacaoProtocolo.findMany({where,select:{id:true,animalId:true,animal:{select:animalSelect},canceladaEm:true,motivoCancelamento:true,inicio:true,inicioEfetivo:true,precisaoTemporal:true,precisaoInicioEfetivo:true},orderBy:[{inicio:"asc"},{id:"asc"}],skip:(pagina-1)*f.porPagina,take:f.porPagina});
    return {itens:participacoes.map(p=>({id:p.id,animalId:p.animalId,animal:p.animal,encerradoEm:p.canceladaEm?.toISOString()??null,motivoEncerramento:p.motivoCancelamento,inicioPrevisto:p.inicio.toISOString(),inicioEfetivo:p.inicioEfetivo?.toISOString()??null,precisaoTemporal:p.precisaoTemporal,precisaoInicioEfetivo:p.precisaoInicioEfetivo})),total,pagina,porPagina:f.porPagina};
  });
}

/** Resumo dos vínculos coletivos da ficha, sem árvore de animais ou tarefas. */
export async function listarVinculosColetivosOperacao(propriedadeId:number|null,consulta:import("./operacao.schemas.js").ConsultaVinculosColetivosOperacao) {
  const {consultaVinculosColetivosOperacaoSchema}=await import("./operacao.schemas.js");
  const f=consultaVinculosColetivosOperacaoSchema.parse(consulta);
  return leitura(async tx=>{
    const where:Prisma.ParticipacaoProtocoloWhereInput={rodadaId:{not:null},animalId:f.animalId,...(f.participacaoId?{id:f.participacaoId}:{}),protocolo:{tipo:f.tipo},AND:[participacaoNoEscopoOperacao(propriedadeId)],...(f.busca?{OR:[{protocolo:{nome:{contains:f.busca,mode:"insensitive"}}},{rodada:{nome:{contains:f.busca,mode:"insensitive"}}}]}:{})};
    const total=await tx.participacaoProtocolo.count({where});const pagina=paginaOperacao(total,f.pagina,f.porPagina);
    const participacoes=await tx.participacaoProtocolo.findMany({where,select:{id:true,animalId:true,animal:{select:animalSelect},protocolo:{select:protocoloSelect},rodada:{select:{id:true,nome:true}},inicio:true,inicioEfetivo:true,precisaoTemporal:true,precisaoInicioEfetivo:true,canceladaEm:true,motivoCancelamento:true},orderBy:[{inicio:"desc"},{id:"asc"}],skip:(pagina-1)*f.porPagina,take:f.porPagina});
    const itens=participacoes.map(p=>{
      if(!p.rodada)throw new RebanhoError("CONFLITO","Vínculo coletivo sem programação; atualize a consulta");
      return {id:p.id,animalId:p.animalId,animal:p.animal,protocolo:p.protocolo,programacao:p.rodada,inicioReferencia:p.inicio.toISOString(),precisaoTemporal:p.precisaoTemporal,precisaoInicioEfetivo:p.precisaoInicioEfetivo,inicioEfetivo:p.inicioEfetivo?.toISOString()??null,encerradoEm:p.canceladaEm?.toISOString()??null,motivoEncerramento:p.motivoCancelamento,modo:"COLETIVO" as const};
    });
    return {itens,total,pagina,porPagina:f.porPagina};
  });
}

/** Vínculos atuais e históricos de um fato autorizado, sem dados clínicos ou financeiros. */
export async function listarOrigensFatoOperacao(propriedadeId:number|null,consulta:import("./operacao.schemas.js").ConsultaOrigensFatoOperacao) {
  const {consultaOrigensFatoOperacaoSchema}=await import("./operacao.schemas.js");
  const f=consultaOrigensFatoOperacaoSchema.parse(consulta);
  return leitura(async tx=>{
    const escopo={animalId:f.animalId,...(propriedadeId==null?{}:{propriedadeId})};
    const [tentativa,interpretacao,exame,aplicacao]=await Promise.all([
      tx.tentativaReprodutiva.findFirst({where:{id:f.fatoId,...escopo},select:{id:true,tarefaId:true}}),
      tx.interpretacaoReprodutiva.findFirst({where:{id:f.fatoId,exame:escopo},select:{exameId:true,exame:{select:{tarefaId:true}}}}),
      tx.exameAnimal.findFirst({where:{id:f.fatoId,...escopo},select:{id:true,tarefaId:true}}),
      tx.aplicacaoProduto.findFirst({where:{id:f.fatoId,...escopo},select:{id:true,tarefaId:true}}),
    ]);
    if(!tentativa&&!interpretacao&&!exame&&!aplicacao)throw new RebanhoError("NAO_ENCONTRADO","Fato não encontrado para este animal e sítio");
    const exameResolvidoId=interpretacao?.exameId??exame?.id;
    if(f.exameId&&f.exameId!==exameResolvidoId)throw new RebanhoError("VALIDACAO","O exame informado não corresponde ao fato consultado");
    const relacoes:Prisma.TarefaProtocoloWhereInput[]=[];
    if(tentativa)relacoes.push({vinculos:{some:{tentativaId:tentativa.id}}},...(tentativa.tarefaId?[{id:tentativa.tarefaId}]:[]));
    const tarefaExameId=interpretacao?.exame.tarefaId??exame?.tarefaId;
    if(exameResolvidoId){relacoes.push({vinculos:{some:{exameId:exameResolvidoId}}});if(tarefaExameId)relacoes.push({id:tarefaExameId});}
    if(aplicacao)relacoes.push({vinculos:{some:{aplicacaoId:aplicacao.id}}},...(aplicacao.tarefaId?[{id:aplicacao.tarefaId}]:[]));
    const where:Prisma.ParticipacaoProtocoloWhereInput={animalId:f.animalId,AND:[participacaoNoEscopoOperacao(propriedadeId),{tarefas:{some:{OR:relacoes}}}]};
    const total=await tx.participacaoProtocolo.count({where});const pagina=paginaOperacao(total,f.pagina,f.porPagina);
    const participacoes=await tx.participacaoProtocolo.findMany({where,select:{id:true,protocolo:{select:{id:true,nome:true,versao:true}},rodada:{select:{id:true,nome:true}}},orderBy:[{inicio:"desc"},{id:"asc"}],skip:(pagina-1)*f.porPagina,take:f.porPagina});
    return {itens:participacoes.map(p=>({protocolo:p.protocolo,programacao:p.rodada,participacaoId:p.id})),total,pagina,porPagina:f.porPagina};
  });
}

/** Momentos são agrupamentos explícitos da versão; legado sem associação não é inferido por data. */
export async function listarMomentosOperacao(contexto:ContextoOperacao,propriedadeId:number|null,consulta:ConsultaOperacao) {
  const f=consultaOperacaoSchema.parse(consulta);
  return leitura(async tx=>{
    const c=await contextoTx(tx,contexto,propriedadeId);
    const where={protocoloId:c.protocolo.id};
    const explicitos=await tx.momentoProtocolo.count({where});
    const semMomento=await tx.etapaProtocolo.count({where:{...where,momentoId:null}})>0;
    const total=explicitos+Number(semMomento);const pagina=paginaOperacao(total,f.pagina,f.porPagina);
    const itens:Array<{id:string;nome:string;ordem:number|null}>=await tx.momentoProtocolo.findMany({where,select:{id:true,nome:true,ordem:true},orderBy:[{ordem:"asc"},{id:"asc"}],skip:(pagina-1)*f.porPagina,take:f.porPagina});
    if(semMomento&&pagina===Math.max(1,Math.ceil(total/f.porPagina)))itens.push({id:"SEM_MOMENTO",nome:"Ações sem momento explícito",ordem:null});
    return{itens,total,pagina,porPagina:f.porPagina};
  });
}
