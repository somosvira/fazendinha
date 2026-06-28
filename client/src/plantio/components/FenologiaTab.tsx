import { useTalhoes } from "../api";
import { LavouraDomainView } from "./LavouraDomainView";
import { DOMAINS } from "../domains";
import { insightDaLavoura } from "../mock";
import type { ResumoTalhao } from "../types";
import { resumos as mockResumos } from "../mock";

export function FenologiaTab({ onAbrirTalhao }: { onAbrirTalhao: (id: string) => void }) {
  const { data, loading, erro } = useTalhoes({ estado: "ATIVO" });
  if (loading) return <main className="rb-main"><div className="rb-eyebrow">Lavoura</div><div className="rb-head"><h1>Fenologia</h1></div><p className="rb-sub">Carregando…</p></main>;
  if (erro) return <main className="rb-main"><div className="rb-head"><h1>Fenologia</h1></div><p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {erro}</p></main>;
  const resumos: ResumoTalhao[] = data.map((t) => mockResumos.find((x) => x.talhaoId === t.id) ?? ({ talhaoId: t.id, fase: "REPOUSO" } as ResumoTalhao));
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
