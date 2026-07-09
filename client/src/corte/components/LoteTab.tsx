import { useState } from "react";
import { Loader } from "../../components/Loading";
import { useLotes } from "../api";
import { LoteDomainView, COR_TOOLBAR } from "./LoteDomainView";
import { DOMAINS, CATEGORIAS_ORDEM } from "../domains";
import type { ResumoLote } from "../types";
import { CATEGORIA_LABEL } from "../types";

type EstadoFiltro = "ATIVO" | "VENDIDO" | "TODOS";
const OPCOES: { k: EstadoFiltro; lab: string }[] = [
  { k: "ATIVO", lab: "Ativos" },
  { k: "VENDIDO", lab: "Vendidos" },
  { k: "TODOS", lab: "Todos" },
];

export function LoteTab({ onAbrirLote, onNovo }: { onAbrirLote: (id: string) => void; onNovo: () => void }) {
  const [estado, setEstado] = useState<EstadoFiltro>("ATIVO");
  const [categoria, setCategoria] = useState<string>("");
  const { data, loading } = useLotes({ estado, categoria: categoria || undefined });

  const resumos: ResumoLote[] = data.map((l) => l.resumo ?? ({ loteId: l.id } as ResumoLote));

  const controles = (
    <>
      <div className="rb-seg" style={{ display: "flex", gap: 6 }}>
        {OPCOES.map((o) => (
          <button key={o.k} className="rb-btn" aria-pressed={estado === o.k} onClick={() => setEstado(o.k)}>
            {o.lab}
          </button>
        ))}
      </div>
      <select className="rb-select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
        <option value="">Todas as categorias</option>
        {CATEGORIAS_ORDEM.map((c) => <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>)}
      </select>
      <button className="rb-btn pri" style={{ marginLeft: "auto" }} onClick={onNovo}>+ Novo lote</button>
    </>
  );

  if (loading) {
    return (
      <main className="rb-main">
        <div className="rb-eyebrow">{DOMAINS.lote.eyebrow}</div>
        <div className="rb-head"><h1>Lote</h1></div>
        <div className="rb-toolbar" style={COR_TOOLBAR}>{controles}</div>
        <Loader />
      </main>
    );
  }

  return <LoteDomainView config={DOMAINS.lote} resumos={resumos} lotes={data} onAbrirLote={onAbrirLote} controles={controles} />;
}
