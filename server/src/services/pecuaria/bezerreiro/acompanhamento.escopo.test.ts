import type { Prisma } from '@prisma/client';
import { Prisma as PrismaRuntime } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const f = vi.hoisted(() => ({ tx: {} as Record<string, unknown>, auditar: vi.fn(), conferirAnimal: vi.fn() }));
vi.mock('../../../db.js', () => ({ prisma: { $transaction: (executar: (tx: unknown) => unknown) => executar(f.tx) } }));
vi.mock('../transacao.js', () => ({ transacaoPecuaria: (executar: (tx: unknown) => unknown) => executar(f.tx) }));
vi.mock('../fatos.js', () => ({ conferirAnimalNoFato: f.conferirAnimal }));
vi.mock('../rebanho/regras.js', async importar => ({ ...await importar<typeof import('../rebanho/regras.js')>(),
  auditar: f.auditar, travarAnimais: vi.fn() }));

import { acompanharColostragemTx, vincularFornecimentoColostragemTx } from './acompanhamento.js';
import { consultarAcompanhamento, vincularExame } from './consultas.js';

const data = new Date('2026-10-21T00:00:00Z');
const inputB = { animalId: 'cria', criaId: 'cria-parto', propriedadeId: 2, data };
const historicoA = { id: 'acomp-A', animalId: 'cria', propriedadeId: 1, configuracaoId: 'config-A',
  politicaSnapshot: { versao: 1, percentualPesoColostro: '10.00', metaLitros: '4.000' }, criadoPorId: 9,
  exames: [{ exame: { id: 'exame-A' } }], fornecimentos: [{ fornecimento: { id: 'fornecimento-A' } }] };
function banco() {
  return { $executeRaw: vi.fn(), acompanhamentoColostragem: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    configuracaoBezerreiro: { findFirst: vi.fn() }, criaParto: { findFirst: vi.fn(), findUnique: vi.fn() }, vinculoPesagemParto: { findFirst: vi.fn() },
    vinculoFornecimentoColostragem: { findUnique: vi.fn(), create: vi.fn() }, participacaoBezerreiro: { findMany: vi.fn() },
    localizacaoAnimal: { findFirst: vi.fn() }, animal: { findUnique: vi.fn() }, fornecimentoColostro: { findMany: vi.fn() },
    exameAnimal: { findFirst: vi.fn() }, exameImunidadeColostragem: { create: vi.fn() }, requisicaoPecuaria: { findUnique: vi.fn(), create: vi.fn() } };
}
let tx: ReturnType<typeof banco>;
let registros: Map<string, Record<string, unknown>>;
const db = () => tx as unknown as Prisma.TransactionClient;
beforeEach(() => {
  vi.clearAllMocks(); tx = banco(); f.tx = tx;
  registros = new Map([['cria:1', structuredClone(historicoA)]]);
  tx.acompanhamentoColostragem.findUnique.mockImplementation(async ({ where }: { where: { animalId?: string; animalId_propriedadeId?: { animalId: string; propriedadeId: number } } }) => {
    const identidade = where.animalId_propriedadeId;
    return identidade ? registros.get(`${identidade.animalId}:${identidade.propriedadeId}`) ?? null
      : [...registros.values()].find(a => a.animalId === where.animalId) ?? null;
  });
  tx.acompanhamentoColostragem.findFirst.mockImplementation(async ({ where }: { where: { animalId: string; propriedadeId: number } }) => registros.get(`${where.animalId}:${where.propriedadeId}`) ?? null);
  tx.acompanhamentoColostragem.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    const criado = { ...data, id: `acomp-${data.propriedadeId}`, exames: [], fornecimentos: [] };
    registros.set(`${data.animalId}:${data.propriedadeId}`, criado); return criado;
  });
  tx.configuracaoBezerreiro.findFirst.mockResolvedValue({ id: 'config-B', propriedadeId: 2, versao: 3,
    percentualPesoColostro: new PrismaRuntime.Decimal(20), imunidade: { tipoExameId: 'tipo-B' } });
  tx.criaParto.findFirst.mockResolvedValue({ id: 'cria-parto', filiacaoSnapshot: { pesoKg: 40 } });
  tx.criaParto.findUnique.mockResolvedValue({ id: 'cria-parto', filiacaoSnapshot: { pesoKg: 40 } });
  tx.vinculoFornecimentoColostragem.create.mockImplementation(async ({ data }) => data);
  tx.participacaoBezerreiro.findMany.mockResolvedValue([]); tx.localizacaoAnimal.findFirst.mockResolvedValue({ propriedadeId: 2 });
  tx.animal.findUnique.mockResolvedValue({ id: 'cria', brinco: '001', nome: 'Cria', dataNascimento: data });
  tx.fornecimentoColostro.findMany.mockResolvedValue([]);
  tx.exameAnimal.findFirst.mockResolvedValue({ id: 'exame-B', animalId: 'cria', propriedadeId: 2, data,
    status: 'VALIDO', formatoSnapshot: { versao: 'formato-B' } });
  tx.exameImunidadeColostragem.create.mockImplementation(async ({ data }) => ({ id: 'vinculo-exame-B', ...data }));
});

