import type { LocalizacaoAnimal, Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auditar: vi.fn() }));
vi.mock('../rebanho/regras.js', async original => ({ ...await original<typeof import('../rebanho/regras.js')>(), auditar: mocks.auditar }));
import { sincronizarLocalizacoesBezerreiroTx } from './localizacao.js';
const d = (s: string) => new Date(s);
const perfil = { id: 'perfil', loteId: 'lote', propriedadeId: 1, ativo: true };
const local = (id = 'local', loteId: string | null = 'lote', desde = '2026-10-01', ate: string | null = null): LocalizacaoAnimal => ({ id, loteId, animalId: 'animal', propriedadeId: 1, desde: d(desde), ate: ate ? d(ate) : null, movimentacaoId: null, criadoPorId: null, criadoEm: d(desde), atualizadoEm: d(desde) });
const p = () => ({ id: 'participacao', perfilId: perfil.id, perfil, animalId: 'animal', desde: d('2026-10-01'), ate: null as Date | null, versao: 1, fases: [] as { id: string; desde: Date; ate: Date | null }[] });
const modelo = () => ({ findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() });
let m: ReturnType<typeof criarMocks>;
const criarMocks = () => ({ localizacaoAnimal: modelo(), perfilBezerreiro: modelo(), participacaoBezerreiro: modelo(), periodoFaseBezerreiro: modelo(), grupoOfertaBezerreiro: modelo() });
const tx = () => m as unknown as Prisma.TransactionClient;
beforeEach(() => {
  vi.clearAllMocks(); m = criarMocks();
  m.localizacaoAnimal.findMany.mockResolvedValue([local()]);
  m.perfilBezerreiro.findMany.mockResolvedValue([perfil]);
  m.participacaoBezerreiro.findMany.mockResolvedValue([]);
  m.participacaoBezerreiro.findFirst.mockResolvedValue(null);
  m.participacaoBezerreiro.create.mockImplementation(async ({ data }) => ({ id: 'nova', ...data }));
  m.participacaoBezerreiro.update.mockImplementation(async ({ data }) => ({ id: 'participacao', ...data }));
  m.grupoOfertaBezerreiro.findMany.mockResolvedValue([]);
});
describe('participação acompanha a localização na mesma transação', () => {
  it('entrada/cadastro/cria em lote configurado cria participação sem fase ou fato alimentar', async () => {
    await sincronizarLocalizacoesBezerreiroTx(tx(), ['animal'], 7, [], 'INICIAIS');
    expect(m.participacaoBezerreiro.create).toHaveBeenCalledWith({ data: expect.objectContaining({ perfilId: 'perfil', desde: d('2026-10-01'), criadoPorId: 7 }) });
    expect(m.periodoFaseBezerreiro.create).not.toHaveBeenCalled();
    expect(mocks.auditar).toHaveBeenCalledWith(tx(), expect.objectContaining({ acao: 'ENTRADA_LOCALIZACAO' }));
  });
  it('não usa categoria nem nome como gatilho e não carrega histórico faltante na correção', async () => {
    m.perfilBezerreiro.findMany.mockResolvedValue([]);
    await sincronizarLocalizacoesBezerreiroTx(tx(), ['animal'], 7, [], 'INICIAIS');
    expect(m.participacaoBezerreiro.create).not.toHaveBeenCalled();
    m.perfilBezerreiro.findMany.mockResolvedValue([perfil]);
    await sincronizarLocalizacoesBezerreiroTx(tx(), ['animal'], 7, [local()]);
    expect(m.participacaoBezerreiro.create).not.toHaveBeenCalled();
  });
  it('reabertura após configurar o lote integra somente a localização reaberta, sem carregar histórico antigo', async () => {
    const historica = local('historica', 'lote', '2026-09-01', '2026-09-10');
    const encerrada = local('local', 'lote', '2026-10-01', '2026-10-10');
    m.localizacaoAnimal.findMany.mockResolvedValue([historica, local()]);
    await sincronizarLocalizacoesBezerreiroTx(tx(), ['animal'], 7, [historica, encerrada]);
    expect(m.participacaoBezerreiro.create).toHaveBeenCalledTimes(1);
    expect(m.participacaoBezerreiro.create).toHaveBeenCalledWith({ data: expect.objectContaining({ perfilId: perfil.id, animalId: 'animal', desde: encerrada.desde, ate: null }) });
    expect(m.periodoFaseBezerreiro.create).not.toHaveBeenCalled();
    expect(mocks.auditar).toHaveBeenCalledWith(tx(), expect.objectContaining({ acao: 'ENTRADA_LOCALIZACAO', depois: expect.objectContaining({ localizacaoId: 'local' }) }));
    m.participacaoBezerreiro.findMany.mockResolvedValue([p()]);
    m.participacaoBezerreiro.findFirst.mockResolvedValue(p());
    await sincronizarLocalizacoesBezerreiroTx(tx(), ['animal'], 7, [historica, encerrada]);
    expect(m.participacaoBezerreiro.create).toHaveBeenCalledTimes(1);
  });
  it('não importa participação ao apenas encerrar localização legada', async () => {
    m.localizacaoAnimal.findMany.mockResolvedValue([local('local', 'lote', '2026-10-01', '2026-10-10')]);
    await sincronizarLocalizacoesBezerreiroTx(tx(), ['animal'], 7, [local()]);
    expect(m.participacaoBezerreiro.create).not.toHaveBeenCalled();
  });
  it('reabertura coletiva integra os animais e preserva localizações inalteradas', async () => {
    const b = { ...local('local-b'), animalId: 'animal-b' };
    const antiga = { ...local('legada'), animalId: 'legado' };
    m.localizacaoAnimal.findMany.mockResolvedValue([local(), b, antiga]);
    await sincronizarLocalizacoesBezerreiroTx(tx(), ['animal', 'animal-b', 'legado'], 7, [local('local', 'lote', '2026-10-01', '2026-10-10'), { ...b, ate: d('2026-10-10') }, antiga]);
    expect(m.participacaoBezerreiro.create.mock.calls.map(([args]) => args.data.animalId)).toEqual(['animal', 'animal-b']);
  });
  it('não amplia intervalo legado sem participação como efeito de uma correção', async () => {
    m.localizacaoAnimal.findMany.mockResolvedValue([local('local', 'lote', '2026-09-30')]);
    await expect(sincronizarLocalizacoesBezerreiroTx(tx(), ['animal'], 7, [local()])).rejects.toThrow('Regularize a participação');
    expect(m.participacaoBezerreiro.create).not.toHaveBeenCalled();
  });
  it('reexecução preserva participação existente e não fragmenta permanência', async () => {
    m.participacaoBezerreiro.findMany.mockResolvedValue([p()]); m.participacaoBezerreiro.findFirst.mockResolvedValue(p());
    await sincronizarLocalizacoesBezerreiroTx(tx(), ['animal'], 7, [local()], ['local']);
    expect(m.participacaoBezerreiro.create).not.toHaveBeenCalled(); expect(m.participacaoBezerreiro.update).not.toHaveBeenCalled();
  });
  it('não informa sucesso quando participação antiga cobre só parte da localização', async () => {
    m.participacaoBezerreiro.findMany.mockResolvedValue([{ ...p(), ate: d('2026-10-10') }]);
    m.participacaoBezerreiro.findFirst.mockResolvedValue({ ...p(), ate: d('2026-10-10') });
    await expect(sincronizarLocalizacoesBezerreiroTx(tx(), ['animal'], 7, [], ['local'])).rejects.toThrow('cobre apenas parte');
    expect(m.participacaoBezerreiro.create).not.toHaveBeenCalled();
  });
  it('preserva participação sobre localizações contíguas no mesmo lote sem fragmentar', async () => {
    m.localizacaoAnimal.findMany.mockResolvedValue([local('antiga', 'lote', '2026-10-01', '2026-10-10'), local('local', 'lote', '2026-10-10')]);
    m.participacaoBezerreiro.findMany.mockResolvedValue([p()]); m.participacaoBezerreiro.findFirst.mockResolvedValue(p());
    await sincronizarLocalizacoesBezerreiroTx(tx(), ['animal'], 7, [], ['local']);
    expect(m.participacaoBezerreiro.update).not.toHaveBeenCalled(); expect(m.participacaoBezerreiro.create).not.toHaveBeenCalled();
  });
  it('saída/baixa fecha participação e fase, sem apagar fatos', async () => {
    const atual = p(); atual.fases.push({ id: 'fase', desde: d('2026-10-02'), ate: null });
    m.participacaoBezerreiro.findMany.mockResolvedValue([atual]); m.localizacaoAnimal.findMany.mockResolvedValue([local('local', 'lote', '2026-10-01', '2026-10-10')]);
    await sincronizarLocalizacoesBezerreiroTx(tx(), ['animal'], 7, [local()]);
    expect(m.participacaoBezerreiro.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ate: d('2026-10-10') }) }));
    expect(m.periodoFaseBezerreiro.update).toHaveBeenCalledWith({ where: { id: 'fase' }, data: { ate: d('2026-10-10') } });
    expect(m.participacaoBezerreiro.delete).not.toHaveBeenCalled();
  });
  it('transferência entre bezerreiros encerra origem e abre destino sem copiar programação', async () => {
    m.participacaoBezerreiro.findMany.mockResolvedValue([p()]);
    m.perfilBezerreiro.findMany.mockResolvedValue([perfil, { ...perfil, id: 'outro', loteId: 'destino' }]);
    m.localizacaoAnimal.findMany.mockResolvedValue([local('local', 'lote', '2026-10-01', '2026-10-10'), local('nova', 'destino', '2026-10-10')]);
    await sincronizarLocalizacoesBezerreiroTx(tx(), ['animal'], 7, [local()], ['nova']);
    expect(m.participacaoBezerreiro.update).toHaveBeenCalled();
    expect(m.participacaoBezerreiro.create).toHaveBeenCalledWith({ data: expect.objectContaining({ perfilId: 'outro', desde: d('2026-10-10') }) });
    expect(m.periodoFaseBezerreiro.create).not.toHaveBeenCalled();
  });
  it('recusa saída no mesmo dia sem inventar horário ou apagar entrada', async () => {
    m.participacaoBezerreiro.findMany.mockResolvedValue([p()]); m.localizacaoAnimal.findMany.mockResolvedValue([local('local', 'lote', '2026-10-01', '2026-10-01')]);
    await expect(sincronizarLocalizacoesBezerreiroTx(tx(), ['animal'], 7, [local()])).rejects.toThrow('mesmo dia');
    expect(m.participacaoBezerreiro.update).not.toHaveBeenCalled();
  });
  it('bloqueia redução que excluiria oferta confirmada, sem escrever nada', async () => {
    m.participacaoBezerreiro.findMany.mockResolvedValue([p()]); m.localizacaoAnimal.findMany.mockResolvedValue([local('local', 'lote', '2026-10-01', '2026-10-10')]);
    m.grupoOfertaBezerreiro.findMany.mockResolvedValue([{ oferta: { data: d('2026-10-10') } }]);
    await expect(sincronizarLocalizacoesBezerreiroTx(tx(), ['animal'], 7, [local()])).rejects.toThrow('ofertas realizadas');
    expect(m.participacaoBezerreiro.update).not.toHaveBeenCalled();
  });
  it('recusa desfazer quando existe fase, preservando fatos e explicando regularização', async () => {
    const atual = p(); atual.fases.push({ id: 'fase', desde: atual.desde, ate: null });
    m.participacaoBezerreiro.findMany.mockResolvedValue([atual]); m.localizacaoAnimal.findMany.mockResolvedValue([]);
    await expect(sincronizarLocalizacoesBezerreiroTx(tx(), ['animal'], 7, [local()])).rejects.toThrow('fases ou ofertas');
    expect(m.participacaoBezerreiro.delete).not.toHaveBeenCalled();
  });
  it('desfazer sem fatos preserva antes/motivo na auditoria, sem exclusão em cascata', async () => {
    m.participacaoBezerreiro.findMany.mockResolvedValue([p()]); m.localizacaoAnimal.findMany.mockResolvedValue([]);
    await sincronizarLocalizacoesBezerreiroTx(tx(), ['animal'], 7, [local()]);
    expect(m.participacaoBezerreiro.delete).toHaveBeenCalledWith({ where: { id: 'participacao' } });
    expect(mocks.auditar).toHaveBeenCalledWith(tx(), expect.objectContaining({ acao: 'DESFAZER_LOCALIZACAO', antes: expect.objectContaining({ id: 'participacao' }) }));
  });
  it('desfazer transferência remove destino antes de reabrir origem (GiST imediato)', async () => {
    const origem = { ...p(), ate: d('2026-10-10') };
    const destino = { ...p(), id: 'destino', perfilId: 'perfilB', perfil: { ...perfil, id: 'perfilB', loteId: 'loteB' }, desde: d('2026-10-10') };
    m.participacaoBezerreiro.findMany.mockResolvedValue([origem, destino]);
    m.participacaoBezerreiro.findFirst.mockResolvedValue({ ...origem, ate: null });
    await sincronizarLocalizacoesBezerreiroTx(tx(), ['animal'], 7, [local('local', 'lote', '2026-10-01', '2026-10-10'), local('localB', 'loteB', '2026-10-10')]);
    expect(m.participacaoBezerreiro.delete).toHaveBeenCalledWith({ where: { id: 'destino' } });
    expect(m.participacaoBezerreiro.delete.mock.invocationCallOrder[0]).toBeLessThan(m.participacaoBezerreiro.update.mock.invocationCallOrder[0]);
    expect(m.participacaoBezerreiro.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ate: null }) }));
  });
  it('estorno da baixa reabre permanência e conserva fase já encerrada', async () => {
    const atual = { ...p(), ate: d('2026-10-10'), fases: [{ id: 'fase', desde: d('2026-10-01'), ate: d('2026-10-10') }] };
    m.participacaoBezerreiro.findMany.mockResolvedValue([atual]);
    m.participacaoBezerreiro.findFirst.mockResolvedValue({ ...atual, ate: null });
    await sincronizarLocalizacoesBezerreiroTx(tx(), ['animal'], 7, [local('local', 'lote', '2026-10-01', '2026-10-10')]);
    expect(m.participacaoBezerreiro.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ate: null }) }));
    expect(m.periodoFaseBezerreiro.update).not.toHaveBeenCalled();
    expect(m.participacaoBezerreiro.create).not.toHaveBeenCalled();
  });
});
