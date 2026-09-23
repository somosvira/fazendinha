// Filtro local (busca por brinco/nome) para complementar os filtros feitos no servidor.
import type { AnimalResumo } from "../types";

export function filtrarLocal(animais: AnimalResumo[], busca: string): AnimalResumo[] {
  const termo = busca.trim().toLowerCase();
  if (!termo) return animais;
  return animais.filter(
    (a) => a.brinco.toLowerCase().includes(termo) || (a.nome ?? "").toLowerCase().includes(termo),
  );
}
