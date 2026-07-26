// Regra pura da aptidão de novilhas (frmAptidaoAutomatica do IDEAGRI): novilha entra em
// reprodução quando atinge idade e peso mínimos. Determinístico: `hoje` vem do chamador.

export interface NovilhaAptidao {
  animalId: number;
  numero: string;
  categoria: string;
  dataNascimento: string | null;
  ultimoPesoKg: number | null;
}

export interface CriterioAptidao {
  idadeMinMeses: number;
  pesoMinKg: number;
}

export interface AvaliacaoAptidao {
  animalId: number;
  numero: string;
  apta: boolean;
  motivo: string;
}

const MS_MES = 30.436875 * 86_400_000;

function idadeMeses(dataNascimento: string, hoje: string): number {
  return (Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${dataNascimento}T00:00:00Z`)) / MS_MES;
}

export function avaliarAptidao(
  novilha: NovilhaAptidao,
  criterio: CriterioAptidao,
  hoje: string,
): AvaliacaoAptidao {
  const faltas: string[] = [];

  const idadeOk = novilha.dataNascimento != null
    && idadeMeses(novilha.dataNascimento, hoje) >= criterio.idadeMinMeses;
  if (!idadeOk) {
    faltas.push(novilha.dataNascimento == null
      ? "idade desconhecida (sem data de nascimento)"
      : `idade abaixo de ${criterio.idadeMinMeses} meses`);
  }

  const pesoOk = novilha.ultimoPesoKg != null && novilha.ultimoPesoKg >= criterio.pesoMinKg;
  if (!pesoOk) {
    faltas.push(novilha.ultimoPesoKg == null
      ? "peso desconhecido (sem pesagem)"
      : `peso abaixo de ${criterio.pesoMinKg} kg`);
  }

  return {
    animalId: novilha.animalId,
    numero: novilha.numero,
    apta: faltas.length === 0,
    motivo: faltas.length === 0
      ? `Atinge idade (${criterio.idadeMinMeses}m) e peso (${criterio.pesoMinKg}kg) mínimos.`
      : faltas.join(" · "),
  };
}

/** Só as novilhas aptas, ordenadas por número (mesma ordenação do rebanho). */
export function listarAptas(
  novilhas: readonly NovilhaAptidao[],
  criterio: CriterioAptidao,
  hoje: string,
): AvaliacaoAptidao[] {
  return novilhas
    .filter((n) => n.categoria === "NOVILHA")
    .map((n) => avaliarAptidao(n, criterio, hoje))
    .filter((a) => a.apta)
    .sort((a, b) => a.numero.localeCompare(b.numero, "pt-BR", { numeric: true }) || a.animalId - b.animalId);
}
