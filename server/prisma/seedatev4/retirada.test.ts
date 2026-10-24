import { beforeEach, expect, it, vi } from 'vitest';
import { Contexto } from '../seedatev3/contexto.js';
import { prepararRetiradaDemonstrativa } from './retirada.js';
const mocks = vi.hoisted(() => ({ origens: vi.fn(), reconhecer: vi.fn() }));
vi.mock('../../src/db.js', () => ({ prisma: { aplicacaoProduto: { findMany: mocks.origens } } }));
vi.mock('../../src/services/pecuaria/protocolos/manejos-correcao.js', () => ({ reconhecerInsercaoDispositivo: mocks.reconhecer }));
vi.mock('./base.js', () => ({ sitio: () => 3, uid: () => 1, key: (nome: string) => nome,
  acao: async (_c: unknown, _nome: string, executar: () => Promise<unknown>) => executar() }));
const c = new Contexto({ versao: 1, banco: 'fazendinha_seedatev3', identidade: 'teste', dataBase: '2026-10-24', ids: {}, etapas: [], acoes: [], criadoEm: '2026-10-24T00:00:00Z' }, false);
const tarefa = { id: 'retirada', participanteId: 'participacao', previstaEm: new Date('2026-10-24') };
beforeEach(() => { vi.clearAllMocks(); });
it('reconhece a origem legada sem criar outra aplicação e passa o ID à retirada', async () => {
  mocks.origens.mockResolvedValue([{ id: 'origem', insercaoDispositivoSnapshot: null }]);
  expect(await prepararRetiradaDemonstrativa(c, tarefa)).toMatchObject({ insercaoAplicacaoId: 'origem' });
  expect(mocks.reconhecer).toHaveBeenCalledWith('retirada', expect.objectContaining({ aplicacaoId: 'origem', propriedadeId: 3, cienciaSemNovaBaixa: true }), 1);
  expect(mocks.origens).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tarefa: { execucaoId: 'participacao' }, propriedadeId: 3, status: 'VALIDO' }) }));
});
it('preserva reconhecimento existente na retomada', async () => {
  mocks.origens.mockResolvedValue([{ id: 'origem', insercaoDispositivoSnapshot: { versao: 1 } }]);
  await prepararRetiradaDemonstrativa(c, tarefa);
  expect(mocks.reconhecer).not.toHaveBeenCalled();
});
it.each([{ origens: [] }, { origens: [{ id: 'a' }, { id: 'b' }] }])('recusa origem ausente ou ambígua: %j', async ({ origens }) => {
  mocks.origens.mockResolvedValue(origens);
  await expect(prepararRetiradaDemonstrativa(c, tarefa)).rejects.toThrow('registro ambíguo ou removido');
  expect(mocks.reconhecer).not.toHaveBeenCalled();
});
