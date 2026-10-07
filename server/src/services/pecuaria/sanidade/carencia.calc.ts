export type AplicacaoCarencia = {
  aplicadaEm: Date | null;
  data: Date;
  precisaoTemporal: string;
  carenciaLeiteHoras: number | null;
  carenciaCarneHoras: number | null;
  estadoCarenciaLeite?: string;
  estadoCarenciaCarne?: string;
};

export type PrazoCarencia =
  | { estado: "NENHUMA" }
  | { estado: "NAO_INFORMADO" }
  | { estado: "NAO_APLICAVEL" }
  | { estado: "CONHECIDO"; ate: Date; precisaoAproximada: boolean; prazoZero?: boolean };

function baseDaAplicacao(a: AplicacaoCarencia): Date {
  if (a.precisaoTemporal === "HORA" && a.aplicadaEm) return a.aplicadaEm;
  // Registro histórico com apenas data: o fim do dia local é uma aproximação
  // conservadora, nunca um horário de aplicação inventado.
  const dia = a.data.toISOString().slice(0, 10);
  return new Date(`${dia}T23:59:59-03:00`);
}

export function calcularPrazoCarencia(
  aplicacoes: AplicacaoCarencia[],
  destino: "LEITE" | "CARNE",
): PrazoCarencia {
  if (!aplicacoes.length) return { estado: "NENHUMA" };
  const chave = destino === "LEITE" ? "carenciaLeiteHoras" : "carenciaCarneHoras";
  const chaveEstado = destino === "LEITE" ? "estadoCarenciaLeite" : "estadoCarenciaCarne";
  const relevantes = aplicacoes.filter((a) => a[chaveEstado] !== "NAO_APLICAVEL");
  if (!relevantes.length) return { estado: "NAO_APLICAVEL" };
  if (relevantes.some((a) => a[chaveEstado] === "NAO_INFORMADO" || a[chave] == null)) return { estado: "NAO_INFORMADO" };
  let maior = new Date(0);
  let aproximada = false;
  for (const a of relevantes) {
    const fim = new Date(baseDaAplicacao(a).getTime() + a[chave]! * 3_600_000);
    if (fim.getTime() > maior.getTime()) {
      maior = fim;
      aproximada = a.precisaoTemporal !== "HORA";
    }
  }
  return { estado: "CONHECIDO", ate: maior, precisaoAproximada: aproximada, ...(relevantes.every((a) => a[chave] === 0) ? { prazoZero: true } : {}) };
}
