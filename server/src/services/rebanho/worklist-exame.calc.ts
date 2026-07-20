// Cálculo puro da work-list "precisa de exame ginecológico". Sinaliza vacas que já deveriam ter
// passado por palpação/US mas não têm exame recente. Determinístico: `hoje` vem do chamador.

export const EXAME_VALIDADE_DIAS = 60; // exame vale por este período; depois, pede um novo

export interface AnimalExame {
  animalId: number;
  statusReprodutivo: string | null; // "VAZIA" | "GESTANTE" | "INSEMINADA" | ...
  del: number | null; // dias em lactação (proxy de pós-parto)
  ultimoExameGinecologico: string | null; // ISO da data do último exame, ou null
}

function diasEntre(deISO: string, ateISO: string): number {
  return Math.round((Date.parse(ateISO) - Date.parse(deISO)) / 86_400_000);
}

// Precisa de exame quando: não está gestante confirmada, já passou do PEV (janela pós-parto para
// voltar a ciclar), e o último exame está ausente ou vencido.
export function precisaExame(a: AnimalExame, pevDias: number, hoje: string): boolean {
  if (a.statusReprodutivo === "GESTANTE") return false;
  if (a.del != null && a.del < pevDias) return false; // ainda no descanso pós-parto
  if (a.ultimoExameGinecologico == null) return true;
  return diasEntre(a.ultimoExameGinecologico, hoje) > EXAME_VALIDADE_DIAS;
}
