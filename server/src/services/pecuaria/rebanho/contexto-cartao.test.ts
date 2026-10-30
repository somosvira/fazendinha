import { describe, it, expect, vi } from 'vitest';
import { completarContextoCartoes } from './contexto-cartao.js';
vi.mock('../reproducao/contexto-animal.js', () => ({ obterContextosAnimaisNaDataTx: vi.fn(async () => new Map([['ativa', { situacaoProdutiva: 'LACTANTE', del: 4, diasPosParto: 4, idadeGestacionalDias: null, pendencias: [] }]])) }));
import { obterContextosAnimaisNaDataTx } from '../reproducao/contexto-animal.js';
describe('contexto dos cartões', () => {
    it('consulta em lote só fêmeas ativas da página e limita ocorrências ao sítio autorizado', async () => {
        const findMany = vi.fn(async () => [{ animalId: 'ativa', id: 'o1', inicio: new Date('2026-10-26'), doencaNomeSnapshot: 'Nome histórico', doenca: { nome: 'Nome atual' } }]);
        const leitor = { ocorrenciaSanitaria: { findMany } };
        const animais = [{ id: 'ativa', sexo: 'F', situacao: 'ATIVO' }, { id: 'baixa', sexo: 'F', situacao: 'BAIXADO' }, { id: 'macho', sexo: 'M', situacao: 'ATIVO' }] as const;
        const dados = await completarContextoCartoes(leitor as never, animais, new Date('2026-10-30'), 1);
        expect(vi.mocked(obterContextosAnimaisNaDataTx).mock.calls.at(-1)?.[1]).toEqual(['ativa']);
        expect(findMany.mock.calls[0]).toEqual([{ where: { animalId: { in: ['ativa'] }, propriedadeId: 1, status: 'VALIDO', fim: null, inicio: { lte: new Date('2026-10-30') } }, select: expect.any(Object), orderBy: expect.any(Array) }]);
        expect(dados.get('ativa')?.ocorrencias[0].nome).toBe('Nome histórico');
        expect(dados.has('baixa')).toBe(false);
        expect(dados.has('macho')).toBe(false);
    });
    it('não consulta fatos quando a página não contém fêmeas ativas', async () => {
        const findMany = vi.fn();
        expect((await completarContextoCartoes({ ocorrenciaSanitaria: { findMany } } as never, [], new Date(), null)).size).toBe(0);
        expect(findMany).not.toHaveBeenCalled();
    });
});
