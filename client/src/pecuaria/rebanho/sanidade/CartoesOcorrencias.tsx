import { useState, type ReactNode } from "react";
import { Activity, CalendarDays, CircleCheck } from "lucide-react";
import { Button } from "@/financeiro/financeiro-ui";
import { EstadoSanitario } from "./IndicadoresSanitarios";
import { dataSanitaria } from "./rotulos";
import { hojeSanidade } from "./AgendaSemanal";
export type OcorrenciaVisual = { id: string; animalId: string; inicio: string; fim: string | null; status: string; doenca: { id?: string; nome: string }; desfecho: string | null };
export type ResumoOcorrencias = { abertas: number; encerradas: number; anuladas: number; porDoenca: { id: string; nome: string; quantidade: number }[] };
export function diasOcorrencia(inicio: string, fim: string) { return Math.max(0, Math.round((Date.parse(fim.slice(0,10)) - Date.parse(inicio.slice(0,10))) / 86400000)); }
export function CartoesOcorrencias<T extends OcorrenciaVisual>({ itens, resumo, nomeAnimal, acoes, onAbrir, doencaId, onDoenca }: { itens: T[]; resumo: ResumoOcorrencias | null; nomeAnimal: (id: string) => string; acoes: (o: T) => ReactNode; onAbrir: (o: T) => void; doencaId: string; onDoenca: (id: string) => void }) {
  const [selecionada, setSelecionada] = useState("");
  const atual = itens.find(o => o.id === selecionada) ?? itens.find(o => o.status === "VALIDO" && !o.fim) ?? itens[0];
  const maior = Math.max(1,...(resumo?.porDoenca.map(d => d.quantidade) ?? []));
  return <div className="san-ocorrencias-visual"><div className="san-ocorrencias-cartoes">{itens.map(o => {
    const anulada = o.status === "ANULADO";
    const duracao = diasOcorrencia(o.inicio,o.fim ?? hojeSanidade());
    return <article className="san-ocorrencia-cartao" key={o.id} data-selecionada={atual?.id === o.id || undefined} data-encerrada={!!o.fim || anulada || undefined}><header><span className="san-ocorrencia-icone"><Activity size={20} aria-hidden/></span><div><button type="button" className="san-ocorrencia-nome" aria-pressed={atual?.id === o.id} aria-label={`Acompanhar ${nomeAnimal(o.animalId)}`} onClick={() => setSelecionada(o.id)}>{nomeAnimal(o.animalId)}</button><h2>{o.doenca.nome}</h2></div><EstadoSanitario tom={anulada ? "neutro" : o.fim ? "verde" : "atencao"}>{anulada ? "Anulada" : o.fim ? "Encerrada" : "Aberta"}</EstadoSanitario></header>
      <div className="san-ocorrencia-periodo"><span><CalendarDays size={14} aria-hidden/>{dataSanitaria(o.inicio)}</span><strong>{anulada ? "Registro anulado" : o.fim ? `${duracao} dias até o encerramento` : `${duracao} ${duracao === 1 ? "dia" : "dias"} em aberto`}</strong></div>
      <div className="san-ocorrencia-intervalo" aria-hidden><span/><i/><span/></div><div className="san-ocorrencia-datas"><span>Abertura</span><span>{anulada ? "Anulada" : o.fim ? `Fim ${dataSanitaria(o.fim)}` : "Hoje"}</span></div>
      <footer><Button secondary onClick={() => onAbrir(o)}>Ver ocorrência</Button><div>{acoes(o)}</div></footer>
    </article>;
  })}</div><aside className="san-ocorrencias-lateral"><section className="san-ocorrencias-distribuicao"><h2>Casos abertos por doença</h2>{resumo ? <><p>{resumo.abertas} {resumo.abertas === 1 ? "ocorrência aberta" : "ocorrências abertas"} no recorte filtrado</p>{resumo.porDoenca.map((d,i) => <button type="button" key={`${d.id}-${i}`} aria-pressed={doencaId === d.id} onClick={() => onDoenca(doencaId === d.id ? "" : d.id)}><span>{d.nome}</span><span className="san-doenca-barra"><i style={{width:`${d.quantidade/maior*100}%`}}/></span><strong>{d.quantidade}</strong></button>)}{!resumo.porDoenca.length && <p className="san-visual-meta">Nenhum caso aberto neste recorte.</p>}{doencaId && <Button secondary onClick={() => onDoenca("")}>Todas as doenças</Button>}</> : <p>Distribuição indisponível.</p>}</section>
    {atual && <section className="san-ocorrencia-acompanhamento" aria-label="Acompanhamento da ocorrência"><h2>Acompanhamento</h2><strong>{nomeAnimal(atual.animalId)}</strong><p>{atual.doenca.nome}</p><ol><li><time>{dataSanitaria(atual.inicio)}</time><strong>Abertura da ocorrência</strong></li><li><time>{atual.status === "ANULADO" ? "Situação atual" : dataSanitaria(atual.fim ?? hojeSanidade())}</time><strong>{atual.status === "ANULADO" ? "Ocorrência anulada" : atual.fim ? "Ocorrência encerrada" : "Em aberto"}</strong>{atual.desfecho && <p>{atual.desfecho}</p>}</li></ol><Button secondary onClick={() => onAbrir(atual)}><CircleCheck size={15} aria-hidden/>Consultar histórico completo</Button></section>}
  </aside></div>;
}
