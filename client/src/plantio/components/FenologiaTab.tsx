import { useTalhoes } from "../api";
import { LavouraDomainView } from "./LavouraDomainView";
import { DOMAINS } from "../domains";
import { insightDaLavoura } from "../mock";
import type { ResumoTalhao } from "../types";

export function FenologiaTab({ onAbrirTalhao }: { onAbrirTalhao: (id: string) => void }) {
  const { data, loading, erro } = useTalhoes({ estado: "ATIVO" });
  if (loading) return <main className="rb-main"><div className="rb-eyebrow">Lavoura</div><div className="rb-head"><h1>Fenologia</h1></div><p className="rb-sub">Carregando…</p></main>;
  if (erro) return <main className="rb-main"><div className="rb-head"><h1>Fenologia</h1></div><p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {erro}</p></main>;
  // Resumo real embutido em cada talhão (.resumo). Talhão recém-criado pode vir
  // sem resumo → filtramos pra não quebrar a view.
  const resumos: ResumoTalhao[] = data.map((t) => t.resumo).filter(Boolean) as ResumoTalhao[];
  const nomes = Object.fromEntries(data.map((t) => [t.id, { nome: t.nome, codigo: t.codigo }]));
  return <LavouraDomainView
    key="fenologia"
    config={DOMAINS.fenologia}
    resumos={resumos}
    insight={insightDaLavoura("fenologia")}
    nomes={nomes}
    onAbrirTalhao={onAbrirTalhao}
    dicaLinha="clique num talhão pra ver a timeline editorial" />;
}
