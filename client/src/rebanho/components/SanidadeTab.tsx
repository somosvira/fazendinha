import { Loader } from "../../components/Loading";
import { useAnimais, type ChaveWorklistRebanho, type WorklistRebanho } from "../api";
import { HerdDomainView } from "./HerdDomainView";
import { WorklistCanonica, type AcaoItemWorklist } from "./WorklistCanonica";
import { RebHeader } from "./RebHeader";
import { RebMain } from "@/components/rb/RebPrimitives";
import { DOMAINS } from "../domains";
import { insightDoRebanho } from "../mock";
import { ProtocolosSanitarios } from "./ProtocolosSanitarios";
import type { Animal, ResumoAnimal } from "../types";

export function SanidadeTab({ onRegistrarEvento, onRegistrarWorklist, onAbrirFicha, worklistChave, worklistSnapshot }: { onRegistrarEvento: (animal: Animal) => void; onRegistrarWorklist: (acao: AcaoItemWorklist) => void; onAbrirFicha: (id: string) => void; worklistChave?: ChaveWorklistRebanho; worklistSnapshot?: WorklistRebanho }) {
  const { data, loading, erro } = useAnimais({ status: "ATIVO" });
  if (worklistChave === "ccs-alta" || worklistChave === "carencia") return <WorklistCanonica chave={worklistChave} snapshot={worklistSnapshot} onAcao={onRegistrarWorklist} onAbrirFicha={onAbrirFicha} />;
  if (loading) return <RebMain><RebHeader eyebrow="Rebanho" title="Sanidade" /><Loader /></RebMain>;
  if (erro) return <RebMain><RebHeader title="Sanidade" /><p className="mt-[7px] text-sm text-prejuizo">Erro: {erro}</p></RebMain>;
  const resumos: ResumoAnimal[] = data.map((a) => ({ ...(a.resumo ?? { statusReprodutivo: "VAZIA" }), animalId: a.id }) as ResumoAnimal);
  const nomes = Object.fromEntries(data.map((a) => [a.id, { nome: a.nome, numero: a.numero }]));
  // Idem Reprodução: clicar no animal abre a modal travada em "sanidade".
  const abrirRegistro = (id: string) => {
    const animal = data.find((a) => a.id === id);
    if (animal) onRegistrarEvento(animal);
  };
  return <HerdDomainView key="sanidade" config={DOMAINS.sanidade} resumos={resumos} insight={insightDoRebanho("sanidade")} nomes={nomes} onAbrirAnimal={abrirRegistro} dicaLinha="clique numa linha pra registrar evento de sanidade" topo={<ProtocolosSanitarios />} />;
}
