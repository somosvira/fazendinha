import { useLotes } from "../api";
import { LoteDomainView } from "./LoteDomainView";
import { DOMAINS } from "../domains";
import type { ResumoLote } from "../types";

export function PesagemTab({ onAbrirLote }: { onAbrirLote: (id: string) => void }) {
  const { data, loading } = useLotes({ estado: "ATIVO" });
  if (loading) return <main className="rb-main"><div className="rb-eyebrow">Corte</div><div className="rb-head"><h1>Pesagem</h1></div><p className="rb-sub">Carregando…</p></main>;
  const resumos: ResumoLote[] = data.map((l) => l.resumo ?? ({ loteId: l.id } as ResumoLote));
  return <LoteDomainView config={DOMAINS.pesagem} resumos={resumos} lotes={data} onAbrirLote={onAbrirLote} dicaLinha="clique pra ver histórico de pesagens" />;
}
