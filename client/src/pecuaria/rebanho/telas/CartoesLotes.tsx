import { useEffect, useState, type ReactNode } from "react";
import { MapPin, TrendingUp, Weight } from "lucide-react";
import { Button, Pill, Empty } from "@/financeiro/financeiro-ui";
import { buscarResumoLote } from "../api";
import type { Lote, ResumoLote } from "../types";
import { formatarGmd, formatarKg } from "../lib/peso";
import "./lotes-visuais.css";
export function Composicao({ resumo }: { resumo: ResumoLote }) {
  const agrupadas = new Map<string, number>();
  for (const { categoria, qtd } of resumo.porCategoria) {
    agrupadas.set(categoria, (agrupadas.get(categoria) ?? 0) + qtd);
  }
  const categorias = [...agrupadas].sort(([nomeA, qtdA], [nomeB, qtdB]) =>
    qtdB - qtdA || nomeA.localeCompare(nomeB, "pt-BR"),
  );

  if (!resumo.ativos) return <p className="consulta-cartao-meta">Sem animais ativos.</p>;

  return <ul className="lote-composicao" aria-label="Animais por categoria">
    {categorias.map(([categoria, qtd]) => <li key={categoria}>
      <span>{categoria}</span>
      <strong>{qtd}</strong>
      <div className="lote-composicao-barra" aria-hidden="true">
        <span style={{ width: `${qtd / resumo.ativos * 100}%` }} />
      </div>
    </li>)}
  </ul>;
}

function Cartao({ lote, acoes, onAbrir }: { lote: Lote; acoes: ReactNode; onAbrir: (id: string) => void }) {
  const [resumo, setResumo] = useState<ResumoLote | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const { id, animaisAtivos, nome, propriedade, ativo } = lote;

  useEffect(() => {
    let vivo = true;
    setResumo(null);
    setErro(false);
    buscarResumoLote(id, { periodoDias: 30 })
      .then(resultado => { if (vivo) setResumo(resultado); })
      .catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; };
  }, [id, animaisAtivos, tentativa]);

  const total = resumo?.ativos ?? animaisAtivos;

  return <article className="consulta-cartao lote-cartao">
    <button type="button" className="lote-cartao-abrir" aria-label={`Ver lote ${nome}`} onClick={() => onAbrir(id)} />
    <header>
      <div>
        <h2>{nome}</h2>
        <p className="consulta-cartao-meta"><MapPin size={14} aria-hidden />{propriedade.nome}</p>
      </div>
      <div className="lote-cartao-acoes">
        <Pill tone={ativo ? "green" : "neutral"}>{ativo ? "Ativo" : "Inativo"}</Pill>
        {acoes}
      </div>
    </header>
    <div className="lote-cartao-corpo">
      <div className="lote-cartao-efetivo">
        <p className="lote-cartao-total">{total} {total === 1 ? "animal ativo" : "animais ativos"}</p>
        {resumo ? (total > 0 && <Composicao resumo={resumo} />) : erro
          ? <div className="lote-composicao-vazia">
            <span>Resumo indisponível.</span>
            <Button secondary onClick={() => setTentativa(valor => valor + 1)}>Tentar novamente</Button>
          </div>
          : <p role="status" className="consulta-cartao-meta">Consultando resumo…</p>}
      </div>
      <div className="lote-medidas">
        <div>
          <span><Weight size={15} aria-hidden />Peso médio</span>
          <strong>{resumo ? formatarKg(resumo.peso.medioKg) : "—"}</strong>
          {resumo && <small>{resumo.peso.medioKg == null ? "Sem pesagens" : `${total - resumo.peso.semPeso} de ${total} com pesagem`}</small>}
        </div>
        <div>
          <span><TrendingUp size={15} aria-hidden />GMD · 30 dias</span>
          <strong>{resumo ? formatarGmd(resumo.gmd.medio) : "—"}</strong>
          {resumo && <small>{resumo.gmd.comGmd} de {total} com GMD</small>}
        </div>
      </div>
    </div>
  </article>;
}

export function CartoesLotes({lotes,todos,acoes,onAbrir}:{lotes:Lote[];todos:Lote[];acoes:(l:Lote)=>ReactNode;onAbrir:(id:string)=>void}){
 if(!todos.length)return <Empty>Nenhum lote corresponde aos filtros atuais.</Empty>;
 const comparacao=[...todos].sort((a,b)=>b.animaisAtivos-a.animaisAtivos||a.nome.localeCompare(b.nome)).slice(0,8);const maior=Math.max(1,...comparacao.map(l=>l.animaisAtivos));
 return <><div className="consulta-cartoes lotes-cartoes">{lotes.map(l=><Cartao key={l.id} lote={l} acoes={acoes(l)} onAbrir={onAbrir}/>)}</div>{comparacao.length>1&&<section className="lote-distribuicao"><h2>Distribuição do efetivo por lote</h2><p>{comparacao.length===todos.length?"Todos os lotes do recorte filtrado":`${comparacao.length} de ${todos.length} lotes do recorte filtrado`}</p>{comparacao.map(l=><button type="button" key={l.id} onClick={()=>onAbrir(l.id)}><span>{l.nome}</span><span className="lote-distribuicao-barra"><i style={{width:`${l.animaisAtivos/maior*100}%`}}/></span><strong>{l.animaisAtivos}</strong></button>)}</section>}</>;
}
