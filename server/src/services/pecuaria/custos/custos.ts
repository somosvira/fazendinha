import { Prisma, type ClassificacaoCustoPecuaria } from "@prisma/client";
import { prisma } from "../../../db.js";
import { exigirPeriodoAberto } from "../../financeiro/regras.js";
import { auditar, RebanhoError, travarAnimais } from "../rebanho/regras.js";
import { transacaoPecuaria } from "../transacao.js";
import { calcularAtribuicao } from "../nutricao/atribuicao.calc.js";
import { operacaoIdempotenteTx } from "../reproducao/operacoes.js";
import { componentesDaFonte, aplicarParcelaPreparo, conferirParcelasPreparo, consolidarCustos, type ClassificacaoCusto, type FonteCusto, type TipoFonteCusto } from "./custos.calc.js";
import { classificacaoCustoSchema, consultaCustosSchema, vinculoPreparoSchema, type ClassificacaoCustoInput, type ConsultaCustos, type VinculoPreparoInput } from "./custos.schemas.js";

type Db = Prisma.TransactionClient;
const dia = (v: Date) => v.toISOString().slice(0,10);
const campoFonte = (tipo: TipoFonteCusto) => ({ TENTATIVA: "tentativaId", APLICACAO: "aplicacaoId", EXAME: "exameId", PARTICIPACAO: "participacaoId", NUTRICAO: "participacaoConsumoId" } as const)[tipo];
const classificacao = (c: ClassificacaoCustoPecuaria | null): ClassificacaoCusto | null => c ? { finalidade: c.finalidade as ClassificacaoCusto["finalidade"], materialNaoAplicavel: c.materialNaoAplicavel, servicoNaoAplicavel: c.servicoNaoAplicavel, coberturaServico: c.coberturaServico as ClassificacaoCusto["coberturaServico"], valorMaterialDocumentado: c.valorMaterialDocumentado } : null;
const tarefa = { select: { execucaoId: true } } as const;
const relacoes = { classificacaoCusto: true, tarefa, vinculosProtocolo: { where: { estado: "ATUAL" }, select: { tarefa: { select: { execucaoId: true } } } } } as const;
const chaveFonte = (f: Pick<FonteCusto,"tipo"|"id">) => `${f.tipo}:${f.id}`;
function traduzirCalculo<T>(executar: () => T): T { try { return executar(); } catch(e) { throw new RebanhoError("CONFLITO", e instanceof Error ? e.message : "Composição incompatível"); } }

