import { useAnimais } from "../api";
import { HerdDomainView } from "./HerdDomainView";
import { DOMAINS } from "../domains";
import { insightDoRebanho } from "../mock";
import type { ResumoAnimal } from "../types";

export function ReproducaoTab({ onAbrirAnimal }: { onAbrirAnimal: (id: string) => void }) {
  const { data, loading, erro } = useAnimais({ status: "ATIVO" });
  if (loading) return <main className="rb-main"><div className="rb-eyebrow">Rebanho</div><div className="rb-head"><h1>Reprodução</h1></div><p className="rb-sub">Carregando…</p></main>;
  if (erro) return <main className="rb-main"><div className="rb-head"><h1>Reprodução</h1></div><p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {erro}</p></main>;
  const resumos: ResumoAnimal[] = data.map((a) => ({ ...(a.resumo ?? { statusReprodutivo: "VAZIA" }), animalId: a.id }) as ResumoAnimal);
  const nomes = Object.fromEntries(data.map((a) => [a.id, { nome: a.nome, numero: a.numero }]));
  return <HerdDomainView key="reproducao" config={DOMAINS.reproducao} resumos={resumos} insight={insightDoRebanho("reproducao")} nomes={nomes} onAbrirAnimal={onAbrirAnimal} />;
}
