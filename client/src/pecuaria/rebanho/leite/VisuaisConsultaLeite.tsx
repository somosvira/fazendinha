import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatarLitros } from './modelo';
import { naturezasVisuais, segmentosNatureza } from './visuais-leite';
import './visuais-consulta-leite.css';

export function EstadoLeite({ texto, pendente = false, anulado = false }: {texto:string;pendente?:boolean;anulado?:boolean}) {
  return <Badge variant="outline" className={`leite-estado-visual ${anulado?'anulado':pendente?'pendente':'neutro'}`}>{texto}</Badge>;
}
export function ComposicaoNaturezas({ itens, rotulo = 'Composição do volume' }: {itens: {natureza:string;litros:number|null}[];rotulo?:string}) {
  const segmentos = segmentosNatureza(itens);
  if (!segmentos.length && !itens.some(p => p.litros != null)) return <p className="leite-composicao-vazia">Sem volume aferido para distribuir entre comercial, não comercial e colostro.</p>;
  return <div className="leite-composicao-visual">
    {!!segmentos.length && <div className="leite-barra-naturezas" role="img" aria-label={`${rotulo}: ${segmentos.map(s=>`${s.nome??s.natureza}: ${formatarLitros(s.litros)}`).join('; ')}`}>
      {segmentos.map(s=><span key={s.natureza} className={s.cor??'pendente'} style={{flexGrow:s.litros}} />)}
    </div>}
    <dl className="leite-naturezas-legenda">{itens.map(p=>{const n=naturezasVisuais.find(n=>n.natureza===p.natureza);return <div key={p.natureza}><dt><i className={n?.cor??'pendente'} aria-hidden/>{n?.nome??p.natureza}</dt><dd>{formatarLitros(p.litros)}</dd></div>})}</dl>
  </div>;
}
export function ResumoEstoqueVisual({resumo}:{resumo:{quantidadeLitros:string|null;comercial:{quantidadeLitros:string|null};descarteLitros:string|null;colostroLitros:string|null;classificacaoPendenteLitros?:string|null;custoPendenteLitros?:string|null;estadoValor?:string;produtosSemLastro:number}}) {
  const numero=(v:string|null|undefined)=>v==null?null:Number(v);
  return <div className="leite-estoque-visao"><section><div className="leite-estoque-total"><div><h3>Saldo físico</h3><strong>{formatarLitros(numero(resumo.quantidadeLitros))}</strong></div></div>
    <ComposicaoNaturezas rotulo="Composição do estoque" itens={[{natureza:'COMERCIAL',litros:numero(resumo.comercial.quantidadeLitros)},{natureza:'NAO_COMERCIAL',litros:numero(resumo.descarteLitros)},{natureza:'COLOSTRO',litros:numero(resumo.colostroLitros)},...(Number(resumo.classificacaoPendenteLitros)>0?[{natureza:'A_CLASSIFICAR',litros:numero(resumo.classificacaoPendenteLitros)}]:[])]}/>
  </section><Card className="leite-coberturas"><h3>Conferência do saldo</h3><dl><div><dt>Classificação pendente</dt><dd>{formatarLitros(numero(resumo.classificacaoPendenteLitros))}</dd></div><div><dt>Custo a apurar</dt><dd>{resumo.estadoValor==='OCULTO'?'Restrito':formatarLitros(numero(resumo.custoPendenteLitros))}</dd></div><div><dt>Produtos sem lastro</dt><dd>{resumo.produtosSemLastro}</dd></div></dl></Card></div>;
}
