import { Loader } from "../../components/Loading";
import { useAnimais } from "../api";
import { HerdDomainView } from "./HerdDomainView";
import { RebHeader } from "./RebHeader";
import { DOMAINS } from "../domains";
import { insightDoRebanho } from "../mock";
import type { Animal, ResumoAnimal } from "../types";

export function SanidadeTab({ onRegistrarEvento }: { onRegistrarEvento: (animal: Animal) => void }) {
  const { data, loading, erro } = useAnimais({ status: "ATIVO" });
  if (loading) return <main className="rb-main"><RebHeader eyebrow="Rebanho" title="Sanidade" /><Loader /></main>;
  if (erro) return <main className="rb-main"><RebHeader title="Sanidade" /><p className="mt-[7px] text-sm text-prejuizo">Erro: {erro}</p></main>;
  const resumos: ResumoAnimal[] = data.map((a) => ({ ...(a.resumo ?? { statusReprodutivo: "VAZIA" }), animalId: a.id }) as ResumoAnimal);
  const nomes = Object.fromEntries(data.map((a) => [a.id, { nome: a.nome, numero: a.numero }]));
  // Idem Reprodução: clicar no animal abre a modal travada em "sanidade".
  const abrirRegistro = (id: string) => {
    const animal = data.find((a) => a.id === id);
    if (animal) onRegistrarEvento(animal);
  };
  return <HerdDomainView key="sanidade" config={DOMAINS.sanidade} resumos={resumos} insight={insightDoRebanho("sanidade")} nomes={nomes} onAbrirAnimal={abrirRegistro} dicaLinha="clique numa linha pra registrar evento de sanidade" />;
}
