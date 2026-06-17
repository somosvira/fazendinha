import { useState } from "react";
import { useAnimais, useSetores } from "../api";
import { HerdDomainView } from "./HerdDomainView";
import { DOMAINS } from "../domains";
import type { ResumoAnimal } from "../types";

type StatusFiltro = "ATIVO" | "BAIXADO" | "TODOS";
const OPCOES: { k: StatusFiltro; lab: string }[] = [
  { k: "ATIVO", lab: "Ativos" },
  { k: "BAIXADO", lab: "Baixados" },
  { k: "TODOS", lab: "Todos" },
];

export function AnimalTab({ onAbrirAnimal, onNovo }: { onAbrirAnimal: (id: string) => void; onNovo: () => void }) {
  const [status, setStatus] = useState<StatusFiltro>("ATIVO");
  const [setor, setSetor] = useState<string>("");
  const { data, loading, erro } = useAnimais({ status, setor: setor || undefined });
  const { data: setores } = useSetores();

  // ResumoAnimal[] que o HerdDomainView consome — cada animal traz seu resumo embutido.
  const resumos: ResumoAnimal[] = data.map((a) => ({ ...(a.resumo ?? { statusReprodutivo: "VAZIA" }), animalId: a.id }) as ResumoAnimal);
  // Para baixados, anexa data/motivo da baixa ao nome (espelha o Ideagri).
  const nomes = Object.fromEntries(
    data.map((a) => [
      a.id,
      {
        nome: a.ativo
          ? (a.nome ?? "")
          : `${a.nome ?? ""} · baixa ${a.dataBaixa ?? ""}${a.motivoBaixa ? ` (${a.motivoBaixa})` : ""}`.trim(),
        numero: a.numero,
      },
    ]),
  );

  return (
    <div style={{ position: "relative" }}>
      {/* Filtro de status — sempre visível, espelha "Baixado: Não/Sim/Todos" do Ideagri */}
      <div className="rb-seg" style={{ position: "absolute", left: 40, top: 30, zIndex: 2, display: "flex", gap: 6 }}>
        {OPCOES.map((o) => (
          <button key={o.k} className="rb-btn" aria-pressed={status === o.k} onClick={() => setStatus(o.k)}>
            {o.lab}
          </button>
        ))}
      </div>
      <select className="rb-select" value={setor} onChange={(e) => setSetor(e.target.value)} style={{ position: "absolute", left: 220, top: 30, zIndex: 2 }}>
        <option value="">Todos os setores</option>
        {(setores ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <button className="rb-btn pri" style={{ position: "absolute", right: 40, top: 30, zIndex: 2 }} onClick={onNovo}>
        + Novo animal
      </button>

      {loading ? (
        <main className="rb-main"><div className="rb-eyebrow">Rebanho</div><div className="rb-head"><h1>Animal</h1></div><p className="rb-sub">Carregando…</p></main>
      ) : erro ? (
        <main className="rb-main"><div className="rb-head"><h1>Animal</h1></div><p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {erro}</p></main>
      ) : (
        <HerdDomainView config={DOMAINS.animal} resumos={resumos} onAbrirAnimal={onAbrirAnimal} nomes={nomes} />
      )}
    </div>
  );
}
