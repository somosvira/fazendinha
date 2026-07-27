export interface Ancestral {
  chave: string;
  grau: number;
}

export interface Genealogia {
  ancestrais: Ancestral[];
  profundidade: number;
  paiConhecido: boolean;
}

export function normalizarChaveGenealogica(
  valor: string | null | undefined,
): string {
  return (valor ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s/g, "");
}

function somarGrausValidos(ancestrais: Ancestral[]): Map<string, number> {
  const grausPorChave = new Map<string, number>();

  for (const ancestral of ancestrais) {
    const chave = normalizarChaveGenealogica(ancestral.chave);
    if (!chave || !Number.isFinite(ancestral.grau) || ancestral.grau <= 0) {
      continue;
    }

    grausPorChave.set(
      chave,
      (grausPorChave.get(chave) ?? 0) + ancestral.grau,
    );
  }

  return grausPorChave;
}

export function coeficienteParentesco(
  femea: Genealogia,
  touro: Genealogia,
): number {
  const grausFemea = somarGrausValidos(femea.ancestrais);
  const grausTouro = somarGrausValidos(touro.ancestrais);
  let coeficiente = 0;

  for (const [chave, grauFemea] of grausFemea) {
    const grauTouro = grausTouro.get(chave);
    if (grauTouro !== undefined) {
      coeficiente += grauFemea * grauTouro;
    }
  }

  const limitado = Math.min(1, Math.max(0, coeficiente));
  return Math.round(limitado * 1_000_000) / 1_000_000;
}

export function pedigreeVerificavel(
  femea: Genealogia,
  touro: Genealogia,
): boolean {
  return [femea, touro].every(
    (genealogia) =>
      genealogia.paiConhecido === true &&
      genealogia.profundidade >= 1 &&
      somarGrausValidos(genealogia.ancestrais).size > 0,
  );
}
