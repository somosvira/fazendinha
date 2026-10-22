import { Prisma } from "@prisma/client";
const D = (n: Prisma.Decimal.Value) => new Prisma.Decimal(n);
/** Limites documentais: nunca infere aceite, proporcionalidade de preço ou dinheiro recebido. */
export function conferirSaldoComercial(input: { expedido: Prisma.Decimal.Value; aceito: Prisma.Decimal.Value | null; valorVenda: Prisma.Decimal.Value; quantidadeAlocada: Prisma.Decimal.Value; valorAlocado: Prisma.Decimal.Value; quantidade: Prisma.Decimal.Value; valor: Prisma.Decimal.Value; motivoAceitePendente?: string }) {
  const maximo = input.aceito === null ? D(input.expedido) : Prisma.Decimal.min(D(input.expedido), D(input.aceito));
  if(input.aceito===null&&!input.motivoAceitePendente?.trim()) throw new Error("Aceite desconhecido exige pendência explícita para conciliar o volume reconhecido no demonstrativo");
  const q=D(input.quantidadeAlocada).plus(input.quantidade), v=D(input.valorAlocado).plus(input.valor);
  if(q.gt(maximo)||v.gt(input.valorVenda)) throw new Error("Parcela supera saldo comercial de quantidade ou valor");
  // Fechar só litros ou só valor deixaria um saldo impossível de apropriar sem parcela fictícia.
  if(q.eq(maximo)!==v.eq(input.valorVenda)) throw new Error("Encerramento documental deve conciliar os litros expedidos e o valor integral da venda");
  return { quantidadeDisponivel: maximo.minus(q), valorDisponivel: D(input.valorVenda).minus(v) };
}
export function conferirTotaisDemonstrativo(quantidade: Prisma.Decimal.Value, valor: Prisma.Decimal.Value, alocacoes: { quantidadeLitros: Prisma.Decimal.Value; valor: Prisma.Decimal.Value }[]) {
  if(!alocacoes.reduce((s,a)=>s.plus(a.quantidadeLitros),D(0)).eq(quantidade)||!alocacoes.reduce((s,a)=>s.plus(a.valor),D(0)).eq(valor)) throw new Error("Parcelas não conciliam volume reconhecido e valor comercial declarados");
}
