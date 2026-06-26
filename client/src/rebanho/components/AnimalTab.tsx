import { useState } from "react";
import { useAnimais, useSetores } from "../api";
import { HerdDomainView, RB_TOOLBAR } from "./HerdDomainView";
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

  // Controles (filtro de status + setor + novo) — renderizados na toolbar do header
  // (em fluxo normal, sem sobrepor o cabeçalho). Espelha o filtro do Ideagri.
  const controles = (
    <>
      <div className="rb-seg" style={{ display: "flex", gap: 6 }}>
        {OPCOES.map((o) => (
          <button key={o.k} className="rb-btn" aria-pressed={status === o.k} onClick={() => setStatus(o.k)}>
            {o.lab}
          </button>
        ))}
      </div>
      <select className="rb-select" value={setor} onChange={(e) => setSetor(e.target.value)}>
        <option value="">Todos os setores</option>
        {(setores ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <button className="rb-btn pri" style={{ marginLeft: "auto" }} onClick={onNovo}>+ Novo animal</button>
    </>
  );

  if (loading || erro) {
    return (
      <main className="rb-main">
        <div className="rb-eyebrow">{DOMAINS.animal.eyebrow}</div>
        <div className="rb-head"><h1>Animal</h1></div>
        <div className="rb-toolbar" style={RB_TOOLBAR}>{controles}</div>
        {loading
          ? <p className="rb-sub">Carregando…</p>
          : <p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {erro}</p>}
      </main>
    );
  }

  return <HerdDomainView config={DOMAINS.animal} resumos={resumos} onAbrirAnimal={onAbrirAnimal} nomes={nomes} controles={controles} />;
}