/** Só fatos do sítio consultado; localização atual nunca concede leitura de custo de outro sítio. */
export async function carregarFontesCustoTx(tx: Db, propriedadeId: number, filtro: { animalId?: string; participacaoId?: string; programacaoId?: string; ids?: Partial<Record<TipoFonteCusto,string[]>> } = {}): Promise<FonteCusto[]> {
  const participacoes = filtro.participacaoId ? [filtro.participacaoId] : filtro.programacaoId ? (await tx.participacaoProtocolo.findMany({ where: { propriedadeId, rodadaId: filtro.programacaoId }, select: { id: true } })).map(p=>p.id) : null;
  const base = { propriedadeId, ...(filtro.animalId ? { animalId: filtro.animalId } : {}) };
  const vinculo = participacoes ? { OR: [{ tarefa: { execucaoId: { in: participacoes } } }, { vinculosProtocolo: { some: { estado: "ATUAL", tarefa: { execucaoId: { in: participacoes } } } } }] } : {};
  const porId = (tipo: TipoFonteCusto) => filtro.ids ? { id: { in: filtro.ids[tipo] ?? [] } } : {};
  const [tentativas, aplicacoes, exames, protocolos] = await Promise.all([
    tx.tentativaReprodutiva.findMany({ where: { ...base, AND: [{ OR: [{ status: "VALIDO" }, { consumoMantido: true }] }, vinculo], ...porId("TENTATIVA") }, include: relacoes }),
    tx.aplicacaoProduto.findMany({ where: { ...base, AND: [{ OR: [{ status: "VALIDO" }, { consumoMantido: true }] }, vinculo], ...porId("APLICACAO") }, include: relacoes }),
    tx.exameAnimal.findMany({ where: { ...base, status: "VALIDO", realizacao: { not: "NAO_REALIZADO" }, ...vinculo, ...porId("EXAME") }, include: relacoes }),
    tx.participacaoProtocolo.findMany({ where: { ...base, ...(participacoes ? { id: { in: participacoes } } : {}), ...porId("PARTICIPACAO"), ...(filtro.ids?.PARTICIPACAO?.length ? {} : { OR: [{ operacaoServicoId: { not: null } }, { classificacaoCusto: { isNot: null } }] }) }, include: { classificacaoCusto: true, protocolo: { select: { nome: true } } } }),
  ]);
  const participacao = (f: { tarefa: { execucaoId: string } | null; vinculosProtocolo: Array<{ tarefa: { execucaoId: string } }> }) => f.tarefa?.execucaoId ?? f.vinculosProtocolo[0]?.tarefa.execucaoId ?? null;
  const nutricao:FonteCusto[]=[];
  if (!participacoes && (filtro.animalId || filtro.ids?.NUTRICAO?.length)) {
    const fechamentos=await tx.fechamentoConsumo.findMany({where:{propriedadeId,status:"CONFIRMADO",participacoes:{some:{...(filtro.animalId?{animalId:filtro.animalId}:{}),...(filtro.ids?.NUTRICAO?{id:{in:filtro.ids.NUTRICAO}}:{})}}},include:{participacoes:{include:{classificacaoCusto:true}},itens:{include:{produto:{select:{nome:true}},movimentoEstoque:{select:{valorTotal:true}}}}}});
    for(const f of fechamentos){const distribuicao=calcularAtribuicao(f.participacoes,f.animalDias,f.itens.map(i=>({produtoId:i.produtoId,unidade:i.unidade,quantidadeConfirmada:i.quantidadeConfirmada,custoConhecido:i.quantidadeConfirmada.isZero()?"0":i.situacaoCusto==="CONHECIDO"?i.movimentoEstoque?.valorTotal??null:null})));
      for(const p of f.participacoes.filter(p=>(!filtro.animalId||p.animalId===filtro.animalId)&&(!filtro.ids?.NUTRICAO||filtro.ids.NUTRICAO.includes(p.id)))){
        const atribuicao=distribuicao.participacoes.find(v=>v.animalId===p.animalId)!;
        for(const i of f.itens){const parcela=atribuicao.itens.find(v=>v.produtoId===i.produtoId)!;
          nutricao.push({id:p.id,tipo:"NUTRICAO",animalId:p.animalId,propriedadeId,data:dia(f.fim),descricao:`Nutrição · ${i.produto.nome} · ${dia(f.inicio)} a ${dia(f.fim)}`,estadoFato:f.status,participacaoId:null,origemMaterial:"NUTRICAO",movimentoEstoqueId:i.movimentoEstoqueId,operacaoServicoId:null,valorMaterial:parcela.custoConhecido,valorServico:null,classificacao:classificacao(p.classificacaoCusto),versaoClassificacao:p.classificacaoCusto?.versao??0,componenteId:i.id,periodoConsumo:{inicio:dia(f.inicio),fim:dia(f.fim)}});
        }
      }
    }
  }
  return [
    ...nutricao,
    ...tentativas.map(f => ({ id:f.id,tipo:"TENTATIVA" as const,animalId:f.animalId,propriedadeId,data:dia(f.data),descricao:`Tentativa ${f.tipo} · ciclo ${f.ciclo} · ${f.ordem}`,estadoFato:f.status+(f.consumoMantido ? " · consumo mantido" : ""),participacaoId:participacao(f),origemMaterial:f.origemMaterial,movimentoEstoqueId:f.movimentoEstoqueId,operacaoServicoId:f.operacaoServicoId,valorMaterial:f.valorProdutoAtribuido,valorServico:f.valorServicoAtribuido,documentoMaterial:f.classificacaoCusto?.documentoMaterial??null,versaoClassificacao:f.classificacaoCusto?.versao??0,classificacao:classificacao(f.classificacaoCusto) })),
    ...aplicacoes.map(f => ({ id:f.id,tipo:"APLICACAO" as const,animalId:f.animalId,propriedadeId,data:dia(f.data),descricao:f.nomeProdutoAplicado,estadoFato:f.status+(f.consumoMantido ? " · consumo mantido" : ""),participacaoId:participacao(f),origemMaterial:f.origemInsumo==="SEM_ORIGEM_JUSTIFICADA"?"DOCUMENTADA":f.origemInsumo,movimentoEstoqueId:f.movimentoEstoqueId,operacaoServicoId:f.operacaoServicoId,valorMaterial:f.valorProdutoAtribuido,valorServico:f.valorServicoAtribuido,documentoMaterial:f.classificacaoCusto?.documentoMaterial??null,versaoClassificacao:f.classificacaoCusto?.versao??0,classificacao:classificacao(f.classificacaoCusto) })),
    ...exames.map(f => ({ id:f.id,tipo:"EXAME" as const,animalId:f.animalId,propriedadeId,data:dia(f.data),descricao:"Exame realizado",estadoFato:f.status,participacaoId:participacao(f),origemMaterial:"NAO_APLICAVEL",movimentoEstoqueId:null,operacaoServicoId:f.operacaoServicoId,valorMaterial:null,valorServico:f.valorServicoAtribuido,documentoMaterial:f.classificacaoCusto?.documentoMaterial??null,versaoClassificacao:f.classificacaoCusto?.versao??0,classificacao:classificacao(f.classificacaoCusto) })),
    ...protocolos.map(f => ({ id:f.id,tipo:"PARTICIPACAO" as const,animalId:f.animalId,propriedadeId,data:dia(f.inicio),descricao:`Participação · ${f.protocolo.nome}`,estadoFato:f.canceladaEm ? "INTERROMPIDA · custos preservados" : "ATIVA",participacaoId:f.id,origemMaterial:"NAO_APLICAVEL",movimentoEstoqueId:null,operacaoServicoId:f.operacaoServicoId,valorMaterial:null,valorServico:f.valorServicoAtribuido,documentoMaterial:f.classificacaoCusto?.documentoMaterial??null,versaoClassificacao:f.classificacaoCusto?.versao??0,classificacao:classificacao(f.classificacaoCusto) })),
  ];
}
async function fonteTx(tx: Db, tipo: TipoFonteCusto, id: string, propriedadeId: number) {
  const f = (await carregarFontesCustoTx(tx,propriedadeId,{ids:{[tipo]:[id]}})).find(f=>f.tipo===tipo && f.id===id);
  if (!f) throw new RebanhoError("NAO_ENCONTRADO","Fato com custo não encontrado neste sítio");
  return f;
}
async function verificarAlvoTx(tx: Db, propriedadeId: number, filtro: ConsultaCustos) {
  if (filtro.animalId) {
    // Custos históricos continuam no sítio do fato após a transferência.
    if (!await tx.animal.findFirst({where:{id:filtro.animalId,localizacoes:{some:{propriedadeId}}},select:{id:true}})) throw new RebanhoError("NAO_ENCONTRADO","Animal não encontrado neste sítio");
  } else if (filtro.tentativaId) {
    if (!await tx.tentativaReprodutiva.findFirst({where:{id:filtro.tentativaId,propriedadeId},select:{id:true}})) throw new RebanhoError("NAO_ENCONTRADO","Tentativa não encontrada neste sítio");
  } else if (filtro.aplicacaoId || filtro.exameId) {
    await fonteTx(tx,filtro.aplicacaoId?"APLICACAO":"EXAME",(filtro.aplicacaoId??filtro.exameId)!,propriedadeId);
  } else if (filtro.participacaoId) {
    if (!await tx.participacaoProtocolo.findFirst({where:{id:filtro.participacaoId,propriedadeId},select:{id:true}})) throw new RebanhoError("NAO_ENCONTRADO","Participação não encontrada neste sítio");
  } else if (!await tx.programacaoProtocolo.findFirst({where:{id:filtro.programacaoId,propriedadeId},select:{id:true}})) throw new RebanhoError("NAO_ENCONTRADO","Programação não encontrada neste sítio");
}
export async function consultarCustosTx(tx: Db, propriedadeId: number, filtro: ConsultaCustos, verValores: boolean, verDocumentos = verValores) {
  await verificarAlvoTx(tx,propriedadeId,filtro);
  let fontes: FonteCusto[], componentes;
  let vinculos = await tx.vinculoPreparoTentativa.findMany({where:{encerradoEm:null,tentativa:{propriedadeId},...(filtro.tentativaId ? {tentativaId:filtro.tentativaId} : {})},orderBy:[{criadoEm:"asc"},{id:"asc"}]});
  if (filtro.tentativaId) {
    const propria=await fonteTx(tx,"TENTATIVA",filtro.tentativaId,propriedadeId);
    const ids: Partial<Record<TipoFonteCusto,string[]>> = { APLICACAO:vinculos.flatMap(v=>v.aplicacaoId?[v.aplicacaoId]:[]),EXAME:vinculos.flatMap(v=>v.exameId?[v.exameId]:[]),PARTICIPACAO:vinculos.flatMap(v=>v.participacaoId?[v.participacaoId]:[]) };
    fontes=[propria,...await carregarFontesCustoTx(tx,propriedadeId,{ids})];
    componentes=componentesDaFonte(propria);
    for(const v of vinculos){const origem=fontes.find(f=>f.id===(v.aplicacaoId??v.exameId??v.participacaoId)&&campoFonte(f.tipo)===(v.aplicacaoId?"aplicacaoId":v.exameId?"exameId":"participacaoId"));if(origem)componentes.push(...traduzirCalculo(()=>aplicarParcelaPreparo(componentesDaFonte(origem),{...v,modo:v.modo as "INTEGRAL"|"PARCELA"})));}
  } else {
    fontes=await carregarFontesCustoTx(tx,propriedadeId,{...filtro,...filtro.aplicacaoId?{ids:{APLICACAO:[filtro.aplicacaoId]}}:filtro.exameId?{ids:{EXAME:[filtro.exameId]}}:{}});
    componentes=fontes.flatMap(componentesDaFonte);
    if(filtro.participacaoId||filtro.programacaoId){
      const participacoes=filtro.participacaoId?[filtro.participacaoId]:(await tx.participacaoProtocolo.findMany({where:{propriedadeId,rodadaId:filtro.programacaoId},select:{id:true}})).map(p=>p.id);
      // A associação de um preparatório realizado sobrevive à anulação da tentativa.
      const alvos=await tx.tentativaReprodutiva.findMany({where:{propriedadeId,OR:[{tarefa:{execucaoId:{in:participacoes}}},{vinculosProtocolo:{some:{estado:"ATUAL",tarefa:{execucaoId:{in:participacoes}}}}}]},select:{id:true}});
      const idsAlvo=new Set(alvos.map(t=>t.id));const relevantes=vinculos.filter(v=>idsAlvo.has(v.tentativaId));
      const externas=await carregarFontesCustoTx(tx,propriedadeId,{ids:{APLICACAO:relevantes.flatMap(v=>v.aplicacaoId?[v.aplicacaoId]:[]),EXAME:relevantes.flatMap(v=>v.exameId?[v.exameId]:[]),PARTICIPACAO:relevantes.flatMap(v=>v.participacaoId?[v.participacaoId]:[])}});
      const proprias=new Set(fontes.map(chaveFonte));const chavesProprias=new Set(componentes.map(c=>c.chave));
      for(const f of externas){
        if(proprias.has(chaveFonte(f)))continue;
        const parcelas=relevantes.filter(v=>v[campoFonte(f.tipo) as "aplicacaoId"|"exameId"|"participacaoId"]===f.id);
        const integral=parcelas.some(v=>v.modo==="INTEGRAL");
        const somar=(campo:"valorMaterial"|"valorServico")=>parcelas.some(v=>v[campo]!=null)?parcelas.reduce((s,v)=>s.plus(v[campo]??0),new Prisma.Decimal(0)):null;
        const partes=traduzirCalculo(()=>aplicarParcelaPreparo(componentesDaFonte(f),{modo:integral?"INTEGRAL":"PARCELA",valorMaterial:somar("valorMaterial"),valorServico:somar("valorServico")}));
        componentes.push(...partes.filter(c=>!chavesProprias.has(c.chave)));fontes.push(f);
      }
    }
  }
  const totalIntegral=consolidarCustos(componentes,verValores);
  const recorte=componentes.filter(c=>(!filtro.inicio||c.data>=filtro.inicio)&&(!filtro.fim||c.data<=filtro.fim)&&(!filtro.finalidade||(filtro.finalidade==="SEM_CLASSIFICACAO" ? c.finalidade==null : c.finalidade===filtro.finalidade)));
  const consolidado=consolidarCustos(recorte,verValores);
  const fontesConsultadas=new Set(fontes.map(chaveFonte));
  vinculos=vinculos.filter(v=>fontesConsultadas.has(`APLICACAO:${v.aplicacaoId}`)||fontesConsultadas.has(`EXAME:${v.exameId}`)||fontesConsultadas.has(`PARTICIPACAO:${v.participacaoId}`));
  // As pendências acompanham o recorte completo, antes da paginação. Na tentativa,
  // a lista também permite desfazer vínculos existentes: conserve o escopo integral.
  const fontesNoRecorte = new Set(recorte.map(c => `${c.tipoFonte}:${c.fonteId}`));
  const atribuicoes=fontes.filter(f=>["APLICACAO","EXAME","PARTICIPACAO"].includes(f.tipo) && (filtro.tentativaId || fontesNoRecorte.has(chaveFonte(f)))).map(f=>{
    const vs=vinculos.filter(v=>f.id===(v.aplicacaoId??v.exameId??v.participacaoId)&&campoFonte(f.tipo)===(v.aplicacaoId?"aplicacaoId":v.exameId?"exameId":"participacaoId"));
    const originais=componentesDaFonte(f);const integral=vs.some(v=>v.modo==="INTEGRAL");
    const parcelas=["MATERIAL","SERVICO"].map(natureza=>{const original=originais.find(c=>c.natureza===natureza&&c.valor!=null)?.valor??null;const atribuido=integral?original:vs.reduce((s,v)=>s.plus(natureza==="MATERIAL"?v.valorMaterial??0:v.valorServico??0),new Prisma.Decimal(0));return{natureza,valorOrigem:verValores?original?.toFixed(2)??null:null,valorAtribuido:verValores?atribuido?.toFixed(2)??null:null,restante:verValores&&original!=null?original.minus(atribuido??0).toFixed(2):null};});
    const aAtribuir=!integral&&(originais.some(c=>c.estado==="DESCONHECIDO")||originais.some(c=>c.valor!=null&&c.valor.gt(vs.reduce((s,v)=>s.plus(c.natureza==="MATERIAL"?v.valorMaterial??0:v.valorServico??0),new Prisma.Decimal(0)))));
    return { fonteId:f.id,tipo:f.tipo,descricao:f.descricao,vinculos:vs.map(v=>({id:v.id,tentativaId:v.tentativaId,modo:v.modo})),aAtribuir,parcelas };

  });
  return {...consolidado,escopo:filtro.tentativaId?"TENTATIVA":filtro.participacaoId?"PARTICIPACAO":filtro.programacaoId?"PROGRAMACAO":filtro.aplicacaoId?"APLICACAO":filtro.exameId?"EXAME":"ANIMAL_PERIODO",propriedadeId,
    periodo:{inicio:filtro.inicio??null,fim:filtro.fim??null,referencia:"DATA_DO_FATO"},totalIntegral:filtro.animalId?null:{rotulo:"Protocolo ou tentativa inteira, sem recorte",cobertura:totalIntegral.cobertura,situacao:totalIntegral.situacao,totalConhecido:totalIntegral.totalConhecido,componentesPendentes:totalIntegral.componentesPendentes},
    componentes:consolidado.componentes.slice((filtro.pagina-1)*filtro.limite,filtro.pagina*filtro.limite),totalComponentes:consolidado.componentes.length,pagina:filtro.pagina,limite:filtro.limite,
    fontes:[...new Map(fontes.map(f=>[chaveFonte(f),f])).values()].map(f=>({id:f.id,tipo:f.tipo,descricao:f.descricao,data:f.data,periodoConsumo:f.periodoConsumo,origemMaterial:f.origemMaterial,documentoMaterial:verDocumentos?f.documentoMaterial??null:null,versaoClassificacao:f.versaoClassificacao??0,classificacao:f.classificacao?{...f.classificacao,valorMaterialDocumentado:verValores?f.classificacao.valorMaterialDocumentado?.toString()??null:null}:null})),atribuicoesPreparos:atribuicoes};
}
export async function consultarCustos(propriedadeId:number,filtro:ConsultaCustos,verValores:boolean,verDocumentos=verValores){return prisma.$transaction(tx=>consultarCustosTx(tx,propriedadeId,consultaCustosSchema.parse(filtro),verValores,verDocumentos),{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});}
async function travarFonteTx(tx:Db,f:FonteCusto){await travarAnimais(tx,[f.animalId]);await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-custo:${chaveFonte(f)}`}))`;}
async function vinculosFonteTx(tx:Db,f:FonteCusto){return tx.vinculoPreparoTentativa.findMany({where:{[campoFonte(f.tipo)]:f.id,encerradoEm:null}});}
function conferirClassificacao(f:FonteCusto,c:ClassificacaoCusto){
  if(c.valorMaterialDocumentado!=null&&(f.origemMaterial!=="DOCUMENTADA"||f.movimentoEstoqueId||f.valorMaterial!=null))throw new RebanhoError("VALIDACAO","Valor documentado só pode completar material de origem DOCUMENTADA sem valor já congelado");
  if(c.materialNaoAplicavel&&(f.movimentoEstoqueId||f.valorMaterial!=null||c.valorMaterialDocumentado!=null))throw new RebanhoError("VALIDACAO","Material utilizado não pode ser marcado como não aplicável");
  if(c.servicoNaoAplicavel&&(f.operacaoServicoId||f.valorServico!=null))throw new RebanhoError("VALIDACAO","Serviço vinculado não pode ser marcado como não aplicável");
  if(c.coberturaServico!=="PROCEDIMENTO"&&!f.operacaoServicoId)throw new RebanhoError("VALIDACAO","Cobertura de pacote exige Serviço identificado");
  traduzirCalculo(()=>componentesDaFonte({...f,classificacao:c}));
}
export async function classificarCusto(input:ClassificacaoCustoInput,usuarioId:number|null){input=classificacaoCustoSchema.parse(input);return transacaoPecuaria(async tx=>operacaoIdempotenteTx(tx,input,usuarioId,"CLASSIFICAR_CUSTO",async()=>{
  let f=await fonteTx(tx,input.tipo,input.fonteId,input.propriedadeId);await travarFonteTx(tx,f);f=await fonteTx(tx,input.tipo,input.fonteId,input.propriedadeId);
  await exigirPeriodoAberto(tx,input.propriedadeId,new Date(f.data));
  const campo=campoFonte(input.tipo);const antes=await tx.classificacaoCustoPecuaria.findFirst({where:{[campo]:f.id}});
  if((antes?.versao??0)!==input.versao)throw new RebanhoError("CONFLITO","A classificação mudou; recarregue antes de confirmar");
  const nova:ClassificacaoCusto={finalidade:input.finalidade,materialNaoAplicavel:input.materialNaoAplicavel,servicoNaoAplicavel:input.servicoNaoAplicavel,coberturaServico:input.coberturaServico,valorMaterialDocumentado:input.materialDocumentado?.valor??null};
  conferirClassificacao(f,nova);
  if(f.tipo==="NUTRICAO"&&(input.materialNaoAplicavel||input.servicoNaoAplicavel||input.coberturaServico!=="PROCEDIMENTO"||input.materialDocumentado))throw new RebanhoError("VALIDACAO","A classificação nutricional altera apenas a finalidade; o custo vem do fechamento");
  const vinculados=f.tipo==="NUTRICAO"?[]:await vinculosFonteTx(tx,f);traduzirCalculo(()=>conferirParcelasPreparo(componentesDaFonte({...f,classificacao:nova}),vinculados.map(v=>({...v,modo:v.modo as "INTEGRAL"|"PARCELA"}))));
  const data={...nova,valorMaterialDocumentado:input.materialDocumentado?new Prisma.Decimal(input.materialDocumentado.valor):null,documentoMaterial:input.materialDocumentado?{referencia:input.materialDocumentado.referencia,evidencia:input.materialDocumentado.evidencia}:Prisma.DbNull,versao:input.versao+1,atualizadoPorId:usuarioId};
  const depois=antes?await tx.classificacaoCustoPecuaria.update({where:{id:antes.id},data}):await tx.classificacaoCustoPecuaria.create({data:{...data,[campo]:f.id}});
  await auditar(tx,{entidade:"ClassificacaoCustoPecuaria",entidadeId:depois.id,animalId:f.animalId,propriedadeId:input.propriedadeId,usuarioId,acao:"CLASSIFICADA",antes,depois:{...depois,motivo:input.motivo}});
  return{id:depois.id,versao:depois.versao};
}));}
export async function vincularPreparo(input:VinculoPreparoInput,usuarioId:number|null){input=vinculoPreparoSchema.parse(input);return transacaoPecuaria(async tx=>operacaoIdempotenteTx(tx,input,usuarioId,"VINCULAR_PREPARO",async()=>{
  let tentativa=await fonteTx(tx,"TENTATIVA",input.tentativaId,input.propriedadeId);let fonte=await fonteTx(tx,input.tipo,input.fonteId,input.propriedadeId);
  if(fonte.animalId!==tentativa.animalId||fonte.data>tentativa.data)throw new RebanhoError("VALIDACAO","Preparatório deve pertencer ao mesmo animal e anteceder a tentativa");
  await travarFonteTx(tx,fonte);fonte=await fonteTx(tx,input.tipo,input.fonteId,input.propriedadeId);tentativa=await fonteTx(tx,"TENTATIVA",input.tentativaId,input.propriedadeId);if(fonte.animalId!==tentativa.animalId||fonte.data>tentativa.data)throw new RebanhoError("CONFLITO","O contexto da tentativa mudou; recarregue e confira o vínculo");await exigirPeriodoAberto(tx,input.propriedadeId,new Date(tentativa.data));
  const existentes=await vinculosFonteTx(tx,fonte);
  if(existentes.some(v=>v.tentativaId===tentativa.id))throw new RebanhoError("CONFLITO","Este preparatório já está vinculado à tentativa");
  traduzirCalculo(()=>conferirParcelasPreparo(componentesDaFonte(fonte),[...existentes.map(v=>({...v,modo:v.modo as "INTEGRAL"|"PARCELA"})),{modo:input.modo,valorMaterial:input.valorMaterial??null,valorServico:input.valorServico??null}]));
  const novo=await tx.vinculoPreparoTentativa.create({data:{tentativaId:tentativa.id,[campoFonte(input.tipo)]:fonte.id,modo:input.modo,valorMaterial:input.valorMaterial==null?null:new Prisma.Decimal(input.valorMaterial),valorServico:input.valorServico==null?null:new Prisma.Decimal(input.valorServico),motivo:input.motivo,criadoPorId:usuarioId}});
  await auditar(tx,{entidade:"VinculoPreparoTentativa",entidadeId:novo.id,animalId:fonte.animalId,propriedadeId:input.propriedadeId,usuarioId,acao:"VINCULADO",depois:novo});return{id:novo.id};
}));}
export async function encerrarVinculoPreparo(id:string,input:{chave:string;propriedadeId:number;motivo:string},usuarioId:number|null){return transacaoPecuaria(async tx=>operacaoIdempotenteTx(tx,{...input,id},usuarioId,"ENCERRAR_PREPARO",async()=>{
  const v=await tx.vinculoPreparoTentativa.findFirst({where:{id,tentativa:{propriedadeId:input.propriedadeId}},include:{tentativa:true}});if(!v)throw new RebanhoError("NAO_ENCONTRADO","Vínculo não encontrado neste sítio");await travarAnimais(tx,[v.tentativa.animalId]);await exigirPeriodoAberto(tx,input.propriedadeId,v.tentativa.data);
  if(v.encerradoEm)throw new RebanhoError("CONFLITO","Vínculo já encerrado");const depois=await tx.vinculoPreparoTentativa.update({where:{id},data:{encerradoEm:new Date(),motivoEncerramento:input.motivo}});await auditar(tx,{entidade:"VinculoPreparoTentativa",entidadeId:id,animalId:v.tentativa.animalId,propriedadeId:input.propriedadeId,usuarioId,acao:"ENCERRADO",antes:v,depois});return{id};
}));}
export async function candidatosPreparo(tentativaId:string,propriedadeId:number,verValores:boolean){return prisma.$transaction(async tx=>{
 const t=await fonteTx(tx,"TENTATIVA",tentativaId,propriedadeId);const fontes=(await carregarFontesCustoTx(tx,propriedadeId,{animalId:t.animalId})).filter(f=>["APLICACAO","EXAME","PARTICIPACAO"].includes(f.tipo)&&f.data<=t.data);
 return{itens:fontes.map(f=>({id:f.id,tipo:f.tipo,descricao:f.descricao,data:f.data,participacaoId:f.participacaoId,...consolidarCustos(componentesDaFonte(f),verValores)}))};
});}

