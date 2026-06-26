import { useAnimais } from "../api";
import { HerdDomainView } from "./HerdDomainView";
import { DOMAINS } from "../domains";
import { insightDoRebanho } from "../mock";
import type { Animal, ResumoAnimal } from "../types";

export function ReproducaoTab({ onRegistrarEvento }: { onRegistrarEvento: (animal: Animal) => void }) {
  const { data, loading, erro } = useAnimais({ status: "ATIVO" });
  if (loading) return <main className="rb-main"><div className="rb-eyebrow">Rebanho</div><div className="rb-head"><h1>Reprodução</h1></div><p className="rb-sub">Carregando…</p></main>;
  if (erro) return <main className="rb-main"><div className="rb-head"><h1>Reprodução</h1></div><p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {erro}</p></main>;
  const resumos: ResumoAnimal[] = data.map((a) => ({ ...(a.resumo ?? { statusReprodutivo: "VAZIA" }), animalId: a.id }) as ResumoAnimal);
  const nomes = Object.fromEntries(data.map((a) => [a.id, { nome: a.nome, numero: a.numero }]));
  // Clicar no animal abre direto a modal de registro travada em "reprodução" —
  // o cockpit completo só aparece depois que o evento for salvo (fluxo definido em RebanhoContent).
  const abrirRegistro = (id: string) => {
    const animal = data.find((a) => a.id === id);
    if (animal) onRegistrarEvento(animal);
  };
  return <HerdDomainView key="reproducao" config={DOMAINS.reproducao} resumos={resumos} insight={insightDoRebanho("reproducao")} nomes={nomes} onAbrirAnimal={abrirRegistro} dicaLinha="clique numa linha pra registrar evento de reprodução" />;
}
