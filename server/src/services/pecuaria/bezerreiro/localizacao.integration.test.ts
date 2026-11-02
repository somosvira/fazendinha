import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../db.js';
import { exigirBancoIntegracaoPecuaria } from '../../../lib/banco-pecuaria-integration.fixture.js';
import { cadastrar, darBaixa, desfazerMovimentacao, estornarBaixa, movimentar } from '../rebanho/animais.js';
import { cadastrarAnimalSchema } from '../rebanho/schemas.js';
import { registrarPerfil, registrarParticipacao } from './gestao.js';
import { sincronizarLocalizacoesBezerreiroTx } from './localizacao.js';
import { travarBrinco, travarAnimais } from '../rebanho/regras.js';
import { conflitoTransacaoPecuaria } from '../transacao.js';
import { participantesNaDataTx } from './gestao.js';
import { criarPartoTx } from '../reproducao/registros.js';

const suite = process.env.PECUARIA_DB_INTEGRATION === '1' ? describe : describe.skip;
const sitios: number[] = [];
let sitio: number, outroSitio: number, loteA: string, loteB: string, perfilA: string;
const data = (s: string) => new Date(s);
const marca = `Bezerreiro-localizacao-${randomUUID()}`;
async function lote(nome: string, propriedadeId = sitio) {
  return prisma.lote.create({ data: { nome: `${marca}-${nome}`, propriedadeId } });
}
async function animal(loteId?: string, propriedadeId = sitio, nascimento = '2020-01-01') {
  return cadastrar(cadastrarAnimalSchema.parse({ brinco: randomUUID(), sexo: 'F', origem: 'COMPRADO', aptidao: 'LEITE', propriedadeId, loteId, dataNascimento: nascimento, dataEntrada: '2026-01-01' }), null);
}
const participantes = (animalId: string) => prisma.participacaoBezerreiro.findMany({ where: { animalId }, orderBy: { desde: 'asc' } });

// Somente fixtures próprias. Não há ofertas, estoque ou fatos imutáveis commitados.
// A cria e o parto são exercitados numa transação integralmente revertida.
afterAll(async () => {
  if (!sitios.length) return;
  const propriedadeId = { in: sitios };
  const animais = await prisma.animal.findMany({ where: { localizacoes: { some: { propriedadeId } } }, select: { id: true } });
  const animalId = { in: animais.map(a => a.id) };
  const movimentos = await prisma.movimentacao.findMany({ where: { propriedadeDestinoId: propriedadeId }, select: { id: true } });
  await prisma.$transaction(async tx => {
    await tx.auditoriaPecuaria.deleteMany({ where: { OR: [{ propriedadeId }, { animalId }, { entidadeId: { in: movimentos.map(m => m.id) } }] } });
    await tx.requisicaoPecuaria.deleteMany({ where: { propriedadeId } });
    await tx.periodoFaseBezerreiro.deleteMany({ where: { participacao: { animalId } } });
    await tx.participacaoBezerreiro.deleteMany({ where: { animalId } });
    await tx.faseBezerreiroVersao.deleteMany({ where: { propriedadeId } });
    await tx.baixaAnimal.deleteMany({ where: { animalId } });
    await tx.movimentacaoAnimal.deleteMany({ where: { animalId } });
    await tx.localizacaoAnimal.deleteMany({ where: { animalId } });
    await tx.movimentacao.deleteMany({ where: { propriedadeDestinoId: propriedadeId } });
    await tx.periodoReprodutivoAnimal.deleteMany({ where: { animalId } });
    await tx.finalidadeAnimal.deleteMany({ where: { animalId } });
    await tx.pesagem.deleteMany({ where: { animalId } });
    await tx.animal.deleteMany({ where: { id: animalId } });
    await tx.perfilBezerreiro.deleteMany({ where: { propriedadeId } });
    await tx.lote.deleteMany({ where: { propriedadeId } });
    await tx.propriedade.deleteMany({ where: { id: propriedadeId } });
    await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
  });
  expect(await prisma.propriedade.count({ where: { id: propriedadeId } })).toBe(0);
});

