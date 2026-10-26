import { DistribuicaoConsumoLeite } from "./DistribuicaoConsumoLeite";
import { AlternarVisualizacaoConsulta } from "@/components/VisualizacaoConsulta";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AjudaCampo } from "@/components/Dica";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { consultarLeite } from "./operacoes-api";
import { ComponentesProducaoLeite } from "./ComponentesProducaoLeite";
import { resumirOperacionalPeriodo, type ResumoOperacionalProducao, type GrupoProducaoLeite } from "./resumo-producao";
import { formatarLitros } from "./modelo";
interface Props { sitio:number|null; inicio:string; fim:string; grupos:GrupoProducaoLeite[]; ordenhas:{posicaoId:string;nome:string}[]; data:string }
export function RegistroVisualProducaoLeite({sitio,inicio,fim,grupos,ordenhas,data}:Props) {
 const [modoDetalhe, setModoDetalhe] = useState<"visual" | "tabela">("visual");
 const titulo = useRef<HTMLHeadingElement>(null);
 const [resumo,setResumo]=useState<ResumoOperacionalProducao|null>(null),[erro,setErro]=useState(""),[revisao,setRevisao]=useState(0);
 const [periodo,setPeriodo]=useState(data),[detalhe,setDetalhe]=useState<'producao'|'consumo'|'vendas'|null>(null);
 useEffect(()=>{let ativa=true;setResumo(null);setErro("");void consultarLeite<ResumoOperacionalProducao>(`/consultas-producao/resumo-operacional?${new URLSearchParams({inicio,fim})}`,sitio).then(r=>{if(ativa)setResumo(r)}).catch(e=>{if(ativa)setErro(e instanceof Error?e.message:"Não foi possível consultar os destinos e vendas.")});return()=>{ativa=false}},[sitio,inicio,fim,revisao]);
 const grupo=grupos.find(g=>g.periodo===periodo)??grupos.find(g=>data.startsWith(g.periodo))??grupos[0];
 if(!grupo)return <p role="status">Nenhuma produção registrada no período.</p>;
 const operacional=resumo?resumirOperacionalPeriodo(resumo.dias,grupo.periodo):null;
 const litros=(v:string|null|undefined)=>formatarLitros(v==null?null:Number(v));
 const itens=detalhe==='producao'?grupo.turnos.map(t=>({nome:ordenhas.find(o=>o.posicaoId===t.posicaoId)?.nome??t.nome??'Ordenha',valor:formatarLitros(t.litros)})):detalhe==='consumo'?[
 {nome:'Funcionários',valor:'Em aberto'},{nome:'Casa',valor:'Em aberto'},
 {nome:'Limpo',valor:litros(operacional?.consumo.comumLitros)},{nome:'Sujo',valor:litros(operacional?.consumo.naoComercialLitros)},
 {nome:'Colostro',valor:litros(operacional?.consumo.colostroLitros)},
 {nome:'Descarte do limpo',valor:litros(operacional?.descarte.comercialLitros)},{nome:'Descarte do sujo',valor:litros(operacional?.descarte.naoComercialLitros)},
 {nome:'Descarte de colostro',valor:litros(operacional?.descarte.colostroLitros)},{nome:'Descarte a classificar',valor:litros(operacional?.descarte.semClassificacaoLitros)}
 ]:operacional?.vendas.compradores.map(c=>({nome:c.nome,valor:litros(c.litros)}))??[];
 return <><div className="producao-registro-cabecalho"><h3>Registro {grupo.periodo.length===7?'mensal':'diário'}</h3><div><AjudaCampo rotulo="Sobre o recorte dos destinos e vendas" texto="Consumo, descarte e vendas apresentam fatos físicos de todo o sítio no período. O filtro de natureza refina apenas a produção; destinos e vendas não são somados aos litros produzidos."/><SelectCampo aria-label="Período dos componentes" value={grupo.periodo} onValueChange={setPeriodo}>{grupos.map(g=><option key={g.periodo} value={g.periodo}>{g.periodo.split('-').reverse().join('/')}</option>)}</SelectCampo></div></div>
 <ComponentesProducaoLeite grupo={grupo} ordenhas={ordenhas} operacional={operacional} carregando={!resumo&&!erro} erro={erro} onRecarregar={()=>setRevisao(r=>r+1)} onDetalhar={v=>{setModoDetalhe("visual");setDetalhe(v)}}/>
 <Dialog open={detalhe!==null} onOpenChange={v=>{if(!v)setDetalhe(null)}}><DialogContent className="leite-consulta-dialog producao-destinos-dialog" aria-describedby={undefined} onOpenAutoFocus={e=>{e.preventDefault();titulo.current?.focus()}}><DialogHeader><DialogTitle ref={titulo} tabIndex={-1}>{detalhe==='producao'?'Leite produzido':detalhe==='consumo'?'Alimentação e descarte':'Leite vendido'} · {grupo.periodo.split('-').reverse().join('/')}</DialogTitle></DialogHeader>{detalhe==='consumo'&&<AlternarVisualizacaoConsulta modo={modoDetalhe} mudar={setModoDetalhe} rotulo="Apresentação dos destinos"/>}{detalhe==='consumo'&&modoDetalhe==='visual'?<DistribuicaoConsumoLeite dados={operacional}/>:<TabelaFinanceira visualizacao="tabela" rotulo="Detalhamento do registro" itens={itens} chaveDe={i=>i.nome} colunas={[{chave:'nome',titulo:detalhe==='vendas'?'Comprador':'Item',celula:i=><>{i.nome}{detalhe==='consumo'&&<AjudaCampo rotulo={`Sobre ${i.nome.toLocaleLowerCase('pt-BR')}`} texto={['Funcionários','Casa'].includes(i.nome)?'Destino em aberto, sem volume atribuído. Não representa zero.':i.nome.startsWith('Descarte')?'Descarte físico confirmado, separado da alimentação, pela classificação histórica da alocação.':'Volume declarado na alimentação, incluído no volume destinado. A classificação operacional não certifica aptidão sanitária.'}/>}</>},{chave:'valor',titulo:'Volume',alinhamento:'direita',celula:i=>i.valor}]}/>}<Button variant="outline" onClick={()=>setDetalhe(null)}>Voltar à produção</Button></DialogContent></Dialog></>;
}
