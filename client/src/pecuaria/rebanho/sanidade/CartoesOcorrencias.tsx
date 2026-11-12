import { type ReactNode } from "react";
import { Button, Empty } from "@/financeiro/financeiro-ui";
import { EstadoSanitario } from "./IndicadoresSanitarios";
import { dataSanitaria } from "./rotulos";
import { hojeSanidade } from "./AgendaSemanal";
export type OcorrenciaVisual = { id: string; animalId: string; inicio: string; fim: string | null; status: string; doenca: { id?: string; nome: string }; desfecho: string | null; _count?: { aplicacoes: number; exames: number; execucoes: number } };
export type ResumoOcorrencias = { abertas: number; encerradas: number; anuladas: number; porDoenca: { id: string; nome: string; quantidade: number }[] };
export function diasOcorrencia(inicio: string, fim: string) { return Math.max(0, Math.round((Date.parse(fim.slice(0,10)) - Date.parse(inicio.slice(0,10))) / 86400000)); }
export function CartoesOcorrencias<T extends OcorrenciaVisual>({ itens, resumo, nomeAnimal, acoes, onAbrir, doencaId, onDoenca }: { itens: T[]; resumo: ResumoOcorrencias | null; nomeAnimal: (id: string) => string; acoes: (o: T) => ReactNode; onAbrir: (o: T) => void; doencaId: string; onDoenca: (id: string) => void }) {
  const maior = Math.max(1,...(resumo?.porDoenca.map(d => d.quantidade) ?? []));
  return <div className="san-ocorrencias-visual san-ocorrencias-operacionais">
    <section className="san-ocorrencias-distribuicao san-ocorrencias-resumo"><header><h2>Casos abertos por doença</h2>{resumo ? <p>{resumo.abertas} {resumo.abertas === 1 ? "ocorrência aberta" : "ocorrências abertas"} no recorte filtrado</p> : <p>Distribuição indisponível.</p>}</header><div className="san-ocorrencias-doencas">{resumo?.porDoenca.map((d,i) => <button type="button" key={`${d.id}-${i}`} aria-pressed={doencaId === d.id} onClick={() => onDoenca(doencaId === d.id ? "" : d.id)}><span>{d.nome}</span><span className="san-doenca-barra"><i style={{width:`${d.quantidade/maior*100}%`}}/></span><strong>{d.quantidade}</strong></button>)}{resumo && !resumo.porDoenca.length && <Empty>Nenhum caso aberto neste recorte.</Empty>}{doencaId && <Button secondary onClick={() => onDoenca("")}>Todas as doenças</Button>}</div></section>
    <div className="san-ocorrencias-cartoes">
      {itens.map(o => {
        const anulada = o.status === "ANULADO";
        const duracao = diasOcorrencia(o.inicio, hojeSanidade());
        const periodo = anulada ? "Registro anulado" : o.fim
          ? `Encerrada em ${dataSanitaria(o.fim)}`
          : `${duracao} ${duracao === 1 ? "dia" : "dias"} em aberto`;
        const fatos = o._count && [
          `${o._count.aplicacoes} ${o._count.aplicacoes === 1 ? "aplicação" : "aplicações"}`,
          `${o._count.exames} ${o._count.exames === 1 ? "exame" : "exames"}`,
          `${o._count.execucoes} ${o._count.execucoes === 1 ? "protocolo" : "protocolos"}`,
        ].join(" · ");

        return <article className="san-ocorrencia-cartao" key={o.id}>
          <header>
            <div>
              <button type="button" className="san-ocorrencia-nome" aria-label={`Acompanhar ${nomeAnimal(o.animalId)}`} onClick={() => onAbrir(o)}>
                {nomeAnimal(o.animalId)}
              </button>
              <h2>{o.doenca.nome}</h2>
            </div>
            <EstadoSanitario tom={anulada ? "neutro" : o.fim ? "verde" : "atencao"}>
              {anulada ? "Anulada" : o.fim ? "Encerrada" : "Aberta"}
            </EstadoSanitario>
          </header>
          <p className="san-ocorrencia-periodo">Início {dataSanitaria(o.inicio)} · {periodo}</p>
          {fatos && <p className="san-ocorrencia-fatos">{fatos}</p>}
          <footer>
            <div className="san-ocorrencia-detalhe">
              <Button secondary onClick={() => onAbrir(o)}>Ver ocorrência</Button>
              {o.fim && o.desfecho && <span className="san-ocorrencia-desfecho">{o.desfecho}</span>}
            </div>
            {acoes(o)}
          </footer>
        </article>;
      })}
    </div>
  </div>;
}
