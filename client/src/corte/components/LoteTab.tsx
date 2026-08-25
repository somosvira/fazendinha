import { useState } from "react";
import { Loader } from "../../components/Loading";
import { useLotes } from "../api";
import { LoteDomainView, COR_TOOLBAR } from "./LoteDomainView";
import { DOMAINS, CATEGORIAS_ORDEM } from "../domains";
import type { ResumoLote } from "../types";
import { CATEGORIA_LABEL } from "../types";
import { ToolbarSelect } from "@/components/ToolbarSelect";
import { RebHeader } from "@/rebanho/components/RebHeader";
import { RebButton } from "@/components/rb/RebButton";
import { RebMain } from "@/components/rb/RebPrimitives";

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
      <div className="flex gap-1.5">
        {OPCOES.map((o) => (
          <RebButton key={o.k} aria-pressed={estado === o.k} onClick={() => setEstado(o.k)}>
            {o.lab}
          </RebButton>
        ))}
      </div>
      <ToolbarSelect
        value={categoria}
        onChange={setCategoria}
        ariaLabel="Filtrar por categoria"
        options={[{ value: "", label: "Todas as categorias" }, ...CATEGORIAS_ORDEM.map((c) => ({ value: c, label: CATEGORIA_LABEL[c] }))]}
      />
      <RebButton variant="pri" className="ml-auto" onClick={onNovo}>+ Novo lote</RebButton>
    </>
  );

  if (loading) {
    return (
      <RebMain>
        <RebHeader eyebrow={DOMAINS.lote.eyebrow} title="Lotes coletivos" />
        <div className={COR_TOOLBAR}>{controles}</div>
        <Loader />
      </RebMain>
    );
  }

  return <LoteDomainView config={DOMAINS.lote} resumos={resumos} lotes={data} onAbrirLote={onAbrirLote} controles={controles} />;
}
