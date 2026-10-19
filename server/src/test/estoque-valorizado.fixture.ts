import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { exigirBancoIntegracaoPecuaria } from "../lib/banco-pecuaria-integration.fixture.js";
import {
  abrirValorizacao, diagnosticarValorizacao, planejarSaidaTx, registrarEntradaValorizadaTx,
  registrarSaidaValorizadaTx, type DistribuicaoValor,
} from "../services/estoque/valorizacao.js";

/** Entrada nova da fixture: fato físico e parcelas de valor na mesma transação. */
export async function criarEntradaValorizadaFixtureTx(tx: Prisma.TransactionClient, input: Prisma.MovimentoEstoqueCreateArgs) {
  exigirBancoIntegracaoPecuaria();
  if (input.data.tipo !== "ENTRADA") throw new Error("A fixture de entrada aceita somente ENTRADA; legado deve ser preparado explicitamente");
  const exigeDocumento = ["INVENTARIO_INICIAL", "BONIFICACAO", "PRODUCAO"].includes(input.data.origem);
  if (exigeDocumento && input.data.valorTotal == null) throw new Error("A fixture exige valor explícito, inclusive quando for zero comprovado");
  const evidenciaValor = exigeDocumento && input.data.evidenciaValor == null ? {
    referencia: "FIXTURE_VALOR_DOCUMENTADO", evidencia: "Valor fictício documentado explicitamente por este caso de teste",
    usuarioId: null, valorTotal: new Prisma.Decimal(input.data.valorTotal!.toString()).toFixed(2),
  } : input.data.evidenciaValor;
  const movimento = await tx.movimentoEstoque.create({ ...input, data: { ...input.data, ...(evidenciaValor ? { evidenciaValor } : {}) }, include: { alocacaoPartidaEstoques: true } });
  await registrarEntradaValorizadaTx(tx, movimento, movimento.alocacaoPartidaEstoques);
  return movimento;
}
export async function criarEntradaValorizadaFixture(input: Prisma.MovimentoEstoqueCreateArgs) {
  exigirBancoIntegracaoPecuaria();
  return prisma.$transaction(tx => criarEntradaValorizadaFixtureTx(tx, input));
}

/** Usada somente quando o caso exige montar uma saída física sem executar outro domínio. */
export async function criarSaidaValorizadaFixtureTx(tx: Prisma.TransactionClient, input: Prisma.MovimentoEstoqueCreateArgs, distribuicao: DistribuicaoValor[]) {
  exigirBancoIntegracaoPecuaria();
  const dados = input.data;
  if (dados.tipo !== "SAIDA" || !dados.produtoId || dados.propriedadeId == null)
    throw new Error("A fixture de saída exige produto, sítio e tipo SAIDA explícitos");
  const plano = await planejarSaidaTx(tx, {
    produtoId: dados.produtoId, propriedadeId: dados.propriedadeId, data: new Date(dados.data),
    quantidade: new Prisma.Decimal(dados.quantidade.toString()), partidas: distribuicao,
  });
  const movimento = await tx.movimentoEstoque.create({ ...input, data: { ...dados, custoUnitario: plano.custoUnitario, valorTotal: plano.valorTotal } });
  await registrarSaidaValorizadaTx(tx, movimento.id, plano);
  return movimento;
}

/** O teste fornece o valor comprovado. Não deduz preço a partir de movimentos legados. */
export async function abrirValorLegadoFixture(input: {
  produtoId: string; propriedadeId: number; data: string;
  bases: Array<{ partidaId?: string | null; quantidade: string; valor: string; disponivelDesde?: string; referencia: string }>;
}) {
  exigirBancoIntegracaoPecuaria();
  const previa = await diagnosticarValorizacao(input.produtoId, input.propriedadeId, new Date(input.data));
  return abrirValorizacao({ ...input, chave: randomUUID(), revisao: previa.revisao,
    motivo: "Abertura explícita do saldo residual da fixture de transição",
    evidencia: "Quantidade e valor declarados neste caso de teste" }, null);
}

/** Exclusão administrativa restrita aos produtos da suíte; sem desabilitar garantias SQL. */
export async function limparMovimentosValorizadosFixtureTx(tx: Prisma.TransactionClient, produtoIds: string[]) {
  exigirBancoIntegracaoPecuaria();
  if (!produtoIds.length) return;
  if (produtoIds.some(id => !id)) throw new Error("A limpeza exige os IDs explícitos dos produtos da fixture");
  const produtoId = { in: [...new Set(produtoIds)] };
  await tx.parcelaValorizacaoEstoque.deleteMany({ where: { movimentoEstoque: { produtoId } } });
  await tx.baseValorizacaoEstoque.deleteMany({ where: { produtoId } });
  await tx.alocacaoPartidaEstoque.deleteMany({ where: { movimentoEstoque: { produtoId } } });
  await tx.movimentoEstoque.deleteMany({ where: { produtoId } });
}
export async function limparMovimentosValorizadosFixture(produtoIds: string[]) {
  if (!produtoIds.length) return;
  exigirBancoIntegracaoPecuaria();
  return prisma.$transaction(tx => limparMovimentosValorizadosFixtureTx(tx, produtoIds));
}
