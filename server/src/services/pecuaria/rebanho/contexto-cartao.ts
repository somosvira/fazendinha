import type { Prisma } from '@prisma/client';
import { obterContextosAnimaisNaDataTx } from '../reproducao/contexto-animal.js';
import { mapearContextoProdutivoFicha, type ContextoProdutivoFicha } from './mappers.js';
export interface ContextoCartaoAnimal {
    produtivo: ContextoProdutivoFicha | null;
    ocorrencias: Array<{
        id: string;
        nome: string;
        inicio: string;
    }>;
}
type Leitor = Parameters<typeof obterContextosAnimaisNaDataTx>[0] & Pick<Prisma.TransactionClient, 'ocorrenciaSanitaria'>;
/** O chamador entrega somente os animais já autorizados e paginados. Não consulta ficha por animal. */
export async function completarContextoCartoes(tx: Leitor, animais: readonly {
    id: string;
    sexo: string;
    situacao: string;
}[], hoje: Date, propriedadeId: number | null): Promise<Map<string, ContextoCartaoAnimal>> {
    const ids = animais.filter(a => a.sexo === 'F' && a.situacao === 'ATIVO').map(a => a.id);
    if (!ids.length)
        return new Map();
    const [contextos, ocorrencias] = await Promise.all([
        obterContextosAnimaisNaDataTx(tx, ids, hoje),
        tx.ocorrenciaSanitaria.findMany({ where: { animalId: { in: ids }, ...(propriedadeId != null ? { propriedadeId } : {}), status: 'VALIDO', fim: null, inicio: { lte: hoje } }, select: { id: true, animalId: true, inicio: true, doencaNomeSnapshot: true, doenca: { select: { nome: true } } }, orderBy: [{ inicio: 'desc' }, { id: 'asc' }] }),
    ]);
    const porAnimal = new Map<string, ContextoCartaoAnimal['ocorrencias']>();
    for (const o of ocorrencias) {
        const lista = porAnimal.get(o.animalId) ?? [];
        lista.push({ id: o.id, nome: o.doencaNomeSnapshot ?? o.doenca.nome, inicio: o.inicio.toISOString().slice(0, 10) });
        porAnimal.set(o.animalId, lista);
    }
    return new Map(ids.map(id => [id, { produtivo: contextos.has(id) ? mapearContextoProdutivoFicha(contextos.get(id)!) : null, ocorrencias: porAnimal.get(id) ?? [] }]));
}
