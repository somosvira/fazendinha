import { DistribuicaoConsumoLeite } from './DistribuicaoConsumoLeite';
import {Card}from'@/components/ui/card';
import{Button}from'@/components/ui/button';
import{Badge}from'@/components/ui/badge';
import{AjudaCampo}from'@/components/Dica';
import{Skeleton}from'@/components/ui/skeleton';
import{Milk,GlassWater,Truck,ArrowUpRight}from'lucide-react';
import{formatarLitros}from'./modelo';
import type{DiaOperacionalLeite,GrupoProducaoLeite}from'./resumo-producao';
import'./componentes-producao.css';
const litros=(v:string|null|undefined)=>formatarLitros(v==null?null:Number(v));
function Campo({rotulo,valor,ajuda}:{rotulo:string;valor:React.ReactNode;ajuda:string}){return <div><dt><span>{rotulo}</span><AjudaCampo rotulo={`Sobre ${rotulo.toLocaleLowerCase('pt-BR')}`} texto={ajuda}/></dt><dd>{valor}</dd></div>}
function Total({rotulo,valor,ajuda}:{rotulo:string;valor:React.ReactNode;ajuda:string}){return <div className="producao-componente-total"><span>{rotulo}<AjudaCampo rotulo={`Sobre ${rotulo.toLocaleLowerCase('pt-BR')}`} texto={ajuda}/></span><strong>{valor}</strong></div>}
export function ComponentesProducaoLeite({grupo,ordenhas,operacional,carregando,erro,onRecarregar,onDetalhar}:{grupo:GrupoProducaoLeite;ordenhas:{posicaoId:string;nome:string}[];operacional:DiaOperacionalLeite|null;carregando:boolean;erro:string;onRecarregar:()=>void;onDetalhar:(grupo:'producao'|'consumo'|'vendas')=>void}){
 const consumo=operacional?.consumo,vendas=operacional?.vendas;
 const somaTurnos=grupo.turnos.reduce((s,t)=>s+(t.litros??0),0);
 const espera=carregando?<Skeleton className="h-5 w-20"/>:null;
 const valor=(v:string|null|undefined)=>espera??(erro?'Indisponível':litros(v));
 const mediaVendida=grupo.completa&&grupo.periodo.length===10&&grupo.vacasOrdenhadas&&vendas?.totalLitros!=null?Number(vendas.totalLitros)/grupo.vacasOrdenhadas:null;
 return <div className="producao-tres-componentes">
 <Card asChild className="producao-componente"><article aria-label="Leite produzido"><header><Milk size={19} aria-hidden/><h3>Leite produzido</h3><Badge variant="secondary">{grupo.completa?'Completo':'Parcial'}</Badge></header><Total rotulo="Volume registrado" valor={formatarLitros(grupo.litros)} ajuda="Volume das medições no período selecionado, pela fonte geral ou individual vigente. Consumo e venda não acrescentam litros à produção."/>
 {somaTurnos>0&&<div className="producao-componente-barra" aria-hidden>{grupo.turnos.map((t,i)=><span key={t.posicaoId} style={{flexGrow:t.litros??0,background:`var(--producao-turno-${i%3})`}}/>)}</div>}
 <dl className="producao-componente-campos turnos">{grupo.turnos.map(t=>{const nome=ordenhas.find(o=>o.posicaoId===t.posicaoId)?.nome??t.nome??'Ordenha';return <Campo key={t.posicaoId} rotulo={nome} valor={formatarLitros(t.litros)} ajuda={`Litros registrados para ${nome.toLocaleLowerCase('pt-BR')}. Ausência de medição não significa zero.`}/>})}</dl>
 <dl className="producao-componente-campos divisor"><Campo rotulo="Vacas com origem informada" valor={grupo.vacasOrdenhadas==null?'Não informado':`${grupo.vacasOrdenhadas} ${grupo.vacasOrdenhadas===1?'vaca':'vacas'}`} ajuda="Animais distintos vinculados às medições do dia. Origem incompleta ou agrupamento mensal mantém o número não informado; não usa o efetivo atual do rebanho."/><Campo rotulo="Média por vaca" valor={grupo.mediaPorVaca==null?'Não apurada':`${grupo.mediaPorVaca.toLocaleString('pt-BR',{maximumFractionDigits:3})} L/vaca`} ajuda="Média gerencial apenas de um dia com produção completa e animais de origem conhecidos. Não é uma medição individual nem uma projeção mensal."/></dl>
 <Button variant="ghost" onClick={()=>onDetalhar('producao')}>Consultar produção<ArrowUpRight size={14} aria-hidden/></Button></article></Card>
 <Card asChild className="producao-componente"><article aria-label="Leite consumido"><header><GlassWater size={19} aria-hidden/><h3>Leite consumido</h3></header><Total rotulo="Volume destinado" valor={valor(consumo?.totalLitros)} ajuda="Destinos aos animais, alimentação nutricional e retiradas para Casa/Funcionários confirmados no período. Estornos ficam fora da soma. Descartes são apresentados à parte e não se somam à alimentação."/>
 <DistribuicaoConsumoLeite dados={operacional} compacto carregando={carregando} erro={!!erro}/>
 {erro&&<div role="alert" className="producao-componente-erro">{erro}<Button variant="outline" size="sm" onClick={onRecarregar}>Tentar novamente</Button></div>}
 <Button variant="ghost" onClick={()=>onDetalhar('consumo')} disabled={carregando||!!erro}>Consultar consumo<ArrowUpRight size={14} aria-hidden/></Button></article></Card>
 <Card asChild className="producao-componente"><article aria-label="Leite vendido"><header><Truck size={19} aria-hidden/><h3>Leite vendido</h3></header><Total rotulo="Volume retirado para venda" valor={valor(vendas?.totalLitros)} ajuda="Saídas físicas confirmadas para venda na data da retirada. A operação comercial pode estar com preço pendente; o volume não representa receita ou recebimento."/>
 <dl className="producao-componente-campos">{vendas?.compradores.length?vendas.compradores.map(c=><Campo key={c.id??c.nome} rotulo={c.nome} valor={litros(c.litros)} ajuda={`Volume físico confirmado para ${c.nome} no período selecionado.`}/>):<Campo rotulo="Compradores" valor={espera??(erro?'Indisponível':'Sem retirada registrada')} ajuda="Compradores vinculados às saídas físicas confirmadas no período. Ausência de retirada não comprova volume zero."/>}</dl>
 <dl className="producao-componente-campos divisor"><Campo rotulo="Média vendida por vaca" valor={mediaVendida==null?'Não apurada':`${mediaVendida.toLocaleString('pt-BR',{maximumFractionDigits:3})} L/vaca`} ajuda="Relação entre o volume retirado para venda e os animais com origem conhecida no dia. As retiradas podem reunir leite de outros dias; não equivale à produção individual ou a preço por litro."/></dl>
 {!!vendas?.coletasSemPreco&&<Badge variant="secondary">{vendas.coletasSemPreco} {vendas.coletasSemPreco===1?'retirada com preço pendente':'retiradas com preço pendente'}</Badge>}
 <Button variant="ghost" onClick={()=>onDetalhar('vendas')} disabled={carregando||!!erro}>Consultar vendas<ArrowUpRight size={14} aria-hidden/></Button></article></Card>
 </div>
}
