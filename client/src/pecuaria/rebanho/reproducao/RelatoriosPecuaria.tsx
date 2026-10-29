import { Button } from "../../../components/ui/button";
import { useEffect, useState } from "react";
import { PageHeader, PaginaFinanceira } from "../../../financeiro/financeiro-ui";
import { Tabs,TabsList,TabsTrigger } from "@/components/ui/tabs";
import { navegarPara } from "../../../router";
import { ConsultaPorSitio } from "./ConsultaPorSitio";
import { RelatorioPartos } from "./RelatorioPartos";
import { IndicadoresReprodutivos } from "./IndicadoresReprodutivos";
import { RelatoriosLeite } from "../leite/RelatoriosLeite";
import { BuilderRelatorio } from "../../relatorios/BuilderRelatorio";
import { relatoriosDisponiveis,fontesRelatorio,type FonteId } from "../../relatorios/catalogo";
import {CatalogoRelatorios} from '../../relatorios/CatalogoRelatorios';
import {ehFonteCatalogo,type FonteCatalogoId} from '../../relatorios/catalogo-operacional';
import { RelatoriosComplementares } from "../../relatorios/RelatoriosComplementares";
import {ehFonteAcompanhamento,type FonteAcompanhamento}from'../../relatorios/acompanhamento';
import {SlidersHorizontal}from'lucide-react';
import '../../relatorios/relatorios.css';
import '../../relatorios/hierarquia-relatorios.css';
const daUrl=()=>{const p=new URLSearchParams(window.location.search),v=p.get('tipo'),f=p.get('fonte'),r=p.get('relatorio');return {tipo:v==='builder'||relatoriosDisponiveis.some(r=>r.id===v)?v!:'partos',fonte:f&&Object.hasOwn(fontesRelatorio,f)?f as FonteId:'partos' as FonteId,operacional:r&&ehFonteCatalogo(r)?r:'animais' as FonteCatalogoId,relatorio:r&&ehFonteAcompanhamento(r)?r:'iep' as FonteAcompanhamento}};
export function RelatoriosPecuaria({ podeLancar,podeExportar=false,podeFinanceiro=false }: { podeLancar: boolean;podeExportar?:boolean;podeFinanceiro?:boolean }) {
 const[rota,setRota]=useState(daUrl);const {tipo,fonte,relatorio,operacional}=rota;
 useEffect(()=>{const sync=()=>setRota(daUrl());window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync)},[]);
 function selecionar(v:string){const url=new URL(window.location.href);url.searchParams.set('tipo',v);navegarPara(url.pathname+url.search+url.hash)}
 function selecionarComplementar(v:FonteAcompanhamento){const url=new URL(window.location.href);url.searchParams.set('relatorio',v);navegarPara(url.pathname+url.search+url.hash)}
 function selecionarOperacional(v:FonteCatalogoId){const url=new URL(window.location.href);url.searchParams.set('relatorio',v);url.searchParams.delete('animalId');url.searchParams.delete('loteId');navegarPara(url.pathname+url.search+url.hash)}
 function abrirBuilder(){const url=new URL(window.location.href);url.searchParams.set('tipo','builder');url.searchParams.set('fonte',tipo==='catalogo'?operacional:relatorio);navegarPara(url.pathname+url.search+url.hash)}
 return <PaginaFinanceira><div className="relatorios-pecuaria"> <ConsultaPorSitio cabecalho={controle=>tipo==='builder'?<div className="rel-builder-sitio">{controle}</div>:<><PageHeader titulo="Relatórios da Pecuária"  acao={<div className="rel-cabecalho-acoes">{controle}<Button variant="outline" onClick={()=>tipo==='acompanhamento'||tipo==='catalogo'?abrirBuilder():selecionar('builder')}><SlidersHorizontal size={16}/>Montar relatório</Button></div>}/><Tabs value={tipo} onValueChange={selecionar}><TabsList variant="line" className="rel-tabs">{relatoriosDisponiveis.map(r=><TabsTrigger key={r.id} value={r.id}>{r.label}</TabsTrigger>)}</TabsList></Tabs></>}>{id=>tipo==='builder'?<BuilderRelatorio key={`builder:${id}:${fonte}`} fonteInicial={fonte} propriedadeId={id} podeExportar={podeExportar} voltar={()=>selecionar(ehFonteCatalogo(fonte)?'catalogo':ehFonteAcompanhamento(fonte)?'acompanhamento':'partos')}/>:tipo==='catalogo'?<CatalogoRelatorios key={`catalogo:${id}`} propriedadeId={id} fonte={operacional} selecionar={selecionarOperacional} personalizar={abrirBuilder} podeExportar={podeExportar}/>:tipo==='acompanhamento'?<RelatoriosComplementares key={`complementares:${id}`} propriedadeId={id} fonte={relatorio} selecionar={selecionarComplementar} personalizar={abrirBuilder} podeExportar={podeExportar}/>:tipo==='partos'?<RelatorioPartos key={`partos:${id}`} propriedadeId={id} podeLancar={podeLancar}/>:tipo==='indicadores'?<IndicadoresReprodutivos key={`indicadores:${id}`} propriedadeId={id} podeLancar={podeLancar} modo="relatorio"/>:<RelatoriosLeite key={`leite:${id}`} propriedadeId={id} podeExportar={podeExportar} podeFinanceiro={podeFinanceiro}/>}</ConsultaPorSitio>
</div></PaginaFinanceira>;
}
