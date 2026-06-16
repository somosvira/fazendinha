import { useState, useCallback } from "react";

export type RebanhoTab = "dashboard" | "animal" | "reproducao" | "sanidade" | "nutricao" | "ia";

export interface RebanhoNav {
  tab: RebanhoTab;
  animalId: string | null;     // quando setado, mostra a ficha-cockpit
  irPara: (tab: RebanhoTab) => void;
  abrirAnimal: (id: string) => void;
  voltarAoRebanho: () => void;
}

export function useRebanhoNav(): RebanhoNav {
  const [tab, setTab] = useState<RebanhoTab>("reproducao");
  const [animalId, setAnimalId] = useState<string | null>(null);
  const irPara = useCallback((t: RebanhoTab) => { setTab(t); setAnimalId(null); }, []);
  const abrirAnimal = useCallback((id: string) => setAnimalId(id), []);
  const voltarAoRebanho = useCallback(() => setAnimalId(null), []);
  return { tab, animalId, irPara, abrirAnimal, voltarAoRebanho };
}