/** Chamado antes de reatribuir Serviço: preserva cobertura declarada e preparos já divididos. */
export async function conferirAtribuicaoServicoCustoTx(tx:Db,itens:Array<{id:string;tipo:"APLICACAO"|"EXAME"|"PROTOCOLO"|"TENTATIVA";operacaoServicoId:string|null;valor:string|null}>){
 const ids=(tipo:string)=>itens.filter(i=>i.tipo===tipo).map(i=>i.id);
 const filtros=[{aplicacaoId:{in:ids("APLICACAO")}},{exameId:{in:ids("EXAME")}},{participacaoId:{in:ids("PROTOCOLO")}},{tentativaId:{in:ids("TENTATIVA")}}];
 const [classes,vinculos]=await Promise.all([tx.classificacaoCustoPecuaria.findMany({where:{OR:filtros}}),tx.vinculoPreparoTentativa.findMany({where:{encerradoEm:null,OR:filtros.slice(0,3)}})]);
 for(const item of itens){const campo=item.tipo==="APLICACAO"?"aplicacaoId":item.tipo==="EXAME"?"exameId":item.tipo==="PROTOCOLO"?"participacaoId":"tentativaId";const c=classes.find(c=>c[campo]===item.id);
  if(c&&((c.servicoNaoAplicavel&&item.operacaoServicoId!=null)||(c.coberturaServico!=="PROCEDIMENTO"&&item.operacaoServicoId==null)))throw new RebanhoError("CONFLITO","Revise a classificação de custo antes de alterar o Serviço deste fato");
  if(campo!=="tentativaId"){const parcelas=vinculos.filter(v=>v[campo]===item.id&&v.valorServico!=null);const soma=parcelas.reduce((s,v)=>s.plus(v.valorServico??0),new Prisma.Decimal(0));if(parcelas.length&&(item.valor==null||soma.gt(item.valor)))throw new RebanhoError("CONFLITO","A atribuição do Serviço ficaria abaixo dos preparatórios já divididos");}
 }
}
