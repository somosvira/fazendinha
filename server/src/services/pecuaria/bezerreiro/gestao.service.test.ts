import type { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ tx: null as unknown as Prisma.TransactionClient, auditar: vi.fn(), travarAnimais: vi.fn(), sitio: vi.fn() }));
vi.mock('../../../db.js', () => ({ prisma: { $transaction: (executar: (tx: Prisma.TransactionClient) => unknown) => executar(f.tx) } }));
vi.mock('../transacao.js', () => ({ transacaoPecuaria: (executar: (tx: Prisma.TransactionClient) => unknown) => executar(f.tx) }));
vi.mock('../rebanho/regras.js', async original => ({ ...await original<typeof import('../rebanho/regras.js')>(), auditar: f.auditar, travarAnimais: f.travarAnimais, hojeFazendaDate: () => new Date('2026-10-28T00:00:00Z') }));
vi.mock('../leite/configuracoes.js', () => ({ conferirSitioLeiteTx: f.sitio }));
import { dia, mudarFase, cancelarFase, sairParticipacao, salvarConfiguracao, listarParticipantes } from './gestao.js';
import { consultaSchema, salvarConfiguracaoSchema } from './schemas.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const data = new Date('2026-10-28T00:00:00Z');
const participacao = { id: id(1), animalId: id(2), perfilId: id(3), desde: new Date('2026-10-20T00:00:00Z'), ate: null, versao: 1 };
const fase = { id: id(4), publicada: true, litrosDia: '0', ofertas: [], propriedadeId: 1 };
function modelo() { return { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() }; }
let m: ReturnType<typeof mocks>;
function mocks() { return { $executeRaw: vi.fn(), requisicaoPecuaria: modelo(), configuracaoBezerreiro: modelo(), coleiraBezerreiro: modelo(), faseBezerreiroVersao: modelo(), localizacaoAnimal: modelo(), perfilBezerreiro: modelo(), participacaoBezerreiro: modelo(), grupoOfertaBezerreiro: modelo(), periodoFaseBezerreiro: modelo() }; }
beforeEach(() => {
  vi.clearAllMocks(); m = mocks(); f.tx = m as unknown as Prisma.TransactionClient;
  const requisicoes = new Map<string, unknown>();
  m.requisicaoPecuaria.findUnique.mockImplementation(async ({ where }) => requisicoes.get(where.chave) ?? null);
  m.requisicaoPecuaria.create.mockImplementation(async ({ data }) => { requisicoes.set(data.chave, data); return data; });
  m.participacaoBezerreiro.findFirst.mockResolvedValue(participacao);
  m.participacaoBezerreiro.update.mockResolvedValue({ ...participacao, versao: 2 });
  m.faseBezerreiroVersao.findFirst.mockResolvedValue(fase);
  m.grupoOfertaBezerreiro.findFirst.mockResolvedValue(null);
  m.localizacaoAnimal.findFirst.mockResolvedValue(null);
  m.perfilBezerreiro.findFirst.mockResolvedValue({ id: participacao.perfilId, loteId: id(99), propriedadeId: 1 });
  m.periodoFaseBezerreiro.findFirst.mockResolvedValue(null);
});
const troca = { chave: id(10), propriedadeId: 1, versaoEsperada: 1, faseVersaoId: id(4), desde: '2026-10-28', motivo: 'Mudança conferida no manejo' };

