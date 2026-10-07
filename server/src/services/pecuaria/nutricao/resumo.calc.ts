import { Prisma } from "@prisma/client";

type Item = { produtoId: string; unidade: string; quantidadeConfirmada: Prisma.Decimal; modoEstoque: string; situacaoCusto: string;
  produto: { nome: string }; movimentoEstoque: { valorTotal: Prisma.Decimal | null } | null };
type Consumo = { animalDias: number; itens: Item[] };

export function somarConsumoMensal(fechamentos: Consumo[]) {
  const totais = new Map<string, { produtoId: string; nome: string; unidade: string; quantidadeConfirmada: Prisma.Decimal }>();
  let custo = new Prisma.Decimal(0); let temCusto = false; let coberturaCustoCompleta = true;
  for (const f of fechamentos) for (const i of f.itens) {
    const chave = `${i.produtoId}:${i.unidade}`;
    const anterior = totais.get(chave);
    totais.set(chave, { produtoId: i.produtoId, nome: i.produto.nome, unidade: i.unidade, quantidadeConfirmada: (anterior?.quantidadeConfirmada ?? new Prisma.Decimal(0)).plus(i.quantidadeConfirmada) });
    const conhecido = i.modoEstoque === "BAIXA_ESTOQUE" && (i.quantidadeConfirmada.isZero() || i.situacaoCusto === "CONHECIDO" && i.movimentoEstoque?.valorTotal != null);
    if (conhecido) { custo = custo.plus(i.movimentoEstoque?.valorTotal ?? 0); temCusto = true; }
    else coberturaCustoCompleta = false;
  }
  return { fechamentos: fechamentos.length, animalDias: fechamentos.reduce((n, f) => n + f.animalDias, 0),
    custoConhecido: temCusto ? custo.toFixed(2) : null, coberturaCustoCompleta,
    itens: [...totais.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true })).map((i) => ({ ...i, quantidadeConfirmada: i.quantidadeConfirmada.toFixed(3) })) };
}
