import { Prisma } from "@prisma/client";

type Classificada = { categoriaId?: number | null; categoriaNome?: string | null; classificacao?: "CUSTEIO" | "INVESTIMENTO" | null };
export type OperacaoClassificada = Classificada & { valorTotal?: Prisma.Decimal | string | number; itens: (Classificada & { id: number; valorTotal: Prisma.Decimal | string | number })[] };

/** Rateio determinístico por maiores restos. Centavos fecham no valor original. */
export function ratearCategorias(operacao: OperacaoClassificada | null, valor: Prisma.Decimal | string | number) {
  const itens = operacao?.itens.length ? [...operacao.itens].sort((a, b) => a.id - b.id) : [{ ...operacao, id: 0, valorTotal: 1 }];
  // O Decimal do Prisma no Worker não expõe os atalhos round() e floor().
  const pesos = itens.map((i) => new Prisma.Decimal(i.valorTotal).mul(100).toDecimalPlaces(0));
  const soma = pesos.reduce((a, b) => a.plus(b), new Prisma.Decimal(0));
  const centavos = new Prisma.Decimal(valor).mul(100).toDecimalPlaces(0);
  if (soma.isZero()) return [{ categoriaId: null, categoriaNome: "Sem categoria", classificacao: null, valor: centavos.div(100) }];
  const partes = pesos.map((peso, indice) => {
    const exato = centavos.abs().mul(peso).div(soma);
    const inteiro = exato.toDecimalPlaces(0, Prisma.Decimal.ROUND_FLOOR);
    return { indice, inteiro, resto: exato.minus(inteiro) };
  });
  const faltam = centavos.abs().minus(partes.reduce((a, p) => a.plus(p.inteiro), new Prisma.Decimal(0))).toNumber();
  [...partes].sort((a, b) => b.resto.comparedTo(a.resto) || a.indice - b.indice).slice(0, faltam).forEach((p) => { p.inteiro = p.inteiro.plus(1); });
  return partes.map((p) => ({ categoriaId: itens[p.indice].categoriaId ?? null, categoriaNome: itens[p.indice].categoriaNome ?? "Sem categoria", classificacao: itens[p.indice].classificacao ?? null, valor: p.inteiro.mul(centavos.isNegative() ? -1 : 1).div(100) }));
}

export const incluirClassificacao = {
  itens: true,
  compromissos: { include: { liquidacoes: true } },
  transacoes: { select: { id: true, tipo: true, valorTotal: true, reversaoDeId: true, status: true } },
} as const;

type Transacao = { id: number; tipo: string; valorTotal: Prisma.Decimal | string | number; reversaoDeId: number | null; status?: string };
export type OperacaoComFluxo = OperacaoClassificada & { transacoes: Transacao[] };

/** Distribui cada pagamento sobre o saldo dos itens. O último fecha todos os
 * centavos e uma reversão desfaz exatamente o rateio do pagamento original.
 * A ordem de registro (id) é estável, inclusive para datas retroativas. */
export function classificarFluxo(operacao: OperacaoComFluxo) {
  const total = operacao.valorTotal ?? operacao.itens.reduce((s, i) => s.plus(i.valorTotal), new Prisma.Decimal(0));
  const base = ratearCategorias(operacao, total);
  let saldo = base.map((p) => p.valor);
  const transacoes = new Map<number, ReturnType<typeof ratearCategorias>>();
  for (const t of [...operacao.transacoes].sort((a, b) => a.id - b.id)) {
    if (!["PAGAMENTO", "RECEBIMENTO", "APORTE", "RETIRADA", "REVERSAO"].includes(t.tipo)) continue;
    const original = t.reversaoDeId ? transacoes.get(t.reversaoDeId) : undefined;
    const partes = original ? original.map((p) => ({ ...p, valor: p.valor.negated() }))
      : ratearCategorias(operacao.itens.length ? { ...operacao, itens: base.map((p, i) => ({ ...p, id: i, valorTotal: saldo[i] })) } : operacao, t.valorTotal);
    transacoes.set(t.id, partes);
    saldo = saldo.map((s, i) => s.minus(partes[i]?.valor ?? 0));
  }
  return { transacoes, saldo: base.map((p, i) => ({ ...p, valor: saldo[i] })) };
}

export function ratearTransacao(operacao: OperacaoComFluxo | null, transacaoId: number, valor: Prisma.Decimal | string | number) {
  return operacao ? classificarFluxo(operacao).transacoes.get(transacaoId) ?? ratearCategorias(operacao, valor) : ratearCategorias(null, valor);
}


type CompromissoRateio = { id: number; status: string; valorOriginal: Prisma.Decimal; liquidacoes: { transacaoId: number; valor: Prisma.Decimal }[] };
export function ratearCompromissos(operacao: OperacaoComFluxo & { compromissos: CompromissoRateio[] }) {
  const fluxo = classificarFluxo(operacao);
  let saldo = fluxo.saldo;
  const resultado = new Map<number, ReturnType<typeof ratearCategorias>>();
  for (const c of [...operacao.compromissos].sort((a, b) => a.id - b.id)) {
    if (!["PENDENTE", "PARCIAL"].includes(c.status)) continue;
    const pago = c.liquidacoes.filter((l) => operacao.transacoes.some((t) => t.id === l.transacaoId && t.status === "CONFIRMADA")).reduce((s, l) => s.plus(l.valor), new Prisma.Decimal(0));
    const partes = ratearCategorias(operacao.itens.length ? { ...operacao, itens: saldo.map((p, i) => ({ ...p, id: i, valorTotal: p.valor })) } : operacao, c.valorOriginal.minus(pago));
    resultado.set(c.id, partes);
    saldo = saldo.map((p, i) => ({ ...p, valor: p.valor.minus(partes[i]?.valor ?? 0) }));
  }
  return resultado;
}
