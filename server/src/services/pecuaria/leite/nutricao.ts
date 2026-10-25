import { Prisma } from "@prisma/client";
import { baixarLeiteTx, estornarBaixaLeiteTx, saldosOrigensLeiteTx, valoresMovimentosLeiteTx } from "../../estoque/leite.js";
import { travarValorizacaoTx } from "../../estoque/valorizacao.js";
import { calcularAtribuicao } from "../nutricao/atribuicao.calc.js";
import { RebanhoError } from "../rebanho/regras.js";
import { planejarFornecimentoLeite } from "./nutricao.calc.js";
import { aplicarReferenciaProvisoriaTx } from "./referencias.js";

/** O ingrediente só entra no adaptador quando possui lastro próprio de produção V5; litros genéricos não bastam. */
export async function ingredienteLeiteProducaoTx(tx: Prisma.TransactionClient, produtoId: string, propriedadeId: number) {
  return !!await tx.entradaProducaoLeite.findFirst({ where: { movimento: { produtoId, propriedadeId } }, select: { id: true } });
}
export async function origensNutricionaisLeiteTx(tx: Prisma.TransactionClient, propriedadeId: number, data: Date, travar = false) {
  const entradas = await tx.entradaProducaoLeite.findMany({ where: { status: "CONFIRMADA", movimento: { propriedadeId, status: "CONFIRMADO", data: { lte: data }, produto: { ativo: true, unidade: "L", rastrearPartidas: false } } },
    select: { movimento: { select: { produtoId: true, produto: { select: { nome: true } } } } } });
  const produtos = [...new Set(entradas.map(e => e.movimento.produtoId))].sort();
  if (travar) await travarValorizacaoTx(tx, produtos);
  const origens = [];
  for (const produtoId of produtos) for (const o of await saldosOrigensLeiteTx(tx, produtoId, propriedadeId, data)) {
    if (!["COMERCIAL", "NAO_COMERCIAL"].includes(o.natureza) || !o.quantidade.gt(0)) continue;
    origens.push({ entradaId: o.entradaId, produtoId, produtoNome: entradas.find(e => e.movimento.produtoId === produtoId)!.movimento.produto.nome,
      natureza: o.natureza, data: o.data, ordem: o.ordem, quantidade: o.quantidade, valor: o.valor });
  }
  return origens;
}
export async function previaLeiteNutricionalTx(tx: Prisma.TransactionClient, produtoId: string, propriedadeId: number, data: Date, quantidade: Prisma.Decimal) {
  if (!await ingredienteLeiteProducaoTx(tx, produtoId, propriedadeId)) return null;
  const origens = await origensNutricionaisLeiteTx(tx, propriedadeId, data);
  const disponivel = origens.reduce((s,o) => s.plus(o.quantidade), new Prisma.Decimal(0));
  const efetivo = Prisma.Decimal.min(quantidade, disponivel);
  const plano = efetivo.gt(0) ? planejarFornecimentoLeite(origens, efetivo) : null;
  return { quantidadeDisponivelLitros: disponivel.toFixed(3), quantidadePrevistaLitros: quantidade.toFixed(3),
    quantidadeAtendivelLitros: efetivo.toFixed(3), custoPrevisto: plano?.custoProducao?.toFixed(2) ?? null,
    origens: origens.map(o => ({ entradaId: o.entradaId, produtoId: o.produtoId, produtoNome: o.produtoNome, natureza: o.natureza, data: o.data, quantidadeDisponivelLitros: o.quantidade.toFixed(3) })),
    composicaoPrevista: plano?.parcelas.map(o => ({ entradaId: o.entradaId, natureza: o.natureza, quantidadeLitros: o.quantidade.toFixed(3) })) ?? [] };
}
export async function baixarLeiteNutricionalTx(tx: Prisma.TransactionClient, input: { produtoId: string; propriedadeId: number; data: Date; quantidade: Prisma.Decimal; entradaIds: string[]; usuarioId: number | null; observacao: string }) {
  if (!await ingredienteLeiteProducaoTx(tx, input.produtoId, input.propriedadeId)) throw new RebanhoError("VALIDACAO", "O ingrediente não tem produção leiteira V5 comprovada neste sítio");
  const origens = await origensNutricionaisLeiteTx(tx, input.propriedadeId, input.data, true);
  if (!input.entradaIds.length || new Set(input.entradaIds).size !== input.entradaIds.length || input.entradaIds.some(id => !origens.some(o => o.entradaId === id)))
    throw new RebanhoError("CONFLITO", "Confira as origens de leite disponíveis neste sítio e data");
  const plano = planejarFornecimentoLeite(origens.filter(o => input.entradaIds.includes(o.entradaId)), input.quantidade);
  const movimentos = [];
  // Cada parcela usa o núcleo de estoque e sua origem exata. Nenhuma baixa genérica é produzida.
  for (const p of plano.parcelas) {
    const m = await baixarLeiteTx(tx, { produtoId: p.produtoId, propriedadeId: input.propriedadeId, data: input.data, quantidade: p.quantidade,
      entradaIds: [p.entradaId], origem: "NUTRICAO", usuarioId: input.usuarioId, observacao: input.observacao });
    movimentos.push({ movimentoId: m.id, entradaId: p.entradaId, natureza: p.natureza, quantidadeLitros: p.quantidade });
  }
  return { movimentos, custoProducao: plano.custoProducao };
}
export async function registrarFornecimentoNutricionalTx(tx: Prisma.TransactionClient, input: { itemId: string; propriedadeId: number; data: Date; quantidade: Prisma.Decimal; usuarioId: number | null;
  participacoes: { animalId: string; dias: number }[]; animalDias: number; movimentos: { movimentoId: string; entradaId: string; natureza: string; quantidadeLitros: Prisma.Decimal }[] }) {
  const atribuicao = calcularAtribuicao(input.participacoes, input.animalDias, [{ produtoId: "leite", unidade: "L", quantidadeConfirmada: input.quantidade, custoConhecido: null }]);
  const fornecimento = await tx.fornecimentoNutricionalLeite.create({ data: { itemId: input.itemId, propriedadeId: input.propriedadeId, data: input.data,
    quantidadeLitros: input.quantidade, criadoPorId: input.usuarioId, movimentos: { create: input.movimentos },
    parcelas: { create: atribuicao.participacoes.map(p => ({ animalId: p.animalId, dias: p.dias, quantidadeLitros: new Prisma.Decimal(p.itens[0].quantidadeAtribuida), baseQuantidade: "ATRIBUIDA" })) } } });
  await aplicarReferenciaProvisoriaTx(tx, fornecimento, input.usuarioId);
  return fornecimento;
}
export async function estornarLeiteNutricionalTx(tx: Prisma.TransactionClient, itemId: string, propriedadeId: number, usuarioId: number | null, motivo: string) {
  const f = await tx.fornecimentoNutricionalLeite.findFirst({ where: { itemId, propriedadeId }, include: { movimentos: true } });
  if (!f) return;
  if (f.status !== "CONFIRMADO") throw new RebanhoError("CONFLITO", "Fornecimento leiteiro já estornado");
  for (const origem of f.movimentos) await estornarBaixaLeiteTx(tx, { movimentoId: origem.movimentoId, propriedadeId, usuarioId, motivo });
  await tx.fornecimentoNutricionalLeite.update({ where: { id: f.id }, data: { status: "ESTORNADO" } });
}
export async function consultarFornecimentosNutricionaisTx(tx: Prisma.TransactionClient, itemIds: string[], verValores: boolean, verReferenciasComerciais = verValores) {
  if (!itemIds.length) return new Map<string, never>();
  const fornecimentos = await tx.fornecimentoNutricionalLeite.findMany({ where: { itemId: { in: itemIds } }, include: { movimentos: true, parcelas: true, referencias: { orderBy: { versao: "asc" } } } });
  const valores = await valoresMovimentosLeiteTx(tx, fornecimentos.flatMap(f => f.movimentos.map(m => m.movimentoId)));
  return new Map(fornecimentos.map(f => {
    const custos = f.movimentos.map(m => valores.get(m.movimentoId)?.valorTotal ?? null);
    const custoProducao = custos.every(c => c != null) ? custos.reduce<Prisma.Decimal>((s,c) => s.plus(c!), new Prisma.Decimal(0)).toFixed(2) : null;
    const referencias = f.referencias.map(r => ({ id: r.id, versao: r.versao, fechamentoId: r.fechamentoId, periodoInicio: r.periodoInicio.toISOString().slice(0,10), periodoFim: r.periodoFim.toISOString().slice(0,10), parceiroId: r.parceiroId,
      precoUnitario: verReferenciasComerciais ? r.precoUnitario.toFixed(4) : null, valorTotal: verReferenciasComerciais ? r.valorTotal.toFixed(2) : null, provisoria: r.provisoria, motivo: verReferenciasComerciais ? r.motivo : null, criadoPorId: r.criadoPorId, criadoEm: r.criadoEm.toISOString() }));
    const referencia = referencias.at(-1) ?? null;
    const atribuicao = referencia && verReferenciasComerciais ? calcularAtribuicao(f.parcelas, f.parcelas.reduce((s,p) => s+p.dias,0), [{ produtoId: "leite", unidade: "L", quantidadeConfirmada: f.quantidadeLitros, custoConhecido: referencia.valorTotal }]) : null;
    return [f.itemId, { id: f.id, status: f.status, quantidadeLitros: f.quantidadeLitros.toFixed(3), custoProducao: verValores ? custoProducao : null,
      referencia, referencias, movimentos: f.movimentos.map(m => ({ entradaId: m.entradaId, movimentoId: m.movimentoId, natureza: m.natureza, quantidadeLitros: m.quantidadeLitros.toFixed(3) })),
      parcelas: f.parcelas.map(p => ({ animalId: p.animalId, dias: p.dias, baseQuantidade: p.baseQuantidade, quantidadeLitros: p.quantidadeLitros.toFixed(3), valorGerencial: verReferenciasComerciais ? atribuicao?.participacoes.find(a => a.animalId === p.animalId)?.custoConhecido ?? null : null })) }];
  }));
}