describe('gestão operacional do bezerreiro', () => {
  it('recusa datas civis inexistentes também na chamada direta ao serviço', () => {
    expect(() => dia('2026-02-30')).toThrow('civil válida');
  });
  it('revalida a versão da participação depois de obter os locks', async () => {
    m.participacaoBezerreiro.findFirst.mockResolvedValueOnce(participacao).mockResolvedValueOnce({ ...participacao, versao: 2 });
    await expect(mudarFase(participacao.id, troca, 7)).rejects.toMatchObject({ code: 'CONFLITO' });
    expect(m.periodoFaseBezerreiro.create).not.toHaveBeenCalled();
    expect(m.participacaoBezerreiro.findFirst).toHaveBeenCalledTimes(2);
  });
  it('permite corrigir a fase iniciada hoje antes de oferta, conservando auditoria', async () => {
    const periodo = { id: id(5), desde: data, faseVersaoId: id(6) };
    m.periodoFaseBezerreiro.findFirst.mockResolvedValue(periodo);
    await mudarFase(participacao.id, troca, 7);
    expect(m.periodoFaseBezerreiro.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ faseVersaoId: id(4) }) }));
    expect(m.periodoFaseBezerreiro.create).not.toHaveBeenCalled();
    expect(f.auditar).toHaveBeenCalledWith(f.tx, expect.objectContaining({ antes: expect.objectContaining({ faseAnterior: periodo }) }));
  });
  it('não altera programação já usada numa oferta, mesmo sem hora conhecida', async () => {
    m.grupoOfertaBezerreiro.findFirst.mockResolvedValue({ id: id(20) });
    await expect(mudarFase(participacao.id, troca, 7)).rejects.toThrow('Há oferta realizada');
    expect(m.periodoFaseBezerreiro.update).not.toHaveBeenCalled();
  });
  it('não fecha intervalo antes de uma fase futura, evitando período negativo', async () => {
    m.periodoFaseBezerreiro.findFirst.mockResolvedValue({ id: id(21), desde: new Date('2026-10-29') });
    await expect(sairParticipacao(participacao.id, { chave: id(11), propriedadeId: 1, versaoEsperada: 1, data: '2026-10-28', motivo: 'Saída conferida no manejo' }, 7)).rejects.toThrow('fase nesta data ou depois');
    expect(m.periodoFaseBezerreiro.updateMany).not.toHaveBeenCalled();
  });
  it('reenvio idêntico não cria outra versão; dados diferentes conflitam', async () => {
    m.configuracaoBezerreiro.findFirst.mockResolvedValue({ id: id(30), versao: 1 });
    m.configuracaoBezerreiro.create.mockResolvedValue({ id: id(31), versao: 2 });
    const dados = { ...salvarConfiguracaoSchema.parse({ chave: id(12), versaoEsperada: 1, brixReferencia: '25', percentualPesoColostro: '10', fases: [] }), propriedadeId: 1 };
    expect(await salvarConfiguracao(dados, -1)).toEqual({ id: id(31), versao: 2 });
    expect(await salvarConfiguracao(dados, -1)).toEqual({ id: id(31), versao: 2 });
    expect(m.configuracaoBezerreiro.create).toHaveBeenCalledTimes(1);
    expect(m.configuracaoBezerreiro.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ criadoPorId: null }) }));
    await expect(salvarConfiguracao({ ...dados, brixReferencia: '26' }, -1)).rejects.toMatchObject({ code: 'CONFLITO' });
  });
  it('exige referências positivas antes de escrever configuração', async () => {
    const dados = { chave: id(12), propriedadeId: 1, versaoEsperada: 0, brixReferencia: '0', percentualPesoColostro: '10', fases: [] };
    await expect(salvarConfiguracao(dados, 7)).rejects.toThrow();
    expect(m.configuracaoBezerreiro.create).not.toHaveBeenCalled();
  });
  it('histórico com filtro de coleira consulta fases históricas e preserva sítio/período', async () => {
    m.participacaoBezerreiro.count.mockResolvedValue(0); m.participacaoBezerreiro.findMany.mockResolvedValue([]);
    await listarParticipantes(2, consultaSchema.parse({ historico: 'true', de: '2026-10-01', ate: '2026-10-28', coleiraId: id(40) }));
    expect(m.participacaoBezerreiro.count).toHaveBeenCalledWith({ where: expect.objectContaining({ perfil: { propriedadeId: 2 }, ate: { gte: new Date('2026-10-01'), lte: data }, fases: { some: { faseVersao: { coleiraId: id(40) } } } }) });
  });
});


