import type { LocalizacaoAnimal, Prisma } from '@prisma/client';
import { auditar, RebanhoError } from '../rebanho/regras.js';

/** Chamado depois de escrever a localização, dentro da mesma transação e sob o lock do animal.
 * Só entradas explicitamente novas/regularizadas criam participação: uma correção não importa
 * silenciosamente permanências históricas ainda não conciliadas. */
export async function sincronizarLocalizacoesBezerreiroTx(
  tx: Prisma.TransactionClient,
  animalIds: string[],
  usuarioId: number | null,
  anteriores: LocalizacaoAnimal[] = [],
  novasIds: string[] | 'INICIAIS' = [],
  motivo = 'Integração com a localização do animal',
) {
  const ids = [...new Set(animalIds)].sort();
  if (!ids.length) return;
  const locais = await tx.localizacaoAnimal.findMany({ where: { animalId: { in: ids } }, orderBy: [{ desde: 'asc' }, { id: 'asc' }] });
  const perfis = await tx.perfilBezerreiro.findMany({ where: { loteId: { in: [...new Set([...locais, ...anteriores].flatMap(l => l.loteId ? [l.loteId] : []))] } } });
  const ps = await tx.participacaoBezerreiro.findMany({ where: { animalId: { in: ids } }, include: { perfil: true, fases: true } });
  // A oferta também trava todos os animais antes do perfil; não é necessário obter um
  // perfil depois de outro perfil numa movimentação coletiva, evitando ordem inversa.
  const agrupar = (linhas: LocalizacaoAnimal[]) => {
    const grupos: (LocalizacaoAnimal & { ids: string[] })[] = [];
    for (const linha of [...linhas].sort((a,b) => a.animalId.localeCompare(b.animalId) || (a.loteId ?? '').localeCompare(b.loteId ?? '') || a.propriedadeId-b.propriedadeId || a.desde.getTime()-b.desde.getTime())) {
      const anterior = grupos.at(-1);
      if (anterior && anterior.animalId === linha.animalId && anterior.loteId === linha.loteId && anterior.propriedadeId === linha.propriedadeId && (!anterior.ate || anterior.ate >= linha.desde)) {
        anterior.ids.push(linha.id);
        anterior.ate = !anterior.ate || !linha.ate ? null : anterior.ate > linha.ate ? anterior.ate : linha.ate;
      } else grupos.push({ ...linha, ids: [linha.id] });
    }
    return grupos;
  };
  const grupos = agrupar(locais), gruposAntes = agrupar(anteriores);
  const contem = (l: LocalizacaoAnimal, p: typeof ps[number]) => l.animalId === p.animalId && l.loteId === p.perfil.loteId && l.propriedadeId === p.perfil.propriedadeId && l.desde <= p.desde && (!l.ate || l.ate > p.desde);
  const igual = (a: Date | null, b: Date | null) => a?.getTime() === b?.getTime();
  const planos = ps.map(p => {
    const antes = gruposAntes.find(l => contem(l, p));
    const local = (antes ? grupos.find(l => l.ids.some(id => antes.ids.includes(id)) && l.loteId === p.perfil.loteId && l.propriedadeId === p.perfil.propriedadeId) : undefined) ?? grupos.find(l => contem(l, p));
    const desde = local ? (antes && igual(p.desde, antes.desde) ? local.desde : p.desde < local.desde ? local.desde : p.desde) : null;
    const ate = local ? (antes && igual(p.ate, antes.ate) ? local.ate : p.ate && (!local.ate || p.ate <= local.ate) ? p.ate : local.ate) : null;
    const expande = local && (desde! < p.desde || p.ate != null && (ate == null || ate > p.ate));
    return { p, local, desde, ate, ordem: !local ? 0 : expande ? 2 : 1 };
  }).sort((a, b) => a.ordem - b.ordem || a.p.id.localeCompare(b.p.id));
  // A exclusão GiST é imediata: remover/encurtar antes de reabrir evita conflito
  // temporário entre origem e destino ao desfazer uma transferência.
  for (const { p, local, desde, ate } of planos) {
    const mudou = !local || !igual(desde, p.desde) || !igual(ate, p.ate);
    if (!mudou) continue;
    if (local && !p.perfil.ativo && p.ate && (!ate || ate > p.ate)) throw new RebanhoError('CONFLITO', 'O perfil do Bezerreiro foi desativado. Regularize sua ativação antes de reabrir a permanência.');
    if (desde && ate && ate <= desde) throw new RebanhoError('CONFLITO', 'Entrada e saída do Bezerreiro no mesmo dia não formam permanência válida. Regularize a localização; não é possível inventar horário ou data.');
    const ofertas = await tx.grupoOfertaBezerreiro.findMany({ where: { oferta: { perfilId: p.perfilId, status: 'CONFIRMADO', data: { gte: p.desde, ...(p.ate ? { lt: p.ate } : {}) } }, participantesSnapshot: { array_contains: [{ animalId: p.animalId }] } }, include: { oferta: { select: { data: true } } } });
    if (ofertas.some(o => !local || o.oferta.data < desde! || (ate != null && o.oferta.data >= ate))) throw new RebanhoError('CONFLITO', 'Regularize ou estorne as ofertas realizadas incompatíveis antes de corrigir ou desfazer a localização.');
    if (!local) {
      if (p.fases.length || ofertas.length) throw new RebanhoError('CONFLITO', 'A participação possui fases ou ofertas registradas. Regularize esses fatos antes de desfazer a localização.');
      await tx.participacaoBezerreiro.delete({ where: { id: p.id } });
      await auditar(tx, { entidade: 'ParticipacaoBezerreiro', entidadeId: p.id, animalId: p.animalId, propriedadeId: p.perfil.propriedadeId, usuarioId, acao: 'DESFAZER_LOCALIZACAO', antes: p, depois: { motivo } });
      continue;
    }
    for (const f of p.fases) {
      if (f.desde < desde! || (ate && f.desde >= ate)) throw new RebanhoError('CONFLITO', 'Há uma fase fora da permanência proposta. Regularize a programação antes de corrigir a localização.');
      if (ate && (!f.ate || f.ate > ate)) {
        await tx.periodoFaseBezerreiro.update({ where: { id: f.id }, data: { ate } });
        await auditar(tx, { entidade: 'PeriodoFaseBezerreiro', entidadeId: f.id, animalId: p.animalId, propriedadeId: p.perfil.propriedadeId, usuarioId, acao: 'ENCERRAMENTO_LOCALIZACAO', antes: f, depois: { ...f, ate, motivo } });
      }
    }
    const salvo = await tx.participacaoBezerreiro.update({ where: { id: p.id, versao: p.versao }, data: { desde: desde!, ate, motivoSaida: ate ? motivo : null, versao: { increment: 1 } } });
    await auditar(tx, { entidade: 'ParticipacaoBezerreiro', entidadeId: p.id, animalId: p.animalId, propriedadeId: p.perfil.propriedadeId, usuarioId, acao: 'LOCALIZACAO', antes: p, depois: salvo });
  }
  const novas = novasIds === 'INICIAIS' ? locais : locais.filter(l => novasIds.includes(l.id));
  for (const l of novas) {
    const perfil = perfis.find(p => p.ativo && p.loteId === l.loteId && p.propriedadeId === l.propriedadeId);
    if (!perfil) continue;
    if (l.ate && l.ate <= l.desde) throw new RebanhoError('CONFLITO', 'Bezerreiro exige saída posterior à entrada; uma permanência vazia no mesmo dia precisa de regularização.');
    const existente = await tx.participacaoBezerreiro.findFirst({ where: { animalId: l.animalId, perfilId: perfil.id, ...(l.ate ? { desde: { lt: l.ate } } : {}), OR: [{ ate: null }, { ate: { gt: l.desde } }] } });
    if (existente) {
      if (existente.desde > l.desde || existente.ate && (!l.ate || existente.ate < l.ate)) throw new RebanhoError('CONFLITO', 'A participação existente cobre apenas parte da localização. Concilie o intervalo e seus fatos antes de regularizar.');
      continue;
    }
    const p = await tx.participacaoBezerreiro.create({ data: { perfilId: perfil.id, animalId: l.animalId, desde: l.desde, ate: l.ate, motivoEntrada: motivo, motivoSaida: l.ate ? motivo : null, criadoPorId: usuarioId } });
    await auditar(tx, { entidade: 'ParticipacaoBezerreiro', entidadeId: p.id, animalId: p.animalId, propriedadeId: perfil.propriedadeId, usuarioId, acao: 'ENTRADA_LOCALIZACAO', depois: { ...p, localizacaoId: l.id } });
  }
}
