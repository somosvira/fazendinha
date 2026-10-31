import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../db.js';
import { transacaoPecuaria } from '../transacao.js';
import { operacaoIdempotenteTx } from '../reproducao/operacoes.js';
import { auditar, hojeFazendaDate, RebanhoError, travarAnimais } from '../rebanho/regras.js';
import { conferirAnimalNoFato } from '../fatos.js';
import { conferirSitioLeiteTx } from '../leite/configuracoes.js';
import { conferirProgramacao } from './aleitamento.calc.js';
import { dataCivil, salvarConfiguracaoSchema, type ConsultaBezerreiro, type SalvarConfiguracao } from './schemas.js';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const autor = (id: number | null) => id != null && id > 0 ? id : null;
export function dia(v: string) {
  if (!dataCivil.safeParse(v).success) throw new RebanhoError('VALIDACAO', 'Informe uma data civil válida');
  return new Date(`${v}T00:00:00Z`);
}
export const textoDia = (v: Date) => v.toISOString().slice(0, 10);
export function dataFato(v: string) {
  const d = dia(v);
  if (d > hojeFazendaDate()) throw new RebanhoError('VALIDACAO', 'Informe uma data válida até hoje');
  return d;
}
export async function travarPerfil(tx: Prisma.TransactionClient, id: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bezerreiro:${id}`}))`;
}
export async function obterPerfilTx(tx: Prisma.TransactionClient, id: string, propriedadeId: number) {
  const p = await tx.perfilBezerreiro.findFirst({ where: { id, propriedadeId }, include: { lote: true } });
  if (!p) throw new RebanhoError('NAO_ENCONTRADO', 'Bezerreiro não encontrado neste sítio');
  return p;
}
export async function configuracaoTx(tx: Prisma.TransactionClient, propriedadeId: number) {
  return tx.configuracaoBezerreiro.findFirst({ where: { propriedadeId }, orderBy: { versao: 'desc' } });
}
export async function consultarConfiguracao(propriedadeId: number) {
  return prisma.$transaction(async tx => ({
    vigente: await configuracaoTx(tx, propriedadeId),
    coleiras: await tx.coleiraBezerreiro.findMany({ where: { propriedadeId, ativo: true }, orderBy: { nome: 'asc' } }),
    fases: await tx.faseBezerreiroVersao.findMany({ where: { propriedadeId }, orderBy: [{ identidadeId: 'asc' }, { versao: 'desc' }], distinct: ['identidadeId'], include: { coleira: true, ofertas: { orderBy: { ordem: 'asc' } } } }),
    perfis: await tx.perfilBezerreiro.findMany({ where: { propriedadeId }, include: { lote: true } }),
  }), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
export async function salvarConfiguracao(input: SalvarConfiguracao & { propriedadeId: number }, usuarioId: number | null) {
  input = { ...salvarConfiguracaoSchema.parse(input), propriedadeId: input.propriedadeId };
  usuarioId = autor(usuarioId);
  return transacaoPecuaria(tx => operacaoIdempotenteTx(tx, input, usuarioId, 'BEZERREIRO_CONFIGURACAO', async () => {
    await travarPerfil(tx, `config:${input.propriedadeId}`);
    await conferirSitioLeiteTx(tx, input.propriedadeId, true);
    const atual = await configuracaoTx(tx, input.propriedadeId);
    if ((atual?.versao ?? 0) !== input.versaoEsperada) throw new RebanhoError('CONFLITO', 'A configuração mudou; confira a versão atual');
    const identidades = input.fases.flatMap(f => f.identidadeId ? [f.identidadeId] : []);
    if (new Set(identidades).size !== identidades.length) throw new RebanhoError('VALIDACAO', 'Uma fase não pode ter duas versões na mesma configuração');
    for (const fase of input.fases) conferirProgramacao(fase.litrosDia, fase.ofertas, fase.publicada);
    const config = await tx.configuracaoBezerreiro.create({ data: { propriedadeId: input.propriedadeId, versao: input.versaoEsperada + 1, brixReferencia: D(input.brixReferencia), percentualPesoColostro: D(input.percentualPesoColostro), imunidade: input.imunidade ?? Prisma.JsonNull, criadoPorId: usuarioId } });
    for (const f of input.fases) {
      let coleiraId = f.coleiraId ?? null;
      if (coleiraId) {
        if (!await tx.coleiraBezerreiro.findFirst({ where: { id: coleiraId, propriedadeId: input.propriedadeId, ativo: true } })) throw new RebanhoError('VALIDACAO', 'Coleira não pertence ao sítio');
        if (f.coleiraNome || f.cor) await tx.coleiraBezerreiro.update({ where: { id: coleiraId }, data: { ...(f.coleiraNome ? { nome: f.coleiraNome } : {}), ...(f.cor ? { cor: f.cor } : {}) } });
      } else if (f.coleiraNome) {
        const existente = await tx.coleiraBezerreiro.findFirst({ where: { propriedadeId: input.propriedadeId, nome: f.coleiraNome } });
        if (existente && (!existente.ativo || (f.cor && existente.cor !== f.cor))) throw new RebanhoError('CONFLITO', 'Selecione a coleira existente para alterar sua cor ou situação');
        coleiraId = existente?.id ?? (await tx.coleiraBezerreiro.create({ data: { propriedadeId: input.propriedadeId, nome: f.coleiraNome, cor: f.cor ?? '#006f68', criadoPorId: usuarioId } })).id;
      }
      const identidadeId = f.identidadeId ?? randomUUID();
      const anterior = await tx.faseBezerreiroVersao.findFirst({ where: { propriedadeId: input.propriedadeId, identidadeId }, orderBy: { versao: 'desc' } });
      await tx.faseBezerreiroVersao.create({ data: { propriedadeId: input.propriedadeId, identidadeId, versao: (anterior?.versao ?? 0) + 1, nome: f.nome, coleiraId, litrosDia: D(f.litrosDia), publicada: f.publicada, criteriosTransicao: f.criteriosTransicao ?? Prisma.JsonNull, criadoPorId: usuarioId, ofertas: { create: f.ofertas.map(o => ({ ...o, percentual: D(o.percentual) })) } } });
    }
    await auditar(tx, { entidade: 'ConfiguracaoBezerreiro', entidadeId: config.id, propriedadeId: input.propriedadeId, usuarioId, acao: 'CONFIGURACAO', antes: atual, depois: config });
    return { id: config.id, versao: config.versao };
  }));
}
export async function registrarPerfil(input: { chave: string; propriedadeId: number; loteId: string }, usuarioId: number | null) {
  usuarioId = autor(usuarioId);
  return transacaoPecuaria(tx => operacaoIdempotenteTx(tx, input, usuarioId, 'BEZERREIRO_PERFIL', async () => {
    await travarPerfil(tx, `lote:${input.loteId}`);
    await conferirSitioLeiteTx(tx, input.propriedadeId, true);
    const lote = await tx.lote.findFirst({ where: { id: input.loteId, propriedadeId: input.propriedadeId, ativo: true } });
    if (!lote) throw new RebanhoError('VALIDACAO', 'Selecione um lote ativo deste sítio');
    const existente = await tx.perfilBezerreiro.findUnique({ where: { loteId: lote.id } });
    if (existente) return existente;
    const p = await tx.perfilBezerreiro.create({ data: { loteId: lote.id, propriedadeId: input.propriedadeId, criadoPorId: usuarioId } });
    await auditar(tx, { entidade: 'PerfilBezerreiro', entidadeId: p.id, propriedadeId: input.propriedadeId, usuarioId, acao: 'REGISTRO', depois: p });
    return p;
  }));
}
export async function faseValidaTx(tx: Prisma.TransactionClient, id: string, propriedadeId: number) {
  const f = await tx.faseBezerreiroVersao.findFirst({ where: { id, propriedadeId, publicada: true }, include: { ofertas: true, coleira: true } });
  if (!f) throw new RebanhoError('VALIDACAO', 'Selecione uma fase publicada deste sítio');
  conferirProgramacao(f.litrosDia, f.ofertas, true);
  return f;
}
export async function registrarParticipacao(input: { chave: string; propriedadeId: number; perfilId: string; animalId: string; desde: string; faseVersaoId?: string; motivo?: string }, usuarioId: number | null) {
  usuarioId = autor(usuarioId);
  return transacaoPecuaria(tx => operacaoIdempotenteTx(tx, input, usuarioId, 'BEZERREIRO_ENTRADA', async () => {
    const data = dataFato(input.desde);
    await travarAnimais(tx, [input.animalId]); await travarPerfil(tx, input.perfilId);
    const perfil = await obterPerfilTx(tx, input.perfilId, input.propriedadeId);
    if (!perfil.ativo || !perfil.lote.ativo) throw new RebanhoError('CONFLITO', 'Bezerreiro ou lote inativo');
    await conferirAnimalNoFato(tx, input.animalId, input.propriedadeId, data);
    const local = await tx.localizacaoAnimal.findFirst({ where: { animalId: input.animalId, propriedadeId: input.propriedadeId, loteId: perfil.loteId, desde: { lte: data }, OR: [{ ate: null }, { ate: { gt: data } }] } });
    if (!local) throw new RebanhoError('VALIDACAO', 'Movimente o animal para o lote do bezerreiro antes de registrar a participação');
    if (await tx.participacaoBezerreiro.findFirst({ where: { animalId: input.animalId, OR: [{ ate: null }, { ate: { gt: data } }] } })) throw new RebanhoError('CONFLITO', 'Animal já possui participação sobreposta no bezerreiro');
    if (input.faseVersaoId) await faseValidaTx(tx, input.faseVersaoId, input.propriedadeId);
    const p = await tx.participacaoBezerreiro.create({ data: { perfilId: perfil.id, animalId: input.animalId, desde: data, motivoEntrada: input.motivo, criadoPorId: usuarioId, ...(input.faseVersaoId ? { fases: { create: { faseVersaoId: input.faseVersaoId, desde: data, criadoPorId: usuarioId } } } : {}) } });
    await auditar(tx, { entidade: 'ParticipacaoBezerreiro', entidadeId: p.id, animalId: p.animalId, propriedadeId: input.propriedadeId, usuarioId, acao: 'ENTRADA', depois: p });
    return p;
  }));
}
async function participacaoTravadaTx(tx: Prisma.TransactionClient, id: string, propriedadeId: number) {
  const where = { id, perfil: { propriedadeId } };
  const referencia = await tx.participacaoBezerreiro.findFirst({ where });
  if (!referencia) throw new RebanhoError('NAO_ENCONTRADO', 'Participação não encontrada');
  await travarAnimais(tx, [referencia.animalId]); await travarPerfil(tx, referencia.perfilId);
  const atual = await tx.participacaoBezerreiro.findFirst({ where });
  if (!atual) throw new RebanhoError('CONFLITO', 'Participação alterada; confira os dados atuais');
  return atual;
}
export async function mudarFase(id: string, input: { chave: string; propriedadeId: number; versaoEsperada: number; faseVersaoId: string; desde: string; motivo: string }, usuarioId: number | null) {
  usuarioId = autor(usuarioId);
  return transacaoPecuaria(tx => operacaoIdempotenteTx(tx, { ...input, id }, usuarioId, 'BEZERREIRO_FASE', async () => {
    const p = await participacaoTravadaTx(tx, id, input.propriedadeId);
    if (p.ate || p.versao !== input.versaoEsperada) throw new RebanhoError('CONFLITO', 'Participação mudou ou está encerrada');
    const data = dia(input.desde), amanha = new Date(hojeFazendaDate().getTime() + 86_400_000);
    if (data < p.desde || data > amanha) throw new RebanhoError('VALIDACAO', 'Confira a data de vigência');
    await faseValidaTx(tx, input.faseVersaoId, input.propriedadeId);
    if (await tx.grupoOfertaBezerreiro.findFirst({ where: { oferta: { perfilId: p.perfilId, status: 'CONFIRMADO', data: { gte: data } }, participantesSnapshot: { array_contains: [{ animalId: p.animalId }] } } })) throw new RebanhoError('CONFLITO', 'Há oferta realizada desde essa data; escolha o dia seguinte à última oferta');
    const aberto = await tx.periodoFaseBezerreiro.findFirst({ where: { participacaoId: id, ate: null }, orderBy: { desde: 'desc' } });
    if (aberto && aberto.desde > data) throw new RebanhoError('CONFLITO', 'Há uma fase futura; confira sua vigência antes de registrar outra troca');
    if (aberto && aberto.desde.getTime() === data.getTime()) {
      // Nenhuma oferta usa este intervalo: a correção preserva o antes/depois na auditoria.
      await tx.periodoFaseBezerreiro.update({ where: { id: aberto.id }, data: { faseVersaoId: input.faseVersaoId, solicitadaEm: new Date(), motivo: input.motivo } });
    } else {
      if (aberto) await tx.periodoFaseBezerreiro.update({ where: { id: aberto.id }, data: { ate: data } });
      await tx.periodoFaseBezerreiro.create({ data: { participacaoId: id, faseVersaoId: input.faseVersaoId, desde: data, motivo: input.motivo, criadoPorId: usuarioId } });
    }
    const salvo = await tx.participacaoBezerreiro.update({ where: { id, versao: input.versaoEsperada }, data: { versao: { increment: 1 } } });
    await auditar(tx, { entidade: 'ParticipacaoBezerreiro', entidadeId: id, animalId: p.animalId, propriedadeId: input.propriedadeId, usuarioId, acao: 'FASE', antes: { ...p, faseAnterior: aberto }, depois: { ...salvo, ...input } });
    return salvo;
  }));
}
export async function sairParticipacao(id: string, input: { chave: string; propriedadeId: number; versaoEsperada: number; data: string; motivo: string }, usuarioId: number | null) {
  usuarioId = autor(usuarioId);
  return transacaoPecuaria(tx => operacaoIdempotenteTx(tx, { ...input, id }, usuarioId, 'BEZERREIRO_SAIDA', async () => {
    const p = await participacaoTravadaTx(tx, id, input.propriedadeId), data = dataFato(input.data);
    if (p.ate || p.versao !== input.versaoEsperada || data <= p.desde) throw new RebanhoError('CONFLITO', 'Confira participação, versão e data posterior à entrada');
    if (await tx.grupoOfertaBezerreiro.findFirst({ where: { oferta: { perfilId: p.perfilId, status: 'CONFIRMADO', data: { gte: data } }, participantesSnapshot: { array_contains: [{ animalId: p.animalId }] } } })) throw new RebanhoError('CONFLITO', 'A saída não pode excluir uma participação já usada em oferta; escolha o dia seguinte');
    if (await tx.periodoFaseBezerreiro.findFirst({ where: { participacaoId: id, desde: { gte: data } } })) throw new RebanhoError('CONFLITO', 'Há uma fase nesta data ou depois dela; confira a programação antes de registrar a saída');
    await tx.periodoFaseBezerreiro.updateMany({ where: { participacaoId: id, ate: null }, data: { ate: data } });
    const salvo = await tx.participacaoBezerreiro.update({ where: { id, versao: input.versaoEsperada }, data: { ate: data, motivoSaida: input.motivo, versao: { increment: 1 } } });
    await auditar(tx, { entidade: 'ParticipacaoBezerreiro', entidadeId: id, animalId: p.animalId, propriedadeId: input.propriedadeId, usuarioId, acao: 'SAIDA', antes: p, depois: salvo });
    return salvo;
  }));
}
export async function participantesNaDataTx(tx: Prisma.TransactionClient, propriedadeId: number, data: Date, perfilId?: string) {
  const ps = await tx.participacaoBezerreiro.findMany({ where: { perfil: { propriedadeId, ...(perfilId ? { id: perfilId } : {}) }, desde: { lte: data }, OR: [{ ate: null }, { ate: { gt: data } }] }, include: { animal: { select: { id: true, brinco: true, nome: true, dataNascimento: true } }, perfil: { include: { lote: true } }, fases: { where: { desde: { lte: data }, OR: [{ ate: null }, { ate: { gt: data } }] }, orderBy: { desde: 'desc' }, include: { faseVersao: { include: { coleira: true, ofertas: { orderBy: { ordem: 'asc' } } } } } } } });
  const ids = ps.map(p => p.animalId);
  const locais = ids.length ? await tx.localizacaoAnimal.findMany({ where: { animalId: { in: ids }, propriedadeId, desde: { lte: data }, OR: [{ ate: null }, { ate: { gt: data } }] } }) : [];
  return ps.map(p => ({ ...p, localizacaoComprovada: locais.some(l => l.animalId === p.animalId && l.loteId === p.perfil.loteId) }));
}
export async function listarParticipantes(propriedadeId: number, q: ConsultaBezerreiro) {
  const data = q.data ? dia(q.data) : hojeFazendaDate();
  return prisma.$transaction(async tx => {
    const where: Prisma.ParticipacaoBezerreiroWhereInput = {
      perfil: { propriedadeId, ...(q.perfilId ? { id: q.perfilId } : {}) },
      ...(q.animalId ? { animalId: q.animalId } : {}),
      ...(q.historico === 'true' ? { ate: { lte: data, ...(q.de ? { gte: dia(q.de) } : {}), ...(q.ate ? { lte: dia(q.ate) < data ? dia(q.ate) : data } : {}) } } : { desde: { lte: q.ate ? dia(q.ate) : data }, OR: [{ ate: null }, { ate: { gt: q.de ? dia(q.de) : data } }] }),
      ...(q.busca ? { animal: { OR: [{ brinco: { contains: q.busca, mode: 'insensitive' } }, { nome: { contains: q.busca, mode: 'insensitive' } }] } } : {}),
      ...(q.coleiraId || q.faseVersaoId ? { fases: { some: { ...(q.historico === 'true' ? {} : { desde: { lte: data }, OR: [{ ate: null }, { ate: { gt: data } }] }), faseVersao: { ...(q.coleiraId ? { coleiraId: q.coleiraId } : {}), ...(q.faseVersaoId ? { id: q.faseVersaoId } : {}) } } } } : {}),
    };
    const [total, itens] = await Promise.all([
      tx.participacaoBezerreiro.count({ where }),
      tx.participacaoBezerreiro.findMany({ where, orderBy: [{ desde: 'desc' }, { id: 'asc' }], skip: (q.pagina - 1) * q.porPagina, take: q.porPagina, include: { animal: { select: { id: true, brinco: true, nome: true, dataNascimento: true } }, perfil: { include: { lote: true } }, fases: { orderBy: { desde: 'desc' }, include: { faseVersao: { include: { coleira: true, ofertas: true } } } } } }),
    ]);
    return { itens, total, pagina: q.pagina, porPagina: q.porPagina };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
