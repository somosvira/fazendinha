import { z } from "zod";
import { transacaoPecuaria } from "../transacao.js";
import { auditar, RebanhoError } from "../rebanho/regras.js";
import { criarProtocoloReprodutivoTx } from "../protocolos/reproducao.js";
import { operacaoIdempotenteTx } from "./operacoes.js";

/** Referência publicada, não uma prescrição. A cópia nunca escolhe produto, dose ou animal. */
const referencias=[{
 id:"ovsynch56-wisconsin-2021",nome:"Ovsynch 56 — referência Wisconsin",familia:"Ovsynch",versaoReferencia:"2021-04-15",
 fonte:{titulo:"Dairy Wisconsin — Synchronization Protocols",url:"https://dairy.extension.wisc.edu/files/2023/05/DWT-Synchronization-4-15-2021.pptx.pdf",pagina:24,data:"2021-04-15",consultadaEm:"2026-10-16"},
 objetivo:"Referência de sincronização da ovulação e inseminação em tempo fixo.",populacaoIndicada:"Vacas leiteiras conforme a ficha de referência; a indicação individual e a elegibilidade exigem avaliação técnica.",camposACompletar:["Elegibilidade e indicação individual","Produtos, doses, unidades e vias das aplicações","Material e quantidade da tentativa","Responsáveis e orientação temporal de cada etapa"],
 observacoes:["Referência para discussão com o responsável técnico.","Não define elegibilidade, produto, dose, via ou recomendação individual.","Conferir a fonte e configurar cada etapa antes de publicar ou executar."],
 etapas:[{nome:"Referência GnRH — configurar aplicação",tipo:"APLICACAO" as const,intervalo:0,unidade:"HORAS" as const},{nome:"Referência PGF — configurar aplicação",tipo:"APLICACAO" as const,intervalo:168,unidade:"HORAS" as const},{nome:"Referência GnRH após 56 horas — configurar",tipo:"APLICACAO" as const,intervalo:224,unidade:"HORAS" as const},{nome:"Referência IA após 16 horas — configurar",tipo:"TENTATIVA" as const,intervalo:240,unidade:"HORAS" as const}],
}];
export function listarBibliotecaReprodutiva(busca=""){
 const q=busca.trim().toLocaleLowerCase("pt-BR");
 return referencias.filter(r=>`${r.nome} ${r.familia} ${r.fonte.titulo}`.toLocaleLowerCase("pt-BR").includes(q));
}
export const copiarReferenciaSchema=z.object({chave:z.string().uuid(),propriedadeId:z.number().int().positive(),nome:z.string().trim().min(2).max(120),versao:z.number().int().positive()}).strict();
export function copiarReferenciaReprodutiva(id:string,input:z.infer<typeof copiarReferenciaSchema>,usuarioId:number|null){
 const referencia=referencias.find(r=>r.id===id);
 if(!referencia)throw new RebanhoError("NAO_ENCONTRADO","Referência não encontrada na biblioteca");
 return transacaoPecuaria(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-biblioteca:${input.chave}`}))`;
  return operacaoIdempotenteTx(tx,{...input,referenciaId:id},usuarioId,"COPIAR_REFERENCIA_REPRODUTIVA",async()=>{
   const p=await criarProtocoloReprodutivoTx(tx,{data:{nome:input.nome,versao:input.versao,publicado:false,etapas:referencia.etapas,criadoPorId:usuarioId,descricao:`Rascunho copiado de ${referencia.fonte.titulo}. Configuração e publicação explícitas necessárias.`}});
   await tx.protocolo.update({where:{id:p.id},data:{referenciaTecnica:JSON.parse(JSON.stringify({id:referencia.id,versaoReferencia:referencia.versaoReferencia,fonte:referencia.fonte,objetivo:referencia.objetivo,populacaoIndicada:referencia.populacaoIndicada,camposACompletar:referencia.camposACompletar,observacoes:referencia.observacoes}))}});
   await auditar(tx,{entidade:"Protocolo",entidadeId:p.id,propriedadeId:input.propriedadeId,acao:"COPIA_REFERENCIA_RASCUNHO",usuarioId,depois:{protocolo:p,referencia}});
   return p;
  });
 });
}
