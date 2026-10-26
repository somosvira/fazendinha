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
describe('preflight sem alterações e sem conexão operacional', () => {
  it('usa sessão PostgreSQL somente leitura e não salva manifesto ausente', async () => {
    const aberto = await abrirContexto('preflight');
    expect(aberto.contexto.verificar).toBe(true);
    expect(mocks.opcoes.mock.calls[0][0]).toMatchObject({ options: '-c default_transaction_read_only=on' });
    expect(mocks.query.mock.calls.every(([consulta]) => String(consulta).startsWith('SELECT'))).toBe(true);
    expect(mocks.writeFile).not.toHaveBeenCalled(); await aberto.fechar(); expect(mocks.end).toHaveBeenCalledOnce();
  });
  it('aceita migration incremental aplicada depois da baseline', async () => {
    const extensao = '20261026000000_add_clerk_user_id';
    mocks.readdir.mockResolvedValue([nome, extensao]);
    mocks.readFile.mockImplementation(async (path: URL | string) => {
      if (String(path).includes(extensao)) return 'ALTER TABLE exemplo ADD COLUMN clerk_user_id text;';
      if (String(path).endsWith('migration.sql')) return sql;
      throw Object.assign(new Error('inexistente'), { code: 'ENOENT' });
    });
    const checksumExtensao = createHash('sha256').update('ALTER TABLE exemplo ADD COLUMN clerk_user_id text;').digest('hex');
    const original = mocks.query.getMockImplementation()!;
    mocks.query.mockImplementation(async (consulta: string) => consulta.includes('_prisma_migrations')
      ? { rows: [
        { migration_name: nome, checksum, finished_at: new Date('2026-10-24T12:00:00Z'), rolled_back_at: null },
        { migration_name: extensao, checksum: checksumExtensao, finished_at: new Date('2026-10-25T12:00:00Z'), rolled_back_at: null },
      ] }
      : original(consulta));
    const aberto = await abrirContexto('preflight');
    await aberto.fechar();
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
