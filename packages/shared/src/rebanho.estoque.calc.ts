// Motor puro de saldo de estoque (Prisma-free) — usado pelo server pra
// computar o saldo real e pelo client pra aplicar o mesmo delta no cache
// otimista, sem duplicar a regra de sinal por tipo.

export interface MovIn {
  tipo: "ENTRADA" | "SAIDA" | "AJUSTE";
  quantidade: number;
  valorTotal: number;
  data: string;
}

// SAIDA subtrai; ENTRADA e AJUSTE somam (AJUSTE pode ter quantidade/valor negativos).
export const sinalMovimentoEstoque = (t: MovIn["tipo"]) => (t === "SAIDA" ? -1 : 1);

export function saldoProduto(movs: MovIn[]): { saldo: number; valor: number } {
  let saldo = 0;
  let valor = 0;
  for (const m of movs) {
    saldo += sinalMovimentoEstoque(m.tipo) * m.quantidade;
    valor += sinalMovimentoEstoque(m.tipo) * m.valorTotal;
  }
  return { saldo: Math.round(saldo * 100) / 100, valor: Math.round(valor * 100) / 100 };
}
