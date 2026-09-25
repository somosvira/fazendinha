import { useState } from "react";
import { Loader } from "../../components/Loading";
import { useTalhoes } from "../api";
import { LavouraDomainView, PLA_TOOLBAR } from "./LavouraDomainView";
import { RebHeader } from "@/components/rb/RebHeader";
import { RebButton } from "@/components/rb/RebButton";
import { RebMain } from "@/components/rb/RebPrimitives";
import { DOMAINS } from "../domains";
import type { ResumoTalhao } from "../types";
import { ToolbarSelect } from "@/components/ToolbarSelect";

type EstadoFiltro = "ATIVO" | "FORMACAO" | "BAIXADO" | "TODOS";
const OPCOES: { k: EstadoFiltro; lab: string }[] = [
  { k: "ATIVO", lab: "Ativos" },
  { k: "FORMACAO", lab: "Em formação" },
  { k: "BAIXADO", lab: "Baixados" },
  { k: "TODOS", lab: "Todos" },
];

export function TalhaoTab({ onAbrirTalhao, onNovo }: { onAbrirTalhao: (id: string) => void; onNovo: () => void }) {
  const [estado, setEstado] = useState<EstadoFiltro>("ATIVO");
  const [lavoura, setLavoura] = useState<string>("");
  const { data, loading, erro } = useTalhoes({ estado, lavoura: lavoura || undefined });

  // O backend entrega o resumo embutido em cada talhão (/api/plantio/talhoes).
  const resumos: ResumoTalhao[] = data.map(
    (t) => t.resumo ?? ({ talhaoId: t.id, fase: "REPOUSO" } as ResumoTalhao),
  );
  const nomes = Object.fromEntries(data.map((t) => [
    t.id,
    {
      nome: t.estado === "BAIXADO"
        ? `${t.nome} · baixado`
        : t.nome,
      codigo: t.codigo,
    },
  ]));
  const lavouras = Array.from(new Set(data.map((t) => t.lavoura))).sort();

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
        value={lavoura}
        onChange={setLavoura}
        ariaLabel="Filtrar por lavoura"
        options={[{ value: "", label: "Todas as lavouras" }, ...lavouras.map((l) => ({ value: l, label: l }))]}
      />
      <RebButton variant="pri" className="ml-auto" onClick={onNovo}>+ Novo talhão</RebButton>
    </>
  );

  if (loading || erro) {
    return (
      <RebMain>
        <RebHeader eyebrow={DOMAINS.talhao.eyebrow} title="Talhão" />
        <div className={PLA_TOOLBAR}>{controles}</div>
        {loading
          ? <Loader />
          : <p className="text-sm text-prejuizo">Erro: {erro}</p>}
      </RebMain>
    );
  }

  return <LavouraDomainView config={DOMAINS.talhao} resumos={resumos} onAbrirTalhao={onAbrirTalhao} nomes={nomes} controles={controles} />;
}
