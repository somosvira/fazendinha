import { Loader } from "../../components/Loading";
import { useLotes } from "../api";
import { LoteDomainView } from "./LoteDomainView";
import { DOMAINS } from "../domains";
import type { ResumoLote, Lote } from "../types";

export function PesagemTab({ onAbrirLote, onPesar }: { onAbrirLote: (id: string) => void; onPesar?: (lote: Lote) => void }) {
  const { data, loading } = useLotes({ estado: "ATIVO" });
  if (loading) return <main className="rb-main"><div className="rb-eyebrow">Corte</div><div className="rb-head"><h1>Pesagem</h1></div><Loader /></main>;
  const resumos: ResumoLote[] = data.map((l) => l.resumo ?? ({ loteId: l.id } as ResumoLote));
  // Quando há handler de pesagem, clicar numa linha abre o drawer de registro;
  // caso contrário, cai no comportamento de leitura (abre o cockpit do lote).
  const aoClicar = (id: string) => {
    if (!onPesar) return onAbrirLote(id);
    const l = data.find((x) => x.id === id);
    if (l) onPesar(l);
  };
  return (
    <LoteDomainView
      config={DOMAINS.pesagem}
      resumos={resumos}
      lotes={data}
      onAbrirLote={aoClicar}
      dicaLinha={onPesar ? "clique num lote pra registrar uma pesagem" : "clique pra ver histórico de pesagens"}
    />
  );
}
