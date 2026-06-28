import { useTalhoes } from "../api";
import { LavouraDomainView } from "./LavouraDomainView";
import { DOMAINS } from "../domains";
import { insightDaLavoura } from "../mock";
import type { ResumoTalhao, Talhao } from "../types";
import { resumos as mockResumos } from "../mock";

export function FitossanidadeTab({ onRegistrarOperacao }: { onRegistrarOperacao: (talhao: Talhao) => void }) {
  const { data, loading, erro } = useTalhoes({ estado: "ATIVO" });
  if (loading) return <main className="rb-main"><div className="rb-eyebrow">Lavoura</div><div className="rb-head"><h1>Fitossanidade</h1></div><p className="rb-sub">Carregando…</p></main>;
  if (erro) return <main className="rb-main"><div className="rb-head"><h1>Fitossanidade</h1></div><p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {erro}</p></main>;
  const resumos: ResumoTalhao[] = data.map((t) => mockResumos.find((x) => x.talhaoId === t.id) ?? ({ talhaoId: t.id, fase: "REPOUSO" } as ResumoTalhao));
  const nomes = Object.fromEntries(data.map((t) => [t.id, { nome: t.nome, codigo: t.codigo }]));
  const abrir = (id: string) => { const t = data.find((x) => x.id === id); if (t) onRegistrarOperacao(t); };
  return <LavouraDomainView
    key="fitossanidade"
    config={DOMAINS.fitossanidade}
    resumos={resumos}
    insight={insightDaLavoura("fitossanidade")}
    nomes={nomes}
    onAbrirTalhao={abrir}
    dicaLinha="clique numa linha pra registrar aplicação/inspeção" />;
}
