// Motor puro de estoque (Prisma-free, testado por TDD).
// Saldo é computado (Σ entradas − Σ saídas).

export interface MovIn {
  tipo: "ENTRADA" | "SAIDA" | "AJUSTE";
  quantidade: number;
  valorTotal: number;
  data: string;
}

// SAIDA subtrai; ENTRADA e AJUSTE somam (AJUSTE pode ter quantidade/valor negativos).
const sinal = (t: MovIn["tipo"]) => (t === "SAIDA" ? -1 : 1);

export function saldoProduto(movs: MovIn[]): { saldo: number; valor: number } {
  let saldo = 0;
  let valor = 0;
  for (const m of movs) {
    saldo += sinal(m.tipo) * m.quantidade;
    valor += sinal(m.tipo) * m.valorTotal;
  }
  return { saldo: Math.round(saldo * 100) / 100, valor: Math.round(valor * 100) / 100 };
}
