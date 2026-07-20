// Cálculo puro da alteração coletiva (bulk) — sem I/O. Valida o patch de mudança em massa.
// Hoje o bulk só muda grupo e/ou setor (campos de maior valor operacional).

export interface PatchBulk {
  grupoId?: number | null;
  setor?: string | null;
}

// Há mudança quando ao menos um campo veio no patch (mesmo que null = "esvaziar").
export function patchTemMudanca(patch: PatchBulk): boolean {
  return patch.grupoId !== undefined || patch.setor !== undefined;
}
