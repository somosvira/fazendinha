// Motor puro de estoque do Plantio (Prisma-free, testado por TDD).
// Mesma convenção do rebanho (ver estoque/estoque.calc.ts): SAIDA subtrai;
// ENTRADA e AJUSTE somam (AJUSTE pode ter quantidade negativa — correção de
// saldo). Aqui o valor em R$ é derivado do custoUnitário do produto (saldo ×
// custo), e não da soma dos valores de movimento — o estoque do Plantio é uma
// fotografia de quanto vale o que está em galpão hoje.

export interface MovEstoque {
  tipo: "ENTRADA" | "SAIDA" | "AJUSTE";
  quantidade: number;
}

// SAIDA subtrai; ENTRADA e AJUSTE somam (idêntico ao rebanho).
const sinal = (t: MovEstoque["tipo"]) => (t === "SAIDA" ? -1 : 1);

// Saldo físico em estoque = Σ(ENTRADA.quantidade) − Σ(SAIDA.quantidade) ± AJUSTE.
export function calcularSaldo(movs: MovEstoque[]): number {
  let saldo = 0;
  for (const m of movs) saldo += sinal(m.tipo) * m.quantidade;
  return Math.round(saldo * 100) / 100;
}

// Valor em R$ = saldo × custoUnitário (0 quando não há custo cadastrado).
export function calcularValor(saldo: number, custoUnitario: number | null): number {
  if (!custoUnitario) return 0;
  return Math.round(saldo * custoUnitario * 100) / 100;
}

// Abaixo do mínimo apenas quando há mínimo cadastrado e o saldo o perfura.
export function abaixoDoMinimo(saldo: number, minimoEstoque: number | null): boolean {
  return minimoEstoque != null && saldo < minimoEstoque;
}
