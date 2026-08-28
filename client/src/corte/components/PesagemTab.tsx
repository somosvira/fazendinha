import { Loader } from "../../components/Loading";
import { useLotes, useRegistrarPesagem } from "../api";
import { LoteDomainView } from "./LoteDomainView";
import { DOMAINS } from "../domains";
import { RebHeader } from "@/rebanho/components/RebHeader";
import { RebMain } from "@/components/rb/RebPrimitives";
import type { ResumoLote, Lote } from "../types";

export function PesagemTab({ onAbrirLote, onPesar }: { onAbrirLote: (id: string) => void; onPesar?: (lote: Lote) => void }) {
  const { data, loading } = useLotes({ estado: "ATIVO" });
  // Fila não guarda o lote isolado por item — contador é global, não por lote.
  const { pendentes } = useRegistrarPesagem();
  if (loading) return <RebMain><RebHeader eyebrow="Pecuária · Lotes coletivos" title="Pesagem" /><Loader /></RebMain>;
  const resumos: ResumoLote[] = data.map((l) => l.resumo ?? ({ loteId: l.id } as ResumoLote));
  // Quando há handler de pesagem, clicar numa linha abre o drawer de registro;
  // caso contrário, cai no comportamento de leitura (abre o cockpit do lote).
  const aoClicar = (id: string) => {
    if (!onPesar) return onAbrirLote(id);
    const l = data.find((x) => x.id === id);
    if (l) onPesar(l);
  };
  const controles = pendentes.length > 0 ? (
    <span className="ml-auto text-[13px] text-atencao">
      {pendentes.length} {pendentes.length > 1 ? "pesagens pendentes" : "pesagem pendente"} de sincronização
    </span>
  ) : undefined;
  return (
    <LoteDomainView
      config={DOMAINS.pesagem}
      resumos={resumos}
      lotes={data}
      onAbrirLote={aoClicar}
      controles={controles}
      dicaLinha={onPesar ? "clique num lote pra registrar uma pesagem" : "clique pra ver histórico de pesagens"}
    />
  );
}
