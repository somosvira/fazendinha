import { Prisma } from '@prisma/client';
import { prisma } from '../../../db.js';
import { exigirPeriodoAberto } from '../../financeiro/regras.js';
import { transacaoPecuaria } from '../transacao.js';
import { auditar, hojeFazendaDate, RebanhoError, travarAnimais } from '../rebanho/regras.js';
import { operacaoIdempotenteTx, hashDados } from '../reproducao/operacoes.js';
import { origensNutricionaisLeiteTx, baixarLeiteNutricionalTx } from '../leite/nutricao.js';
import { aplicarReferenciaProvisoriaTx } from '../leite/referencias.js';
import { estornarBaixaLeiteTx, valoresMovimentosLeiteTx } from '../../estoque/leite.js';
import { normalizarDetalhesParto } from '../reproducao/partos.js';
import { conferirAnimalNoFato } from '../fatos.js';
import { distribuirQuantidade, quantidadePorOferta } from './aleitamento.calc.js';
import { configuracaoTx, dataFato, dia, obterPerfilTx, participantesNaDataTx, textoDia, travarPerfil } from './gestao.js';
import { confirmarOfertaSchema, type ConsultaBezerreiro } from './schemas.js';
import type { z } from 'zod';
import { exigirAdicionalExplicito, fechamentosSobrepostosTx, travarAlimentacaoLeiteTx } from './alimentacao-compartilhada.js';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const autor = (id: number | null) => id != null && id > 0 ? id : null;
type Confirmacao = z.infer<typeof confirmarOfertaSchema> & { propriedadeId: number };
type RecortePrevisao = Pick<ConsultaBezerreiro, 'animalId' | 'coleiraId' | 'faseVersaoId' | 'busca'>;
type ParticipantePrevisto = {
  animalId: string; brinco: string; nome: string | null; participacaoId: string; faseVersaoId: string; litrosDia: string;
  coleira: { id: string; nome: string; cor: string } | null;
  ofertas: { id: string; identidadeId: string; ordem: number; percentual: string; horarioPrevisto: string | null }[];
};
function coleiraHistorica(fase: { coleiraId: string | null; coleiraSnapshot: Prisma.JsonValue | null; coleira: { id: string; nome: string; cor: string } | null }) {
  const s = fase.coleiraSnapshot;
  if (s && typeof s === 'object' && !Array.isArray(s) && typeof s.id === 'string' && typeof s.nome === 'string' && typeof s.cor === 'string') return { id: s.id, nome: s.nome, cor: s.cor };
  return fase.coleira ? { id: fase.coleira.id, nome: fase.coleira.nome, cor: fase.coleira.cor } : null;
}
export async function previsaoTx(tx: Prisma.TransactionClient, propriedadeId: number, data: Date, perfilId?: string, recorte: RecortePrevisao = {}) {
  const perfil = perfilId ? await obterPerfilTx(tx, perfilId, propriedadeId) : null;
  const encontrados = await participantesNaDataTx(tx, propriedadeId, data, perfilId);
  const busca = recorte.busca?.trim().toLocaleLowerCase('pt-BR');
  const participantes = encontrados.filter(p => (!recorte.animalId || p.animalId === recorte.animalId)
    && (!recorte.coleiraId || p.fases[0]?.faseVersao.coleiraId === recorte.coleiraId)
    && (!recorte.faseVersaoId || p.fases[0]?.faseVersao.id === recorte.faseVersaoId)
    && (!busca || `${p.animal.brinco} ${p.animal.nome ?? ''}`.toLocaleLowerCase('pt-BR').includes(busca)));
  const grupos = new Map<string, { coleiraId: string | null; nome: string; cor: string | null; participantes: ParticipantePrevisto[]; litrosDia: Prisma.Decimal }>();
  const pendentes: string[] = [];
  for (const p of participantes) {
    const f = p.fases[0]?.faseVersao;
    if (!f || !f.publicada || !p.localizacaoComprovada) { pendentes.push(p.animalId); continue; }
    const key = f.coleiraId ?? 'sem-coleira', coleira = coleiraHistorica(f);
    let g = grupos.get(key);
    if (!g) { g = { coleiraId: f.coleiraId, nome: coleira?.nome ?? 'Sem coleira', cor: coleira?.cor ?? null, participantes: [], litrosDia: D(0) }; grupos.set(key, g); }
    g.litrosDia = g.litrosDia.plus(f.litrosDia);
    g.participantes.push({ animalId: p.animalId, brinco: p.animal.brinco, nome: p.animal.nome, participacaoId: p.id, faseVersaoId: f.id, litrosDia: f.litrosDia.toFixed(3), coleira,
      ofertas: f.ofertas.map(o => ({ id: o.id, identidadeId: o.identidadeId, ordem: o.ordem, horarioPrevisto: o.horarioPrevisto, percentual: o.percentual.toFixed(4) })) });
  }
  const realizadas = await tx.ofertaBezerreiro.findMany({ where: { propriedadeId, data, status: 'CONFIRMADO', ...(perfilId ? { perfilId } : {}) },
    include: { grupos: { include: { itemConsumo: { include: { FornecimentoNutricionalLeite: { include: { parcelas: true } } } } } } }, orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }] });
  const possuiRecorte = !!(recorte.animalId || recorte.coleiraId || recorte.faseVersaoId || busca);
  const conhecidos = [...grupos.values()].map(g => {
    const ids = new Set(g.participantes.map(p => p.animalId));
    const fornecido = realizadas.flatMap(o => o.grupos).filter(x => x.coleiraId === g.coleiraId).reduce((n, x) => {
      if (!possuiRecorte) return n.plus(x.quantidadeLitros);
      const parcelas = x.itemConsumo?.FornecimentoNutricionalLeite?.parcelas ?? [];
      return n.plus(parcelas.filter(p => ids.has(p.animalId)).reduce((s, p) => s.plus(p.quantidadeLitros), D(0)));
    }, D(0));
    return { ...g, litrosDia: g.litrosDia.toFixed(3), fornecidoLitros: fornecido.toFixed(3), restanteLitros: Prisma.Decimal.max(0, g.litrosDia.minus(fornecido)).toFixed(3) };
  });
  const origens = await origensNutricionaisLeiteTx(tx, propriedadeId, data);
  const idsRecorte = new Set(participantes.map(p => p.animalId));
  const ofertasDoRecorte = possuiRecorte ? realizadas.filter(o => o.grupos.some(g => g.itemConsumo?.FornecimentoNutricionalLeite?.parcelas.some(p => idsRecorte.has(p.animalId)))) : realizadas;
  // O token usa o universo do perfil, sem depender de filtros ou paginação.
  const contextoToken = hashDados({ versao: 1, propriedadeId, perfilId: perfilId ?? null, data: textoDia(data),
    perfil: perfil ? { id: perfil.id, ativo: perfil.ativo, loteId: perfil.loteId, loteAtivo: perfil.lote.ativo } : null,
    participantes: [...encontrados].sort((a, b) => a.id.localeCompare(b.id)).map(p => ({
      id: p.id, animalId: p.animalId, perfilId: p.perfilId, versao: p.versao, desde: p.desde, ate: p.ate, localizacaoComprovada: p.localizacaoComprovada,
      fases: [...p.fases].sort((a, b) => a.faseVersao.id.localeCompare(b.faseVersao.id)).map(f => ({ id: f.id, desde: f.desde, ate: f.ate,
        fase: { id: f.faseVersao.id, versao: f.faseVersao.versao, publicada: f.faseVersao.publicada, coleira: coleiraHistorica(f.faseVersao), litrosDia: f.faseVersao.litrosDia.toFixed(3),
          ofertas: [...f.faseVersao.ofertas].sort((a, b) => a.id.localeCompare(b.id)).map(o => ({ id: o.id, identidadeId: o.identidadeId, ordem: o.ordem, percentual: o.percentual.toFixed(4), horarioPrevisto: o.horarioPrevisto })) } })) })),
    realizadas: realizadas.map(o => ({ id: o.id, versao: o.versao })).sort((a, b) => a.id.localeCompare(b.id)) });
  return { contextoToken, data: textoDia(data), grupos: conhecidos, pendentes, previsaoCompleta: !pendentes.length,
    totalPrevistoLitros: conhecidos.reduce((n, g) => n.plus(g.litrosDia), D(0)).toFixed(3), totalFornecidoLitros: conhecidos.reduce((n, g) => n.plus(g.fornecidoLitros), D(0)).toFixed(3),
    ofertasRealizadas: ofertasDoRecorte.map(o => ({ id: o.id, data: textoDia(o.data), ocorridoEm: o.ocorridoEm, ofertaProgramadaId: o.ofertaProgramadaId, versao: o.versao })),
    origens: origens.map(o => ({ entradaId: o.entradaId, produtoId: o.produtoId, produtoNome: o.produtoNome, natureza: o.natureza, quantidadeDisponivelLitros: o.quantidade.toFixed(3) })) };
}
export async function consultarPrevisao(propriedadeId: number, q: ConsultaBezerreiro) {
  if (q.de || q.ate) throw new RebanhoError('VALIDACAO', 'A previsão é diária; informe a data, sem período');
  return prisma.$transaction(tx => previsaoTx(tx, propriedadeId, q.data ? dia(q.data) : hojeFazendaDate(), q.perfilId, q), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
export async function confirmarOferta(input: Confirmacao, usuarioId: number | null) {
  if (!input.contextoToken) throw new RebanhoError('VALIDACAO', 'Contexto da previsão ausente. Atualize a página e confira a alimentação antes de confirmar.', 'contextoToken');
  input = { ...confirmarOfertaSchema.parse(input), propriedadeId: input.propriedadeId };
  usuarioId = autor(usuarioId);
  return transacaoPecuaria(tx => confirmarOfertaTx(tx, input, usuarioId));
}

/** Compõe a confirmação com outros fatos na mesma transação; mantém idempotência. */
export async function confirmarOfertaTx(tx: Prisma.TransactionClient, input: Confirmacao, usuarioId: number | null) {
  return operacaoIdempotenteTx(tx, input, usuarioId, 'BEZERREIRO_OFERTA', async () => {
    const data = dataFato(input.data);
    await travarAlimentacaoLeiteTx(tx, input.propriedadeId);
    const referencias = await participantesNaDataTx(tx, input.propriedadeId, data, input.perfilId);
    await travarAnimais(tx, referencias.map(p => p.animalId)); await travarPerfil(tx, input.perfilId);
    const perfil = await obterPerfilTx(tx, input.perfilId, input.propriedadeId);
    if (!perfil.ativo || !perfil.lote.ativo) throw new RebanhoError('CONFLITO', 'Bezerreiro ou lote inativo');
    await exigirPeriodoAberto(tx, input.propriedadeId, data);
    if (new Set(input.grupos.map(g => g.coleiraId ?? '')).size !== input.grupos.length) throw new RebanhoError('VALIDACAO', 'Coleira repetida no fornecimento');
    if (!input.grupos.some(g => D(g.quantidadeLitros).gt(0))) throw new RebanhoError('VALIDACAO', 'Informe um volume positivo');
    const { ocorridoEm, horarioEstimado } = normalizarDetalhesParto({ ocorridoEm: input.ocorridoEm, horarioEstimado: input.horarioEstimado }, input.data);
    const previa = await previsaoTx(tx, input.propriedadeId, data, input.perfilId);
    if (previa.contextoToken !== input.contextoToken) throw new RebanhoError('CONFLITO', 'Participantes, permanências ou programação mudaram desde a previsão. Atualize o contexto e confira novamente.', 'contextoToken');
    const sobreposicoes = await fechamentosSobrepostosTx(tx, input.propriedadeId, data, previa.grupos.flatMap(g => g.participantes.map(p => p.animalId)));
    for (const grupo of input.grupos.filter(g => D(g.quantidadeLitros).gt(0))) {
      const ids = new Set(previa.grupos.find(g => g.coleiraId === (grupo.coleiraId ?? null))?.participantes.map(p => p.animalId) ?? []);
      exigirAdicionalExplicito(sobreposicoes.filter(f => f.animalIds.some(id => ids.has(id))), grupo.consumoAdicional, grupo.justificativa);
    }
    let identidade: string | null = null;
    if (input.ofertaProgramadaId) {
      const o = await tx.ofertaProgramadaBezerreiro.findFirst({ where: { id: input.ofertaProgramadaId, faseVersao: { propriedadeId: input.propriedadeId, publicada: true } } });
      if (!o) throw new RebanhoError('VALIDACAO', 'Oferta prevista não pertence ao sítio');
      identidade = o.identidadeId;
    }
    const config = await configuracaoTx(tx, input.propriedadeId);
    const dadosOferta = { perfilId: input.perfilId, propriedadeId: input.propriedadeId, data, ocorridoEm, horarioEstimado, ofertaProgramadaId: input.ofertaProgramadaId,
      configuracaoId: config?.id, configuracaoSnapshot: config ? JSON.parse(JSON.stringify(config)) : Prisma.JsonNull, chave: input.chave, hash: hashDados(input), responsavel: input.responsavel, observacao: input.observacao, criadoPorId: usuarioId } satisfies Prisma.OfertaBezerreiroUncheckedCreateInput;
    const oferta = await tx.ofertaBezerreiro.create({ data: dadosOferta });
    for (const g of input.grupos) {
      const esperado = previa.grupos.find(x => x.coleiraId === (g.coleiraId ?? null));
      if (!esperado) throw new RebanhoError('CONFLITO', 'Coleira sem participantes comprovados nesta data');
      const quantidade = D(g.quantidadeLitros);
      if (quantidade.isZero()) continue;
      const base = esperado.participantes.map(p => {
        if (!identidade) return { ...p, previstoOferta: D(p.litrosDia) };
        const o = p.ofertas.find(o => o.identidadeId === identidade);
        if (!o) throw new RebanhoError('CONFLITO', 'A oferta prevista não pertence à fase de todos os participantes');
        return { ...p, previstoOferta: quantidadePorOferta(p.litrosDia, p.ofertas).find(x => x.id === o.id)!.quantidade };
      });
      const previstoOferta = base.reduce((n, p) => n.plus(p.previstoOferta), D(0));
      const planejado = previstoOferta;
      const porContagem = previstoOferta.isZero();
      if ((!identidade || !quantidade.eq(planejado) || porContagem) && !g.justificativa) throw new RebanhoError('VALIDACAO', 'Justifique o fornecimento avulso, sem dose prevista ou diferente do previsto');
      for (const p of base) await conferirAnimalNoFato(tx, p.animalId, input.propriedadeId, data);
      const criterio = porContagem ? 'CONTAGEM_PARTICIPANTES' : identidade ? 'QUANTIDADE_PROGRAMADA_OFERTA' : 'DOSE_DIARIA_PROGRAMADA';
      const participantesSnapshot = base.map(p => ({ animalId: p.animalId, participacaoId: p.participacaoId, faseVersaoId: p.faseVersaoId, litrosDia: p.litrosDia, coleira: p.coleira, ofertas: p.ofertas,
        consumoAdicional: g.consumoAdicional === true, quantidadePrevistaOferta: p.previstoOferta.toFixed(3), criterioAtribuicao: criterio, pesoAtribuicao: porContagem ? '1' : p.previstoOferta.toFixed(3) }));
      const parcelas = distribuirQuantidade(quantidade, participantesSnapshot.map(p => ({ id: p.animalId, peso: p.pesoAtribuicao })));
      const grupo = await tx.grupoOfertaBezerreiro.create({ data: { ofertaId: oferta.id, coleiraId: g.coleiraId ?? null, quantidadeLitros: quantidade, quantidadePrevistaLitros: planejado, participantesSnapshot, programacaoSnapshot: participantesSnapshot, justificativa: g.justificativa } });
      const origens = await origensNutricionaisLeiteTx(tx, input.propriedadeId, data, true);
      const ids = g.entradaIds === undefined ? origens.map(o => o.entradaId) : g.entradaIds;
      const principal = origens.filter(o => ids.includes(o.entradaId)).sort((a, b) => Number(a.natureza === 'COMERCIAL') - Number(b.natureza === 'COMERCIAL') || a.data.localeCompare(b.data) || a.ordem - b.ordem || a.entradaId.localeCompare(b.entradaId))[0];
      if (!principal) throw new RebanhoError('CONFLITO', 'Nenhuma origem de leite disponível');
      const baixa = await baixarLeiteNutricionalTx(tx, { produtoId: principal.produtoId, propriedadeId: input.propriedadeId, data, quantidade, entradaIds: ids, usuarioId, observacao: `Alimentação do bezerreiro · oferta ${oferta.id}` });
      const item = await tx.itemFechamentoConsumo.create({ data: { grupoOfertaId: grupo.id, produtoId: principal.produtoId, quantidadePrevista: planejado, quantidadeConfirmada: quantidade,
        baseQuantidade: 'CONFERIDA', motivoAjuste: g.justificativa, unidade: 'L', modoEstoque: 'BAIXA_ESTOQUE', situacaoCusto: baixa.custoProducao == null ? 'NAO_APURADO' : 'CONHECIDO' } });
      const fornecimento = await tx.fornecimentoNutricionalLeite.create({ data: { itemId: item.id, propriedadeId: input.propriedadeId, data, quantidadeLitros: quantidade, criadoPorId: usuarioId,
        movimentos: { create: baixa.movimentos }, parcelas: { create: parcelas.map(p => ({ animalId: p.id, dias: null, quantidadeLitros: p.quantidade, baseQuantidade: 'ATRIBUIDA', criterioAtribuicao: 'ATRIBUIDA_POR_OFERTA', programacaoSnapshot: participantesSnapshot })) } } });
      await aplicarReferenciaProvisoriaTx(tx, fornecimento, usuarioId);
    }
    await auditar(tx, { entidade: 'OfertaBezerreiro', entidadeId: oferta.id, propriedadeId: input.propriedadeId, usuarioId, acao: 'FORNECIMENTO', depois: oferta });
    return { id: oferta.id, versao: oferta.versao, status: oferta.status };
  });
}
export async function estornarOferta(id: string, input: { chave: string; propriedadeId: number; versaoEsperada: number; motivo: string }, usuarioId: number | null) {
  usuarioId = autor(usuarioId);
  return transacaoPecuaria(tx => operacaoIdempotenteTx(tx, { ...input, id }, usuarioId, 'BEZERREIRO_ESTORNO_OFERTA', async () => {
    await travarAlimentacaoLeiteTx(tx, input.propriedadeId);
    const referencia = await tx.ofertaBezerreiro.findFirst({ where: { id, propriedadeId: input.propriedadeId }, select: { perfilId: true } });
    if (!referencia) throw new RebanhoError('NAO_ENCONTRADO', 'Oferta não encontrada');
    await travarPerfil(tx, referencia.perfilId);
    const f = await tx.ofertaBezerreiro.findFirst({ where: { id, propriedadeId: input.propriedadeId }, include: { grupos: { include: { itemConsumo: { include: { FornecimentoNutricionalLeite: { include: { movimentos: true } } } } } } } });
    if (!f || f.status !== 'CONFIRMADO' || f.versao !== input.versaoEsperada) throw new RebanhoError('CONFLITO', 'Oferta já alterada ou estornada');
    await exigirPeriodoAberto(tx, input.propriedadeId, f.data); await exigirPeriodoAberto(tx, input.propriedadeId, hojeFazendaDate());
    for (const g of f.grupos) {
      const fornecimento = g.itemConsumo?.FornecimentoNutricionalLeite;
      if (!fornecimento) continue;
      for (const m of fornecimento.movimentos) await estornarBaixaLeiteTx(tx, { movimentoId: m.movimentoId, propriedadeId: input.propriedadeId, usuarioId, motivo: input.motivo });
      await tx.fornecimentoNutricionalLeite.update({ where: { id: fornecimento.id }, data: { status: 'ESTORNADO' } });
    }
    const salvo = await tx.ofertaBezerreiro.update({ where: { id, versao: input.versaoEsperada }, data: { status: 'ESTORNADO', versao: { increment: 1 }, estornadoEm: new Date(), estornadoPorId: usuarioId, motivoEstorno: input.motivo } });
    await auditar(tx, { entidade: 'OfertaBezerreiro', entidadeId: id, propriedadeId: input.propriedadeId, usuarioId, acao: 'ESTORNO', antes: f, depois: salvo });
    return { id: salvo.id, versao: salvo.versao, status: salvo.status };
  }));
}
export async function consultarOfertas(propriedadeId: number, q: ConsultaBezerreiro, verValores: boolean) {
  return prisma.$transaction(async tx => {
    const filtroGrupo: Prisma.GrupoOfertaBezerreiroWhereInput = {
      ...(q.coleiraId ? { coleiraId: q.coleiraId } : {}),
      ...(q.animalId || q.faseVersaoId ? { participantesSnapshot: { array_contains: [{ ...(q.animalId ? { animalId: q.animalId } : {}), ...(q.faseVersaoId ? { faseVersaoId: q.faseVersaoId } : {}) }] } } : {}),
    };
    const where: Prisma.OfertaBezerreiroWhereInput = { propriedadeId, ...(q.perfilId ? { perfilId: q.perfilId } : {}),
      ...(q.data || q.de || q.ate ? { data: q.data ? dia(q.data) : { ...(q.de ? { gte: dia(q.de) } : {}), ...(q.ate ? { lte: dia(q.ate) } : {}) } } : {}),
      ...(q.animalId || q.coleiraId || q.faseVersaoId ? { grupos: { some: filtroGrupo } } : {}),
    };
    const [total, itens] = await Promise.all([tx.ofertaBezerreiro.count({ where }), tx.ofertaBezerreiro.findMany({ where, orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }], skip: (q.pagina - 1) * q.porPagina, take: q.porPagina,
      include: { grupos: { include: { coleira: true, itemConsumo: { include: { FornecimentoNutricionalLeite: { include: { movimentos: true, parcelas: true, referencias: { orderBy: { versao: 'desc' }, take: 1 } } } } } } } } })]);
    const valores = verValores ? await valoresMovimentosLeiteTx(tx, itens.flatMap(o => o.grupos.flatMap(g => g.itemConsumo?.FornecimentoNutricionalLeite?.movimentos.map(m => m.movimentoId) ?? []))) : new Map();
    return { itens: itens.map(o => ({ id: o.id, data: textoDia(o.data), ocorridoEm: o.ocorridoEm, status: o.status, versao: o.versao, perfilId: o.perfilId, ofertaProgramadaId: o.ofertaProgramadaId, responsavel: o.responsavel, observacao: o.observacao,
      grupos: o.grupos.map(g => { const f = g.itemConsumo?.FornecimentoNutricionalLeite, custos = f?.movimentos.map(m => valores.get(m.movimentoId)?.valorTotal ?? null) ?? [];
        const historico = Array.isArray(g.participantesSnapshot) ? g.participantesSnapshot[0] : null;
        const coleira = historico && typeof historico === 'object' && !Array.isArray(historico) ? historico.coleira : null;
        const nomeHistorico = coleira && typeof coleira === 'object' && !Array.isArray(coleira) && typeof coleira.nome === 'string' ? coleira.nome : null;
        return { id: g.id, coleiraId: g.coleiraId, coleiraNome: nomeHistorico ?? g.coleira?.nome, quantidadeLitros: g.quantidadeLitros.toFixed(3), quantidadePrevistaLitros: g.quantidadePrevistaLitros.toFixed(3), participantes: g.participantesSnapshot,
          custoProducao: verValores && custos.length && custos.every(v => v != null) ? custos.reduce((n, v) => n.plus(v!), D(0)).toFixed(2) : null,
          referencia: verValores ? f?.referencias[0]?.valorTotal.toFixed(2) ?? null : null, fornecimentoId: f?.id, parcelas: f?.parcelas.map(p => ({ animalId: p.animalId, quantidadeLitros: p.quantidadeLitros.toFixed(3), baseQuantidade: p.baseQuantidade })) ?? [] };
      }) })), total, pagina: q.pagina, porPagina: q.porPagina };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