suite('localização e participação com PostgreSQL autorizado', () => {
  beforeAll(async () => {
    exigirBancoIntegracaoPecuaria();
    for (const nome of ['origem', 'destino']) sitios.push((await prisma.propriedade.create({ data: { nome: `${marca}-${nome}` } })).id);
    [sitio, outroSitio] = sitios;
    loteA = (await lote('A')).id; loteB = (await lote('B')).id;
    perfilA = (await registrarPerfil({ chave: randomUUID(), propriedadeId: sitio, loteId: loteA }, null)).id;
    await registrarPerfil({ chave: randomUUID(), propriedadeId: sitio, loteId: loteB }, null);
  });
  it('cadastro de adulto no lote participa sem fase; cria fora do lote não participa', async () => {
    const adulto = await animal(loteA), criaFora = await animal(undefined, sitio, '2025-12-20');
    expect(await participantes(adulto.id)).toHaveLength(1);
    expect(await prisma.periodoFaseBezerreiro.count({ where: { participacao: { animalId: adulto.id } } })).toBe(0);
    expect(await participantes(criaFora.id)).toHaveLength(0);
  });
  it('movimentação entrada/transferência/undo/baixa/estorno e reenvio mantêm um histórico coerente', async () => {
    const a = await animal();
    const entrada = { animalIds: [a.id], propriedadeId: sitio, loteId: loteA, data: '2026-01-02' };
    expect((await movimentar(entrada, null)).movidos).toBe(1);
    expect((await movimentar(entrada, null)).movidos).toBe(0);
    expect(await participantes(a.id)).toHaveLength(1);
    const transferida = await movimentar({ ...entrada, loteId: loteB, data: '2026-01-03' }, null);
    expect((await participantes(a.id)).map(p => p.ate?.toISOString().slice(0, 10) ?? null)).toEqual(['2026-01-03', null]);
    await desfazerMovimentacao(transferida.movimentacaoId, 'Conferência da localização', null);
    expect(await participantes(a.id)).toMatchObject([{ perfilId: perfilA, ate: null }]);
    await darBaixa({ animalId: a.id, tipo: 'EXTRAVIO', data: '2026-01-04' }, null);
    expect((await participantes(a.id))[0].ate).toEqual(data('2026-01-04'));
    await estornarBaixa(a.id, { motivo: 'Animal localizado novamente' }, null);
    expect((await participantes(a.id))[0].ate).toBeNull();
    await movimentar({ animalIds: [a.id], propriedadeId: outroSitio, data: '2026-01-05' }, null);
    expect((await participantes(a.id))[0].ate).toEqual(data('2026-01-05'));
  });
  it('saída no mesmo dia é recusada e localização/participação permanecem íntegras', async () => {
    const a = await animal(loteA);
    await expect(darBaixa({ animalId: a.id, tipo: 'EXTRAVIO', data: '2026-01-01' }, null)).rejects.toThrow('mesmo dia');
    expect((await participantes(a.id))[0].ate).toBeNull();
    expect(await prisma.localizacaoAnimal.count({ where: { animalId: a.id, ate: null } })).toBe(1);
    expect(await prisma.baixaAnimal.count({ where: { animalId: a.id } })).toBe(0);
  });
  it('animal inválido aborta movimentação coletiva inteira, inclusive o primeiro animal', async () => {
    const a = await animal(loteA), b = await animal(loteA);
    await expect(movimentar({ animalIds: [a.id, b.id, randomUUID()], propriedadeId: sitio, data: '2026-01-20' }, null)).rejects.toThrow('Animal não encontrado');
    expect(await prisma.localizacaoAnimal.count({ where: { animalId: { in: [a.id, b.id] }, loteId: loteA, ate: null } })).toBe(2);
    expect((await participantes(a.id))[0].ate).toBeNull();
  });
  it('fase incompatível recusa saída com rollback integral da fixture publicada', async () => {
    const a = await animal(loteA), p = (await participantes(a.id))[0];
    await expect(prisma.$transaction(async tx => {
      const f = await tx.faseBezerreiroVersao.create({ data: { propriedadeId: sitio, identidadeId: randomUUID(), versao: 1, nome: marca, litrosDia: 0, publicada: true } });
      await tx.periodoFaseBezerreiro.create({ data: { participacaoId: p.id, faseVersaoId: f.id, desde: data('2026-01-30') } });
      const anterior = await tx.localizacaoAnimal.findFirstOrThrow({ where: { animalId: a.id, ate: null } });
      await tx.localizacaoAnimal.update({ where: { id: anterior.id }, data: { ate: data('2026-01-20') } });
      await sincronizarLocalizacoesBezerreiroTx(tx, [a.id], null, [anterior]);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })).rejects.toThrow('fase fora');
    expect(await prisma.faseBezerreiroVersao.count({ where: { propriedadeId: sitio } })).toBe(0);
    expect((await participantes(a.id))[0].ate).toBeNull();
  });
  it('executor explícito configura lote ocupado, valida snapshot/escopo e não duplica ao repetir', async () => {
    const ocupado = await lote('ocupado'); const a = await animal(ocupado.id);
    await expect(registrarPerfil({ chave: randomUUID(), propriedadeId: sitio, loteId: ocupado.id }, null)).rejects.toThrow('Lote ocupado');
    await expect(registrarPerfil({ chave: randomUUID(), propriedadeId: outroSitio, loteId: ocupado.id }, null)).rejects.toThrow('deste sítio');
    const atual = await prisma.localizacaoAnimal.findFirstOrThrow({ where: { animalId: a.id, ate: null } });
    const comando = { chave: randomUUID(), propriedadeId: sitio, loteId: ocupado.id, regularizacao: { motivo: 'Conciliação explícita da fixture', localizacoes: [{ id: atual.id, animalId: a.id, desde: '2026-01-01' }] } };
    await expect(registrarPerfil({ ...comando, regularizacao: { ...comando.regularizacao, localizacoes: [] } }, null)).rejects.toThrow('prévia está incompleta');
    const perfil = await registrarPerfil(comando, null);
    expect(await registrarPerfil(comando, null)).toMatchObject({ id: perfil.id });
    expect(await registrarPerfil({ ...comando, chave: randomUUID() }, null)).toMatchObject({ id: perfil.id });
    expect(await participantes(a.id)).toHaveLength(1);
    expect(await registrarParticipacao({ chave: randomUUID(), propriedadeId: sitio, perfilId: perfil.id, animalId: a.id, desde: '2026-01-01', motivo: 'Revisão da mesma evidência' }, null)).toMatchObject({ perfilId: perfil.id });
    await expect(prisma.perfilBezerreiro.update({ where: { id: perfil.id }, data: { ativo: false } })).rejects.toThrow();
  });
  it('parto com cria viva no lote abre participação atomicamente sem inferir fase', async () => {
    const rollback = new Error('ROLLBACK_PARTO_BEZERREIRO');
    try {
      await prisma.$transaction(async tx => {
        const matriz = await tx.animal.create({ data: { brinco: randomUUID(), sexo: 'F', origem: 'COMPRADO', dataNascimento: data('2020-01-01'), dataEntrada: data('2024-01-01'), localizacoes: { create: { propriedadeId: sitio, desde: data('2024-01-01') } }, destinos: { create: { aptidao: 'LEITE', desde: data('2024-01-01') } }, papeisReprodutivos: { create: { tipo: 'NENHUM', inicio: data('2024-01-01'), origem: 'MANUAL' } } } });
        const parto = await criarPartoTx(tx, { chave: randomUUID(), animalId: matriz.id, propriedadeId: sitio, data: '2026-01-01', desfecho: 'NASCIMENTO', iniciarLactacao: false, crias: [{ viva: true, sexo: 'F', aptidao: 'LEITE', loteId: loteA, pesoKg: 32 }] }, null);
        const p = await tx.participacaoBezerreiro.findFirstOrThrow({ where: { animalId: parto.crias[0].animalId! } });
        expect(p.desde).toEqual(data('2026-01-01'));
        expect(await tx.periodoFaseBezerreiro.count({ where: { participacaoId: p.id } })).toBe(0);
        await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
        throw rollback;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
    } catch (e) { if (e !== rollback) throw e; }
  });
  it('oferta com snapshot anterior à saída recebe conflito SSI; toda oferta da fixture é revertida', async () => {
    const a = await animal(loteA), chave = randomUUID();
    let prosseguir!: () => void, leu!: () => void;
    const portao = new Promise<void>(r => { prosseguir = r; });
    const leitura = new Promise<void>(r => { leu = r; });
    const rollbackObrigatorio = new Error('ROLLBACK_OBRIGATORIO_OFERTA_FIXTURE');
    const oferta = prisma.$transaction(async tx => {
      const referencias = await participantesNaDataTx(tx, sitio, data('2026-01-10'), perfilA);
      expect(referencias.some(p => p.animalId === a.id)).toBe(true);
      leu(); await portao;
      await travarAnimais(tx, [a.id]);
      await tx.ofertaBezerreiro.create({ data: { perfilId: perfilA, propriedadeId: sitio, data: data('2026-01-10'), chave, hash: 'a'.repeat(64), grupos: { create: { quantidadePrevistaLitros: 0, quantidadeLitros: 0, programacaoSnapshot: [], participantesSnapshot: [{ animalId: a.id }] } } } });
      await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
      // Mesmo se a proteção falhar, este teste jamais commita um fato imutável.
      throw rollbackObrigatorio;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
    const resultado = Promise.allSettled([oferta]);
    try {
      await leitura;
      await movimentar({ animalIds: [a.id], propriedadeId: sitio, data: '2026-01-10' }, null);
      prosseguir();
      const [r] = await resultado;
      expect(r.status).toBe('rejected');
      if (r.status === 'rejected') expect(conflitoTransacaoPecuaria(r.reason)).toBe(true);
      expect(await prisma.ofertaBezerreiro.count({ where: { chave } })).toBe(0);
      expect((await participantes(a.id))[0].ate).toEqual(data('2026-01-10'));
    } finally { prosseguir(); await resultado; }
  }, 30_000);
  it('cadastro concorrente com configuração invalida snapshot e nunca deixa perfil ativo sem participação', async () => {
    const destino = await lote('concorrente'), brinco = randomUUID().toUpperCase();
    let liberar!: () => void, bloqueou!: () => void;
    const portao = new Promise<void>(r => { liberar = r; });
    const travado = new Promise<void>(r => { bloqueou = r; });
    const latch = prisma.$transaction(async tx => { await travarBrinco(tx, sitio, brinco); bloqueou(); await portao; }, { timeout: 20_000 });
    await travado;
    const fila = async (chave: string) => {
      for (let i = 0; i < 300; i++) {
        const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int n FROM pg_locks WHERE locktype='advisory' AND NOT granted AND objid::bigint=(hashtext(${chave})::bigint & 4294967295)`;
        if (n) return; await new Promise(r => setTimeout(r, 10));
      }
      throw new Error('Timeout na barreira de concorrência');
    };
    const criacao = cadastrar(cadastrarAnimalSchema.parse({ brinco, sexo: 'F', origem: 'COMPRADO', aptidao: 'LEITE', propriedadeId: sitio, loteId: destino.id, dataNascimento: '2020-01-01', dataEntrada: '2026-01-01' }), null);
    const resultadoCriacao = Promise.allSettled([criacao]);
    let resultadoPerfil: Promise<PromiseSettledResult<Awaited<ReturnType<typeof registrarPerfil>>>[]> | undefined;
    try {
      await fila(`pec-brinco:${sitio}:${brinco}`);
      const perfil = registrarPerfil({ chave: randomUUID(), propriedadeId: sitio, loteId: destino.id }, null);
      resultadoPerfil = Promise.allSettled([perfil]);
      // Espera o pedido FOR UPDATE já estar na fila do lote compartilhado pelo cadastro.
      for (let i = 0; i < 300; i++) {
        const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FOR UPDATE%' AND pid<>pg_backend_pid()`;
        if (n) break; if (i === 299) throw new Error('Configuração não chegou à barreira do lote'); await new Promise(r => setTimeout(r, 10));
      }
      liberar(); await latch;
      const [[c], [p]] = await Promise.all([resultadoCriacao, resultadoPerfil]);
      expect(c.status).toBe('fulfilled');
      expect(p.status).toBe('rejected');
      expect(await prisma.perfilBezerreiro.count({ where: { loteId: destino.id } })).toBe(0);
    } finally { liberar(); await latch.catch(() => undefined); await resultadoCriacao; if (resultadoPerfil) await resultadoPerfil; }
  }, 30_000);
});
