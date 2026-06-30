import { useState } from "react";
import { useTalhoes } from "../api";
import { LavouraDomainView, PLA_TOOLBAR } from "./LavouraDomainView";
import { DOMAINS } from "../domains";
import type { ResumoTalhao } from "../types";

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
      <div className="rb-seg" style={{ display: "flex", gap: 6 }}>
        {OPCOES.map((o) => (
          <button key={o.k} className="rb-btn" aria-pressed={estado === o.k} onClick={() => setEstado(o.k)}>
            {o.lab}
          </button>
        ))}
      </div>
      <select className="rb-select" value={lavoura} onChange={(e) => setLavoura(e.target.value)}>
        <option value="">Todas as lavouras</option>
        {lavouras.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>
      <button className="rb-btn pri" style={{ marginLeft: "auto" }} onClick={onNovo}>+ Novo talhão</button>
    </>
  );

  if (loading || erro) {
    return (
      <main className="rb-main">
        <div className="rb-eyebrow">{DOMAINS.talhao.eyebrow}</div>
        <div className="rb-head"><h1>Talhão</h1></div>
        <div className="rb-toolbar" style={PLA_TOOLBAR}>{controles}</div>
        {loading
          ? <p className="rb-sub">Carregando…</p>
          : <p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {erro}</p>}
      </main>
    );
  }

  return <LavouraDomainView config={DOMAINS.talhao} resumos={resumos} onAbrirTalhao={onAbrirTalhao} nomes={nomes} controles={controles} />;
}