describe('acompanhamento da cria por sítio após transferência', () => {
  it('cria acompanhamento B para fornecimento novo e conserva ID, política, autor e vínculos de A', async () => {
    const vinculo = await vincularFornecimentoColostragemTx(db(), { ...inputB, fornecimentoId: 'fornecimento-B' }, 12);
    expect(vinculo).toMatchObject({ acompanhamentoId: 'acomp-2', fornecimentoId: 'fornecimento-B', criadoPorId: 12 });
    expect(registros.get('cria:1')).toEqual(historicoA);
    expect(registros.get('cria:2')).toMatchObject({ id: 'acomp-2', propriedadeId: 2, configuracaoId: 'config-B', criadoPorId: 12,
      politicaSnapshot: { versao: 3, percentualPesoColostro: '20.00', metaLitros: '8.000' } });
    tx.configuracaoBezerreiro.findFirst.mockClear();
    const reuso = await acompanharColostragemTx(db(), inputB, 13);
    expect(reuso.id).toBe('acomp-2'); expect(reuso.criadoPorId).toBe(12);
    expect(tx.acompanhamentoColostragem.create).toHaveBeenCalledTimes(1);
    expect(tx.configuracaoBezerreiro.findFirst).not.toHaveBeenCalled();
  });

  it('vincula exame em B ao acompanhamento de B sem reclassificar o histórico de A', async () => {
    await vincularExame({ chave: 'exame-comando-B', propriedadeId: 2, animalId: 'cria', exameId: 'exame-B' }, 12);
    expect(tx.exameImunidadeColostragem.create).toHaveBeenCalledWith({ data: expect.objectContaining({ acompanhamentoId: 'acomp-2', exameId: 'exame-B', criadoPorId: 12 }) });
    expect(f.conferirAnimal).toHaveBeenCalledWith(db(), 'cria', 2, data);
    expect(registros.get('cria:1')).toEqual(historicoA);
  });

  it('consulta B sem devolver acompanhamento, exames ou fornecimentos de A', async () => {
    const antes = await consultarAcompanhamento('cria', 2);
    expect(antes.acompanhamento).toBeNull(); expect(antes.exames).toEqual([]);
    await acompanharColostragemTx(db(), inputB, 12);
    const depois = await consultarAcompanhamento('cria', 2);
    expect(depois.acompanhamento?.id).toBe('acomp-2');
    expect(JSON.stringify(depois)).not.toMatch(/acomp-A|exame-A|fornecimento-A|config-A/);
    expect(tx.acompanhamentoColostragem.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { animalId: 'cria', propriedadeId: 2 } }));
    expect(tx.fornecimentoColostro.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { propriedadeId: 2, cria: { animalId: 'cria' } } }));
  });

  it('não concede acesso a B só porque existe histórico em A', async () => {
    tx.localizacaoAnimal.findFirst.mockResolvedValue(null);
    await expect(consultarAcompanhamento('cria', 2)).rejects.toMatchObject({ code: 'NAO_ENCONTRADO' });
    expect(tx.fornecimentoColostro.findMany).not.toHaveBeenCalled();
  });
});
