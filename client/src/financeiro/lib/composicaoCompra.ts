/** Prévia em centavos; a confirmação usa o cálculo Decimal autoritativo do servidor. */
export function previaDesconto(brutos: number[], elegiveis: boolean[], desconto: number) {
  const pesos = brutos.map((v,i) => elegiveis[i] ? Math.max(0, Math.round(v*100)) : 0);
  const totalPeso = pesos.reduce((s,v) => s+v,0);
  const centavos = Math.max(0, Math.round(desconto*100));
  const partes = pesos.map((peso,i) => {
    const numerador = BigInt(centavos)*BigInt(peso), divisor = BigInt(totalPeso || 1);
    return { i, parcela: Number(numerador/divisor), resto: numerador%divisor };
  });
  if (totalPeso > 0) {
    const resto = centavos-partes.reduce((s,p) => s+p.parcela,0);
    [...partes].sort((a,b) => a.resto === b.resto ? a.i-b.i : a.resto>b.resto ? -1:1).slice(0,resto).forEach(p => p.parcela++);
  }
  return { valido: centavos<=totalPeso, descontos: partes.map(p => p.parcela/100), liquidos: brutos.map((v,i) => (Math.round(v*100)-partes[i].parcela)/100) };
}
