import { Prisma } from "@prisma/client";
export interface RegraRetirada {
  id: string;
  vigenteDesde: string;
  tipo: string;
  diaSemana: number | null;
  diasSemana: number[];
  metaLitros: string | null;
  produtoId: string | null;
}
export interface AvaliacaoMeta {
  estado: "ATINGIDA" | "ABAIXO_DA_META" | "NAO_AFERIVEL";
  saldoLitros: string | null;
  metaLitros: string;
  motivo: string | null;
}
export function avaliarMetaRetirada(
  metaLitros: string,
  saldo: {
    confiavel: boolean;
    quantidadeLitros: string | null;
    motivoNaoAferivel: string | null;
  } | null,
  referenciaAtual: boolean,
): AvaliacaoMeta {
  if (!referenciaAtual)
    return {
      estado: "NAO_AFERIVEL",
      saldoLitros: null,
      metaLitros,
      motivo:
        "O saldo físico disponível é atual; não comprova saldo histórico ou futuro.",
    };
  if (!saldo?.confiavel || saldo.quantidadeLitros === null)
    return {
      estado: "NAO_AFERIVEL",
      saldoLitros: null,
      metaLitros,
      motivo:
        saldo?.motivoNaoAferivel ??
        "Saldo físico confiável não disponível para o produto desta programação.",
    };
  const quantidade = new Prisma.Decimal(saldo.quantidadeLitros);
  if (!quantidade.isFinite() || quantidade.isNegative())
    return {
      estado: "NAO_AFERIVEL",
      saldoLitros: null,
      metaLitros,
      motivo: "O saldo físico requer conciliação.",
    };
  return {
    estado: quantidade.gte(metaLitros) ? "ATINGIDA" : "ABAIXO_DA_META",
    saldoLitros: quantidade.toString(),
    metaLitros,
    motivo: null,
  };
}
/** Calendário exclusivamente previsto. Cada data usa sua versão vigente. */
export function preverRetiradas(
  regras: readonly RegraRetirada[],
  inicio: string,
  quantidadeDias = 14,
) {
  const ordenadas = [...regras].sort((a, b) =>
    b.vigenteDesde.localeCompare(a.vigenteDesde),
  );
  const previsoes: { data: string; programacaoId: string; tipo: string }[] = [];
  for (let i = 0; i < quantidadeDias; i++) {
    const data = new Date(`${inicio}T12:00:00Z`);
    data.setUTCDate(data.getUTCDate() + i);
    const texto = data.toISOString().slice(0, 10);
    const regra = ordenadas.find((r) => r.vigenteDesde <= texto);
    if (!regra) continue;
    const dia = data.getUTCDay();
    if (
      regra.tipo === "DIARIA" ||
      (regra.tipo === "SEMANAL" && regra.diaSemana === dia) ||
      (regra.tipo === "DIAS_ESCOLHIDOS" && regra.diasSemana.includes(dia))
    )
      previsoes.push({
        data: texto,
        programacaoId: regra.id,
        tipo: regra.tipo,
      });
  }
  return previsoes;
}
