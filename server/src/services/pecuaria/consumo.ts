import { Prisma, type Produto } from "@prisma/client";
import { RebanhoError } from "./rebanho/regras.js";
import { propriedadePrincipalId } from "../propriedade.js";
import { statusSaldoEstoque } from "../estoque/estoque.js";
import { planejarSaidaTx, registrarSaidaValorizadaTx, travarValorizacaoTx } from "../estoque/valorizacao.js";
import { resolverLotePrincipalTx, saldoPartidaTx, validadeVencida } from "../estoque/partidas.js";
import { exigirPeriodoAberto } from "../financeiro/regras.js";
import { travarUsosProduto } from "../estoque/usos.js";

export async function obterSaldo(tx: Prisma.TransactionClient, produtoId: string, propriedadeId: number, partidaId?: string | null) {
  if (partidaId) return saldoPartidaTx(tx, partidaId, propriedadeId);
  const principal = await propriedadePrincipalId();
  const movimentos = await tx.movimentoEstoque.findMany({
    where: { produtoId, status: statusSaldoEstoque, ...(propriedadeId === principal ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : { propriedadeId }) },
  });
  return movimentos.reduce((saldo, m) => m.tipo === "SAIDA" ? saldo.minus(m.quantidade) : saldo.plus(m.quantidade), new Prisma.Decimal(0));
}

type ConsumoEstoque = {
  produto: Pick<Produto, "id" | "rastrearPartidas">;
  propriedadeId: number;
  quantidade: Prisma.Decimal;
  campoQuantidade: "dose" | "quantidade";
  data: Date;
  instante?: Date;
  partidaId?: string | null;
  cienciaValidadeDesconhecida?: boolean;
  documentacaoExcepcional?: boolean;
  motivoDocumentacaoExcepcional?: string | null;
  origem: "SANIDADE" | "REPRODUCAO" | "NUTRICAO";
  observacao: string;
  usuarioId: number | null;
  previa?: boolean;
};

/** Exige animal travado pelo executor. Prévia valida o mesmo consumo, sem reservá-lo. */
export async function consumirEstoqueTx(tx: Prisma.TransactionClient, input: ConsumoEstoque) {
  const { produto, propriedadeId, quantidade, data } = input;
  await travarValorizacaoTx(tx, [produto.id]);
  const erro = (mensagem: string, campo?: string): never => { throw new RebanhoError("VALIDACAO", mensagem, campo); };
  if (!quantidade.isFinite() || quantidade.lte(0) || quantidade.decimalPlaces() > 3)
    erro("Informe quantidade positiva com até três casas decimais", input.campoQuantidade);
  await travarUsosProduto(tx, [produto.id]);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-produto:${propriedadeId}:${produto.id}`}))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-produto:${produto.id}`}))`;
  if (produto.rastrearPartidas !== !!input.partidaId)
    erro(produto.rastrearPartidas ? "Selecione o lote do produto" : "Este Produto não usa lotes", "partidaId");
  const partida = input.partidaId ? await resolverLotePrincipalTx(tx, input.partidaId, produto.id) : null;
  if (input.partidaId && !partida) erro("Lote não pertence a este Produto", "partidaId");
  if (partida && !partida.validade && !input.cienciaValidadeDesconhecida)
    erro("Confirme a ciência de uso do lote com validade não informada", "cienciaValidadeDesconhecida");
  const vencida = partida?.validade && validadeVencida(partida.validade, data);
  if (vencida) {
    if (!input.documentacaoExcepcional || (input.motivoDocumentacaoExcepcional?.trim().length ?? 0) < 5 || (input.instante ?? data) > new Date())
      erro("Lote vencido: uso operacional bloqueado; documentação de fato já ocorrido exige ciência e justificativa", "partidaId");
  } else if (input.documentacaoExcepcional) erro("Documentação excepcional só cabe para fato já ocorrido com lote vencido", "documentacaoExcepcional");
  if ((await obterSaldo(tx, produto.id, propriedadeId)).lt(quantidade)) erro("Saldo de estoque insuficiente neste sítio", input.campoQuantidade);
  if (partida && (await obterSaldo(tx, produto.id, propriedadeId, partida.id)).lt(quantidade)) erro("Saldo do lote insuficiente neste sítio", "partidaId");
  await exigirPeriodoAberto(tx, propriedadeId, data);
  const plano = await planejarSaidaTx(tx, { produtoId: produto.id, propriedadeId, quantidade, data, partidas: partida ? [{ partidaId: partida.id, quantidade }] : [] });
  const valores = { custoUnitario: plano.custoUnitario, valorTotal: plano.valorTotal };
  const movimento = input.previa ? null : await tx.movimentoEstoque.create({ data: {
    produtoId: produto.id, propriedadeId, tipo: "SAIDA", origem: input.origem, data, quantidade,
    ...valores, criadoPorId: input.usuarioId, observacao: input.observacao,
    ...(partida ? { alocacaoPartidaEstoques: { create: { partidaId: partida.id, quantidade } } } : {}),
  } });
  if (movimento) await registrarSaidaValorizadaTx(tx, movimento.id, plano);
  return { movimentoEstoqueId: movimento?.id ?? null, valorProdutoAtribuido: valores.valorTotal,
    situacaoCusto: "CONHECIDO", partida };
}
