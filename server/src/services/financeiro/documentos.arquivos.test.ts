import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uid } from '../../lib/uid.fixture.js';

const mocks = vi.hoisted(() => ({
  operacao: { findFirst: vi.fn() }, rascunho: { findFirst: vi.fn() },
  documento: { findUnique: vi.fn(), create: vi.fn() },
  putObject: vi.fn(), deleteObject: vi.fn(), auditar: vi.fn(),
}));
vi.mock('../../env.js', () => ({ env: { STORAGE_NAMESPACE: 'test', R2_BUCKET_NOTAS: 'bucket-teste', JWT_SECRET: 'segredo-ficticio-teste' } }));
vi.mock('../../db.js', () => ({ prisma: { operacao: mocks.operacao, rascunhoOperacao: mocks.rascunho, documentoFinanceiro: mocks.documento } }));
vi.mock('../../lib/storage.js', () => ({ getStorage: async () => ({ putObject: mocks.putObject, deleteObject: mocks.deleteObject }) }));
vi.mock('./regras.js', async importar => ({ ...await importar<typeof import('./regras.js')>(), auditar: mocks.auditar }));
import { anexarDocumentoOperacao, anexarDocumentoRascunho } from './documentos.js';

const arquivo = { propriedadeId: 1, tipo: 'OUTRO' as const, nome: 'Demonstrativo.xml', mimeType: 'application/xml', buffer: Buffer.from('<demonstrativo/>'), usuarioId: 7 };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.operacao.findFirst.mockResolvedValue({ id: uid(1) });
  mocks.rascunho.findFirst.mockResolvedValue({ id: uid(2) });
  mocks.documento.findUnique.mockResolvedValue(null);
  mocks.documento.create.mockImplementation(async ({ data }) => ({ id: uid(3), ...data }));
  mocks.putObject.mockImplementation(async ({ key }) => ({ storageKey: key, storageDriver: 'r2', bucket: 'bucket-teste' }));
});
describe('isolamento dos documentos gravados pelo servidor', () => {
  it('anexa à operação somente dentro do namespace configurado', async () => {
    const documento = await anexarDocumentoOperacao({ ...arquivo, operacaoId: uid(1) });
    expect(documento.storageKey).toMatch(new RegExp(`^test/financeiro/operacoes/${uid(1)}/[a-f0-9]{64}\\.xml$`));
    expect(mocks.putObject).toHaveBeenCalledWith(expect.objectContaining({ key: documento.storageKey, contentType: 'application/xml' }));
    expect(mocks.auditar).toHaveBeenCalledTimes(1);
  });
  it('anexa ao rascunho somente dentro do namespace configurado', async () => {
    const documento = await anexarDocumentoRascunho({ ...arquivo, rascunhoId: uid(2) });
    expect(documento.storageKey).toMatch(new RegExp(`^test/financeiro/rascunhos/${uid(2)}/[a-f0-9]{64}\\.xml$`));
  });
  it('remove somente o objeto recém-gravado se a persistência falhar', async () => {
    mocks.documento.create.mockRejectedValue(new Error('Falha simulada'));
    await expect(anexarDocumentoRascunho({ ...arquivo, rascunhoId: uid(2) })).rejects.toThrow('Falha simulada');
    expect(mocks.deleteObject).toHaveBeenCalledWith({ key: mocks.putObject.mock.calls[0][0].key });
    expect(mocks.deleteObject.mock.calls[0][0].key).toMatch(/^test\//);
  });
});