describe('cancelamento explícito de programação equivocada', () => {
  const periodo = { id: id(55), participacaoId: participacao.id, faseVersaoId: fase.id, desde: new Date('2026-10-21'), ate: new Date('2026-10-24'), motivo: 'Registro original', criadoPorId: 7 };
  const comando = { chave: id(56), propriedadeId: 1, versaoEsperada: 1, motivo: 'Programação lançada no animal errado' };
  beforeEach(() => { m.periodoFaseBezerreiro.findFirst.mockResolvedValue(periodo); });
  it('cancela somente o período conferido e preserva snapshot/autoria/motivo na auditoria', async () => {
    await cancelarFase(participacao.id, periodo.id, comando, 7);
    expect(m.periodoFaseBezerreiro.delete).toHaveBeenCalledWith({ where: { id: periodo.id } });
    expect(m.periodoFaseBezerreiro.update).not.toHaveBeenCalled();
    expect(m.periodoFaseBezerreiro.updateMany).not.toHaveBeenCalled();
    expect(m.participacaoBezerreiro.update).toHaveBeenCalledWith({ where: { id: participacao.id, versao: 1 }, data: { versao: { increment: 1 } } });
    expect(f.auditar).toHaveBeenCalledWith(f.tx, expect.objectContaining({ entidade: 'PeriodoFaseBezerreiro', entidadeId: periodo.id, usuarioId: 7, propriedadeId: 1, animalId: participacao.animalId, acao: 'CANCELAMENTO', antes: periodo, depois: expect.objectContaining({ motivo: comando.motivo, cancelado: true }) }));
  });
  it('permite regularizar participação encerrada e não reabre programação anterior', async () => {
    m.participacaoBezerreiro.findFirst.mockResolvedValue({ ...participacao, ate: new Date('2026-10-25') });
    await cancelarFase(participacao.id, periodo.id, comando, 7);
    expect(m.periodoFaseBezerreiro.delete).toHaveBeenCalledTimes(1);
    expect(m.periodoFaseBezerreiro.create).not.toHaveBeenCalled();
    expect(m.periodoFaseBezerreiro.updateMany).not.toHaveBeenCalled();
  });
  it('recusa alimentação confirmada no intervalo exclusivo do animal e orienta estorno', async () => {
    m.grupoOfertaBezerreiro.findFirst.mockResolvedValue({ id: id(60) });
    await expect(cancelarFase(participacao.id, periodo.id, comando, 7)).rejects.toThrow('estorne');
    expect(m.grupoOfertaBezerreiro.findFirst).toHaveBeenCalledWith({ where: { oferta: { perfilId: participacao.perfilId, status: 'CONFIRMADO', data: { gte: periodo.desde, lt: periodo.ate } }, participantesSnapshot: { array_contains: [{ animalId: participacao.animalId }] } } });
    expect(m.periodoFaseBezerreiro.delete).not.toHaveBeenCalled();
    expect(f.auditar).not.toHaveBeenCalled();
  });
  it('considera todas as ofertas posteriores ao início de uma fase aberta', async () => {
    m.periodoFaseBezerreiro.findFirst.mockResolvedValue({ ...periodo, ate: null });
    await cancelarFase(participacao.id, periodo.id, comando, 7);
    expect(m.grupoOfertaBezerreiro.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ oferta: expect.objectContaining({ data: { gte: periodo.desde } }) }) }));
  });
  it('revalida versão sob locks e não escreve se a programação mudou', async () => {
    m.participacaoBezerreiro.findFirst.mockResolvedValueOnce(participacao).mockResolvedValueOnce({ ...participacao, versao: 2 });
    await expect(cancelarFase(participacao.id, periodo.id, comando, 7)).rejects.toMatchObject({ code: 'CONFLITO' });
    expect(m.periodoFaseBezerreiro.delete).not.toHaveBeenCalled();
  });
  it('reenvio idêntico retorna recibo sem repetir cancelamento; payload divergente conflita', async () => {
    await cancelarFase(participacao.id, periodo.id, comando, 7);
    await cancelarFase(participacao.id, periodo.id, comando, 7);
    expect(m.periodoFaseBezerreiro.delete).toHaveBeenCalledTimes(1);
    expect(f.auditar).toHaveBeenCalledTimes(1);
    await expect(cancelarFase(participacao.id, periodo.id, { ...comando, motivo: 'Outro motivo de correção' }, 7)).rejects.toMatchObject({ code: 'CONFLITO' });
  });
  it('não encontra período de outra participação e não acessa outro sítio', async () => {
    m.periodoFaseBezerreiro.findFirst.mockResolvedValue(null);
    await expect(cancelarFase(participacao.id, periodo.id, comando, 7)).rejects.toMatchObject({ code: 'NAO_ENCONTRADO' });
    expect(m.periodoFaseBezerreiro.findFirst).toHaveBeenCalledWith({ where: { id: periodo.id, participacaoId: participacao.id } });
    expect(m.periodoFaseBezerreiro.delete).not.toHaveBeenCalled();
    m.participacaoBezerreiro.findFirst.mockResolvedValue(null);
    await expect(cancelarFase(participacao.id, periodo.id, { ...comando, chave: id(70), propriedadeId: 2 }, 7)).rejects.toMatchObject({ code: 'NAO_ENCONTRADO' });
    expect(m.participacaoBezerreiro.findFirst).toHaveBeenLastCalledWith({ where: { id: participacao.id, perfil: { propriedadeId: 2 } } });
  });
  it('exige motivo também quando chamado diretamente', async () => {
    await expect(cancelarFase(participacao.id, periodo.id, { ...comando, motivo: '  ' }, 7)).rejects.toThrow();
    expect(m.periodoFaseBezerreiro.delete).not.toHaveBeenCalled();
  });
});
