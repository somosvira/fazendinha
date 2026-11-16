import { useEffect, useState } from "react";
import { Skeleton } from "../components/ui/skeleton";
import { consultarRadar, type PrioridadeRadar } from "./radar-api";

export const ROTULO_URGENCIA = { atrasado: "Atrasado", hoje: "Hoje", semana: "Esta semana", depois: "Próximos dias" } as const;

/** As três primeiras prioridades do Radar ao lado da conversa, ligando as duas abas. */
export function HojeNaFazenda({ propriedadeId, onVerRadar, onPerguntar }: { propriedadeId: number | null; onVerRadar: () => void; onPerguntar: (pergunta: string) => void }) {
  const [prioridades, setPrioridades] = useState<PrioridadeRadar[] | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    const controle = new AbortController();
    setPrioridades(null); setErro(false);
    consultarRadar(false, controle.signal)
      .then((r) => { if (!controle.signal.aborted) setPrioridades(r.prioridades.slice(0, 3)); })
      .catch(() => { if (!controle.signal.aborted) setErro(true); });
    return () => controle.abort();
  }, [propriedadeId]);
  return <aside className="ia-hoje" aria-label="Hoje na fazenda">
    <h2>Hoje na fazenda</h2>
    <p className="ia-hoje-data">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })} · do Radar</p>
    {prioridades === null && !erro ? <div role="status" aria-label="Carregando prioridades" className="ia-hoje-esqueleto">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      : erro ? <p className="ia-hoje-vazio">Não foi possível ler o Radar agora.</p>
      : !prioridades!.length ? <p className="ia-hoje-vazio">Nenhuma prioridade registrada para hoje.</p>
      : <ol>{prioridades!.map((p) => <li key={p.id} className={p.urgencia}>
          <span className="ia-hoje-urgencia">{p.prazo ?? (p.urgencia ? ROTULO_URGENCIA[p.urgencia] : "Prioridade")}</span>
          <button type="button" onClick={() => onPerguntar(p.pergunta)} title="Perguntar à IA">{p.titulo}</button>
          <span>{p.descricao}</span>
        </li>)}</ol>}
    <button type="button" className="ia-hoje-radar" onClick={onVerRadar}>Ver o Radar completo</button>
  </aside>;
}
