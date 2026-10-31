import { Prisma } from '@prisma/client';
import { RebanhoError } from '../rebanho/regras.js';

/** A oferta e o fechamento disputam a mesma alimentação. Adquirir antes dos locks
 * de animais, lote e estoque; replays concluídos são recuperados antes deste lock. */
export async function travarAlimentacaoLeiteTx(tx: Prisma.TransactionClient, propriedadeId: number) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-alimentacao-leite:${propriedadeId}`}))`;
}
type Localizacao = { animalId: string; desde: Date; ate: Date | null };
const presente = (l: Localizacao, animalId: string, data: Date) => l.animalId === animalId && l.desde <= data && (!l.ate || l.ate > data);

/** Expõe fatos reais. Não transforma previsão em consumo nem abate litros automaticamente. */
export async function ofertasSobrepostasTx(tx: Prisma.TransactionClient, propriedadeId: number, inicio: Date, fim: Date, localizacoes: Localizacao[]) {
  const animalIds = [...new Set(localizacoes.map(l => l.animalId))];
  if (!animalIds.length) return [];
  const fatos = await tx.fornecimentoNutricionalLeite.findMany({
    where: { propriedadeId, status: 'CONFIRMADO', data: { gte: inicio, lte: fim },
      parcelas: { some: { animalId: { in: animalIds }, quantidadeLitros: { gt: 0 } } },
      ItemFechamentoConsumo: { grupoOferta: { is: { oferta: { status: 'CONFIRMADO' } } } } },
    include: { parcelas: true, ItemFechamentoConsumo: { include: { grupoOferta: { include: { oferta: true } } } } },
    orderBy: [{ data: 'asc' }, { id: 'asc' }],
  });
  return fatos.flatMap(f => {
    const parcelas = f.parcelas.filter(p => localizacoes.some(l => presente(l, p.animalId, f.data)) && p.quantidadeLitros.gt(0));
    const grupo = f.ItemFechamentoConsumo.grupoOferta;
    return parcelas.length && grupo ? [{ ofertaId: grupo.ofertaId, fornecimentoId: f.id, data: f.data.toISOString().slice(0, 10),
      quantidadeLitros: parcelas.reduce((n, p) => n.plus(p.quantidadeLitros), new Prisma.Decimal(0)).toFixed(3), animalIds: parcelas.map(p => p.animalId) }] : [];
  });
}

export async function fechamentosSobrepostosTx(tx: Prisma.TransactionClient, propriedadeId: number, data: Date, animalIds: string[]) {
  if (!animalIds.length) return [];
  const fatos = await tx.fornecimentoNutricionalLeite.findMany({
    where: { propriedadeId, status: 'CONFIRMADO', parcelas: { some: { animalId: { in: animalIds }, quantidadeLitros: { gt: 0 } } },
      ItemFechamentoConsumo: { fechamento: { is: { status: 'CONFIRMADO', inicio: { lte: data }, fim: { gte: data } } } } },
    include: { parcelas: true, ItemFechamentoConsumo: { include: { fechamento: true } } },
    orderBy: { id: 'asc' },
  });
  if (!fatos.length) return [];
  const locais = await tx.localizacaoAnimal.findMany({ where: { propriedadeId, animalId: { in: animalIds }, desde: { lte: data }, OR: [{ ate: null }, { ate: { gt: data } }] }, select: { animalId: true, loteId: true, desde: true, ate: true } });
  return fatos.flatMap(f => {
    const fechamento = f.ItemFechamentoConsumo.fechamento;
    const ids = f.parcelas.filter(p => animalIds.includes(p.animalId) && p.quantidadeLitros.gt(0) && locais.some(l => l.loteId === fechamento?.loteId && presente(l, p.animalId, data))).map(p => p.animalId);
    return fechamento && ids.length ? [{ fechamentoId: fechamento.id, inicio: fechamento.inicio.toISOString().slice(0, 10), fim: fechamento.fim.toISOString().slice(0, 10), animalIds: ids }] : [];
  });
}
export function exigirAdicionalExplicito(sobreposicoes: { fechamentoId: string }[], adicional: boolean | undefined, justificativa: string | null | undefined) {
  if (adicional && (!justificativa || justificativa.trim().length < 5)) throw new RebanhoError('VALIDACAO', 'Justifique o consumo adicional explicitamente conferido');
  if (sobreposicoes.length && !adicional) throw new RebanhoError('CONFLITO', 'Há leite registrado em fechamento de Nutrição para estes animais nesta data. Consulte o fechamento e concilie o fornecimento existente; para um novo consumo real, declare consumo adicional e justifique.');
}
