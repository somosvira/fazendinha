export type AplicacaoCarencia = {
  aplicadaEm: Date | null;
  data: Date;
  precisaoTemporal: string;
  carenciaLeiteHoras: number | null;
  carenciaCarneHoras: number | null;
};

export type PrazoCarencia =
  | { estado: "NENHUMA" }
  | { estado: "NAO_INFORMADO" }
  | { estado: "CONHECIDO"; ate: Date; precisaoAproximada: boolean };

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
  if (aplicacoes.some((a) => a[chave] == null)) return { estado: "NAO_INFORMADO" };
  let maior = new Date(0);
  let aproximada = false;
  for (const a of aplicacoes) {
    const fim = new Date(baseDaAplicacao(a).getTime() + a[chave]! * 3_600_000);
    if (fim.getTime() > maior.getTime()) {
      maior = fim;
      aproximada = a.precisaoTemporal !== "HORA";
    }
  }
  return { estado: "CONHECIDO", ate: maior, precisaoAproximada: aproximada };
}
