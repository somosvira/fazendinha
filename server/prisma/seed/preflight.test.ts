import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
const mocks = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn(), end: vi.fn(), writeFile: vi.fn(), readFile: vi.fn(), readdir: vi.fn(), opcoes: vi.fn() }));
vi.mock('pg', () => ({ default: { Client: class {
  constructor(opcoes: unknown) { mocks.opcoes(opcoes); }
  connect = mocks.connect; query = mocks.query; end = mocks.end;
} } }));
vi.mock('node:fs/promises', () => ({ readFile: mocks.readFile, readdir: mocks.readdir, writeFile: mocks.writeFile, mkdir: vi.fn(), rename: vi.fn() }));
import { abrirContexto } from './contexto.js';
const sql = 'CREATE TABLE exemplo(id int);', nome = '20261025000000_base_unificada';
const checksum = createHash('sha256').update(sql).digest('hex');
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('DATABASE_URL', 'postgresql://local:local@localhost/fazendinha_seedatev3'); vi.stubEnv('DIRECT_URL', ''); vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('STORAGE_NAMESPACE', 'test');
  mocks.readdir.mockResolvedValue([nome, 'migration_lock.toml']);
  mocks.readFile.mockImplementation(async (path: URL | string) => {
    if (String(path).endsWith('migration.sql')) return sql;
    throw Object.assign(new Error('inexistente'), { code: 'ENOENT' });
  });
  mocks.query.mockImplementation(async (consulta: string) => {
    if (consulta.includes('pg_try_advisory_lock')) return { rows: [{ livre: true }] };
    if (consulta.includes('_prisma_migrations')) return { rows: [{ migration_name: nome, checksum, finished_at: new Date('2026-10-24T12:00:00Z'), rolled_back_at: null }] };
    if (consulta.includes('pg_database')) return { rows: [{ identidade: '123:fazendinha_seedatev3' }] };
    if (consulta.includes('count(*)')) return { rows: [{ total: '0' }] };
    throw new Error(`Consulta inesperada: ${consulta}`);
  });
});
afterEach(() => vi.unstubAllEnvs());
const incremento = '20261029000000_incremento';
const sqlIncremento = 'ALTER TABLE exemplo ADD COLUMN nome text;';
const checksumIncremento = createHash('sha256').update(sqlIncremento).digest('hex');
const aplicada = (migration_name = nome, hash = checksum) => ({ migration_name, checksum: hash, finished_at: new Date('2026-10-24T12:00:00Z'), rolled_back_at: null as Date | null });
function cadeia(rows: Array<ReturnType<typeof aplicada> | (Omit<ReturnType<typeof aplicada>, 'finished_at'> & { finished_at: null })>) {
  mocks.readdir.mockResolvedValue([incremento, 'migration_lock.toml', nome]);
  mocks.readFile.mockImplementation(async (path: URL | string) => {
    if (String(path).endsWith(`${incremento}/migration.sql`)) return sqlIncremento;
    if (String(path).endsWith(`${nome}/migration.sql`)) return sql;
    throw Object.assign(new Error('inexistente'), { code: 'ENOENT' });
  });
  const original = mocks.query.getMockImplementation()!;
  mocks.query.mockImplementation(async (consulta: string) => consulta.includes('_prisma_migrations') ? { rows } : original(consulta));
}
describe('preflight sem alterações e sem conexão operacional', () => {
  it('aceita baseline inicial e incrementais concluídas com cada checksum conferido', async () => {
    cadeia([aplicada(incremento, checksumIncremento), aplicada()]);
    const aberto = await abrirContexto('preflight');
    expect(aberto.contexto.manifesto.baseline).toEqual({ nome, checksum });
    expect(aberto.contexto.manifesto.identidade).toBe('localhost:5432:123:fazendinha_seedatev3:2026-10-24T12:00:00.000Z');
    expect(mocks.writeFile).not.toHaveBeenCalled();
    await aberto.fechar();
  });
  it.each([
    ['incremental ausente', () => [aplicada()]],
    ['incremental pendente', () => [aplicada(), { ...aplicada(incremento, checksumIncremento), finished_at: null }]],
    ['incremental checksum alterado', () => [aplicada(), aplicada(incremento, 'b'.repeat(64))]],
    ['migration desconhecida no banco', () => [aplicada(), aplicada(incremento, checksumIncremento), aplicada('20261030000000_desconhecida')]],
    ['incremental ativa duplicada', () => [aplicada(), aplicada(incremento, checksumIncremento), aplicada(incremento, checksumIncremento)]],
    ['baseline ausente', () => [aplicada(incremento, checksumIncremento)]],
    ['incremental apenas revertida', () => [aplicada(), { ...aplicada(incremento, checksumIncremento), finished_at: null, rolled_back_at: new Date() }]],
  ] as const)('recusa %s antes de preparar dados', async (_caso, rows) => {
    cadeia(rows());
    await expect(abrirContexto('executar')).rejects.toThrow(/aplicada|migration/i);
    expect(mocks.query.mock.calls.some(([q]) => String(q).includes('pg_database'))).toBe(false);
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(mocks.end).toHaveBeenCalledOnce();
  });
  it('ignora tentativa revertida quando há aplicação concluída da mesma migration', async () => {
    cadeia([aplicada(), { ...aplicada(incremento, 'antigo'), finished_at: null, rolled_back_at: new Date() }, aplicada(incremento, checksumIncremento)]);
    const aberto = await abrirContexto('preflight');
    await aberto.fechar();
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });
  it('retoma manifesto da baseline após incremental sem mudar identidade ou data-base', async () => {
    cadeia([aplicada(), aplicada(incremento, checksumIncremento)]);
    const leitura = mocks.readFile.getMockImplementation()!;
    const manifesto = { versao: 1, banco: 'fazendinha_seedatev3', identidade: 'localhost:5432:123:fazendinha_seedatev3:2026-10-24T12:00:00.000Z', baseline: { nome, checksum }, fuso: 'America/Sao_Paulo', dataBase: '2026-10-23', ids: {}, etapas: ['estoque'], acoes: [], criadoEm: '2026-10-24T12:00:00.000Z' };
    mocks.readFile.mockImplementation(async (path: URL | string) => String(path).endsWith('manifesto.json') ? JSON.stringify(manifesto) : leitura(path));
    const aberto = await abrirContexto('verificar');
    expect(aberto.contexto.manifesto).toEqual(manifesto);
    expect(mocks.writeFile).not.toHaveBeenCalled();
    await aberto.fechar();
  });
  it.each(['identidade', 'nome', 'checksum'] as const)('incrementais válidas não dispensam conferir %s do manifesto', async campo => {
    cadeia([aplicada(), aplicada(incremento, checksumIncremento)]);
    const leitura = mocks.readFile.getMockImplementation()!;
    const manifesto = { versao: 1, banco: 'fazendinha_seedatev3', identidade: campo === 'identidade' ? 'outra-instancia' : 'localhost:5432:123:fazendinha_seedatev3:2026-10-24T12:00:00.000Z', baseline: { nome: campo === 'nome' ? 'outra-baseline' : nome, checksum: campo === 'checksum' ? 'c'.repeat(64) : checksum }, fuso: 'America/Sao_Paulo', dataBase: '2026-10-23', ids: {}, etapas: [], acoes: [], criadoEm: '2026-10-24T12:00:00.000Z' };
    mocks.readFile.mockImplementation(async (path: URL | string) => String(path).endsWith('manifesto.json') ? JSON.stringify(manifesto) : leitura(path));
    await expect(abrirContexto('executar')).rejects.toThrow('outra instância ou baseline');
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(mocks.end).toHaveBeenCalledOnce();
  });
  it('recusa segunda baseline mesmo quando posterior à canônica', async () => {
    mocks.readdir.mockResolvedValue([nome, '20261030000000_outra_baseline']);
    await expect(abrirContexto('preflight')).rejects.toThrow('uma baseline');
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });
  it('usa sessão PostgreSQL somente leitura e não salva manifesto ausente', async () => {
    const aberto = await abrirContexto('preflight');
    expect(aberto.contexto.verificar).toBe(true);
    expect(mocks.opcoes.mock.calls[0][0]).toMatchObject({ options: '-c default_transaction_read_only=on' });
    expect(mocks.query.mock.calls.every(([consulta]) => String(consulta).startsWith('SELECT'))).toBe(true);
    expect(mocks.writeFile).not.toHaveBeenCalled(); await aberto.fechar(); expect(mocks.end).toHaveBeenCalledOnce();
  });
  it('recusa cadeia com migration anterior à baseline canônica', async () => {
    mocks.readdir.mockResolvedValue([nome, '20261001000000_antiga']);
    await expect(abrirContexto('preflight')).rejects.toThrow('uma baseline'); expect(mocks.end).toHaveBeenCalledOnce();
  });
  it('recusa checksum de baseline divergente', async () => {
    const original = mocks.query.getMockImplementation()!;
    mocks.query.mockImplementation(async (consulta: string) => consulta.includes('_prisma_migrations')
      ? { rows: [{ migration_name: nome, checksum: 'outro', finished_at: new Date(), rolled_back_at: null }] } : original(consulta));
    await expect(abrirContexto('executar')).rejects.toThrow('Baseline aplicada'); expect(mocks.writeFile).not.toHaveBeenCalled();
  });
  it('não adota fatos ou usuários de manifestos antigos', async () => {
    const original = mocks.query.getMockImplementation()!;
    mocks.query.mockImplementation(async (consulta: string) => consulta.includes('count(*)') ? { rows: [{ total: '1' }] } : original(consulta));
    await expect(abrirContexto('executar')).rejects.toThrow('sem manifesto da seed única'); expect(mocks.writeFile).not.toHaveBeenCalled();
  });
  it('verificação exige manifesto existente, sem criá-lo', async () => {
    await expect(abrirContexto('verificar')).rejects.toThrow('inexistente'); expect(mocks.writeFile).not.toHaveBeenCalled();
  });
  it('exclusão mútua impede uma segunda execução', async () => {
    mocks.query.mockResolvedValue({ rows: [{ livre: false }] });
    await expect(abrirContexto('executar')).rejects.toThrow('Outra execução'); expect(mocks.readFile).not.toHaveBeenCalled();
  });
});
