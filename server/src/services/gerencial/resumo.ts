import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { temArea, temPermissao } from "../auth/papeis.js";
import type { UsuarioContexto } from "../auth/sessao.js";
import { propriedadePrincipalId } from "../propriedade.js";
import { carregarFontesCustoTx } from "../pecuaria/custos/custos.js";
import { componentesDaFonte, consolidarCustos, type FonteCusto } from "../pecuaria/custos/custos.calc.js";
import { consultarCaixaTx } from "./caixa.js";
import { consultarCompromissosTx } from "./compromissos.js";
import { consultarEstoqueTx } from "./estoque.js";
import { consultarNutricaoTx } from "./nutricao.js";
import { textoDia } from "./presenca.calc.js";

export function permissoesGerencial(u:UsuarioContexto){
  const financeiro=temArea(u,"financeiro");const pecuaria=temArea(u,"pecuaria");const valores=financeiro&&temPermissao(u,"verValores");
  // Não existe marcação semântica de sigilo salarial nas categorias atuais.
  // Sem essa permissão, um total de caixa permite inferir valores protegidos.
  const caixa=valores&&(u.dono||u.abas.includes("dashboard"))&&temPermissao(u,"verSalarios")&&temPermissao(u,"verInvestimento");
  return {acesso:pecuaria||(financeiro&&(u.dono||u.abas.includes("dashboard"))),caixa,estoque:valores,nutricao:pecuaria&&valores,custos:pecuaria&&valores,clinico:pecuaria};
}
/** Uma fonte sem recorte não pode desaparecer da cobertura do agregado. */
export function sinalizarLacunasNutricao<T extends { cobertura: string; situacao: string; totalConhecido: string | null }>(resumo:T,lacunasNutricao:number){
  const cobertura=lacunasNutricao>0?(resumo.totalConhecido==null?"DESCONHECIDO":"PARCIAL"):resumo.cobertura;
  return {...resumo,lacunasNutricao,cobertura,situacao:resumo.situacao==="OCULTO"?"OCULTO":cobertura};
}
const bloqueado=(motivo:string)=>({estado:"RESTRITO" as const,motivo});
const disponivel=<T>(dados:T)=>({estado:"DISPONIVEL" as const,dados});
export async function obterResumoGerencial(u:UsuarioContexto,propriedadeId:number|null,inicio:Date,fim:Date,agora=new Date()){
  const p=permissoesGerencial(u);
  if(!p.acesso)throw new Error("SEM_ACESSO_GERENCIAL");
  const hojeTexto=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(agora);
  const hoje=new Date(`${hojeTexto}T00:00:00Z`);
  const principalId=await propriedadePrincipalId();
  return prisma.$transaction(async tx=>{
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const escopo=propriedadeId==null?{}:{id:propriedadeId};
    const sitios=await tx.propriedade.findMany({where:escopo,select:{id:true,nome:true}});
    if(propriedadeId!=null&&!sitios.length)throw new Error("SITIO_NAO_ENCONTRADO");
    // Uma transação usa uma conexão. Leitura sequencial evita sobrepor comandos
    // no adapter PostgreSQL local e conserva o mesmo snapshot no Neon.
    const caixa=p.caixa?await consultarCaixaTx(tx,propriedadeId,inicio,fim):null;
    const compromissos=p.caixa?await consultarCompromissosTx(tx,propriedadeId,hoje):null;
    const estoque=p.estoque?await consultarEstoqueTx(tx,propriedadeId,principalId,hoje):null;
    const nutricao=p.nutricao?await consultarNutricaoTx(tx,propriedadeId,inicio,fim):null;
    const demandas=p.clinico?await tx.demandaAcompanhamentoReprodutivo.count({where:{...(propriedadeId==null?{}:{propriedadeOrigemId:propriedadeId}),estado:"PENDENTE",previstaPara:{lte:hoje}}}):null;
    const fontes: FonteCusto[][]=[];
    if(p.custos) for(const sitio of sitios) fontes.push(await carregarFontesCustoTx(tx,sitio.id));
    // Somente fatos originais: vínculos preparatórios não geram um segundo gasto.
    const componentes=fontes?.flat().filter(f=>f.data>=textoDia(inicio)&&f.data<=textoDia(fim)).flatMap(componentesDaFonte)??[];
    for(const f of nutricao?.fontes??[])componentes.push({chave:`nutricao:${f.participacaoId}:${f.itemId}`,fonteId:f.participacaoId,tipoFonte:"NUTRICAO",animalId:f.animalId,data:textoDia(fim),descricao:"Nutrição rateada no período",estadoFato:"CONFIRMADO",participacaoId:null,
      finalidade:f.finalidade as "REPRODUCAO"|"SANIDADE"|"ROTINA"|null,natureza:"MATERIAL",estado:f.custoConhecido==null?"DESCONHECIDO":"CONHECIDO",valor:f.custoConhecido==null?null:new Prisma.Decimal(f.custoConhecido),origemId:f.movimentoEstoqueId});
    const custosBase=p.custos?consolidarCustos(componentes):null;
    const custos=custosBase?{...sinalizarLacunasNutricao(custosBase,nutricao?.lacunas.length??0),
      componentes:custosBase.componentes.map(c=>({...c,propriedadeId:c.tipoFonte==="NUTRICAO"?nutricao!.fontes.find(f=>f.participacaoId===c.fonteId)!.propriedadeId:fontes!.flat().find(f=>f.id===c.fonteId&&f.tipo===c.tipoFonte)!.propriedadeId}))}:null;
    const finalidades=["REPRODUCAO","SANIDADE","ROTINA",null].map(finalidade=>({finalidade:finalidade??"SEM_CLASSIFICACAO",...sinalizarLacunasNutricao(consolidarCustos(componentes.filter(c=>c.finalidade===finalidade)),nutricao?.lacunas.length??0)}));
    return {versao:"GERENCIAL_V1",corte:agora.toISOString(),periodo:{inicio:textoDia(inicio),fim:textoDia(fim)},escopo:{propriedadeId,sitios},
      caixa:caixa?disponivel(caixa):bloqueado("Caixa exige Financeiro, aba Visão geral, valores, salários e investimentos. As categorias atuais não permitem separar sigilo salarial com segurança."),
      compromissos:compromissos?disponivel(compromissos):bloqueado("Compromissos exigem Financeiro, aba Visão geral, valores, salários e investimentos. As categorias atuais não permitem separar sigilo salarial com segurança."),
      estoque:estoque?disponivel(estoque):bloqueado("Estoque em valores exige Financeiro e ver valores."),
      nutricao:nutricao?disponivel(nutricao):bloqueado("Custos nutricionais exigem Pecuária, Financeiro e ver valores."),
      custos:custos?disponivel({...custos,finalidades}):bloqueado("Custos diretos exigem Pecuária, Financeiro e ver valores."),
      clinico:demandas!=null?disponivel({data:textoDia(hoje),acompanhamentosPendentes:demandas}):bloqueado("Acompanhamento exige Pecuária."),
      avisos:["Caixa, estoque e consumo representam momentos diferentes; seus totais não devem ser somados.","Nutrição e finalidade gerencial são recortes dos mesmos custos diretos.","Custos sem atribuição operacional não são rateados automaticamente entre animais."]};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
}
