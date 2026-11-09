import { Prisma, type PrincipioAtivo, type NutrienteProdutoCatalogo } from "@prisma/client";
import { prisma } from "../../db.js";
import { FinanceiroError } from "../financeiro/regras.js";
import { payloadCanonico } from "./cadastro-reenvio.js";
import type { ComposicaoInput, InformacoesNutricionaisInput } from "./composicao.schemas.js";

export const includeComposicao = { itens: { orderBy: { ordem: "asc" as const }, include: { principioAtivo: { select: { ativo: true } } } } } as const;
export const includeNutricao = { itens: { orderBy: { ordem: "asc" as const }, include: { nutriente: { select: { ativo: true } } } } } as const;
type Composicao = Prisma.ComposicaoProdutoVersaoGetPayload<{include: typeof includeComposicao}>;
type Nutricao = Prisma.PerfilNutricionalProdutoVersaoGetPayload<{include: typeof includeNutricao}>;
const vazio = { id: null, numero: null, situacao: "NAO_INFORMADA", referencia: null, motivoAlteracao: null, criadoEm: null, criadoPorId: null, itens: [] };
export function composicaoDTO(v: Composicao | null | undefined) {
  return v ? { ...v, criadoEm: v.criadoEm.toISOString(), itens: v.itens.map(({principioAtivo,...i})=>({...i, concentracaoValor:i.concentracaoValor?.toString()??null, ativo:principioAtivo.ativo})) } : vazio;
}
export function nutricaoDTO(v: Nutricao | null | undefined) {
  return v ? { ...v, criadoEm: v.criadoEm.toISOString(), materiaSecaSnapshot: v.materiaSecaSnapshot?.toString()??null, itens: v.itens.map(({nutriente,...i})=>({...i, valor:i.valor?.toString()??null, ativo:nutriente.ativo})) } : {...vazio,materiaSecaSnapshot:null};
}
const autor = (id?:number|null) => id && id>0 ? id:null;
const decimal = (v:string|null) => v === null ? null : new Prisma.Decimal(v).toString();
function conferirVersao(atual: {id:string}|null, esperada:string|null, motivo?:string) {
  if ((atual?.id??null) !== esperada) throw new FinanceiroError("CONFLITO","A versão foi alterada por outra pessoa. Carregue os dados atuais antes de reaplicar a edição.","versaoEsperada");
  if (atual && !motivo?.trim()) throw new FinanceiroError("VALIDACAO","Explique a alteração da versão em pelo menos cinco caracteres","motivoAlteracao");
}
export async function salvarComposicaoTx(tx:Prisma.TransactionClient, produtoId:string, input:ComposicaoInput, usuarioId?:number|null) {
  const produto = await tx.produto.findUniqueOrThrow({where:{id:produtoId},include:{composicaoVersaoAtual:{include:includeComposicao}}});
  const atual = produto.composicaoVersaoAtual;
  if ((atual?.id??null) !== input.versaoEsperada) throw new FinanceiroError("CONFLITO","A composição foi alterada. Carregue a versão atual.","composicao.versaoEsperada");
  const estado = {situacao:input.situacao,referencia:input.referencia?.trim()||null,itens:input.itens.map(i=>({...i,concentracaoValor:decimal(i.concentracaoValor)}))};
  const anterior = {situacao:atual?.situacao??"NAO_INFORMADA",referencia:atual?.referencia??null,itens:atual?.itens.map(i=>({principioAtivoId:i.principioAtivoId,concentracaoValor:i.concentracaoValor?.toString()??null,concentracaoUnidade:i.concentracaoUnidade}))??[]};
  if (payloadCanonico(estado)===payloadCanonico(anterior)) return;
  conferirVersao(atual,input.versaoEsperada,input.motivoAlteracao);
  const ingredientes: PrincipioAtivo[]=[];
  for (const id of [...input.itens.map(i=>i.principioAtivoId)].sort()) {
    await tx.$queryRaw`SELECT "id" FROM public."PrincipioAtivo" WHERE "id" = ${id}::uuid FOR SHARE`;
    const principio = await tx.principioAtivo.findUnique({where:{id}});
    if (!principio || (!principio.ativo && !atual?.itens.some(i=>i.principioAtivoId===id))) throw new FinanceiroError("VALIDACAO","Selecione princípios ativos ou preserve os vínculos existentes","composicao.itens");
    ingredientes.push(principio);
  }
  const nova = await tx.composicaoProdutoVersao.create({data:{produtoId,numero:(atual?.numero??0)+1,situacao:input.situacao,referencia:estado.referencia,motivoAlteracao:input.motivoAlteracao??null,criadoPorId:autor(usuarioId),itens:{create:input.itens.map((i,ordem)=>({...i,nomePrincipioSnapshot:ingredientes.find(p=>p.id===i.principioAtivoId)!.nome,ordem}))}}});
  await tx.produto.update({where:{id:produtoId},data:{composicaoVersaoAtualId:nova.id}});
}
export async function salvarNutricaoTx(tx:Prisma.TransactionClient, produtoId:string, input:InformacoesNutricionaisInput, usuarioId?:number|null) {
  const produto=await tx.produto.findUniqueOrThrow({where:{id:produtoId},include:{perfilNutricionalProduto:true,perfilNutricionalVersaoAtual:{include:includeNutricao}}});
  if (!produto.usoNutricional) throw new FinanceiroError("VALIDACAO","Selecione o uso nutricional para preencher esse perfil","usoNutricional");
  const atual=produto.perfilNutricionalVersaoAtual;
  if ((atual?.id??null)!==input.versaoEsperada) throw new FinanceiroError("CONFLITO","As informações nutricionais foram alteradas. Carregue a versão atual.","informacoesNutricionais.versaoEsperada");
  const materiaSecaSnapshot=produto.perfilNutricionalProduto?.materiaSecaPercentual??null;
  const estado={situacao:input.situacao,referencia:input.referencia?.trim()||null,materiaSecaSnapshot:materiaSecaSnapshot?.toString()??null,itens:input.itens.map(i=>({...i,valor:decimal(i.valor)}))};
  const anterior={situacao:atual?.situacao??"NAO_INFORMADA",referencia:atual?.referencia??null,materiaSecaSnapshot:atual?.materiaSecaSnapshot?.toString()??null,itens:atual?.itens.map(i=>({nutrienteId:i.nutrienteId,valor:i.valor?.toString()??null,base:i.base}))??[]};
  if(payloadCanonico(estado)===payloadCanonico(anterior))return;
  conferirVersao(atual,input.versaoEsperada,input.motivoAlteracao);
  const nutrientes: NutrienteProdutoCatalogo[]=[];
  for(const id of [...input.itens.map(i=>i.nutrienteId)].sort()) {
    await tx.$queryRaw`SELECT "id" FROM public."NutrienteProdutoCatalogo" WHERE "id"=${id}::uuid FOR SHARE`;
    const nutriente=await tx.nutrienteProdutoCatalogo.findUnique({where:{id}});
    if(!nutriente||(!nutriente.ativo&&!atual?.itens.some(i=>i.nutrienteId===id)))throw new FinanceiroError("VALIDACAO","Selecione nutrientes ativos ou preserve os vínculos existentes","informacoesNutricionais.itens");
    const item=input.itens.find(i=>i.nutrienteId===id)!;
    if(item.valor!==null&&nutriente.unidadeReferencia==="PERCENTUAL"&&new Prisma.Decimal(item.valor).gt(100))throw new FinanceiroError("VALIDACAO","O percentual não pode superar 100","informacoesNutricionais.itens");
    nutrientes.push(nutriente);
  }
  const nova=await tx.perfilNutricionalProdutoVersao.create({data:{produtoId,numero:(atual?.numero??0)+1,situacao:input.situacao,referencia:estado.referencia,motivoAlteracao:input.motivoAlteracao??null,materiaSecaSnapshot,criadoPorId:autor(usuarioId),itens:{create:input.itens.map((i,ordem)=>({...i,nomeNutrienteSnapshot:nutrientes.find(n=>n.id===i.nutrienteId)!.nome,unidadeSnapshot:nutrientes.find(n=>n.id===i.nutrienteId)!.unidadeReferencia,ordem}))}}});
  await tx.produto.update({where:{id:produtoId},data:{perfilNutricionalVersaoAtualId:nova.id}});
}
async function comAutores<T extends {criadoPorId:number|null}>(itens:T[]) {
  const ids=[...new Set(itens.flatMap(i=>i.criadoPorId ? [i.criadoPorId] : []))];
  const autores=ids.length ? await prisma.usuario.findMany({where:{id:{in:ids}},select:{id:true,nome:true}}) : [];
  return itens.map(i=>({...i,criadoPor:autores.find(a=>a.id===i.criadoPorId)??null}));
}
export async function historicoComposicoes(produtoId:string,pagina:number,porPagina:number) {
  if(!await prisma.produto.findUnique({where:{id:produtoId},select:{id:true}}))throw new FinanceiroError("NAO_ENCONTRADO","Produto não encontrado");
  const [total,itens]=await prisma.$transaction([prisma.composicaoProdutoVersao.count({where:{produtoId}}),prisma.composicaoProdutoVersao.findMany({where:{produtoId},include:includeComposicao,orderBy:{numero:"desc"},skip:(pagina-1)*porPagina,take:porPagina})]);
  return {itens:await comAutores(itens.map(composicaoDTO)),total,pagina,porPagina};
}
export async function historicoNutricional(produtoId:string,pagina:number,porPagina:number) {
  if(!await prisma.produto.findUnique({where:{id:produtoId},select:{id:true}}))throw new FinanceiroError("NAO_ENCONTRADO","Produto não encontrado");
  const [total,itens]=await prisma.$transaction([prisma.perfilNutricionalProdutoVersao.count({where:{produtoId}}),prisma.perfilNutricionalProdutoVersao.findMany({where:{produtoId},include:includeNutricao,orderBy:{numero:"desc"},skip:(pagina-1)*porPagina,take:porPagina})]);
  return {itens:await comAutores(itens.map(nutricaoDTO)),total,pagina,porPagina};
}
export async function capturarComposicaoTx(tx:Prisma.TransactionClient,produtoId:string):Promise<Prisma.InputJsonObject> {
  const produto=await tx.produto.findUnique({where:{id:produtoId},include:{composicaoVersaoAtual:{include:includeComposicao}}});
  if (!produto) throw new FinanceiroError("NAO_ENCONTRADO","Produto não encontrado");
  const v=composicaoDTO(produto.composicaoVersaoAtual);
  return JSON.parse(JSON.stringify({schemaVersion:1,versaoComposicaoId:v.id,situacao:v.situacao,referencia:v.referencia,itens:v.itens.map(({principioAtivoId,nomePrincipioSnapshot,concentracaoValor,concentracaoUnidade})=>({principioAtivoId,nomePrincipioSnapshot,concentracaoValor,concentracaoUnidade})),capturadoEm:new Date().toISOString(),contexto:"CADASTRO_NA_GRAVACAO"}));
}
