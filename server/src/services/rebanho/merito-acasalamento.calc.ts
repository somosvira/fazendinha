export type DirecaoIndicadorAcasalamento = "maior_melhor" | "menor_melhor";

export interface ValorPorIndicador {
  indicadorId: number;
  valor: number | null;
}

export interface TermoMedida {
  indicadorId: number;
  peso: number;
  direcao: DirecaoIndicadorAcasalamento;
  minimo: number | null;
  maximo: number | null;
}

export interface CandidatoMerito {
  id: number;
  valores: ValorPorIndicador[];
}

export interface ResultadoMerito {
  candidatoId: number;
  merito: number;
  indicadoresPontuados: number;
  violacoes: {
    indicadorId: number;
    tipo: "minimo" | "maximo";
    limite: number;
    valor: number;
  }[];
}

function mesmaConfiguracao(a: TermoMedida, b: TermoMedida): boolean {
  return (
    a.direcao === b.direcao &&
    a.minimo === b.minimo &&
    a.maximo === b.maximo
  );
}

function consolidarTermos(termos: readonly TermoMedida[]): TermoMedida[] {
  const consolidados: TermoMedida[] = [];
  const porIndicador = new Map<number, TermoMedida>();

  for (const termo of termos) {
    if (!Number.isFinite(termo.peso) || termo.peso <= 0) continue;

    const existente = porIndicador.get(termo.indicadorId);
    if (!existente) {
      const consolidado = { ...termo };
      consolidados.push(consolidado);
      porIndicador.set(termo.indicadorId, consolidado);
      continue;
    }

    if (!mesmaConfiguracao(existente, termo)) {
      throw new Error(
        `configuração conflitante para o indicador ${termo.indicadorId}`,
      );
    }

    existente.peso += termo.peso;
  }

  return consolidados;
}

function valorFinito(
  candidato: CandidatoMerito,
  indicadorId: number,
): number | null {
  const encontrado = candidato.valores.find(
    ({ indicadorId: id, valor }) =>
      id === indicadorId && valor !== null && Number.isFinite(valor),
  );
  return encontrado?.valor ?? null;
}

function arredondarSeisCasas(valor: number): number {
  return Math.round(valor * 1_000_000) / 1_000_000;
}

export function calcularMeritos(
  candidatos: readonly CandidatoMerito[],
  termos: readonly TermoMedida[],
): ResultadoMerito[] {
  const consolidados = consolidarTermos(termos);
  const extremos = new Map<number, { minimo: number; maximo: number }>();

  for (const termo of consolidados) {
    const valores = candidatos
      .map((candidato) => valorFinito(candidato, termo.indicadorId))
      .filter((valor): valor is number => valor !== null);

    if (valores.length > 0) {
      extremos.set(termo.indicadorId, {
        minimo: Math.min(...valores),
        maximo: Math.max(...valores),
      });
    }
  }

  return candidatos.map((candidato) => {
    let somaPonderada = 0;
    let somaPesos = 0;
    let indicadoresPontuados = 0;
    const violacoes: ResultadoMerito["violacoes"] = [];

    for (const termo of consolidados) {
      const valor = valorFinito(candidato, termo.indicadorId);
      const faixa = extremos.get(termo.indicadorId);
      if (valor === null || !faixa) continue;

      let normalizado = 0.5;
      if (faixa.minimo !== faixa.maximo) {
        normalizado =
          termo.direcao === "maior_melhor"
            ? (valor - faixa.minimo) / (faixa.maximo - faixa.minimo)
            : (faixa.maximo - valor) / (faixa.maximo - faixa.minimo);
      }

      somaPonderada += normalizado * termo.peso;
      somaPesos += termo.peso;
      indicadoresPontuados += 1;

      if (termo.minimo !== null && valor < termo.minimo) {
        violacoes.push({
          indicadorId: termo.indicadorId,
          tipo: "minimo",
          limite: termo.minimo,
          valor,
        });
      }
      if (termo.maximo !== null && valor > termo.maximo) {
        violacoes.push({
          indicadorId: termo.indicadorId,
          tipo: "maximo",
          limite: termo.maximo,
          valor,
        });
      }
    }

    return {
      candidatoId: candidato.id,
      merito:
        somaPesos === 0 ? 0 : arredondarSeisCasas(somaPonderada / somaPesos),
      indicadoresPontuados,
      violacoes,
    };
  });
}
