import {
  normalizarChaveGenealogica,
  type Ancestral,
  type Genealogia,
} from "./parentesco.calc.js";

export interface AnimalGenealogia {
  paiNome: string | null;
  pai: {
    nome: string | null;
    numero: string;
    paiNome: string | null;
    mae: { nome: string | null; numero: string } | null;
  } | null;
  mae: {
    nome: string | null;
    numero: string;
    paiNome: string | null;
    mae: { nome: string | null; numero: string } | null;
  } | null;
}

export interface PedigreeGenealogia {
  paiNome: string | null;
  paiCodigo: string | null;
  maeNome: string | null;
  maeCodigo: string | null;
  avoMaternoNome: string | null;
  avoMaternoCodigo: string | null;
  avoPaternoNome: string | null;
  avoPaternoCodigo: string | null;
}

function primeiraChave(
  ...opcoes: (string | null | undefined)[]
): string | null {
  return opcoes.find((opcao) => normalizarChaveGenealogica(opcao) !== "") ?? null;
}

function adicionar(
  ancestrais: Ancestral[],
  grau: number,
  ...opcoes: (string | null | undefined)[]
): boolean {
  const chave = primeiraChave(...opcoes);
  if (chave === null) return false;
  ancestrais.push({ chave, grau });
  return true;
}

function adicionarAliases(
  ancestrais: Ancestral[],
  grau: number,
  ...opcoes: (string | null | undefined)[]
): boolean {
  const normalizadas = new Set<string>();
  let adicionou = false;

  for (const chave of opcoes) {
    const normalizada = normalizarChaveGenealogica(chave);
    if (!chave || !normalizada || normalizadas.has(normalizada)) continue;
    ancestrais.push({ chave, grau });
    normalizadas.add(normalizada);
    adicionou = true;
  }

  return adicionou;
}

export function genealogiaDaFemea(animal: AnimalGenealogia): Genealogia {
  const ancestrais: Ancestral[] = [];
  const temPai = adicionar(
    ancestrais,
    0.5,
    animal.pai?.numero,
    animal.pai?.nome,
    animal.paiNome,
  );
  const temMae = adicionar(
    ancestrais,
    0.5,
    animal.mae?.numero,
    animal.mae?.nome,
  );
  const temAvoPaterno = adicionar(ancestrais, 0.25, animal.pai?.paiNome);
  const temAvoPaterna = adicionar(
    ancestrais,
    0.25,
    animal.pai?.mae?.numero,
    animal.pai?.mae?.nome,
  );
  const temAvoMaterno = adicionar(ancestrais, 0.25, animal.mae?.paiNome);
  const temAvoMaterna = adicionar(
    ancestrais,
    0.25,
    animal.mae?.mae?.numero,
    animal.mae?.mae?.nome,
  );

  return {
    ancestrais,
    profundidade:
      temAvoPaterno || temAvoPaterna || temAvoMaterno || temAvoMaterna
        ? 2
        : temPai || temMae
          ? 1
          : 0,
    paiConhecido:
      animal.pai !== null || normalizarChaveGenealogica(animal.paiNome) !== "",
  };
}

export function genealogiaDoTouro(
  pedigree: PedigreeGenealogia | null,
  nomeFallback: string | null,
  codigoFallback: string | null,
): Genealogia {
  const ancestrais: Ancestral[] = [];
  const touroIdentificavel = adicionarAliases(
    ancestrais,
    1,
    codigoFallback,
    nomeFallback,
  );
  const temPai = adicionar(
    ancestrais,
    0.5,
    pedigree?.paiCodigo,
    pedigree?.paiNome,
  );
  const temMae = adicionar(
    ancestrais,
    0.5,
    pedigree?.maeCodigo,
    pedigree?.maeNome,
  );
  const temAvoMaterno = adicionar(
    ancestrais,
    0.25,
    pedigree?.avoMaternoCodigo,
    pedigree?.avoMaternoNome,
  );
  const temAvoPaterno = adicionar(
    ancestrais,
    0.25,
    pedigree?.avoPaternoCodigo,
    pedigree?.avoPaternoNome,
  );

  return {
    ancestrais,
    profundidade: temAvoMaterno || temAvoPaterno ? 2 : temPai || temMae ? 1 : 0,
    paiConhecido: touroIdentificavel && temPai,
  };
}
