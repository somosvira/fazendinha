import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import { registrarToqueAptidaoSchema } from '../../src/services/pecuaria/reproducao/toque-aptidao.schemas.js';
import { decidirElegibilidadeCicloSchema } from '../../src/services/pecuaria/reproducao/elegibilidade.schemas.js';

const dados = vi.hoisted(() => ({
  exames: [] as Array<{ id: string; animalId: string; propriedadeId: number; data: Date; finalidadePrincipal: string; resultadoOpcao: string; status: string }>,
  decisoes: [] as Array<{ id: string; input: unknown; usuarioId: number | null }>,
  requisicoes: new Set<string>(), falharDecisao: false,
}));
vi.mock('../../src/db.js', () => ({ prisma: {
  exameAnimal: { findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => dados.exames.find(e => Object.entries(where).every(([campo, valor]) => valor instanceof Date ? e[campo as keyof typeof e] instanceof Date && (e[campo as keyof typeof e] as Date).getTime() === valor.getTime() : e[campo as keyof typeof e] === valor)) ?? null) },
  requisicaoPecuaria: { findUnique: vi.fn(async ({ where }: { where: { chave: string } }) => dados.requisicoes.has(where.chave) ? { chave: where.chave } : null) },
} }));
vi.mock('../../src/services/pecuaria/reproducao/toque-aptidao.js', () => ({
  registrarToqueAptidao: async (input: z.infer<typeof registrarToqueAptidaoSchema>, usuarioId: number | null) => {
    const valido = registrarToqueAptidaoSchema.parse(input);
    if (usuarioId !== 7) throw new Error('Autoria demonstrativa alterada');
    const exame = { id: '00000000-0000-4000-a000-000000000049', animalId: valido.animalId, propriedadeId: valido.propriedadeId, data: new Date(`${valido.data}T00:00:00Z`), finalidadePrincipal: 'APTIDAO_REPRODUTIVA', resultadoOpcao: valido.resultado, status: 'VALIDO' };
    dados.exames.push(exame); dados.requisicoes.add(valido.chave); return exame;
  },
}));
vi.mock('../../src/services/pecuaria/reproducao/elegibilidade.js', () => ({
  decidirElegibilidadeCiclo: async (input: z.infer<typeof decidirElegibilidadeCicloSchema>, usuarioId: number | null) => {
    decidirElegibilidadeCicloSchema.parse(input);
    if (!dados.exames.some(e => e.id === input.exameAptidaoId)) throw new Error('Liberação exige toque de aptidão apto');
    if (dados.falharDecisao) throw new Error('Interrupção após exame');
    const decisao = { id: 'decisao-49', input, usuarioId }; dados.decisoes.push(decisao); dados.requisicoes.add(input.chave); return decisao;
  },
}));

import { ContextoSeed, chave, type Manifesto } from './contexto.js';
import { liberarNovilhaSeed } from './reproducao.js';
import { tabelaReferencia } from './referencias.js';
const cicloId = '00000000-0000-4000-a000-000000000001';
function contexto() {
  const manifesto: Manifesto = { versao: 1, banco: 'fazendinha_seedatev3', identidade: 'teste-unitario', baseline: { nome: 'base', checksum: 'a'.repeat(64) }, fuso: 'America/Sao_Paulo', dataBase: '2026-10-29', ids: {
    'usuario:dono': '7', 'sitio:Principal': '3', 'animal:49': '00000000-0000-4000-a000-000000000002',
  }, etapas: [], acoes: [], criadoEm: '2026-10-29T12:00:00Z' };
  const c = new ContextoSeed(manifesto, false); vi.spyOn(c, 'salvar').mockResolvedValue(); return c;
}
beforeEach(() => { dados.exames.length = 0; dados.decisoes.length = 0; dados.requisicoes.clear(); dados.falharDecisao = false; });
describe('liberação demonstrativa com evidência clínica, sem banco', () => {
  it('cria toque apto antes da decisão, com ciclo, data, ação e PEV explícitos', async () => {
    const c = contexto(); await liberarNovilhaSeed(c, cicloId);
    expect(dados.exames).toHaveLength(1); expect(dados.decisoes).toHaveLength(1);
    expect(dados.exames[0]).toMatchObject({ animalId: c.id('animal:49'), propriedadeId: 3, data: new Date('2026-09-29T00:00:00Z'), resultadoOpcao: 'APTO', finalidadePrincipal: 'APTIDAO_REPRODUTIVA' });
    expect(dados.decisoes[0]).toMatchObject({ usuarioId: 7, input: { vinculoCicloId: cicloId, propriedadeId: 3, data: '2026-09-29', aptaDesde: '2026-09-29', tipo: 'LIBERAR', exameAptidaoId: dados.exames[0].id, acaoLiberada: 'IA', anteciparPev: false } });
    expect(c.id('exameFato:aptidao:49')).toBe(dados.exames[0].id);
    expect(tabelaReferencia('exameFato:aptidao:49')).toBe('exameFato');
  });
  it('retoma interrupção após o exame sem duplicá-lo e conserva sua referência', async () => {
    const c = contexto(); dados.falharDecisao = true;
    await expect(liberarNovilhaSeed(c, cicloId)).rejects.toThrow('Interrupção após exame');
    const exameId = c.id('exameFato:aptidao:49');
    expect(c.manifesto.acoes).not.toContain('liberacao:49');
    dados.falharDecisao = false; await liberarNovilhaSeed(c, cicloId); await liberarNovilhaSeed(c, cicloId);
    expect(dados.exames).toHaveLength(1); expect(dados.decisoes).toHaveLength(1);
    expect(c.id('exameFato:aptidao:49')).toBe(exameId);
  });
  it('recupera exame gravado antes de persistir sua referência no manifesto', async () => {
    const c = contexto(); dados.falharDecisao = true;
    await expect(liberarNovilhaSeed(c, cicloId)).rejects.toThrow('Interrupção após exame');
    delete c.manifesto.ids['exameFato:aptidao:49'];
    dados.falharDecisao = false; await liberarNovilhaSeed(c, cicloId);
    expect(dados.exames).toHaveLength(1); expect(dados.decisoes).toHaveLength(1);
    expect(c.id('exameFato:aptidao:49')).toBe(dados.exames[0].id);
  });
  it.each(['manifesto', 'requisicao'] as const)('preserva liberação legada concluída no %s sem criar toque retroativo', async (origem) => {
    const c = contexto(); const original = { id: 'legado', input: { tipo: 'LIBERAR', exameAptidaoId: null }, usuarioId: 11 };
    dados.decisoes.push(original);
    if (origem === 'manifesto') c.manifesto.acoes.push('liberacao:49'); else dados.requisicoes.add(chave('liberacao:49'));
    await liberarNovilhaSeed(c, cicloId);
    expect(dados.exames).toHaveLength(0); expect(dados.decisoes).toEqual([original]);
    expect(c.manifesto.ids['exameFato:aptidao:49']).toBeUndefined();
  });
  it('não recria exame removido após interrupção', async () => {
    const c = contexto(); dados.falharDecisao = true;
    await expect(liberarNovilhaSeed(c, cicloId)).rejects.toThrow('Interrupção após exame');
    dados.falharDecisao = false; dados.exames.length = 0;
    await expect(liberarNovilhaSeed(c, cicloId)).rejects.toThrow('removido ou divergiu');
    expect(dados.exames).toHaveLength(0); expect(dados.decisoes).toHaveLength(0);
  });
});
