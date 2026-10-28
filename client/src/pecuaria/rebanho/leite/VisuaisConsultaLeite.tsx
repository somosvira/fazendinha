import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AjudaCampo } from '@/components/Dica';
import { Milk, Sun, Sunset, Moon, ArrowUpRight, Truck, FlaskConical, Wallet, Check, Clock } from 'lucide-react';
import { formatarLitros } from './modelo';
import { formatarDataBR } from '../lib/rotulos';
import type { RegistroOrdenhaConsulta } from './parcelas-types';
import type { AmostraQualidade } from './qualidade-types';
import { naturezasVisuais, segmentosNatureza, situacaoOrdenha } from './visuais-leite';
import './visuais-consulta-leite.css';

export function EstadoLeite({ texto, pendente = false, anulado = false }: {texto:string;pendente?:boolean;anulado?:boolean}) {
  return <Badge variant="outline" className={`leite-estado-visual ${anulado?'anulado':pendente?'pendente':'neutro'}`}>{texto}</Badge>;
}
export function ComposicaoNaturezas({ itens, rotulo = 'Composição do volume' }: {itens: {natureza:string;litros:number|null}[];rotulo?:string}) {
  const segmentos = segmentosNatureza(itens);
  return <div className="leite-composicao-visual">
    {!!segmentos.length && <div className="leite-barra-naturezas" role="img" aria-label={`${rotulo}: ${segmentos.map(s=>`${s.nome??s.natureza}: ${formatarLitros(s.litros)}`).join('; ')}`}>
      {segmentos.map(s=><span key={s.natureza} className={s.cor??'pendente'} style={{flexGrow:s.litros}} />)}
    </div>}
    <dl className="leite-naturezas-legenda">{itens.map(p=>{const n=naturezasVisuais.find(n=>n.natureza===p.natureza);return <div key={p.natureza}><dt><i className={n?.cor??'pendente'} aria-hidden/>{n?.nome??p.natureza}</dt><dd>{formatarLitros(p.litros)}</dd></div>})}</dl>
  </div>;
}
export function CartaoOrdenhaVisual({ registro:r, abrir, podeLancar }: {registro:RegistroOrdenhaConsulta;abrir:()=>void;podeLancar:boolean}) {
  const Icone=r.ordem===1?Sun:r.ordem===2?Sunset:Moon;
  const estado=situacaoOrdenha(r);
  return <Card asChild className="leite-card-visual leite-ordenha-visual"><article>
    <header><Icone size={17} aria-hidden/><h3>{r.nome}</h3><EstadoLeite texto={estado} pendente={r.situacao!=='SEM_AFERICAO'&&r.situacao!=='CONFIRMADA'}/></header>
    <div className="leite-volume-visual"><strong>{r.litros===null?'Não aferido':formatarLitros(r.litros)}</strong><span>{formatarDataBR(r.dataOperacional)} · Fonte {r.fonteProducao==='GERAL'?'geral':'individual'}</span></div>
    <ComposicaoNaturezas itens={naturezasVisuais.filter(n=>n.natureza!=='A_CLASSIFICAR'||r.porNatureza.some(p=>p.natureza===n.natureza)).map(n=>({natureza:n.natureza,litros:r.porNatureza.find(p=>p.natureza===n.natureza)?.litros??null}))}/>
    <footer><Button variant="ghost" onClick={abrir}>{!podeLancar||r.situacao==='CONFIRMADA'?'Consultar registro':r.situacao==='SEM_AFERICAO'?'Registrar aferição':'Continuar confirmação'}<ArrowUpRight size={14}/></Button></footer>
  </article></Card>;
}
export interface ProdutoVisualLeite {nome:string;quantidadeLitros:string|null;comercial:{quantidadeLitros:string|null};descarteLitros:string|null;colostroLitros:string|null;estadoValor:string;valorTotal:string|null;confiavel:boolean}
export function ProdutoEstoqueVisual({item,abrir}:{item:ProdutoVisualLeite;abrir:()=>void}) {
  return <Card asChild className="leite-card-visual leite-produto-visual"><article>
    <span className="leite-produto-simbolo"><Milk size={23} aria-hidden/></span><div className="leite-produto-nome"><h3>{item.nome}</h3><EstadoLeite texto={item.confiavel?'Lastro conciliado':'Conferir lastro'} pendente={!item.confiavel}/></div>
    <div className="leite-produto-saldo"><strong>{formatarLitros(item.quantidadeLitros==null?null:Number(item.quantidadeLitros))}</strong><span>Saldo físico</span></div>
    <div className="leite-produto-valor"><span>Valor do saldo</span><strong>{item.estadoValor==='OCULTO'?'Restrito':item.valorTotal===null?'A apurar':Number(item.valorTotal).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong></div>
    <Button variant="outline" onClick={abrir}>Ver origens<ArrowUpRight size={14}/></Button>
  </article></Card>;
}
export function ResumoEstoqueVisual({resumo}:{resumo:{quantidadeLitros:string|null;comercial:{quantidadeLitros:string|null};descarteLitros:string|null;colostroLitros:string|null;classificacaoPendenteLitros?:string|null;custoPendenteLitros?:string|null;estadoValor?:string;produtosSemLastro:number}}) {
  const numero=(v:string|null|undefined)=>v==null?null:Number(v);
  return <div className="leite-estoque-visao"><section><div className="leite-estoque-total"><div><h3>Saldo físico</h3><strong>{formatarLitros(numero(resumo.quantidadeLitros))}</strong></div><AjudaCampo rotulo="Sobre a composição do saldo" texto="Saldo físico confirmado por natureza, no recorte completo da busca. Não representa capacidade ou localização atual de tanque. Não comercial ainda em estoque é diferente de descarte físico."/></div>
    <ComposicaoNaturezas rotulo="Composição do estoque" itens={[{natureza:'COMERCIAL',litros:numero(resumo.comercial.quantidadeLitros)},{natureza:'NAO_COMERCIAL',litros:numero(resumo.descarteLitros)},{natureza:'COLOSTRO',litros:numero(resumo.colostroLitros)},...(Number(resumo.classificacaoPendenteLitros)>0?[{natureza:'A_CLASSIFICAR',litros:numero(resumo.classificacaoPendenteLitros)}]:[])]}/>
  </section><Card className="leite-coberturas"><h3>Conferência do saldo<AjudaCampo rotulo="Sobre a conferência do saldo" texto="Classificação e custo são coberturas independentes. Valor desconhecido não significa custo zero."/></h3><dl><div><dt>Classificação pendente</dt><dd>{formatarLitros(numero(resumo.classificacaoPendenteLitros))}</dd></div><div><dt>Custo a apurar</dt><dd>{resumo.estadoValor==='OCULTO'?'Restrito':formatarLitros(numero(resumo.custoPendenteLitros))}</dd></div><div><dt>Produtos sem lastro</dt><dd>{resumo.produtosSemLastro}</dd></div></dl></Card></div>;
}
export function ColetaVisual({item,acao}:{item:{parceiroNome:string;data?:string;quantidadeLitros?:string;referencia:string;situacao?:string};acao:React.ReactNode}) {
  const data=item.data?.slice(0,10);
  return <Card asChild className="leite-card-visual leite-coleta-visual"><article>
    <time dateTime={data}><strong>{data?.slice(8)||'—'}</strong><span>{data?new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR',{month:'short'}):'Sem data'}</span></time><Truck size={19} aria-hidden/>
    <div className="leite-coleta-origem"><h3>{item.parceiroNome}</h3><span>{data?formatarDataBR(data):'Data não informada'} · {item.referencia}</span></div>
    <strong className="leite-coleta-litros">{formatarLitros(item.quantidadeLitros===undefined?null:Number(item.quantidadeLitros))}</strong><EstadoLeite texto={item.situacao==='PRECO_PENDENTE'?'Preço pendente':'Preço definido'} pendente={item.situacao==='PRECO_PENDENTE'}/>{acao}
  </article></Card>;
}
export interface VendaVisual {modalidade:'PERIODO'|'AVULSA';referencia:string;inicio:string;fim:string;data:string;parceiroNome:string|null;quantidadeLitros:string;valorTotal:string|null;situacao:string}
export function CartaoVendaVisual({item:v,acao,podeVerValores}:{item:VendaVisual;acao:React.ReactNode;podeVerValores:boolean}) {
  const aberta=v.situacao==='ABERTA',cancelada=v.situacao==='CANCELADA';
  const etapas=v.modalidade==='PERIODO'?['Operação','Coletas','Fechamento']:['Retirada','Venda','Confirmação'];
  return <Card asChild className="leite-card-visual leite-venda-visual"><article><header><span><Wallet size={16} aria-hidden/>{v.modalidade==='PERIODO'?'Por período':'Avulsa'}</span><EstadoLeite texto={({ABERTA:'Aberta',FECHADA:'Fechada',CONFIRMADA:'Confirmada',CANCELADA:'Cancelada'} as Record<string,string>)[v.situacao]??v.situacao} pendente={aberta} anulado={cancelada}/></header>
    <h3>{v.parceiroNome??'Comprador não informado'}</h3><div className="leite-venda-referencia">{v.referencia}</div><time>{v.modalidade==='AVULSA'?formatarDataBR(v.data):`${formatarDataBR(v.inicio)} – ${formatarDataBR(v.fim)}`}</time>
    <dl><div><dt>{v.modalidade==='AVULSA'?'Volume retirado':aberta?'Retirado até agora':'Volume reconhecido'}<AjudaCampo rotulo="Sobre o volume da venda" texto="Operações abertas e vendas avulsas exibem retirada física; o fechamento exibe o volume reconhecido comercialmente. O período do acordo é integral, sem rateio diário."/></dt><dd>{formatarLitros(Number(v.quantidadeLitros))}</dd></div><div><dt>Total comercial<AjudaCampo rotulo="Sobre o total comercial" texto="Valor da venda; não representa recebimento financeiro. Preço pendente permanece sem valor presumido."/></dt><dd>{!podeVerValores?'Restrito':v.valorTotal===null?'Preço pendente':Number(v.valorTotal).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</dd></div></dl>
    {!cancelada&&<ol className="leite-venda-etapas" aria-label="Andamento comercial">{etapas.map((etapa,i)=><li key={etapa} className={aberta&&i===2?'pendente':''}>{aberta&&i===2?<Clock size={15} aria-hidden/>:<Check size={15} aria-hidden/>}{etapa}</li>)}</ol>}<footer>{acao}</footer>
  </article></Card>;
}
export function CartaoAmostraVisual({amostra:a,abrir}:{amostra:AmostraQualidade;abrir:()=>void}) {
  const pendente=a.realizacao==='COLETA_REGISTRADA',anulada=a.status==='ANULADO';
  return <Card asChild className="leite-card-visual leite-amostra-visual"><article><header><span><FlaskConical size={17} aria-hidden/>{a.sujeito.tipo==='ANIMAL'?'Individual':'Coletiva'}</span><EstadoLeite texto={anulada?'Anulada':pendente?'Aguardando resultado':'Resultado informado'} pendente={pendente} anulado={anulada}/></header>
    <h3>{a.sujeito.tipo==='ANIMAL'?[a.animal?.brinco??'Sem brinco',a.animal?.nome].filter(Boolean).join(' · '):a.sujeito.origem}</h3><span className="leite-amostra-formato">Coleta {formatarDataBR(a.data)} · {a.formatoSnapshot.nome} · v{a.formatoSnapshot.versao??1}</span>
    {a.resultados.length?<dl className="leite-laudo-valores">{a.resultados.slice(0,4).map(r=>{const campo=a.formatoSnapshot.campos.find(c=>c.codigo===r.campo);return <div key={r.campo}><dt>{campo?.rotulo??r.campo}</dt><dd>{typeof r.valor==='boolean'?r.valor?'Sim':'Não':typeof r.valor==='number'?r.valor.toLocaleString('pt-BR',{maximumFractionDigits:12}):String(r.valor)} {campo?.unidade??''}</dd></div>})}</dl>:<div className="leite-laudo-pendente"><Clock size={17} aria-hidden/>Resultado ainda não informado</div>}
    <footer><Button variant="outline" onClick={abrir}>{a.resultados.length?'Abrir laudo e histórico':'Abrir amostra'}<ArrowUpRight size={14}/></Button>{a.resultados.length>4&&<span>+{a.resultados.length-4} resultados no laudo</span>}</footer>
  </article></Card>;
}
