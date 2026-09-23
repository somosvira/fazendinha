import { prisma } from "../../db.js";
import { calcularSaldo, calcularValor, abaixoDoMinimo, type MovEstoque } from "./estoque.calc.js";

// DTO consumido pela aba Estoque do Plantio (client/.../EstoqueTab.tsx).
// `tipo` é o subtipoPlantio do Produto (FERTILIZANTE/DEFENSIVO/…). Decimals do
// Prisma já chegam como number; minimoEstoque pode ser null.
export interface SaldoPlantio {
  produtoId: number;
  nome: string;
  tipo: string;            // TipoInsumoPlantio
  saldo: number;
  unidade: string;
  valor: number;           // R$ = saldo × custoUnitário
  minimoEstoque: number | null;
  abaixoMinimo: boolean;
}

// Insumos da lavoura = Produto com subtipoPlantio preenchido (null no rebanho).
// O saldo vem dos MovimentoEstoque (Σ ENTRADA − Σ SAIDA ± AJUSTE), e o valor é
// o saldo × custoUnitário do produto — fotografia do que está em galpão hoje.
export async function listarEstoquePlantio(propriedadeId?: number | null): Promise<SaldoPlantio[]> {
  const produtos = await prisma.produto.findMany({
    where: { subtipoPlantio: { not: null }, ativo: true },
    orderBy: { nome: "asc" },
    // Escopo do sítio: só os movimentos do sítio contam pro saldo (mirror do
    // estoque/estoque.listarSaldos). Produto em si é cadastro compartilhado.
    include: { movimentos: propriedadeId != null ? { where: { propriedadeId } } : true },
  });

  return produtos.map((p) => {
    const movs: MovEstoque[] = p.movimentos.map((m) => ({ tipo: m.tipo, quantidade: Number(m.quantidade) }));
    const saldo = calcularSaldo(movs);
    const custo = p.custoUnitario != null ? Number(p.custoUnitario) : null;
    const minimo = p.minimoEstoque != null ? Number(p.minimoEstoque) : null;
    return {
      produtoId: p.id,
      nome: p.nome,
      tipo: p.subtipoPlantio as string,
      saldo,
      unidade: p.unidade,
      valor: calcularValor(saldo, custo),
      minimoEstoque: minimo,
      abaixoMinimo: abaixoDoMinimo(saldo, minimo),
    };
  });
}
